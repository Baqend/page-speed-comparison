const url = require('url');
const { API } = require('./Pagetest');
const credentials = require('./credentials');
const { isRateLimited } = require('./rateLimiter');
const { getAdSet } = require('./adBlocker');
const { toFile } = require('./download');
const { countHits } = require('./countHits');

const DEFAULT_ACTIVITY_TIMEOUT = 75;
const DEFAULT_TIMEOUT = 30;
const DEFAULT_TTL = 86000 / 2;

exports.call = function (db, data, req) {
    //Check if IP is rate-limited
    if (isRateLimited(req)) {
        throw new Abort({message: 'Too many requests', status: 429});
    }

    const { url, location, isClone, caching, isSpeedKitComparison, activityTimeout } = data;

    const baqendId = startTest(db, url, location, isClone, !caching, activityTimeout, isSpeedKitComparison);
    return { baqendId };
};

/**
 * @param db
 * @param {string} testUrl
 * @param {string} testLocation
 * @param {boolean} isClone
 * @param {boolean} isCachingDisabled
 * @param {number} activityTimeout
 * @param {boolean} isSpeedKitComparison
 * @return {string}
 */
function startTest(
    db,
    testUrl,
    testLocation,
    isClone,
    isCachingDisabled = true,
    activityTimeout = DEFAULT_ACTIVITY_TIMEOUT,
    isSpeedKitComparison = false
) {
    // Create a new test result
    const testResult = new db.TestResult();
    testResult.id = db.util.uuid();

    const testOptions = {
        connectivity: 'Native',
        location: testLocation,
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
        timeline: true, //TODO: only for debugging
        priority: 0,
        minimumDuration: 1, //capture at least one second
        chromeTrace: false,
        netLog: false,
        disableHTTPHeaders: true,
        disableScreenshot: true,
        block: 'favicon', //exclude favicons for fair comparison, as not handled by SWs
        jpegQuality: 100,
        poll: 1, //poll every second
        timeout: 2 * DEFAULT_TIMEOUT //set timeout
    };

    const requirePrewarm = isClone;

    const testScript = createTestScript(testUrl, isClone, isCachingDisabled, activityTimeout, isSpeedKitComparison);

    Promise.resolve().then(() => {
        if (requirePrewarm) {
            const prewarmOptions = Object.assign({}, testOptions, {
                runs: 2,
                timeline: false,
                video: false,
                firstViewOnly: true,
                minimalResults: true
            });

            return API.runTest(testUrl, prewarmOptions, db).then((testId) => {
                return getPrewarmResult(db, testId, isSpeedKitComparison);
            });
        }
    }).then((ttfb) => {
        return API.runTestWithoutWait(testScript, testOptions).then((testId) => {
            db.log.info(`Test started, testId: ${testId} script:\n${testScript}`);
            testResult.testId = testId;
            testResult.save();
            return API.waitOnTest(testId, db);
        }).then((testId) => {
            return getTestResult(db, testResult, testId, ttfb);
        }).then(() => {
            db.log.info(`Test completed, id: ${testResult.id}, testId: ${testResult.testId} script:\n${testScript}`);
        }).catch((e) => {
            db.log.warn(`Test failed, id: ${testResult.id}, testId: ${testResult.testId} script:\n${testScript}\n\n${e.stack}`);
            testResult.ready().then(() => {
                testResult.testDataMissing = true;
                testResult.save();
            });
        });
    });

    return testResult.key;
}

/**
 * @param {string} testUrl
 * @param {boolean} isClone
 * @param {boolean} isCachingDisabled
 * @param {number} activityTimeout
 * @param {boolean} isSpeedKitComparison
 * @return {string}
 */
function createTestScript(testUrl, isClone, isCachingDisabled = true, activityTimeout = DEFAULT_ACTIVITY_TIMEOUT, isSpeedKitComparison = false) {
    let hostname;
    try {
        hostname = url.parse(testUrl).hostname;
    } catch (e) {
        throw new Abort('Invalid Url specified: ' + e.message);
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

    let installNavigation = testUrl + '&noCaching=true&blockExternal=true';
    if (!isCachingDisabled) {
        installNavigation = testUrl.split('#')[0];
    }

    //SW always needs to be installed
    const installSW = `
    logData 0
    setTimeout ${DEFAULT_TIMEOUT}	
    ${isSpeedKitComparison ? 'blockDomainsExcept ' + hostname : ''}
    navigate ${installNavigation}
    ${isSpeedKitComparison ? 'blockDomainsExcept' : ''}
    navigate about:blank
    ${isCachingDisabled ? 'clearcache' : ''}
    logData 1
  `;

    return `
    setActivityTimeout ${activityTimeout}
    ${installSW}
    setTimeout ${DEFAULT_TIMEOUT}	
    navigate ${testUrl}
  `;
}

/**
 * @param db
 * @param {string} testId
 */
function getPrewarmResult(db, testId, isSpeedKitComparison) {
    return API.getTestResults(testId, {
        requests: false,
        breakdown: false,
        domains: false,
        pageSpeed: false,
    }).then((result) => {
        const ttfb = isSpeedKitComparison ? result.data.runs['2'].firstView.TTFB : result.data.runs['1'].firstView.TTFB;
        db.log.info('TTFB of prewarm: ' + ttfb + ' with testId ' + testId, result.data.runs['1'].firstView);
        return ttfb;
    });
}

/**
 * @param db
 * @param testResult
 * @param {string} testId
 * @param {string} ttfb
 */
function getTestResult(db, testResult, testId, ttfb) {
    db.log.info(`Pingback received for ${testId}`);

    if (testResult.firstView) {
        db.log.info(`Result already exists for ${testId}`);
        return;
    }

    testResult.testId = testId;

    const options = {
        requests: true,
        breakdown: false,
        domains: false,
        pageSpeed: false,
    };

    return API.getTestResults(testId, options).then((result) => {
        db.log.info('Saving test result for ' + testId, result.data);
        return createTestResult(db, testResult, result.data, ttfb);
    }).then((ignored) => {
        if (testResult.testDataMissing) {
            throw new Error('Test Data Missing');
        }

        db.log.info('creating video for ' + testId);
        return Promise.all([API.createVideo(testId + '-r:1-c:0'), API.createVideo(testId + '-r:1-c:1')]);
    }).then((result) => {
        db.log.info('videos created for ' + testId);

        testResult.videoIdFirstView = result[0].data.videoId;
        const videoFirstViewPromise = toFile(db,
            constructVideoLink(testId, testResult.videoIdFirstView), '/www/videoFirstView/' + testId + '.mp4');

        let videoRepeatViewPromise = Promise.resolve(true);
        if (result[1].data && result[1].data.videoId) {
            testResult.videoIdRepeatedView = result[1].data.videoId;
            videoRepeatViewPromise = toFile(db,
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

/**
 * @param {string} testId
 * @param {string} videoId
 * @return {string}
 */
function constructVideoLink(testId, videoId) {
    const date = testId.substr(0, 2) + '/' + testId.substr(2, 2) + '/' + testId.substr(4, 2);
    const videoLink = videoId.substr(videoId.indexOf('_') + 1, videoId.length);
    return `http://${credentials.wpt_dns}/results/video/${date}/${videoLink}/video.mp4`;
}

/**
 * @param db
 * @param testObject
 * @param testResult
 * @param {string} ttfb
 */
function createTestResult(db, testObject, testResult, ttfb) {
    testObject.location = testResult.location;
    testObject.url = testResult.testUrl;
    testObject.summaryUrl = testResult.summary;

    return createRun(db, testResult.runs['1'].firstView, ttfb).then((firstView) => {
        testObject.firstView = firstView;
        testObject.testDataMissing = testObject.firstView.lastVisualChange <= 0;

        if (!testResult.runs['1'].repeatView) {
            return testObject.save();
        }

        return createRun(db, testResult.runs['1'].repeatView, ttfb).then(repeatView => {
            testObject.repeatView = repeatView;
            testObject.testDataMissing = testObject.repeatView.lastVisualChange <= 0;
            return testObject.save();
        });
    });
}

/**
 * @param db
 * @param data
 * @param {string} ttfb
 */
function createRun(db, data, ttfb) {
    const run = new db.Run();
    const firstMeaningfulPaintObject = data.chromeUserTiming.reverse().find(entry => { return entry.name === 'firstMeaningfulPaintCandidate' });
    run.loadTime = data.loadTime;
    run.ttfb = ttfb ? ttfb : data.TTFB;
    run.domLoaded = data.domContentLoadedEventStart;
    run.load = data.loadEventStart;
    run.fullyLoaded = data.fullyLoaded;
    run.firstPaint = data.firstPaint;
    run.startRender = data.render;
    run.lastVisualChange = data.lastVisualChange;
    run.speedIndex = data.SpeedIndex;
    run.firstMeaningfulPaint = firstMeaningfulPaintObject ? firstMeaningfulPaintObject.time : 0;
    run.requests = data.requests.length;
    run.failedRequests = createFailedRequestsCount(data);
    run.bytes = data.bytesIn;
    run.hits = new db.Hits(countHits(data));
    run.domElements = data.domElements;
    run.basePageCDN = data.base_page_cdn;
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
    data.requests.forEach(request => {
        if(request.responseCode >= 400)
            failedRequests++;
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

exports.startTest = startTest;
