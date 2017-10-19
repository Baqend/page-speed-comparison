/* eslint-disable comma-dangle, function-paren-newline */
/* eslint no-restricted-syntax: 0 */

const { startTest } = require('./queueTest');
const { getSpeedKitUrl } = require('./getSpeedKitUrl');

function updateBulkTest(db, bulkTest, testResult) {
  const meanValues = testResult.url.indexOf('makefast') !== -1 ? 'speedKitMeanValues' : 'competitorMeanValues';
  const dataView = 'firstView';
  const { speedIndex, firstMeaningfulPaint } = testResult[dataView];

  let hasFinished = true;
  bulkTest.load({ depth: 2 }).then(() => {
    for (const entry of bulkTest.testOverviews) {
      if (!entry.competitorTestResult[dataView] || !entry.speedKitTestResult[dataView]) {
        hasFinished = false;
        break;
      }
    }

    bulkTest.optimisticSave(() => {
      const meanValue = bulkTest[meanValues];
      meanValue.speedIndex = Number.isInteger(meanValue.speedIndex) ? (meanValue.speedIndex + speedIndex) / 2 : speedIndex;
      meanValue.firstMeaningfulPaint = Number.isInteger(meanValue.firstMeaningfulPaint) ? (meanValue.firstMeaningfulPaint + firstMeaningfulPaint) / 2 : firstMeaningfulPaint;
      bulkTest.hasFinished = hasFinished;
      db.log.info(meanValue.speedIndex);
      db.log.info(meanValue.firstMeaningfulPaint);
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


    const speedKitUrl = getSpeedKitUrl(url, whitelist);
    const testOverviews = [];

    const bulkTest = new db.BulkTest();
    bulkTest.url = url;
    bulkTest.testOverviews = testOverviews;
    bulkTest.speedKitMeanValues = new db.Mean();
    bulkTest.competitorMeanValues = new db.Mean();

    for (let i = 0; i < (runs || 1); i += 1) {
      const testOverview = new db.TestOverview();
      testOverview.whitelist = whitelist;
      testOverview.caching = !isCachingDisabled;

      testOverview.competitorTestResult = startTest(
        db, url, location, false, isCachingDisabled, null, false, null, (testResult) => {
          testOverview.competitorTestResult = testResult;
          testOverview.psiDomains = testResult.firstView.domains.length;
          testOverview.psiRequests = testResult.firstView.requests;
          testOverview.psiResponseSize = testResult.firstView.bytes;
          testOverview.save();

          updateBulkTest(db, bulkTest, testResult);
        });

      testOverview.speedKitTestResult = startTest(
        db, speedKitUrl, location, true, isCachingDisabled, null, false, null, (testResult) => {
          testOverview.speedKitTestResult = testResult;
          testOverview.save();

          updateBulkTest(db, bulkTest, testResult);
        });

      testOverviews.push(testOverview);
      testOverview.save();
    }

    bulkTest.save();
    results.push({ url, bulkTest });
  }
  res.send(results);
};
