const targetDB = require('baqend');
const download = require('./download');


/*
 * Migrates the given test from this Baqend app to the specified one.
 * Call this module with the test id und the targeted app as get parameter
 * e.g. ?testId=TzReodkicker&app=makefast-staging
 *
 * NOTE: Before you can migrate videos you need to set the insert permission
 * in the targeted apps /www/ folder to public. Make sure the revoke the permission after migration!
 */
exports.call = function(db, data, req) {
  return connectDB(data.app).then(() => {
    return db.TestOverview.load(data.testId, {depth: 1}).then(test => {

      // Copy result views
      const newSK = copyTestResult(test.speedKitTestResult);
      const newComp = copyTestResult(test.competitorTestResult);
      return Promise.all([newSK, newComp]).then(results => {
        const [skResult, compResult] = results;
        db.log.info('Results ' + skResult.id + ' ' + compResult.id);

        // Copy overview and videos
        const newTest = copyTestOverview(test, skResult, compResult);
        const newSKVideoFirst = copyFile(test.speedKitTestResult.videoFileFirstView);
        const newCompVideoFirst = copyFile(test.competitorTestResult.videoFileFirstView);
        const newSKVideoSecond = copyFile(test.speedKitTestResult.videoFileRepeatView);
        const newCompVideoSecond = copyFile(test.competitorTestResult.videoFileRepeatView);
        return Promise.all([newTest, newSKVideoFirst, newCompVideoFirst, newSKVideoSecond, newCompVideoSecond]);
      });
    });
  });
};

function connectDB(app) {
  if (targetDB.ready()) {
    targetDB.clear();
    return Promise.resolve(targetDB);
  }

  return targetDB.connect(app);
}

function copyTestOverview(test, skResult, compResult) {
  const copy = new targetDB.TestOverview();
  copy.id = test.id;
  copy.psiDomains = test.psiDomains;
  copy.psiRequests = test.psiRequests;
  copy.psiResponseSize = test.psiResponseSize;
  copy.location = test.location;
  copy.caching = test.caching;
  copy.mobile = test.mobile;
  copy.url = test.url;
  copy.competitorTestResult = skResult;
  copy.speedKitTestResult = compResult;
  copy.whitelist = test.whitelist;
  copy.hasFinished = test.hasFinished;
  copy.factors = test.factors;
  return copy.save();
}

function copyTestResult(result) {
  const copy = new targetDB.TestResult();
  copy.id = result.id;
  copy.testId = result.testId;
  copy.location = result.location;
  if (result.firstView) {
    copy.firstView = new targetDB.Run(result.firstView.toJSON());
  }
  if (result.repeatView) {
    copy.repeatView = new targetDB.Run(result.repeatView.toJSON());
  }
  copy.url = result.url;
  copy.summaryUrl = result.summaryUrl;
  copy.videoIdFirstView = result.videoIdFirstView;
  copy.videoIdRepeatedView = result.videoIdRepeatedView;
  copy.testDataMissing = result.testDataMissing;
  copy.videoFileFirstView = result.videoFileFirstView;
  copy.videoFileRepeatView = result.videoFileRepeatView;
  copy.hasFinished = result.hasFinished;
  copy.retryRequired = result.retryRequired;
  copy.isWordPress = result.isWordPress;


  return copy.save();
}

function copyFile(file) {
  if (file) {
    return download.toFile(targetDB, file.url, file.path);
  }

  return Promise.resolve();
}
