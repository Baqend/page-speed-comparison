const { createTestOverview } = require('./createTestOverview');
const { getTestStatus } = require('./getTestStatus');

exports.post = function bulkTestPost(db, req, res) {
    const results = [];
    for (const entry of req.body) {
        const url = entry.url;
        const runs = entry.runs;
        const baqendIds = [];
        for (let i = 0; i < (runs || 1); i++) {
            baqendIds.push(createTestOverview(db, entry));
        }
        results.push({ url, baqendIds });
    }
    res.send(results);
};

exports.get = function bulkTestGet(db, req, res) {
    const promises = [];
    const baqendIds = req.query.ids.split(',');
    for (const baqendId of baqendIds) {
        promises.push(getTestStatus(baqendId));
    }

    return Promise.all(promises).then((results) => res.send(results));
};
