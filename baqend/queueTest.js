const Pagetest = require('./Pagetest');

exports.call = function (db, data, req) {
    const API = new Pagetest.API('ec2-52-57-25-151.eu-central-1.compute.amazonaws.com', 'vjBRNvPBs6F5FviKXem');
    const testUrl = data.url;
    const testLocation = data.location;

    const testScript = `setActivityTimeout\t100\nnavigate\t${testUrl}`;

    db.log.info('starting test for ' + testUrl + ' and location ' + testLocation);
    return API.runTest(testScript, {
        connectivity: 'Native',
        location: testLocation,
        firstViewOnly: false,
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
        jpegQuality: 30,
        pingback: 'https://page-test.app.baqend.com/v1/code/testPingback'
    }).then(result => {
        db.log.info('Started Testid: ' + result.data.testId + ' for ' + testUrl);
        return {testId: result.data.testId};
    });
};