const _ = require('underscore');

exports.countHits = function (data) {
    return _.countBy(data.requests, req => {
        const headers = req.headers.response.join(" ").toLowerCase();
        if(headers.indexOf("x-cache") != -1) {
            return headers.indexOf('hit') != -1  ? 'hit': 'miss';
        } else {
            return 'other';
        }
    });
};