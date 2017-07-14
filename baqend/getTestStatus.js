const Pagetest = require('./Pagetest');
exports.call = function(db, data, req) {
    const testId = data.testId;
    const API = new Pagetest.API('ec2-52-57-25-151.eu-central-1.compute.amazonaws.com', 'vjBRNvPBs6F5FviKXem');
    return API.getTestStatus(testId).then(result => {
        return {status: result};
    });
};