const WebPageTest = require('webpagetest');

class Pagetest {

    constructor(url, apiKey) {
        this.wpt = new WebPageTest(url, apiKey);
        this.promises = {};
    }

    /**
     * Queues a new testrun of the given url with the given options.
     * @param testUrl The url to test.
     * @param options The options of this test (see https://github.com/marcelduran/webpagetest-api).
     * @returns {Promise} A promise of the queuing result containing the testId under 'data.testId'
     */
    runTest(testUrl, options) {
        return new Promise((resolve, reject) => {
            this.wpt.runTest(testUrl, options,
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
        });
    }

    /**
     * Queues a new testrun of the given url with the given options.
     * @param testUrl The url to test.
     * @param options The options of this test (see https://github.com/marcelduran/webpagetest-api).
     * @returns {Promise} A promise of the queuing result containing the testId under 'data.testId'
     */
    runTestSync(testUrl, options) {
        return new Promise((resolve, reject) => {
            this.wpt.runTest(testUrl, options,
                (err, result) => {
                    if (err) {
                        reject(err);
                    }
                    this.promises[testId] = resolve;
                });
        });
    }

    resolveTest(testId, ttfb) {
        this.promises[testId].call(ttfb);
    }

    /**
     * Returns the current test status of the queued test.
     * @param testId The id of the test.
     * @returns {Promise} A status result containing a 'statusCode' which is
     * 101 for waiting
     * 100 for running
     * 200 for completed
     */
    getTestStatus(testId) {
        return new Promise((resolve, reject) => {
            this.wpt.getTestStatus(testId, {},
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
        });
    }

    /**
     * Returns the result of a completed test. Precondition: the test must be completed
     *
     * @param testId The id of the test.
     * @param options The options on what results to return.
     * @returns {Promise} The result of the test.
     */
    getTestResults(testId, options) {
        options = options || {};

        return new Promise((resolve, reject) => {
            this.wpt.getTestResults(testId, options,
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
        });
    }

    /**
     * Creates a video and returns the id.
     * @param testId The id of the test.
     * @returns {Promise}
     */
    createVideo(testId) {
        return new Promise((resolve, reject) => {
            this.wpt.createVideo(testId,{},
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
        });
    }
    /**
     * Returns the embed video url.
     * @param videoId The video to get the embed for.
     * @returns {Promise}
     */
    getEmbedVideoPlayer(videoId) {
        return new Promise((resolve, reject) => {
            this.wpt.getEmbedVideoPlayer(videoId,{},
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
        });
    }
}

exports.API = Pagetest;