const API = require('./Pagetest').API;
const credentials = require('./credentials');

exports.call = function (db, data, req) {
    const testId = data.id;

    db.log.info('Prewarm-Pingback received for ' + testId);

    return API.getTestResults(testId, {
        requests: false,
        breakdown: false,
        domains: false,
        pageSpeed: false,
    }).then(result => {
        const ttfb = result.data.runs['1'].firstView.TTFB;
        db.log.info('TTFB of prewarm: ' + ttfb + ' with testId ' + result.data.testId, result.data.runs['1'].firstView);
        return API.resolvePrewarmTest(testId, ttfb);
    });
};
