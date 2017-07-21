const Pagetest = require('./Pagetest');
const credentials = require('./credentials');

exports.call = function (db, data, req) {
    const API = new Pagetest.API(credentials.wpt_dns, credentials.wpt_api_key);
    const testId = data.id;
    db.log.info('Pingback received for ' + testId);

    return db.TestResult.find().equal('testId', testId).count().then(exists => {
        if (exists > 0) {
            db.log.info('Result already exists for ' + testId);
            return;
        }

        let testResult;
        return API.getTestResults(testId, {
            requests: false,
            breakdown: false,
            domains: false,
            pageSpeed: false,
        }).then(result => {
            db.log.info('Saving test result for ' + testId);

            testResult = createTestResult(testId, result.data, db);
            return testResult.save();
        }).then(ignored => {

            db.log.info('creating video for ' + testId);
            return Promise.all([API.createVideo(testId + '-r:1-c:0'), API.createVideo(testId + '-r:1-c:1')]);
        }).then(result => {
            db.log.info('videos created for ' + testId, {data: result});

            testResult.videoIdFirstView = result[0].data.videoId;
            testResult.videoIdRepeatedView = result[1].data.videoId;
            return testResult.save();
        }).catch(error => {
            db.log.info('Error handling test result for ' + testId + ' with error: ' + error);
        });
    });
};

function createTestResult(testId, testResult, db) {
    const result = new db.TestResult();
    result.testId = testId;
    result.location = testResult.location;
    result.url = testResult.testUrl;
    result.summaryUrl = testResult.summary;
    result.firstView = createRun(testResult.runs['1'].firstView, db);
    if (testResult.runs['1'].repeatView) {
        result.repeatView = createRun(testResult.runs['1'].repeatView, db);
    }
    return result;
}

function createRun(data, db) {
    const run = new db.Run();
    run.loadTime = data.loadTime;
    run.ttfb = data.TTFB;
    run.domLoaded = data.domContentLoadedEventStart;
    run.load = data.loadEventStart;
    run.fullyLoaded = data.fullyLoaded;
    run.firstPaint = data.firstPaint;
    run.startRender = data.render;
    run.lastVisualChange = data.lastVisualChange;
    run.speedIndex = data.SpeedIndex;
    run.requests = data.requests;
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