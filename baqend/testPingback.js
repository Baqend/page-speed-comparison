const { API } = require('./Pagetest');

exports.call = function (db, data, req) {
  db.log.error('Pingback received for ' + data.id);

  const testId = data.id;

  API.resolveTest(db, testId);
};
