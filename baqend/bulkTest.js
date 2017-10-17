/* eslint no-restricted-syntax: 0 */

const { startTest } = require('./queueTest');
const { getSpeedKitUrl } = require('./getSpeedKitUrl');
const { getTestStatus } = require('./getTestStatus');

exports.post = function bulkTestPost(db, req, res) {
  const results = [];
  for (const entry of req.body) {
    const {
      url,
      location,
      whitelist,
      isCachingDisabled,
      runs,
    } = entry;

    const speedKitUrl = getSpeedKitUrl(url, whitelist);
    const testOverviews = [];
    for (let i = 0; i < (runs || 1); i += 1) {
      const testOverview = new db.TestOverview();
      testOverview.whitelist = whitelist;
      testOverview.caching = !isCachingDisabled;
      testOverview.save();

      startTest(db, url, location, false, isCachingDisabled, null, false, (testResult) => {
        testOverview.competitorTestResult = testResult;
        testOverview.psiDomains = testResult.firstView.domains.length;
        testOverview.psiRequests = testResult.firstView.requests;
        testOverview.psiResponseSize = testResult.firstView.bytes;
        testOverview.save();
      });

      startTest(db, speedKitUrl, location, true, isCachingDisabled, null, false, (testResult) => {
        testOverview.speedKitTestResult = testResult;
        testOverview.save();
      });

      testOverviews.push(testOverview);
    }
    const bulkTest = new db.BulkTest();
    bulkTest.url = url;
    bulkTest.testOverviews = testOverviews;
    bulkTest.save();

    results.push({ url, bulkTest });
  }
  res.send(results);
};

exports.get = function bulkTestGet(db, req, res) {
  const promises = [];
  const baqendIds = req.query.ids.split(',');
  for (const baqendId of baqendIds) {
    promises.push(getTestStatus(baqendId));
  }

  return Promise.all(promises).then(results => res.send(results));
};
