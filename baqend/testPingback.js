const API = require('./Pagetest').API;
const credentials = require('./credentials');
const download = require('./download');
const countHits = require('./countHits').countHits;

exports.call = function (db, data, req) {
    const testId = data.id;

    API.resolveTest(testId);
};


