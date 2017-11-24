const WebPageTest = require('webpagetest');
const credentials = require('./credentials');

const PING_BACK_URL = `https://${credentials.app}.app.baqend.com/v1/code/testPingback`;

class Pagetest {
  /**
   * @param {string} url
   * @param {string} apiKey
   */
  constructor(url, apiKey) {
    this.wpt = new WebPageTest(url, apiKey);
    this.testResolver = {};
    this.waitPromises = {};
  }

  /**
   * Queues a new test run of the given url with the given options.
   *
   * @param {string} testUrl The URL under test.
   * @param {object} options The options of this test (see https://github.com/marcelduran/webpagetest-api).
   * @param db Baqend database instance
   * @returns {Promise} A promise of the test
   */
  runTest(testUrl, options, db) {
    return this.runTestWithoutWait(testUrl, options)
      .then(testId => this.waitOnTest(testId, db));
  }

  /**
   * @param {string} testUrl The URL under test.
   * @param {object} options The options to pass to WPT.
   * @return {Promise}
   */
  runTestWithoutWait(testUrl, options = {}) {
    const opts = Object.assign({ pingback: PING_BACK_URL }, options);

    return new Promise((resolve, reject) => {
      this.wpt.runTest(testUrl, opts, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        if (!result.data) {
          db.log.error('Received no test id from WPT', {data: result});
          reject(new Error('Received no test id from WPT'));
        }

        const { testId } = result.data;
        this.waitPromises[testId] = new Promise((nestedResolve) => {
          this.testResolver[testId] = nestedResolve;
        });

        resolve(testId);
      });
    });
  }

  waitOnTest(testId, db) {
    /* // Wait for 2 minutes and check if the pingback was already called
     Promise.resolve().then(() => {
     setTimeout(() => {
     db.TestResult.find().equal('testId', testId).singleResult((testResult) => {
     if (!testResult || !testResult.firstView) {
     this.resolveTest(testId);
     }
     });
     }, 120000);
     }); */

    const result = this.waitPromises[testId];
    delete this.waitPromises[testId];
    return result;
  }

  resolveTest(db, testId) {
    if (this.testResolver[testId]) {
      db.log.info(`Resolver found for test: ${testId}`);
      this.testResolver[testId].call(null, testId);
      delete this.testResolver[testId];
    } else {
      db.log.info(`No resolver for test: ${testId}`);
    }
  }

  /**
   * Returns the current test status of the queued test.
   *
   * @param {string} testId The ID of the test.
   * @returns {Promise} A status result containing a 'statusCode' which is
   * 101 for waiting
   * 100 for running
   * 200 for completed
   */
  getTestStatus(testId) {
    return new Promise((resolve, reject) => {
      this.wpt.getTestStatus(testId, {}, (err, result) => {
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
   * @param {string} testId The ID of the test.
   * @param options The options on what results to return.
   * @returns {Promise} The result of the test.
   */
  getTestResults(testId, options) {
    // Make the result call more reliable
    return this.wptGetTestResults(testId, options)
      .then((result) => {
        const firstMissing = result.data.runs['1'].firstView.lastVisualChange <= 0;
        const secondMissing = result.data.runs['1'].repeatView && result.data.runs['1'].repeatView.lastVisualChange <= 0;

        if (!firstMissing && !secondMissing) {
          return result;
        }

        // Retry after 500 milliseconds
        return new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
      })
      .then(() => this.wptGetTestResults(testId, options));
  }

  wptGetTestResults(testId, options = {}) {
    return new Promise((resolve, reject) => {
      this.wpt.getTestResults(testId, options, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Creates a video and returns the ID.
   *
   * @param {string} testId The ID of the test.
   * @returns {Promise}
   */
  createVideo(testId) {
    return new Promise((resolve, reject) => {
      this.wpt.createVideo(testId, {}, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Returns the embed video URL.
   *
   * @param {string} videoId The video to get the embed for.
   * @returns {Promise}
   */
  getEmbedVideoPlayer(videoId) {
    return new Promise((resolve, reject) => {
      this.wpt.getEmbedVideoPlayer(videoId, {}, (err, result) => {
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
