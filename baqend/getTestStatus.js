const API = require('./Pagetest').API;
const credentials = require('./credentials');
exports.call = function(db, data, req) {
    const testId = data.testId;
    return API.getTestStatus(testId).then(result => {
        return {status: result};
    });
};