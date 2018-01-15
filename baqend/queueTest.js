/* eslint-disable comma-dangle, no-use-before-define, no-restricted-syntax */
/* global Abort */
const { API } = require('./Pagetest');
const credentials = require('./credentials');
const { isRateLimited } = require('./rateLimiter');
const { getAdSet } = require('./adBlocker');
const { toFile } = require('./download');
const { countHits } = require('./countHits');
const { createTestScript } = require('./createTestScript');
const { analyzeSpeedKit } = require('./analyzeSpeedKit');
const fetch = require('node-fetch');

const DEFAULT_LOCATION = 'eu-central-1:Chrome.Native';
const DEFAULT_ACTIVITY_TIMEOUT = 75;
const DEFAULT_TIMEOUT = 30;

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
 * @param {string|null} testScript The script which was executed.
 * @param {Error} error The error thrown.
 */
function handleTestError(db, test, testScript, error) {
  const testToUpdate = test;
  db.log.warn(`Test failed, id: ${test.id}, testId: ${test.testId} ${testScript !== null ? `script:\n${testScript}` : ''}\n\n${error.stack}`);
  return testToUpdate.ready()
    .then(() => {
      // Save that test has finished without data
      testToUpdate.testDataMissing = true;
      testToUpdate.hasFinished = true;
      return testToUpdate.save();
    });
}

/**
 * @param db The Baqend instance.
 * @param {string} url The URL to test.
 * @param {boolean} isClone True, if this is the cloned page.
 * @param {string} [location] The server location to execute the test.
 * @param {boolean} [caching] True, if browser caching should be used.
 * @param {number} [activityTimeout] The timeout when the test should be aborted.
 * @param {boolean} [isSpeedKitComparison] True, if Speed Kit is already running on the tested site.
 * @param {Object} [speedKitConfig] The speedKit configuration.
 * @param {boolean} [mobile] True, if a mobile-only test should be made.
 * @param {number} [priority=0] Defines the test's priority, from 0 (highest) to 9 (lowest).
 * @param {function} [finish] A callback which will be called when the test succeeds or fails.
 * @return {Promise<TestResult>} A promise resolving when the test has been created.
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
  speedKitConfig = null,
  mobile = false,
  priority = 0,
  finish = null,
}) {
  // Create a new test result
  /** @var {TestResult} pendingTest */
  const pendingTest = new db.TestResult();
  pendingTest.id = db.util.uuid();
  pendingTest.hasFinished = false;
  pendingTest.url = url;
  pendingTest.priority = priority;

  const commandLine = createCommandLineFlags(url, isClone);
  db.log.info('flags: %s', commandLine);
  const runs = isClone ? 3 : 1;
  const testOptions = {
    firstViewOnly: !caching,
    runs,
    commandLine,
    video: true,
    disableOptimization: true,
    pageSpeed: false,
    requests: false,
    breakDown: false,
    domains: false,
    saveResponseBodies: false,
    tcpDump: false,
    timeline: true, // TODO: only for debugging
    minimumDuration: 1, // capture at least one second
    chromeTrace: false,
    netLog: false,
    disableHTTPHeaders: true,
    disableScreenshot: true,
    ignoreSSL: true,
    block: 'favicon', // exclude favicons for fair comparison, as not handled by SWs
    jpegQuality: 100,
    poll: 1, // poll every second
    timeout: 2 * DEFAULT_TIMEOUT, // set timeout
    device: mobile ? 'iPhone6' : '',
    priority,
    mobile,
    location,
  };

  // Get the Speed Kit config from the page if it is already running Speed Kit
  const promise = isSpeedKitComparison ? analyzeSpeedKit(url).then(it => it.config) : Promise.resolve(speedKitConfig);

  promise
    .then(config => createTestScript(url, isClone, isSpeedKitComparison, config, activityTimeout))
    /* .then(() => {
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

      return API.runTest(url, prewarmOptions, db)
        .then(testId => getPrewarmResult(db, testId, isSpeedKitComparison));
    }) */
    .then(testScript => {
      return new Promise((res, rej) => {
        setTimeout(() => res(testScript), isClone ? 5000 : 0);
      });
    })
    .then(testScript => API.runTestWithoutWait(testScript, testOptions)
      .then((testId) => {
        db.log.info(`Test started, testId: ${testId} script:\n${testScript}`);
        pendingTest.testId = testId;
        pendingTest.ready().then(() => {
          if (credentials.app === 'makefast-staging') {
            db.log.info(`Save testId for test: ${pendingTest.testId}`);
          }
          return pendingTest.save();
        });
        return API.waitOnTest(testId, db);
      })
      .then(testId => getTestResult(db, pendingTest, testId))
      /* .catch((e) => {
        db.log.info(`First try failed. Second try for: ${pendingTest.testId}:\n ${e && e.stack}`);

        testScript =
          createTestScript(url, isClone, !caching, activityTimeout, isSpeedKitComparison, true, speedKitConfig);

        return API.runTestWithoutWait(testScript, testOptions)
          .then((testId) => {
            db.log.info(`Second try started, testId: ${testId} script:\n${testScript}`);
            pendingTest.testId = testId;
            pendingTest.hasFinished = false;
            pendingTest.retryRequired = true;
            pendingTest.ready().then(() => pendingTest.save());
            return API.waitOnTest(testId, db);
          })
          .then((testId) => {
            db.log.info(`Getting Test result of second try: ${testId} script:\n${testScript}`);
            return getTestResult(db, pendingTest, testId);
          });
      }) */
      .then((result) => {
        db.log.info(`Test completed, id: ${result.id}, testId: ${result.testId} script:\n${testScript}`);
        return result;
      })
      .catch(error => handleTestError(db, pendingTest, testScript, error)))
    .catch(error => handleTestError(db, pendingTest, null, error))
    // Trigger the callback
    .then(updatedResult => finish && finish(updatedResult));

  return pendingTest.ready().then(() => pendingTest.save());
}

/**
 * @param {string} testUrl
 * @param {boolean} isClone
 * @return {string}
 */
function createCommandLineFlags(testUrl, isClone) {
  const http = 'http://';
  if (isClone && testUrl.startsWith(http)) {
    // origin should looks like http://example.com - without any path components
    const end = testUrl.indexOf('/', http.length);
    const origin = testUrl.substring(0, end === -1 ? testUrl.length : end);
    return `--unsafely-treat-insecure-origin-as-secure="${origin}"`;
  }
  return '';
}

/**
 * @param db The Baqend instance.
 * @param {string} testId
 * @param {boolean} isSpeedKitComparison
 */
/* function getPrewarmResult(db, testId, isSpeedKitComparison) {
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
} */

/**
 * @param db The Baqend instance.
 * @param {TestResult} originalResult
 * @param {string} testId
 * @return {Promise<object>} A promised test result.
 */
function getTestResult(db, originalResult, testId) {
  const testResult = originalResult;
  db.log.info(`Pingback received for ${testId}`);

  if (testResult.hasFinished) {
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

    const lastRunIndex = Object.keys(result.data.runs).pop();

    return createTestResult(db, testResult, result.data, lastRunIndex).then(() => {
      if (testResult.testDataMissing) {
        throw new Error('Test Data Missing');
      }

      db.log.info(`creating video for ${testId}`);
      return Promise.all([
        API.createVideo(`${testId}-r:${lastRunIndex}-c:0`),
        API.createVideo(`${testId}-r:${lastRunIndex}-c:1`),
      ]);
    });
  }).then(([firstVideoResult, repeatedVideoResult]) => {
    db.log.info(`videos created for ${testId}`);

    testResult.videoIdFirstView = firstVideoResult.data.videoId;
    const videoFirstViewPromise = toFile(db, constructVideoLink(testId, testResult.videoIdFirstView), `/www/videoFirstView/${testId}.mp4`);

    let videoRepeatViewPromise = Promise.resolve(true);
    if (repeatedVideoResult.data && repeatedVideoResult.data.videoId) {
      testResult.videoIdRepeatedView = repeatedVideoResult.data.videoId;
      videoRepeatViewPromise = toFile(db, constructVideoLink(testId, testResult.videoIdRepeatedView), `/www/videoRepeatView/${testId}.mp4`);
    }

    return Promise.all([videoFirstViewPromise, videoRepeatViewPromise]).then(([videoFirstView, videoRepeatView]) => {
      testResult.videoFileFirstView = videoFirstView;
      testResult.videoFileRepeatView = videoRepeatView;
      testResult.hasFinished = true;
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
 * @param {TestResult} originalObject
 * @param {{ location: string, testUrl: string, summary: string, runs: Object<string, object> }} testResult
 * @param {string} runIndex the index of the run to use
 * @return {Promise<TestResult>} A promise resolving with the created test result.
 */
function createTestResult(db, originalObject, testResult, runIndex) {
  /** @var {TestResult} testObject */
  const testObject = originalObject;
  testObject.location = testResult.location;
  testObject.url = testResult.testUrl;
  testObject.summaryUrl = testResult.summary;

  return iskWordPress(testResult.testUrl)
    .then((isWordPress) => {
      testObject.isWordPress = isWordPress;

      const lastRun = testResult.runs[runIndex];

      return createRun(db, lastRun.firstView).then((firstView) => {
        testObject.firstView = firstView;
        testObject.testDataMissing = testObject.firstView.lastVisualChange <= 0;

        if (!lastRun.repeatView) {
          return testObject;
        }

        return createRun(db, lastRun.repeatView).then((repeatView) => {
          testObject.repeatView = repeatView;
          testObject.testDataMissing = testObject.repeatView.lastVisualChange <= 0;
          return testObject;
        });
      });
    })
    .then(() => testObject);
}

/**
 * @param db The Baqend instance.
 * @param {object} data The data to create the run of.
 * @return {Promise<Run>} A promise resolving with the created run.
 */
function createRun(db, data) {
  /** @var {Run} run */
  const run = new db.Run();

  // Copy fields
  for (const field of ['loadTime', 'fullyLoaded', 'firstPaint', 'lastVisualChange', 'domElements']) {
    run[field] = data[field];
  }

  // Search First Meaningful Paint from timing
  const { chromeUserTiming = [] } = data;
  const firstMeaningfulPaintObject =
    chromeUserTiming
      .reverse()
      .find(entry => entry.name === 'firstMeaningfulPaint' || entry.name === 'firstMeaningfulPaintCandidate');

  run.firstMeaningfulPaint = firstMeaningfulPaintObject ? firstMeaningfulPaintObject.time : 0;

  // Set TTFB
  run.ttfb = data.TTFB;

  // Set other
  run.domLoaded = data.domContentLoadedEventStart;
  run.load = data.loadEventStart;
  run.startRender = data.render;
  run.speedIndex = data.SpeedIndex;
  run.requests = data.requests.length;
  run.failedRequests = createFailedRequestsCount(data);
  run.bytes = data.bytesIn;
  run.hits = new db.Hits(countHits(data.requests));
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

/**
 * Method to check whether the website with the given url is based on WordPress
 * @param url
 * @return {boolean}
 */
function iskWordPress(url) {
  return fetch(url).then(res => res.text().then(text => text.indexOf('wp-content') !== -1));
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

/**
 * @param {{ domains: Object<string, object> }} data
 * @param {Run} run The run to create the domain list for.
 * @return {Promise<Run>} Passing through `run`.
 */
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
  url,
  location,
  isClone,
  isCachingDisabled,
  activityTimeout,
  isSpeedKitComparison,
  mobile,
  finish
) {
  return queueTest({
    // Required parameters
    db,
    url,
    isClone,
    // Optional parameters
    location,
    caching: !isCachingDisabled,
    activityTimeout,
    isSpeedKitComparison,
    mobile,
    finish,
  });
}

exports.startTest = startTest;
exports.queueTest = queueTest;
exports.DEFAULT_LOCATION = DEFAULT_LOCATION;
