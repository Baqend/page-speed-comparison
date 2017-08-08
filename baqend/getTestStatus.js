const API = require('./Pagetest').API;
const credentials = require('./credentials');

exports.call = function(db, data, req) {
    const baqendId = data.baqendId;
    return db.TestResult.load(baqendId).then(result => {
        if(result) {
            return API.getTestStatus(result.testId).then(result => {
                return {status: result};
            });
        } else {
           throw new Error('Object not found');
        }
    })
};