const Pagetest = require('./Pagetest');
const credentials = require('./credentials');
exports.call = function(db, data, req) {
    const testId = data.testId;
    const API = new Pagetest.API(credentials.wpt_dns, credentials.wpt_api_key);
    return API.getTestStatus(testId).then(result => {
        return {status: result};
    });
};