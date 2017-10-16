const { startTest } = require('./queueTest');
const { getSpeedKitUrl } = require('./getSpeedKitUrl');
const testOverviews = new Map();

function saveTestOverview(baqendTestResultId, testResult) {
    if(testOverviews.has(baqendTestResultId)) {
        const testOverview = testOverviews.get(baqendTestResultId);
        if(testResult.url.indexOf('makefast') !== -1) {
            testOverview.speedKitTestResult = testResult;
        } else {
            testOverview.competitorTestResult = testResult;
            testOverview.psiDomains = testResult.firstView.domains.lengt;
            testOverview.psiRequests = testResult.firstView.requests;
            testOverview.psiResponseSize = testResult.firstView.bytes;
        }

        testOverview.ready().then(() => {
            testOverview.save({force: true});
        });

        testOverviews.delete(baqendTestResultId);
    }
}

function createTestOverview(db, { url, location, caching, whitelist }) {
    const speedKitUrl = getSpeedKitUrl(url);

    const testOverview = new db.TestOverview();
    testOverview.caching = caching;
    testOverview.whitelist = whitelist;
    testOverview.save();

    const competitorTestBaqendId = startTest(db, url, location, false, caching);
    const speedKitTestBaqendId = startTest(db, speedKitUrl, location, true, caching);

    testOverviews.set(competitorTestBaqendId, testOverview);
    testOverviews.set(speedKitTestBaqendId, testOverview);

    return testOverview.key;
}

exports.createTestOverview = createTestOverview;
