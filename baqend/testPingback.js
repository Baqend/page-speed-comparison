const { API } = require('./Pagetest');

exports.call = function (db, data, req) {
  const testId = data.id;

  API.resolveTest(db, testId);
};
