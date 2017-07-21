const Pagetest = require('./Pagetest');
const credentials = require('./credentials');

exports.call = function (db, data, req) {
    const API = new Pagetest.API(credentials.wpt_dns, credentials.wpt_api_key);
    const testUrl = data.url;
    const testLocation = data.location;
    const isClone = data.isClone == 'true';
    const caching = data.caching == 'true';

    const testScript =
`setActivityTimeout\t150
logData\t0
navigate\t${testUrl}&noCaching=true&blockExternal=true
navigate\tabout:blank
clearCache
logData\t1
navigate\t${testUrl}`;

    const testEntity = isClone ? testScript : testUrl;

    db.log.info('starting test for ' + testUrl + ' and location ' + testLocation);
    db.log.info('Test entity ' + testEntity);
    return API.runTest(testEntity, {
        connectivity: 'Native',
        location: testLocation,
        firstViewOnly: !caching,
        runs: 1,
        video: true,
        disableOptimization: true,
        pageSpeed: false,
        requests: false,
        breakDown: false,
        domains: false,
        saveResponseBodies: false,
        tcpDump: false,
        timeline: false,
        chromeTrace: false,
        netLog: false,
        disableHTTPHeaders: true,
        disableScreenshot: true,
        jpegQuality: 100,
        pingback: 'https://makefast.app.baqend.com/v1/code/testPingback'
    }).then(result => {
        db.log.info('Started Testid: ' + result.data.testId + ' for ' + testUrl);
        return {testId: result.data.testId};
    });
};