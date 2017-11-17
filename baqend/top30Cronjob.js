/* eslint-disable object-curly-newline */
const { createBulkTest } = require('./bulkTest');
const request = require('request');

// The maximum number of iterations to check the status of given bulk tests.
const MAX_INTERVAL_ITERATIONS = 20;

// Tthe number of milliseconds to wait until the next bulk test is created.
const NEW_TEST_WAITING_MILLIS = 60000;

// A list of test parameters to test.
const TOP_LIST =
  [
    {
      url: 'http://www.alibaba.com/',
      location: 'us-east-1:Chrome.Native',
      whitelist: 'i.alicdn.com, img.alicdn.com, sc01.alicdn.com, sc02.alicdn.com',
      isCachingEnabled: false,
      runs: 5,
      mobile: false,
    },
    {
      url: 'http://www.condenast.com/',
      location: 'eu-central-1:Chrome.Native',
      whitelist: 'netdna-cdn.com',
      isCachingEnabled: false,
      runs: 5,
      mobile: false,
    },
    // { url: 'https://diply.com/', location: 'us-east-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'http://www.espn.com/', location: 'us-east-1:Chrome.Native', whitelist: 'espncdn.com', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'http://fandom.wikia.com/explore', location: 'us-east-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'https://www.golem.de/', location: 'eu-central-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'https://imgur.com/', location: 'us-east-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'http://www.kicker.de/', location: 'eu-central-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'http://www.molsoncoors.com/en', location: 'us-east-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'http://www.msn.com/de-de/', location: 'us-east-1:Chrome.Native', whitelist: 'static-global-s-msn-com.akamaized.net', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'https://www.realtor.com/', location: 'us-east-1:Chrome.Native', whitelist: 'krxd.net', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'https://www.reddit.com/', location: 'us-east-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'https://www.theguardian.com/international', location: 'us-east-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'https://www.tumblr.com/', location: 'us-east-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'https://www.walmart.com/', location: 'us-east-1:Chrome.Native', whitelist: '', isCachingEnabled: false, runs: 10, mobile: false },
    // { url: 'https://www.yelp.com/sf', location: 'us-east-1:Chrome.Native', whitelist: 'yelpcdn.com', isCachingEnabled: false, runs: 10, mobile: false }
  ];

/**
 * Verifies display color for a given factor
 *
 * @param factor A number to be colored
 */
function color(factor) {
  // very good result
  if (factor > 3) {
    return '#00cc66';
  }
  // good result
  if (factor > 2) {
    return '#86bc00';
  }
  // ok result
  if (factor >= 1) {
    return '#cc9a00';
  }

  // bad result
  return '#ad0900';
}

/**
 * Create table data cell (td) with optional color style
 *
 * @param data The data to be displayed
 * @param withoutColor Boolean to decide whether to disyplay a colored result or not
 */
function createTableDataCell(data, withoutColor) {
  if (withoutColor) {
    return `<td>${data}</td>`;
  }

  return `<td style="color: ${color(data)};">${data}</td>`;
}

/**
 * Create the mail template to be send
 *
 * @param bulkTestMap A mapping of new and previous bulkTest objects
 */
function createMailTemplate(bulkTestMap) {
  const totalValues = { SIPrevious: 0, SILatest: 0, FMPPrevious: 0, FMPPaintLatest: 0 };
  let templateString = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>' +
    '<body><table border="1" width="100%"><tr><th>URL</th><th>SI Ø Previous</th><th>SI Ø Latest</th><th>SI ∆</th>' +
    '<th>FMP Ø Previous</th><th>FMP Ø Latest</th><th>FMP ∆</th></tr>';

  bulkTestMap.forEach((previous, latest) => {
    // dummy object to ensure that factors is available
    const ensurePrevious = previous || { factors: {} };

    const speedIndexDiff = latest.factors.speedIndex - (ensurePrevious.factors.speedIndex || 0);
    const firstMeaningfulPaintDiff =
      latest.factors.firstMeaningfulPaint - (ensurePrevious.factors.firstMeaningfulPaint || 0);

    // calculate total values
    totalValues.SIPrevious += ensurePrevious.factors.speedIndex || 0;
    totalValues.SILatest += latest.factors.speedIndex;
    totalValues.FMPPrevious += ensurePrevious.factors.firstMeaningfulPaint || 0;
    totalValues.FMPPaintLatest += latest.factors.firstMeaningfulPaint;

    templateString +=
      `<tr>
         ${createTableDataCell(latest.url, true)}
         ${ensurePrevious.factors.speedIndex ? createTableDataCell(previous.factors.speedIndex.toFixed(2)) : createTableDataCell('-', true)}
         ${createTableDataCell(latest.factors.speedIndex.toFixed(2))}
         ${createTableDataCell(speedIndexDiff.toFixed(2), true)}
         ${ensurePrevious.factors.firstMeaningfulPaint ? createTableDataCell(previous.factors.firstMeaningfulPaint.toFixed(2)) : createTableDataCell('-', true)}
         ${createTableDataCell(latest.factors.firstMeaningfulPaint.toFixed(2))}
         ${createTableDataCell(firstMeaningfulPaintDiff.toFixed(2), true)}
       </tr>`;
  });

  const totalSpeedIndexDiff = totalValues.SILatest - totalValues.SIPrevious;
  const totalFirstMeaningfulPaintDiff = totalValues.FMPPaintLatest - totalValues.FMPPrevious;

  templateString +=
    `<tr>
       <td>
         <strong>Total</strong>
       </td>
       ${createTableDataCell((totalValues.SIPrevious / bulkTestMap.size).toFixed(2))}
       ${createTableDataCell((totalValues.SILatest / bulkTestMap.size).toFixed(2))}
       ${createTableDataCell(totalSpeedIndexDiff.toFixed(2), true)}
       ${createTableDataCell((totalValues.FMPPrevious / bulkTestMap.size).toFixed(2))}
       ${createTableDataCell((totalValues.FMPPaintLatest / bulkTestMap.size).toFixed(2))}
       ${createTableDataCell(totalFirstMeaningfulPaintDiff.toFixed(2), true)}
     </tr></table></body></html>`;

  return templateString;
}

/**
 * Load previous bulk test of a given bulk test (created by the cronjob)
 *
 * @param db The Baqend instance.
 * @param bulkTest The latest bulk test .
 */
function loadPreviousBulkTest(db, bulkTest) {
  return db.BulkTest.find()
    .eq('url', bulkTest.url)
    .eq('createdBy', 'cronjob')
    .lt('createdAt', bulkTest.createdAt)
    .descending('createdAt')
    .singleResult();
}

/**
 * Send a notification mail.
 *
 * @param template A template string to be send as email.
 */
function sendMail(template) {
  const options = {
    method: 'post',
    body: { template },
    json: true,
    url: 'https://bbq.app.baqend.com/v1/code/top30Mail',
  };

  // sendMail
  request(options, () => {});
}

/**
 * Send a notification mail.
 *
 * @param db The Baqend instance.
 * @param bulkTests An array of bulkTest objects.
 */
function sendSuccessMail(db, bulkTests) {
  const bulkTestMap = new Map();
  const loadPromises = bulkTests.map(bulkTest => loadPreviousBulkTest(db, bulkTest)
    .then(latestBulkTest => bulkTestMap.set(bulkTest, latestBulkTest)));

  Promise.all(loadPromises).then(() => {
    const template = createMailTemplate(bulkTestMap);
    sendMail(template);
  });
}

/**
 * Starts an interval to check whether all passed bulk test have finished.
 *
 * @param db The Baqend instance.
 * @param bulkTests An array of bulkTest objects.
 */
function startCheckStateInterval(db, bulkTests) {
  let iterations = 0;
  const finishedBulkTests = [];

  const interval = setInterval(() => {
    iterations += 1;
    bulkTests.forEach((bulkTest) => {
      bulkTest.load().then(() => {
        if (bulkTest.hasFinished) {
          finishedBulkTests.push(bulkTest);
          bulkTests.splice(bulkTests.indexOf(bulkTest), 1);
        }
      });
    });

    if (finishedBulkTests.length === TOP_LIST.length) {
      db.log.info('Clear interval because of success');
      clearInterval(interval);
      sendSuccessMail(db, finishedBulkTests);
    } else if (iterations >= MAX_INTERVAL_ITERATIONS) {
      db.log.info('Clear interval because of failure');
      clearInterval(interval);
    }
  }, 30000);
}

/**
 * Starts a number of bulk tests and initiates the state checking process.
 *
 * @param db The Baqend instance.
 * @param n The number of the iteration.
 * @param bulkTests An array of bulkTest objects.
 */
function startBulkTests(db, n = 0, bulkTests = []) {
  if (n < TOP_LIST.length) {
    createBulkTest(db, 'cronjob', TOP_LIST[n]).then((bulkTest) => {
      bulkTests.push(bulkTest);
      setTimeout(startBulkTests, NEW_TEST_WAITING_MILLIS, db, n + 1, bulkTests);
    });
  } else {
    startCheckStateInterval(db, bulkTests);
  }
}

exports.call = function callQueueTest(db, data, req) {
  startBulkTests(db);
};
