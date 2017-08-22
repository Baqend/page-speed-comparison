const url = require('url');
const API = require('./Pagetest').API;
const credentials = require('./credentials');
const Limiter = require('./rateLimiter');
const download = require('./download');
const countHits = require('./countHits').countHits;
const activityTimeout = 100;
const timeout = 30;
const ttl = 86000/2;


exports.call = function (db, data, req) {
  //Check if IP is rate-limited
  if (Limiter.isRateLimited(req)) {
    return {error: 'Too many requests!'};
  }

  const testUrl = data.url;
  const testLocation = data.location;
  const isClone = data.isClone;
  const caching = data.caching;
  const speedKit = data.speedKit;
  const testResult = new db.TestResult();
  testResult.id = db.util.uuid();

  const testOptions = {
    connectivity: 'Native',
    location: testLocation,
    firstViewOnly: !caching,
    runs: 1,
    video: true,
    disableOptimization: true,
    pageSpeed: false,
    requests: false,
    breakDown: false,
    domains: false,
    saveResponseBodies: false,
    tcpDump: false,
    timeline: true, //TODO: only for debugging
    priority: 0,
    duration: 1, //capture at least one second
    chromeTrace: false,
    netLog: false,
    disableHTTPHeaders: true,
    disableScreenshot: true,
    block: 'favicon', //exclude favicons for fair comparison, as not handled by SWs
    jpegQuality: 100,
    poll: 1, //poll every second
    timeout: 2 * timeout //set timeout
  };

  const requirePrewarm = isClone;

  const testScript = createTestScript(testUrl, data);

  Promise.resolve().then(() => {
    if (requirePrewarm) {
      const prewarmOptions = Object.assign({}, testOptions, {
        video: false,
        firstViewOnly: true
      });

      return API.runTest(testUrl, prewarmOptions).then((testId) => {
        return getPrewarmResult(db, testId);
      });
    }
  }).then(ttfb => {
    return API.runTest(testScript, testOptions).then(testId => {
      return getTestResult(db, testResult, testId, ttfb);
    }).then(() => {
      db.log.info(`Test completed, id: ${testResult.id}, testId: ${testResult.testId} script:\n${testScript}`);
    }).catch((e) => {
      db.log.warn(`Test failed, id: ${testResult.id}, testId: ${testResult.testId} script:\n${testScript}`);
    });
  });

  return {baqendId: testResult.key};
};

function createTestScript(testUrl, options) {
  let hostname;
  try {
    hostname = url.parse(testUrl).hostname;
  } catch (e) {
    throw new Abort('Invalid Url specified: ' + e.message);
  }

  if (!options.isClone) {
    return `
      block /sw.js /sw.php
      setActivityTimeout ${activityTimeout}
      setTimeout ${timeout}
      #expireCache ${ttl} 
      navigate ${testUrl}
    `;
  }

  //SW always needs to be installed
  const installSW = `
    logData 0
    setTimeout ${timeout}	
    blockDomainsExcept ${hostname}	
    navigate ${testUrl}&noCaching=true&blockExternal=true
    blockDomainsExcept
    navigate about:blank
    clearcache
    logData 1
  `;

  return `
    setActivityTimeout ${activityTimeout}
    ${installSW}
    setTimeout ${timeout}	
    navigate ${testUrl}
  `;
}

function getPrewarmResult(db, testId) {
  return API.getTestResults(testId, {
    requests: false,
    breakdown: false,
    domains: false,
    pageSpeed: false,
  }).then(result => {
    const ttfb = result.data.runs['1'].firstView.TTFB;
    db.log.info('TTFB of prewarm: ' + ttfb + ' with testId ' + testId, result.data.runs['1'].firstView);
    return ttfb;
  });
}

function getTestResult(db, testResult, testId, ttfb) {
  db.log.info('Pingback received for ' + testId);

  if (testResult.firstView) {
    db.log.info('Result already exists for ' + testId);
    return;
  }

  testResult.testId = testId;

  const options = {
    requests: true,
    breakdown: false,
    domains: false,
    pageSpeed: false,
  };

  return API.getTestResults(testId, options).then(result => {
    db.log.info('Saving test result for ' + testId, result.data);

    createTestResult(testResult, result.data, ttfb, db);
    return testResult.save();
  }).then(ignored => {
    if(testResult.testDataMissing)
      throw new Error('Test Data Missing');

    db.log.info('creating video for ' + testId);
    return Promise.all([API.createVideo(testId + '-r:1-c:0'), API.createVideo(testId + '-r:1-c:1')]);
  }).then(result => {
    db.log.info('videos created for ' + testId);

    testResult.videoIdFirstView = result[0].data.videoId;
    const videoFirstViewPromise = download.toFile(db,
      constructVideoLink(testId, testResult.videoIdFirstView), '/www/videoFirstView/' + testId + '.mp4');

    let videoRepeatViewPromise = Promise.resolve(true);
    if (result[1].data && result[1].data.videoId) {
      testResult.videoIdRepeatedView = result[1].data.videoId;
      videoRepeatViewPromise = download.toFile(db,
        constructVideoLink(testId, testResult.videoIdRepeatedView), '/www/videoRepeatView/' + testId + '.mp4');
    }

    return Promise.all([videoFirstViewPromise, videoRepeatViewPromise]).then((values) => {
      const [videoFirstView, videoRepeatView] = values;
      testResult.videoFileFirstView = videoFirstView;
      testResult.videoFileRepeatView = videoRepeatView;
      return testResult.save();
    });
  });
}

function constructVideoLink(testId, videoId) {
  const date = testId.substr(0, 2) + '/' + testId.substr(2, 2) + '/' + testId.substr(4, 2);
  return 'http://' + credentials.wpt_dns + '/results/video/' + date + '/' +
    videoId.substr(videoId.indexOf('_') + 1, videoId.length) + '/video.mp4';
}

function createTestResult(testObject, testResult, ttfb, db) {
  testObject.location = testResult.location;
  testObject.url = testResult.testUrl;
  testObject.summaryUrl = testResult.summary;
  testObject.firstView = createRun(testResult.runs['1'].firstView, ttfb, db);
  testObject.testDataMissing = testObject.firstView.lastVisualChange <= 0;
  if (testResult.runs['1'].repeatView) {
    testObject.repeatView = createRun(testResult.runs['1'].repeatView, ttfb, db);
    testObject.testDataMissing = testObject.repeatView.lastVisualChange <= 0;
  }
  db.log.info('First and repeat view ', [testObject.firstView, testObject.repeatView]);
  return testObject;
}

function createRun(data, ttfb, db) {
  const run = new db.Run();
  run.loadTime = data.loadTime;
  run.ttfb = ttfb ? ttfb : data.TTFB;
  run.domLoaded = data.domContentLoadedEventStart;
  run.load = data.loadEventStart;
  run.fullyLoaded = data.fullyLoaded;
  run.firstPaint = data.firstPaint;
  run.startRender = data.render;
  run.lastVisualChange = data.lastVisualChange;
  run.speedIndex = data.SpeedIndex;
  run.requests = data.requests.length;
  run.hits = new db.Hits(countHits(data));
  run.bytes = data.bytesOut;
  run.domElements = data.domElements;
  run.basePageCDN = data.base_page_cdn;
  const completeness = new db.Completeness();
  completeness.p85 = data.visualComplete85;
  completeness.p90 = data.visualComplete90;
  completeness.p95 = data.visualComplete95;
  completeness.p99 = data.visualComplete99;
  completeness.p100 = data.visualComplete;
  run.visualCompleteness = completeness;
  return run;
}