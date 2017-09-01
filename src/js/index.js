import { ConvertBytesService } from './ConvertBytesService';
import { PageSpeedInsightsAPIService } from './PageSpeedInsightsAPIService';
import { ResetVariablesService } from './ResetVariablesService';
import { SpeedKitUrlService } from './SpeedKitUrlService';
import { TestResultHandler } from './TestResultHandler';
import { UiElementCreator } from './UiElementCreator';

import "bootstrap";
import "../styles/main.scss";
import * as hbs from "../templates";
import { db } from "baqend/realtime";

const uiElementCreator = new UiElementCreator();
const pageSpeedInsightsAPIService = new PageSpeedInsightsAPIService();
const speedKitUrlService = new SpeedKitUrlService();
const resetViewService = new ResetVariablesService();
const testResultHandler = new TestResultHandler();
const convertBytesService = new ConvertBytesService();
const data = {};

let co_url;
let testResult = {};
let testVideo = {};
let testOptions = {location: 'eu-central-1:Chrome', caching: false};
let pageSpeedInsightFailed = false;
let pageSpeedInsightRetries = 0;
let testInstance;
let co_subscription;
let sk_subscription;
let testOverview;
let co_baqendId;
let sk_baqendId;
let interval;
let title;

document.addEventListener("DOMContentLoaded", () => {
    $("#main").html(hbs.main(data));
    $('[data-toggle="tooltip"]').tooltip();

    db.connect(APP, true).then(() => {
        initTest();
    });

    //simplified version for report view
    if(REPORT_PAGE) {
        $('#testConfiguration').remove();
        $('#wList').remove();
    }

    title = $('title').text();
});

window.addEventListener("popstate", () => {
  if (db.isReady)
    initTest();
});

window.initTest = () => {
  const testIdParam = getParameterByName('testId');
  if (testIdParam && (!testOverview || testOverview.key !== testIdParam)) {
    db.TestOverview.load(testIdParam, {depth: 1}).then((result) => {
        if (result) {
          testOptions.speedKit = result.speedKit;
          testOptions.caching = result.caching;
          testOptions.location = result.competitorTestResult.location;
          co_url = result.competitorTestResult.url;
          testResultHandler.displayTestResultsById(testOptions, result);
        }
    });
  }

  const url = getParameterByName("url");
  if (url) {
    window.submitComparison(url);
  }
};

window.showInfoBox = () => {
    resetViewService.showInfoBox();
};

window.showImplementation = () => {
    $('#implementation-toggle').hide();
    $('#implementation-dots').hide();
    $('.implementation-hidden').show("medium");
};

window.openBaqendFrame = () => {
    const win = window.open(speedKitUrlService.getBaqendUrl(co_url, $('#wListInput').val(), '_blank'));
    win.focus();
};

window.handleLocationChange = (radioButton) => {
    if (radioButton.value === 'usa') {
        testOptions.location = 'us-east-1:Chrome';
    } else if (radioButton.value === 'eu') {
        testOptions.location = 'eu-central-1:Chrome';
    }
};

window.handleCachingChange = (radioButton) => {
    testOptions.caching = radioButton.value;
    if (radioButton.value === 'yes') {
        testOptions.caching = false;
    } else if (radioButton.value === 'no') {
        testOptions.caching = true;
    }
};

window.playVideos = (videoElement) => {
    if (videoElement.id === 'video-competitor') {
        const videoSpeedKit = document.getElementById('video-speedKit');
        if (videoSpeedKit) {
            videoSpeedKit.currentTime = videoElement.currentTime;
            videoSpeedKit.play();
        }
    } else {
        const videoCompetitor = document.getElementById('video-competitor');
        if (videoCompetitor) {
            videoCompetitor.currentTime = videoElement.currentTime;
            videoCompetitor.play();
        }
    }
};

window.printReport = () => {
    const competitorVideo = document.getElementById('video-competitor');
    const speedKitVideo = document.getElementById('video-speedKit');
    competitorVideo.currentTime = competitorVideo.duration;
    speedKitVideo.currentTime = speedKitVideo.duration;

    setTimeout(function () {
        window.print();
    }, 100);
};

window.contactUs = (e) => {
    e.preventDefault();

    let data = {
        name: $('#c_name').val(),
        email: $('#c_email').val(),
        url: co_url,
        testOverviewId: testOverview.id,
        subject: 'from page speed comparison'
    };

    $.post('https://bbq.app.baqend.com/v1/code/mailUs', data, (data, status, xhr) => {
        let form = $('#contact_form');
        form.find('.modal-body').html("<p>Thanks. We will get in touch shortly. " +
            "Check out our <a href='https://benchmark.baqend.com' target='_blank'>benchmark</a> in the meantime</p>");
        form.find('.c_submit').remove();
    });
};

window.handleURLKeydown = (event) => {
  $('#currentVendorUrlInvalid').hide();

  if (event.keyCode == 13)
      window.submitComparison();
};

window.submitComparison = (urlInput) => {
  urlInput = urlInput || $('#currentVendorUrl').val();
  db.modules.get('testRateLimited').then(() => {
      return db.modules.get('normalizeUrl', { url: urlInput }).then((result) => {
          $('#currentVendorUrl').val(result.url);
          initComparison(result.url);
      });
  }).catch(e => {
    const $currentVendorUrlInvalid = $('#currentVendorUrlInvalid');
    $currentVendorUrlInvalid.text(e.message);
    $currentVendorUrlInvalid.show();
  });
};

function initComparison(url) {
    resetComparison();

    const now = Date.now();
    testInstance = now;

    co_url = url;
    resetViewService.startTest();
    $('.center-vertical').animate({'marginTop': '0px'}, 500);
    const activityTimeout = parseInt($('.activityTimeout').val()) || undefined;

    testOverview = new db.TestOverview();
    testOverview.caching = testOptions.caching;
    testOverview.whitelist = $('#wListInput').val();

    Promise.all([db.modules.post('queueTest', {
        url: co_url,
        activityTimeout: activityTimeout,
        location: testOptions.location,
        isClone: false,
        caching: testOptions.caching
    }), db.modules.post('queueTest', {
        url: speedKitUrlService.getBaqendUrl(co_url, $('#wListInput').val()),
        activityTimeout: activityTimeout,
        location: testOptions.location, isClone: true, caching: testOptions.caching
    })]).then(results => {
        co_baqendId = results[0].baqendId;
        sk_baqendId = results[1].baqendId;

        return sleep(6000);
    }).then(() => {
      if (now === testInstance) {
        const co_query = db.TestResult.find().equal('id', '/db/TestResult/' + co_baqendId);
        co_subscription = co_query.resultStream(result =>
          resultStreamUpdate(result, co_subscription, 'competitor'));

        const sk_query = db.TestResult.find().equal('id', '/db/TestResult/' + sk_baqendId);
        sk_subscription = sk_query.resultStream(result =>
          resultStreamUpdate(result, sk_subscription, 'speedKit'));
      }
    }).catch(showComparisonError);

    callPageSpeed(now).catch(() => {
        const carousel = $('.carousel').carousel({interval: false, wrap: false});
        carousel.carousel(4);
        pageSpeedInsightFailed = true;
        updateTestStatus();
    });
}

function updateTestStatus() {
  interval = setInterval(function () {
    if (co_baqendId) {
      db.modules.get('getTestStatus', {baqendId: co_baqendId}).then(res => {
        if(!res.error){
          if (res.status.statusCode === 101) {
            $('#statusQueue').html(res.status.statusText);
          } else if (res.status.statusCode === 100 || res.status.statusCode === 200) {
            $('#statusQueue').html('Test has been started...');
          }
        }
      });
    }
  }, 2000);
}

function callPageSpeed(now) {
  const carousel = $('.carousel').carousel({interval: false, wrap: false});
  carousel.carousel(0);

  let screenShot;

  return pageSpeedInsightsAPIService.callPageSpeedInsightsAPI(co_url)
    .then((results) => {
      carousel.carousel(1);
      screenShot = results.screenshot;
      setPageSpeedMetrics(results);
      return sleep(1000);
    }).then(() => {
      if (now === testInstance) {
        carousel.carousel(2);
      }
      return sleep(1000);
    }).then(() => {
      if (now === testInstance) {
        carousel.carousel(3);
      }
      return sleep(1000);
    }).then(() => {
      if (now === testInstance) {
        carousel.carousel(4);
        updateTestStatus();
      }
      return sleep(1000);
    }).then(() => {
      if (now === testInstance) {
        $('#compareContent').removeClass('hidden');
        $('#competitor').append(uiElementCreator.createImageElement(screenShot),
          uiElementCreator.createScannerElement());

        $('#speedKit').append(uiElementCreator.createImageElement(screenShot),
          uiElementCreator.createScannerElement());
      }
    });
}

function resultStreamUpdate(result, subscription, elementId) {
    const dataView = testOptions.caching ? 'repeatView' : 'firstView';
    const videoView = testOptions.caching ? 'videoFileRepeatView' : 'videoFileFirstView';

    if (result.length > 0) {
        const entry = result[0];

        if (!testOverview[elementId + 'TestResult']) {
            testOverview[elementId + 'TestResult'] = entry;
        }

        if (!entry.testDataMissing) {
            if (entry[dataView]) {
                testResult[elementId] = entry;
                if (Object.keys(testResult).length === 2) {
                    clearInterval(interval);
                    testResultHandler.displayTestResults('competitor', testResult['competitor'][dataView], testOptions);
                    testResultHandler.displayTestResults('speedKit', testResult['speedKit'][dataView], testOptions);
                    testResultHandler.calculateFactors(testResult['competitor'][dataView], testResult['speedKit'][dataView], testOptions);

                    if(pageSpeedInsightFailed) {
                        setPageSpeedMetrics(testResult['competitor']['firstView']);
                        $('#compareContent').removeClass('hidden');
                    }
                }
            }

            if (entry[videoView]) {
                testVideo[elementId] = entry[videoView].url;
                if (Object.keys(testVideo).length === 2) {
                    const competitorElement = $('#competitor');
                    const speedKitElement = $('#speedKit');

                    const totalRequests = entry['firstView'].requests;
                    const cacheHits = entry['firstView'].hits.hit || 0;
                    const cacheMisses = entry['firstView'].hits.miss || 0;
                    const otherRequests = entry['firstView'].hits.other || 0;

                    console.log('hit: ' + cacheHits + ' miss: ' + cacheMisses + ' other: ' +
                        otherRequests + ' total: ' + (totalRequests || 0));

                    $('#servedRequests').text((100 / totalRequests * ((totalRequests || 0) - otherRequests)).toFixed(0));

                    competitorElement.empty();
                    speedKitElement.empty();
                    competitorElement.append(uiElementCreator.createVideoElement('video-competitor', testVideo['competitor']));
                    speedKitElement.append(uiElementCreator.createVideoElement('video-speedKit', testVideo['speedKit']));
                    speedKitElement.append(uiElementCreator.createLinkButton());

                    resetViewService.resetViewAfterTest();
                }
                subscription.unsubscribe();
            }
        } else {
            showComparisonError(new Error('test data missing'));
        }

        testOverview.ready().then(() => {
            return testOverview.save();
        }).then(() => {
            history.pushState({}, title, '/?testId=' + testOverview.key);
        });
    }
}

function setPageSpeedMetrics(result) {
    testOverview.psiDomains = result.domains;
    testOverview.psiRequests = result.requests;
    testOverview.psiResponseSize = result.bytes;

    $('.numberOfHosts').html(testOverview.psiDomains);
    $('.numberOfRequests').html(testOverview.psiRequests);
    $('.numberOfBytes').html(convertBytesService.convertBytes(testOverview.psiResponseSize, 2));
}

function showComparisonError(e) {
  console.error(e.stack);
  resetComparison();
  resetViewService.showError();
}

function resetComparison() {
    if (co_subscription)
        co_subscription.unsubscribe();

    if (sk_subscription)
        sk_subscription.unsubscribe();

    co_baqendId = sk_baqendId = null;
    pageSpeedInsightFailed = false;
    testResult = {};
    testVideo = {};

    resetViewService.resetView();
    history.pushState({}, title, "/");
}

function getParameterByName(name) {
    let url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function sleep(milis) {
    return new Promise(resolve => {
        setTimeout(resolve, milis);
    });
}
