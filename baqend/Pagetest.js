const WebPageTest = require('webpagetest');
const credentials = require('./credentials');
const pingBackUrl = `https://${credentials.app}.app.baqend.com/v1/code/testPingback`;

class Pagetest {

    constructor(url, apiKey) {
        this.wpt = new WebPageTest(url, apiKey);
        this.promises = {};
    }

    /**
     * Queues a new testrun of the given url with the given options.
     * @param testUrl The url to test.
     * @param options The options of this test (see https://github.com/marcelduran/webpagetest-api).
     * @returns {Promise} A promise of the test
     */
    runTest(testUrl, options) {
        options.pingback = pingBackUrl;

        return new Promise((resolve, reject) => {
            this.wpt.runTest(testUrl, options, (err, result) => {
                if (err) {
                    return reject(err);
                }

                this.promises[result.data.testId] = resolve;
            });
        });
    }

    resolveTest(testId) {
      if (this.promises[testId]) {
        this.promises[testId].call(null, testId);
        delete this.promises[testId];
      }
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
      //make the result call more reliable
      return this._getTestResults(testId, options).then(result => {
        const firstMissing = result.data.runs['1'].firstView.lastVisualChange <= 0;
        const secondMissing = result.data.runs['1'].repeatView && result.data.runs['1'].repeatView.lastVisualChange <= 0;

        if (!firstMissing && !secondMissing) {
          return result;
        }

        return new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
      }).then(() => {
        return this._getTestResults(testId, options);
      });
    }

    _getTestResults(testId, options) {
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

exports.API = new Pagetest(credentials.wpt_dns, credentials.wpt_api_key);