const Pagetest = require('./Pagetest');
const credentials = require('./credentials');
const download = require('./download');
const _ = require('underscore');

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
            requests: true,
            breakdown: false,
            domains: false,
            pageSpeed: false,
        }).then(result => {
            db.log.info('Saving test result for ' + testId, result);

            testResult = createTestResult(testId, result.data, db);
            return testResult.save();
        }).then(ignored => {
            if(testResult.testDataMissing)
                throw new Error('Test Data Missing');

            db.log.info('creating video for ' + testId);
            return Promise.all([API.createVideo(testId + '-r:1-c:0'), API.createVideo(testId + '-r:1-c:1')]);
        }).then(result => {
            db.log.info('videos created for ' + testId, {data: result});

            testResult.videoIdFirstView = result[0].data.videoId;
            const videoFirstViewPromise = download.toFile(db,
                constructVideoLink(testId, testResult.videoIdFirstView), '/www/videoFirstView/' + testId +'.mp4');

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
            })
        }).catch(error => {
            db.log.info('Error handling test result for ' + testId + ' with error: ' + error);
        });
    });
};

function constructVideoLink(testId, videoId) {
    const date = testId.substr(0, 2) + '/' + testId.substr(2, 2) + '/' + testId.substr(4, 2);
    return 'http://' + credentials.wpt_dns + '/results/video/' + date + '/' +
        videoId.substr(videoId.indexOf('_') + 1, videoId.length) + '/video.mp4';
}

function createTestResult(testId, testResult, db) {
    const result = new db.TestResult();
    result.testId = testId;
    result.location = testResult.location;
    result.url = testResult.testUrl;
    result.summaryUrl = testResult.summary;
    result.firstView = createRun(testResult.runs['1'].firstView, db);
    result.testDataMissing = result.firstView.lastVisualChange <= 0;
    if (testResult.runs['1'].repeatView) {
        result.repeatView = createRun(testResult.runs['1'].repeatView, db);
        result.testDataMissing = result.repeatView.lastVisualChange <= 0;
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

function countHits(data) {
    return _.countBy(data.requests, req => {
        const headers = req.headers.response.join(" ").toLowerCase();
        if(headers.indexOf("x-cache") != -1) {
            return headers.indexOf('hit') != -1  ? 'hit': 'miss';
        } else {
            return 'other';
        }
    });
}