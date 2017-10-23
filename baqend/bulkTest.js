/* eslint-disable comma-dangle, function-paren-newline */
/* eslint no-restricted-syntax: 0 */

const { startTest } = require('./queueTest');
const { getSpeedKitUrl } = require('./getSpeedKitUrl');

const fields = ['speedIndex', 'firstMeaningfulPaint', 'ttfb', 'domLoaded', 'fullyLoaded', 'lastVisualChange'];

/**
 * Aggregates an array of runs.
 *
 * @param db The Baqend instance.
 * @param runs An array of test runs.
 * @return A mean containing the aggregated values.
 */
function aggregate(db, runs) {
  const divideBy = runs.length;
  const meanValues = runs.reduce((prev, curr) => {
    const result = prev;
    for (const field of fields) {
      result[field] = (prev[field] || 0) + (curr[field] / divideBy);
    }

    return result;
  }, {});

  return new db.Mean(meanValues);
}

/**
 * Calculates the factors of two mean test result values.
 *
 * @param db The Baqend instance.
 * @param competitor The competitor's result.
 * @param speedKit The result of Speed Kit.
 * @return A mean containing the factors.
 */
function factorize(db, competitor, speedKit) {
  const result = new db.Mean();
  for (const field of fields) {
    result[field] = competitor[field] / speedKit[field];
  }

  return result;
}

/**
 * Returns whether a bulk test has finished.
 */
function hasFinished(bulkTest) {
  return bulkTest.testOverviews.every(it =>
    (it.competitorTestResult.testDataMissing !== true && !it.competitorTestResult.firstView) ||
    (it.speedKitTestResult.testDataMissing !== true && !it.speedKitTestResult.firstView));
}

/**
 * Picks the test results with a given name from a bulk test.
 */
function pickResults(bulkTest, name) {
  const field = `${name}TestResult`;
  return bulkTest.testOverviews.map(it => it[field] && it[field].firstView).filter(it => it);
}

/**
 * Updates aggregates on a bulk test.
 */
function updateBulkTest(db, bulkTestRef) {
  const bulkTest = bulkTestRef;
  return bulkTest.load({ depth: 2 }).then(() => {
    bulkTest.hasFinished = hasFinished(bulkTest);
    bulkTest.speedKitMeanValues = aggregate(db, pickResults(bulkTest, 'speedKit'));
    bulkTest.competitorMeanValues = aggregate(db, pickResults(bulkTest, 'competitor'));
    bulkTest.factors = factorize(db, bulkTest.competitorMeanValues, bulkTest.speedKitMeanValues);

    return bulkTest.save();
  }).catch(() => updateBulkTest(db, bulkTest));
}

/**
 * @param db The Baqend instance.
 * @param {string | null} createdBy A reference to the user who created the bulk test.
 * @param {string} url The URL under test.
 * @param {string} whitelist A whitelist to use for the test.
 * @param {string} location The server location to execute the test.
 * @param {number} runs The number of runs to execute.
 * @param {boolean} isCachingDisabled If true,
 * @return {{ url: string, bulkTest: object }} An object containing bulk test information
 */
function createBulkTest(db, createdBy, {
  url,
  whitelist,
  location = 'eu-central-1:Chrome',
  runs = 1,
  isCachingDisabled = true,
}) {
  const speedKitUrl = getSpeedKitUrl(url, whitelist);
  const bulkTest = new db.BulkTest();
  bulkTest.url = url;
  bulkTest.createdBy = createdBy;
  bulkTest.hasFinished = false;
  bulkTest.testOverviews = [];

  for (let i = 0; i < runs; i += 1) {
    const testOverview = new db.TestOverview();
    testOverview.whitelist = whitelist;
    testOverview.caching = !isCachingDisabled;

    testOverview.competitorTestResult = startTest(
      db, url, location, false, isCachingDisabled, null, false, null, (testResult) => {
        testOverview.competitorTestResult = testResult;
        if (testResult.testDataMissing !== true) {
          testOverview.psiDomains = testResult.firstView.domains.length;
          testOverview.psiRequests = testResult.firstView.requests;
          testOverview.psiResponseSize = testResult.firstView.bytes;
        }
        testOverview.save();
        updateBulkTest(db, bulkTest);
      });

    testOverview.speedKitTestResult = startTest(
      db, speedKitUrl, location, true, isCachingDisabled, null, false, null, (testResult) => {
        testOverview.speedKitTestResult = testResult;
        testOverview.save();

        updateBulkTest(db, bulkTest);
      });

    bulkTest.testOverviews.push(testOverview);
    testOverview.save();
  }

  bulkTest.save();
  return { url, bulkTest };
}

exports.post = function bulkTestPost(db, req, res) {
  const results = [];
  const { body } = req;
  const { createdBy = null } = body;
  let { tests } = body;
  if (body instanceof Array) {
    tests = body;
  }

  for (const entry of tests) {
    const result = createBulkTest(db, createdBy, entry);
    results.push(result);
  }
  res.send(results);
};
