const API = require('./Pagetest').API;
const credentials = require('./credentials');
const Limiter = require('./rateLimiter');
const activityTimeout = 100;
const timeout = 30;
const ttl = 86000/2;


exports.call = function (db, data, req) {
    //Check if IP is rate-limited
    if(Limiter.isRateLimited(req)) {
        return {error: 'Too many requests!'};
    }

    const testUrl = data.url;
    const testLocation = data.location;
    const isClone = data.isClone;
    const caching = data.caching;
    const testResult = new db.TestResult();
    const baqendId = db.util.uuid();

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
        duration: 1, //capture at least one second
        chromeTrace: false,
        netLog: false,
        disableHTTPHeaders: true,
        disableScreenshot: true,
        block: 'favicon', //exclude favicons for fair comparison, as not handled by SWs
        jpegQuality: 100,
        poll: 1, //poll every second
        timeout: 2 * timeout, //set timeout
        pingback: 'https://makefast.app.baqend.com/v1/code/testPingback'
    };

    const prewarmOptions = Object.assign({}, testOptions, {
            pingback: 'https://makefast.app.baqend.com/v1/code/prewarmPingback',
            video: false,
            firstViewOnly: true
        }
    );

    // test cloned website
    if (isClone) {
        //SW always needs to be installed
        const installSW = caching ? `expireCache\t${ttl}` : `logData\t0
setTimeout\t${timeout}	
navigate\t${testUrl}&noCaching=true&blockExternal=true
navigate\tabout:blank
logData\t1`;

        const testScript =
            `setActivityTimeout\t${activityTimeout}
${installSW}
setTimeout\t${timeout}	
navigate\t${testUrl}`;


        API.runPrewarmSync(testUrl, prewarmOptions).then((ttfb) => {
            testOptions.pingback += `?ttfb=${ttfb}&baqendId=${baqendId}`;
            return API.runTest(testScript, testOptions);
        }).then(result => {
            db.log.info(`Clone test, id: ${result.data.testId} script:\n${testScript}`);
            testResult.id = baqendId;
            testResult.testId = result.data.testId;
            testResult.save();
        });

        return {baqendId: baqendId};
    }

    // test original website
    const testScript = `setActivityTimeout\t${activityTimeout}\nsetTimeout\t${timeout}\nexpireCache\t${ttl}\nnavigate\t${testUrl}`;
    testOptions.pingback += `?baqendId=${baqendId}`;

    API.runTest(testScript, testOptions).then(result => {
        db.log.info(`Original test, id: ${result.data.testId} script:\n${testScript}`);
        testResult.id = baqendId;
        testResult.testId = result.data.testId;
        testResult.save();
    });

    return {baqendId: baqendId};
};