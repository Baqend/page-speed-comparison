/* eslint-disable comma-dangle */
/* eslint no-restricted-syntax: 0 */

const { startTest } = require('./queueTest');
const { getSpeedKitUrl } = require('./getSpeedKitUrl');

function updateBulkTest(bulkTest, testResult) {
  let hasFinished = true;
  bulkTest.load({ depth: 2 }).then(() => {
    for (const entry of bulkTest.testOverviews) {
      if (!entry.competitorTestResult.firstView || !entry.speedKitTestResult.firstView) {
        hasFinished = false;
        break;
      }
    }

    bulkTest.optimisticSave(() => {
      bulkTest.hasFinished = hasFinished;
    });
  });
}

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

    const bulkTest = new db.BulkTest();
    const speedKitUrl = getSpeedKitUrl(url, whitelist);
    const testOverviews = [];
    for (let i = 0; i < (runs || 1); i += 1) {
      const testOverview = new db.TestOverview();
      testOverview.whitelist = whitelist;
      testOverview.caching = !isCachingDisabled;

      testOverview.competitorTestResult = startTest(
        db, url, location, false, isCachingDisabled, null, false,
        (testResult) => {
          testOverview.competitorTestResult = testResult;
          testOverview.psiDomains = testResult.firstView.domains.length;
          testOverview.psiRequests = testResult.firstView.requests;
          testOverview.psiResponseSize = testResult.firstView.bytes;
          testOverview.save();

          updateBulkTest(bulkTest, testResult);
        },
      );

      testOverview.speedKitTestResult = startTest(
        db, speedKitUrl, location, true, isCachingDisabled, null, false,
        (testResult) => {
          testOverview.speedKitTestResult = testResult;
          testOverview.save();

          updateBulkTest(bulkTest, testResult);
        },
      );

      testOverviews.push(testOverview);
      testOverview.save();
    }

    bulkTest.url = url;
    bulkTest.testOverviews = testOverviews;
    bulkTest.save();

    results.push({ url, bulkTest });
  }
  res.send(results);
};
