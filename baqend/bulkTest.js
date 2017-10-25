/* eslint-disable comma-dangle, function-paren-newline */
/* eslint no-restricted-syntax: 0 */

const { queueTest, DEFAULT_LOCATION } = require('./queueTest');
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
 * Gets the best result for a given field of the competitor or Speed Kit.
 *
 * @param bulkTest A bulk test to analyze.
 * @param {'competitor' | 'speedKit'} resultFieldPrefix Either 'competitor' or 'speedKit'.
 * @param {string} field The field to get the best result of.
 * @return {number} Returns the result or NaN, if no result exists.
 */
function bestResult(bulkTest, resultFieldPrefix, field) {
  const resultField = `${resultFieldPrefix}TestResult`;
  const best = bulkTest.testOverviews.reduce((prev, { [resultField]: result }) => {
    if (result.firstView) {
      return Math.min(prev, result.firstView[field]);
    }

    return prev;
  }, Infinity);

  return Number.isFinite(best) ? best : NaN;
}

/**
 * Gets the worst result for a given field of the competitor or Speed Kit.
 *
 * @param bulkTest A bulk test to analyze.
 * @param {'competitor' | 'speedKit'} resultFieldPrefix Either 'competitor' or 'speedKit'.
 * @param {string} field The field to get the worst result of.
 * @return {number} Returns the result or NaN, if no result exists.
 */
function worstResult(bulkTest, resultFieldPrefix, field) {
  const resultField = `${resultFieldPrefix}TestResult`;
  const worst = bulkTest.testOverviews.reduce((prev, { [resultField]: result }) => {
    if (result.firstView) {
      return Math.max(prev, result.firstView[field]);
    }

    return prev;
  }, -1);

  return worst === -1 ? NaN : worst;
}

/**
 * Calculates the best factors for a given bulk test.
 *
 * @param db The Baqend instance.
 * @param bulkTest A bulk test to analyze.
 * @return {object} The values of the best factor.
 */
function calcBestFactors(db, bulkTest) {
  const result = new db.Mean();
  for (const field of fields) {
    const competitorWorst = worstResult(bulkTest, 'competitor', field);
    const speedKitBest = bestResult(bulkTest, 'speedKit', field);

    result[field] = (competitorWorst / speedKitBest) || null;
  }

  return result;
}

/**
 * Calculates the worst factors for a given bulk test.
 *
 * @param db The Baqend instance.
 * @param bulkTest A bulk test to analyze.
 * @return {object} The values of the worst factor.
 */
function calcWorstFactors(db, bulkTest) {
  const result = new db.Mean();
  for (const field of fields) {
    const competitorBest = bestResult(bulkTest, 'competitor', field);
    const speedKitWorst = worstResult(bulkTest, 'speedKit', field);

    result[field] = (competitorBest / speedKitWorst) || null;
  }

  return result;
}

/**
 * Checks whether a test overview is finished.
 */
function hasTestOverviewFinished({ competitorTestResult, speedKitTestResult }) {
  return competitorTestResult.hasFinished === true && speedKitTestResult.hasFinished === true;
}

/**
 * Returns whether a bulk test has finished.
 */
function hasBulkTestFinished(bulkTest) {
  return bulkTest.testOverviews.every(it => hasTestOverviewFinished(it));
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
    bulkTest.hasFinished = hasBulkTestFinished(bulkTest);
    bulkTest.speedKitMeanValues = aggregate(db, pickResults(bulkTest, 'speedKit'));
    bulkTest.competitorMeanValues = aggregate(db, pickResults(bulkTest, 'competitor'));
    bulkTest.factors = factorize(db, bulkTest.competitorMeanValues, bulkTest.speedKitMeanValues);
    bulkTest.bestFactors = calcBestFactors(db, bulkTest);
    bulkTest.worstFactors = calcWorstFactors(db, bulkTest);

    return bulkTest.save();
  }).catch(() => updateBulkTest(db, bulkTest));
}

function createTestOverview(db, {
  bulkTest,
  location,
  caching,
  url,
  speedKitUrl,
  whitelist,
  mobile,
}) {
  const testOverview = new db.TestOverview();
  testOverview.url = url;
  testOverview.whitelist = whitelist;
  testOverview.caching = caching;
  testOverview.mobile = mobile;

  Promise.all([
    // Queue the test against the competitor's site
    queueTest({
      db,
      location,
      caching,
      url,
      isClone: false,
      mobile,
      finish(testResult) {
        testOverview.competitorTestResult = testResult;
        if (testResult.testDataMissing !== true) {
          testOverview.psiDomains = testResult.firstView.domains.length;
          testOverview.psiRequests = testResult.firstView.requests;
          testOverview.psiResponseSize = testResult.firstView.bytes;
        }

        if (testOverview.speedKitTestResult.hasFinished) {
          testOverview.hasFinished = true;
          bulkTest.completedRuns += 1;
        }

        testOverview.ready().then(() => testOverview.save());
        updateBulkTest(db, bulkTest);
      },
    }),

    // Queue the test against Speed Kit
    queueTest({
      db,
      location,
      caching,
      url: speedKitUrl,
      isClone: true,
      mobile,
      finish(testResult) {
        testOverview.speedKitTestResult = testResult;

        if (testOverview.competitorTestResult.hasFinished) {
          testOverview.hasFinished = true;
          bulkTest.completedRuns += 1;
        }

        testOverview.ready().then(() => testOverview.save());

        updateBulkTest(db, bulkTest);
      },
    }),
  ]).then(([competitor, speedKit]) => {
    testOverview.competitorTestResult = competitor;
    testOverview.speedKitTestResult = speedKit;
    return testOverview.ready().then(() => testOverview.save());
  });

  return testOverview.save();
}

/**
 * @param db The Baqend instance.
 * @param {object} options
 * @return {Promise}
 */
function createTestOverviews(db, options) {
  const { runs } = options;
  const promises = new Array(runs)
    .fill(null)
    .map(() => createTestOverview(db, options));

  return Promise.all(promises);
}

/**
 * @param db The Baqend instance.
 * @param {string | null} createdBy A reference to the user who created the bulk test.
 * @param {object} options
 * @param {string} options.url The URL under test.
 * @param {string} options.whitelist A whitelist to use for the test.
 * @param {string} options.location The server location to execute the test.
 * @param {number} options.runs The number of runs to execute.
 * @param {boolean} options.caching If true, browser caching will be used. Defaults to false.
 * @param {boolean} options.mobile If true, mobile version will be tested. Defaults to false.
 * @return {Promise} An object containing bulk test information
 */
function createBulkTest(db, createdBy, options = {
  runs: 1, caching: false, location: DEFAULT_LOCATION, mobile: false
}) {
  const {
    url,
    whitelist,
    runs,
    location,
    mobile
  } = options;

  const speedKitUrl = getSpeedKitUrl(url, whitelist);

  const bulkTest = new db.BulkTest();
  bulkTest.url = url;
  bulkTest.createdBy = createdBy;
  bulkTest.hasFinished = false;
  bulkTest.location = location;
  bulkTest.mobile = mobile;
  bulkTest.runs = runs;
  bulkTest.completedRuns = 0;

  return bulkTest.save()
    .then(() => createTestOverviews(db, Object.assign({ bulkTest, speedKitUrl }, options)))
    .then((overviews) => {
      bulkTest.testOverviews = overviews;

      return bulkTest.save();
    });
}

exports.post = function bulkTestPost(db, req, res) {
  const { body } = req;
  const { createdBy = null } = body;
  let { tests } = body;
  if (body instanceof Array) {
    tests = body;
  }

  return Promise.all(tests.map(entry => createBulkTest(db, createdBy, entry)))
    .then(results => res.send(results));
};
