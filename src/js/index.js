import { convertBytes } from './ConvertBytesService';
import { callPageSpeedInsightsAPI } from './PageSpeedInsightsAPIService';
import { showError, showInfoBox, startTest, resetView, resetViewAfterTest } from './ResetVariablesService';
import { getBaqendUrl} from './SpeedKitUrlService';
import { displayTestResultsById, displayTestResults, calculateFactors } from './TestResultHandler';
import { createImageElement, createVideoElement, createScannerElement, createLinkButton } from './UiElementCreator';

import "bootstrap";
import "../styles/main.scss";
import * as hbs from "../templates";
import { db } from "baqend/realtime";
import { Subscription } from 'rxjs';

/** @type {string} */
let co_url;
let testResult = {};
let testVideo = {};
let testOptions = {location: 'eu-central-1:Chrome', caching: false};
/** @type {boolean} */
let pageSpeedInsightFailed = false;
let testInstance;
/** @type {Subscription} */
let co_subscription;
/** @type {Subscription} */
let sk_subscription;
/** @type {db.TestOverview} */
let testOverview;
/** @type {string | null} */
let co_baqendId;
/** @type {string | null} */
let sk_baqendId;
/** @type {Object} */
let interval;
/** @type {string} */
let title;

document.addEventListener("DOMContentLoaded", () => {
    $("#main").html(hbs.main({}));
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
          displayTestResultsById(testOptions, result);
        }
    });
  }

  const url = getParameterByName("url");
  if (url) {
    window.submitComparison(url);
  }
};

window.showInfoBox = () => {
    showInfoBox();
};

window.showImplementation = () => {
    $('#implementation-toggle').hide();
    $('#implementation-dots').hide();
    $('.implementation-hidden').show("medium");
};

window.openBaqendFrame = () => {
    const win = window.open(getBaqendUrl(co_url, $('#wListInput').val()), '_blank');
    win.focus();
};

/**
 * @param {HTMLInputElement} radioButton
 */
window.handleLocationChange = (radioButton) => {
    if (radioButton.value === 'usa') {
        testOptions.location = 'us-east-1:Chrome';
    } else if (radioButton.value === 'eu') {
        testOptions.location = 'eu-central-1:Chrome';
    }
};

/**
 * @param {HTMLInputElement} radioButton
 */
window.handleCachingChange = (radioButton) => {
    testOptions.caching = radioButton.value;
    if (radioButton.value === 'yes') {
        testOptions.caching = false;
    } else if (radioButton.value === 'no') {
        testOptions.caching = true;
    }
};

/**
 * @param {HTMLVideoElement} videoElement
 */
window.playVideos = (videoElement) => {
    if (videoElement.id === 'video-competitor') {
        /** @type {HTMLVideoElement} */
        const videoSpeedKit = document.getElementById('video-speedKit');
        if (videoSpeedKit) {
            videoSpeedKit.currentTime = videoElement.currentTime;
            videoSpeedKit.play();
        }
    } else {
        /** @type {HTMLVideoElement} */
        const videoCompetitor = document.getElementById('video-competitor');
        if (videoCompetitor) {
            videoCompetitor.currentTime = videoElement.currentTime;
            videoCompetitor.play();
        }
    }
};

window.printReport = () => {
    /** @type {HTMLVideoElement} */
    const competitorVideo = document.getElementById('video-competitor');
    /** @type {HTMLVideoElement} */
    const speedKitVideo = document.getElementById('video-speedKit');
    competitorVideo.currentTime = competitorVideo.duration;
    speedKitVideo.currentTime = speedKitVideo.duration;

    setTimeout(function () {
        window.print();
    }, 100);
};

/**
 * @param {Event} e
 */
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

$('#currentVendorUrl').on('keydown', (event) => {
  $('#currentVendorUrlInvalid').hide();

  if (event.keyCode == 13)
      window.submitComparison();
});

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

/**
 * @param {string} url
 */
function initComparison(url) {
    resetComparison();

    const now = Date.now();
    testInstance = now;

    co_url = url;
    startTest();
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
        url: getBaqendUrl(co_url, $('#wListInput').val()),
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

/**
 * @param {number} now Current timestamp.
 * @return {Promise<void>}
 */
function callPageSpeed(now) {
  const carousel = $('.carousel').carousel({ interval: false, wrap: false });
  carousel.carousel(0);

  let screenShot;

  return callPageSpeedInsightsAPI(co_url)
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
        $('#competitor').append(createImageElement(screenShot),
          createScannerElement());

        $('#speedKit').append(createImageElement(screenShot),
          createScannerElement());
      }
    });
}

/**
 * @param {*} result
 * @param {Subscription} subscription
 * @param {string} elementId
 */
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
                    displayTestResults('competitor', testResult['competitor'][dataView], testOptions);
                    displayTestResults('speedKit', testResult['speedKit'][dataView], testOptions);
                    calculateFactors(testResult['competitor'][dataView], testResult['speedKit'][dataView], testOptions);

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
                    competitorElement.append(createVideoElement('video-competitor', testVideo['competitor']));
                    speedKitElement.append(createVideoElement('video-speedKit', testVideo['speedKit']));
                    speedKitElement.append(createLinkButton());

                    resetViewAfterTest();
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

/**
 * @param {{ domains: number | null, requests: number | null, bytes: number | null, screenshot: string | null }} result
 */
function setPageSpeedMetrics(result) {
    testOverview.psiDomains = result.domains;
    testOverview.psiRequests = result.requests;
    testOverview.psiResponseSize = result.bytes;

    $('.numberOfHosts').html(testOverview.psiDomains);
    $('.numberOfRequests').html(testOverview.psiRequests);
    $('.numberOfBytes').html(convertBytes(testOverview.psiResponseSize, 2));
}

/**
 * @param {Error} e
 */
function showComparisonError(e) {
  console.error(e.stack);
  resetComparison();
  showError();
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

    resetView();
    history.pushState({}, title, "/");
}

/**
 * @param {string} name
 * @return {null|string}
 */
function getParameterByName(name) {
    const url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
          results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/**
 * @param {number} millis
 * @return {Promise}
 */
function sleep(millis) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}
