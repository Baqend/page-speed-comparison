const Pagetest = require('./Pagetest');
const credentials = require('./credentials');
const activityTimeout = 50;
const timeout = 30;


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
        timeline: true, //TODO: only for debugging
        priority: 0,
        chromeTrace: false,
        netLog: false,
        disableHTTPHeaders: true,
        disableScreenshot: true,
        jpegQuality: 100,
        poll: 1, //poll every second
        timeout: 2 * timeout, //set timeout
        pingback: 'https://makefast.app.baqend.com/v1/code/testPingback'
    };

    const prewarmOptions = Object.assign({}, testOptions, {pingback: '', firstViewOnly: true});

    // test cloned website
    if (isClone) {
        const prewarmScript = `logData\t0\nnavigate\t${testUrl}`;

        const makefastUrl = testUrl.substr(0, testUrl.indexOf('?'));

        //only pre-install SW, if we are interested in the first view
        const installSW = caching ? "" : `logData\t0
setTimeout\t${timeout}	
navigate\t${testUrl}&noCaching=true&blockExternal=true
navigate\tabout:blank
logData\t1`

        const testScript =
            `setActivityTimeout\t${activityTimeout}
${installSW}
setTimeout\t${timeout}	
navigate\t${testUrl}`;

        return API.runTest(prewarmScript, prewarmOptions).then(() => {
            return API.runTest(testScript, testOptions);
        }).then(result => {
            db.log.info(`Clone test, id: ${result.data.testId} script:\n${testScript}`);
            return {testId: result.data.testId};
        });
    }

    // test original website
    const testScript = `setActivityTimeout\t${activityTimeout}\nsetTimeout\t${timeout}\nnavigate\t${testUrl}`;
    return API.runTest(testScript, testOptions).then(result => {
        db.log.info(`Original test, id: ${result.data.testId} script:\n${testScript}`);
        return {testId: result.data.testId};
    });
};