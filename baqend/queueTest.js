const Pagetest = require('./Pagetest');
const credentials = require('./credentials');

exports.call = function (db, data, req) {
    const API = new Pagetest.API(credentials.wpt_dns, credentials.wpt_api_key);
    const testUrl = data.url;
    const testLocation = data.location;
    const isClone = data.isClone == 'true';
    const caching = data.caching == 'true';

    const testOptions = {
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
        priority: 0,
        chromeTrace: false,
        netLog: false,
        disableHTTPHeaders: true,
        disableScreenshot: true,
        jpegQuality: 100,
        pingback: 'https://makefast.app.baqend.com/v1/code/testPingback'
    };

    const prewarmOptions = Object.assign({}, testOptions, {pingback: '', firstViewOnly: true});

    // test cloned website
    if (isClone) {
        const prewarmScript = `logData\t0\nnavigate\t${testUrl}`;

        const makefastUrl = testUrl.substr(testUrl.indexOf('?'));
        const testScript =
`setActivityTimeout\t150
logData\t0
navigate\t${makefastUrl}
navigate\tabout:blank
logData\t1
navigate\t${testUrl}`;

        return API.runTest(prewarmScript, prewarmOptions).then(() => {
            return API.runTest(testScript, testOptions);
        }).then(result => {
            db.log.info(`Clone test, id: ${result.data.testId} script:\n${testScript}`);
            return {testId: result.data.testId};
        });
    }

    // test original website
    return API.runTest(testUrl, testOptions).then(result => {
        db.log.info(`Original test, id: ${result.data.testId} url:\n${testUrl}`);
        db.log.info('Started Testid: ' + result.data.testId + ' for ' + testUrl);
        return {testId: result.data.testId};
    });
};