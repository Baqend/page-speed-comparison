/* eslint-disable comma-dangle, no-use-before-define, no-restricted-syntax */
/* global Abort */
const { parse } = require('url');
const { API } = require('./Pagetest');
const credentials = require('./credentials');
const { isRateLimited } = require('./rateLimiter');
const { getAdSet } = require('./adBlocker');
const { toFile } = require('./download');
const { countHits } = require('./countHits');

const DEFAULT_LOCATION = 'eu-central-1:Chrome.Native';
const DEFAULT_ACTIVITY_TIMEOUT = 75;
const DEFAULT_TIMEOUT = 30;
const DEFAULT_TTL = 86000 / 2;

exports.call = function callQueueTest(db, data, req) {
  // Check if IP is rate-limited
  if (isRateLimited(req)) {
    throw new Abort({ message: 'Too many requests', status: 429 });
  }

  return queueTest(Object.assign({}, { db }, data))
    .then(testResult => ({ baqendId: testResult.key }));
};

/**
 * @param db The Baqend instance.
 * @param test The test which erred.
 * @param {string} testScript The script which was executed.
 * @param {Error} error The error thrown.
 */
function handleTestError(db, test, testScript, error) {
  const testToUpdate = test;
  db.log.warn(`Test failed, id: ${test.id}, testId: ${test.testId} script:\n${testScript}\n\n${error.stack}`);
  return test.ready()
    .then(() => {
      // Save that test has finished without data
      testToUpdate.testDataMissing = true;
      testToUpdate.hasFinished = true;
      return testToUpdate.save();
    });
}

/**
 * @param db The Baqend instance.
 * @param {string} testUrl
 * @param {string} location
 * @param {boolean} isClone
 * @param {boolean} isCachingDisabled
 * @param {number} activityTimeout
 * @param {boolean} isSpeedKitComparison
 * @param {boolean} mobile
 * @param {function} callback
 * @return {string}
 * @deprecated Use queueTest.
 */
function startTest(
  db,
  testUrl,
  location,
  isClone,
  isCachingDisabled = true,
  activityTimeout = DEFAULT_ACTIVITY_TIMEOUT,
  isSpeedKitComparison = false,
  mobile = false,
  callback = null
) {
  // Create a new test result
  const pendingTest = new db.TestResult();
  pendingTest.id = db.util.uuid();

  const testOptions = {
    firstViewOnly: isCachingDisabled,
    runs: 1,
    video: true,
    disableOptimization: true,
    pageSpeed: false,
    requests: false,
    breakDown: false,
    domains: false,
    saveResponseBodies: false,
    tcpDump: false,
    timeline: true, // TODO: only for debugging
    priority: 0,
    minimumDuration: 1, // capture at least one second
    chromeTrace: false,
    netLog: false,
    disableHTTPHeaders: true,
    disableScreenshot: true,
    block: 'favicon', // exclude favicons for fair comparison, as not handled by SWs
    jpegQuality: 100,
    poll: 1, // poll every second
    timeout: 2 * DEFAULT_TIMEOUT, // set timeout
    device: mobile ? 'iPhone6' : '',
    mobile,
    location,
  };

  const requirePrewarm = isClone;

  let testScript = createTestScript(testUrl, isClone, isCachingDisabled, activityTimeout, isSpeedKitComparison, false);

  Promise.resolve()
    .then(() => {
      if (!requirePrewarm) {
        return null;
      }

      const prewarmOptions = Object.assign({}, testOptions, {
        runs: 2,
        timeline: false,
        video: false,
        firstViewOnly: true,
        minimalResults: true,
      });

      return API.runTest(testUrl, prewarmOptions, db)
        .then(testId => getPrewarmResult(db, testId, isSpeedKitComparison));
    })
    .then(ttfbFromPrewarm => API.runTestWithoutWait(testScript, testOptions)
      .then((testId) => {
        db.log.info(`Test started, testId: ${testId} script:\n${testScript}`);
        pendingTest.testId = testId;
        pendingTest.ready().then(() => pendingTest.save());
        return API.waitOnTest(testId, db);
      })
      .then(testId => getTestResult(db, pendingTest, testId, ttfbFromPrewarm))
      .catch(error => {
        db.log.info(`First try failed. Second try for: ${pendingTest.testId}`);

        testScript = createTestScript(testUrl, isClone, isCachingDisabled, activityTimeout, isSpeedKitComparison, true);
        return API.runTestWithoutWait(testScript, testOptions)
          .then((testId) => {
            db.log.info(`Second try started, testId: ${testId} script:\n${testScript}`);
            pendingTest.testId = testId;
            pendingTest.hasFinished = false;
            pendingTest.retryRequired = true;
            pendingTest.ready().then(() => pendingTest.save());
            return API.waitOnTest(testId, db);
          })
          .then(testId => {
            db.log.info(`Getting Test result of second try: ${testId} script:\n${testScript}`);
            return getTestResult(db, pendingTest, testId, ttfbFromPrewarm);
          });
      }))
    .then((result) => {
      db.log.info(`Test completed, id: ${result.id}, testId: ${result.testId} script:\n${testScript}`);
      return result;
    })
    .catch(error => handleTestError(db, pendingTest, testScript, error))
    // Trigger the callback
    .then(updatedResult => callback && callback(updatedResult));

  return pendingTest.ready().then(() => pendingTest.save());
}

/**
 * @param {string} testUrl
 * @param {boolean} isClone
 * @param {boolean} isCachingDisabled
 * @param {number} activityTimeout
 * @param {boolean} isSpeedKitComparison
 * @param {boolean} secondTry Whether this is the second try to execute the test.
 * @return {string}
 */
function createTestScript(testUrl, isClone, isCachingDisabled, activityTimeout, isSpeedKitComparison, secondTry) {
  let hostname;
  try {
    ({ hostname } = parse(testUrl));
  } catch (e) {
    throw new Abort(`Invalid Url specified: ${e.message}`);
  }

  // Patch for campaigns-business.sites.toyota.pl
  if (testUrl && testUrl.includes('campaigns-business.sites.toyota.pl')) {
    if (isClone) {
      return `logData 0
setDNSName  campaigns-business.sites.toyota.pl pl-clone.app.baqend.com
overrideHost  campaigns-business.sites.toyota.pl pl-clone.app.baqend.com
setHeader	Referer: https://campaigns-business.sites.toyota.pl/

navigate	https://campaigns-business.sites.toyota.pl/speedKitInstaller.html
navigate	about:blank
logData 1
navigate	https://campaigns-business.sites.toyota.pl/#/pl`;
    } else {
      // Without DNS
//       return `logData 0
// setHeader Connection:close
// navigate	https://campaigns-business.sites.toyota.pl/views/race-slider.html
// navigate	https://static.sites.toyota.pl/projects/reliability/toy_no_1.png
// navigate	about:blank
// clearCache
// resetHeaders
// logData 1
// navigate	https://campaigns-business.sites.toyota.pl/#/pl`;
      // With DNS
      return `navigate	https://campaigns-business.sites.toyota.pl/#/pl`;
    }
  }

  // Patch for campaigns-business.sites.toyota.pl
  if (isClone && testUrl && testUrl.includes('de.mycs.com') && testUrl.includes('schraenke') && testUrl.includes('sideboards')) {
      return `logData 0
navigate	https://mycs-demo.app.baqend.com/speedKitInstaller.html
navigate	about:blank
logData 1
navigate	https://mycs-demo.app.baqend.com/schraenke/sideboards/`;
  }

  if (!isClone) {
    return `
      block /sw.js /sw.php
      setActivityTimeout ${activityTimeout}
      setTimeout ${DEFAULT_TIMEOUT}
      #expireCache ${DEFAULT_TTL} 
      navigate ${testUrl}
    `;
  }

  let installNavigation = `${testUrl}&noCaching=true&blockExternal=true`;
  if (!isCachingDisabled) {
    [installNavigation] = testUrl.split('#');
  }

  // SW always needs to be installed
  let installSW = `
    logData 0
    setTimeout ${DEFAULT_TIMEOUT}
    ${isSpeedKitComparison ? `blockDomainsExcept ${hostname}` : ''}
    navigate ${installNavigation}
    ${isSpeedKitComparison ? 'blockDomainsExcept' : ''}
    navigate about:blank
    ${isCachingDisabled ? 'clearcache' : ''}
    logData 1
  `;

  if (secondTry && !isSpeedKitComparison) {
    installSW = `
    logData 0
    setTimeout ${DEFAULT_TIMEOUT}
    navigate ${testUrl.substr(0, testUrl.indexOf('#'))}
    navigate about:blank
    ${isCachingDisabled ? 'clearcache' : ''}
    logData 1
  `;
  }

  return `
    setActivityTimeout ${activityTimeout}
    ${installSW}
    setTimeout ${DEFAULT_TIMEOUT}
    navigate ${testUrl}
  `;
}

/**
 * @param db The Baqend instance.
 * @param {string} testId
 * @param {boolean} isSpeedKitComparison
 */
function getPrewarmResult(db, testId, isSpeedKitComparison) {
  return API.getTestResults(testId, {
    requests: false,
    breakdown: false,
    domains: false,
    pageSpeed: false,
  }).then((result) => {
    const ttfb = isSpeedKitComparison ? result.data.runs['2'].firstView.TTFB : result.data.runs['1'].firstView.TTFB;
    db.log.info(`TTFB of prewarm: ${ttfb} with testId ${testId}`, result.data.runs['1'].firstView);
    return ttfb;
  });
}

/**
 * @param db The Baqend instance.
 * @param originalResult
 * @param {string} testId
 * @param {string} ttfb
 * @return {Promise<object>} A promised test result.
 */
function getTestResult(db, originalResult, testId, ttfb) {
  const testResult = originalResult;
  db.log.info(`Pingback received for ${testId}`);

  if (testResult.firstView && !testResult.testDataMissing) {
    db.log.info(`Result already exists for ${testId}`);
    return Promise.resolve(testResult);
  }

  testResult.testId = testId;

  const options = {
    requests: true,
    breakdown: false,
    domains: false,
    pageSpeed: false,
  };

  return API.getTestResults(testId, options).then((result) => {
    db.log.info(`Saving test result for ${testId}`);
    return createTestResult(db, testResult, result.data, ttfb);
  }).then(() => {
    if (testResult.testDataMissing) {
      throw new Error('Test Data Missing');
    }

    db.log.info(`creating video for ${testId}`);
    return Promise.all([API.createVideo(`${testId}-r:1-c:0`), API.createVideo(`${testId}-r:1-c:1`)]);
  }).then((result) => {
    db.log.info(`videos created for ${testId}`);

    testResult.videoIdFirstView = result[0].data.videoId;
    const videoFirstViewPromise = toFile(db, constructVideoLink(testId, testResult.videoIdFirstView), `/www/videoFirstView/${testId}.mp4`);

    let videoRepeatViewPromise = Promise.resolve(true);
    if (result[1].data && result[1].data.videoId) {
      testResult.videoIdRepeatedView = result[1].data.videoId;
      videoRepeatViewPromise = toFile(db, constructVideoLink(testId, testResult.videoIdRepeatedView), `/www/videoRepeatView/${testId}.mp4`);
    }

    return Promise.all([videoFirstViewPromise, videoRepeatViewPromise]).then((values) => {
      const [videoFirstView, videoRepeatView] = values;
      testResult.videoFileFirstView = videoFirstView;
      testResult.videoFileRepeatView = videoRepeatView;
      return testResult.save();
    });
  });
}

/**
 * @param {string} testId
 * @param {string} videoId
 * @return {string}
 */
function constructVideoLink(testId, videoId) {
  const date = `${testId.substr(0, 2)}/${testId.substr(2, 2)}/${testId.substr(4, 2)}`;
  const videoLink = videoId.substr(videoId.indexOf('_') + 1, videoId.length);
  return `http://${credentials.wpt_dns}/results/video/${date}/${videoLink}/video.mp4`;
}

/**
 * @param db The Baqend instance.
 * @param {object} originalObject
 * @param {object} testResult
 * @param {string} ttfb
 */
function createTestResult(db, originalObject, testResult, ttfb) {
  const testObject = originalObject;
  testObject.location = testResult.location;
  testObject.url = testResult.testUrl;
  testObject.summaryUrl = testResult.summary;

  return createRun(db, testResult.runs['1'].firstView, ttfb).then((firstView) => {
    testObject.firstView = firstView;
    testObject.testDataMissing = testObject.firstView.lastVisualChange <= 0;
    testObject.hasFinished = true;

    if (!testResult.runs['1'].repeatView) {
      return testObject;
    }

    return createRun(db, testResult.runs['1'].repeatView, ttfb).then((repeatView) => {
      testObject.repeatView = repeatView;
      testObject.testDataMissing = testObject.repeatView.lastVisualChange <= 0;
      return testObject;
    });
  });
}

/**
 * @param db The Baqend instance.
 * @param data
 * @param {string} ttfb A TTFB to take instead
 */
function createRun(db, data, ttfb) {
  const run = new db.Run();

  // Copy fields
  for (const field of ['loadTime', 'fullyLoaded', 'firstPaint', 'lastVisualChange', 'domElements']) {
    run[field] = data[field];
  }

  // Search First Meaningful Paint from timing
  const { chromeUserTiming = [] } = data;
  const fmpField = 'firstMeaningfulPaintCandidate';
  const firstMeaningfulPaintObject = chromeUserTiming.reverse().find(entry => entry.name === fmpField);
  run.firstMeaningfulPaint = firstMeaningfulPaintObject ? firstMeaningfulPaintObject.time : 0;

  // Set TTFB
  run.ttfb = ttfb || data.TTFB;

  // Set other
  run.domLoaded = data.domContentLoadedEventStart;
  run.load = data.loadEventStart;
  run.startRender = data.render;
  run.speedIndex = data.SpeedIndex;
  run.requests = data.requests.length;
  run.failedRequests = createFailedRequestsCount(data);
  run.bytes = data.bytesIn;
  run.hits = new db.Hits(countHits(data));
  run.basePageCDN = data.base_page_cdn;

  // Set visual completeness
  const completeness = new db.Completeness();
  completeness.p85 = data.visualComplete85;
  completeness.p90 = data.visualComplete90;
  completeness.p95 = data.visualComplete95;
  completeness.p99 = data.visualComplete99;
  completeness.p100 = data.visualComplete;
  run.visualCompleteness = completeness;

  run.domains = [];

  return createDomainList(data, run);
}

function createFailedRequestsCount(data) {
  let failedRequests = 0;
  data.requests.forEach((request) => {
    if (request.responseCode >= 400) {
      failedRequests += 1;
    }
  });

  return failedRequests;
}

function createDomainList(data, run) {
  return getAdSet().then((adSet) => {
    for (const key of Object.keys(data.domains)) {
      const domainObject = data.domains[key];
      domainObject.isAdDomain = isAdDomain(key, adSet);
      domainObject.url = key;
      run.domains.push(domainObject);
    }

    return run;
  });
}

/**
 * @param {string} url
 * @param {Set<string>} adSet
 * @return {boolean}
 */
function isAdDomain(url, adSet) {
  const index = url.indexOf('.');
  if (index === -1) {
    return false;
  }

  if (adSet.has(url)) {
    return true;
  }

  return isAdDomain(url.substr(index + 1), adSet);
}

/**
 * @param db The Baqend instance.
 * @param {string} url The URL to test.
 * @param {boolean} isClone True, if this is the cloned page.
 * @param {string} [location] The server location to execute the test.
 * @param {boolean} [caching] True, if browser caching should be used.
 * @param {number} [activityTimeout] The timeout when the test should be aborted.
 * @param {boolean} [isSpeedKitComparison] True, if Speed Kit is already running on the tested site.
 * @param {boolean} [mobile] True, if a mobile-only test should be made.
 * @param {function} [finish] A callback which will be called when the test succeeds or fails.
 * @return {string}
 */
function queueTest({
  // Required parameters
  db,
  url,
  isClone,
  // Optional parameters
  location = DEFAULT_LOCATION,
  caching = false,
  activityTimeout = DEFAULT_ACTIVITY_TIMEOUT,
  isSpeedKitComparison = false,
  mobile = false,
  finish = null,
}) {
  return startTest(
    db,
    url,
    location,
    isClone,
    !caching,
    activityTimeout,
    isSpeedKitComparison,
    mobile,
    finish
  );
}

exports.startTest = startTest;
exports.queueTest = queueTest;
exports.DEFAULT_LOCATION = DEFAULT_LOCATION;
