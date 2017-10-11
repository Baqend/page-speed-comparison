exports.get = function bestOfFiveGet(db, req, res) {
    const url = encodeURIComponent(req.query.url);
    return db.TestResult.find()
        .matches('url', '^https://makefast.*' + url)
        .equal('testDataMissing', false)
        .ascending('firstView.speedIndex')
        .limit(5)
        .resultList().then(list => res.send(list));
};
