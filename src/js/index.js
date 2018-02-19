/* eslint-disable no-use-before-define */
/* global $ APP document REPORT_PAGE window */

import 'bootstrap';
import { db } from 'baqend/realtime';

import { formatFileSize, getParameterByName, isDeviceIOS, sleep, sortArray } from './utils';
import { callPageSpeedInsightsAPI } from './pageSpeed';
import {
  resetView,
  resetViewAfterBadTestResult,
  resetViewAfterTest,
  showExamples,
  showInfoBox,
  startTest,
} from './ResetVariablesService';
import { generateRules, generateSpeedKitConfig, getBaqendUrl, getTLD } from './SpeedKitUrlService';
import {
  calculateFactors,
  calculateRevenueBoost,
  calculateServedRequests,
  displayTestResults,
  displayTestResultsById,
  isServedRateSatisfactory,
  isSpeedIndexSatisfactory,
  isFMPSatisfactory,
  verifyWarningMessage,
} from './TestResultHandler';
import {
  createImageElement,
  createLinkButton,
  createScannerElement,
  createVideoElement,
  createWhitelistCandidates,
} from './UiElementCreator';

import '../styles/main.scss';
import * as hbs from '../templates';

/** @type {string} */
let competitorUrl;
let testResult = {};
let testVideo = {};
const testOptions = { location: 'eu-central-1:Chrome.Native', caching: false, mobile: false };
/** @type {boolean} */
let pageSpeedInsightFailed = false;
let testInstance;
/** @type {Subscription} */
let competitorSubscription;
/** @type {Subscription} */
let speedKitSubscription;
/** @type {db.TestOverview} */
let testOverview;
/** @type {string} */
let title;
/** @type {boolean} */
let isSpeedKitComparison;

document.addEventListener('DOMContentLoaded', () => {
  $('#main').html(hbs.main({}));
  $('[data-toggle="tooltip"]').tooltip();

  db.connect(APP, true).then(() => {
    initTest();
  });

  // Simplified version for report view
  if (REPORT_PAGE) {
    $('#testConfiguration').remove();
    $('#whitelist').remove();
  }

  title = $('title').text();

  $('#currentVendorUrl').on('keydown', () => {
    $('#currentVendorUrlInvalid').hide();
  });

  $('#formWhitelist, #formConfiguration').on('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitComparison();
  });

  $('#wListInput, #currentVendorUrl').on('click', () => {
    showInfoBox();
  });

  /**
   * @param {Event} event
   */

  $('#implementation-toggle').on('click', (event) => {
    event.preventDefault();
    $('#implementation-toggle').hide();
    $('#implementation-dots').hide();
    $('.implementation-hidden').show('medium');
  });

  $('#printReport').on('click', () => {
    /** @type {HTMLVideoElement} */
    const competitorVideo = document.getElementById('video-competitor');
    /** @type {HTMLVideoElement} */
    const speedKitVideo = document.getElementById('video-speedKit');
    competitorVideo.currentTime = competitorVideo.duration;
    speedKitVideo.currentTime = speedKitVideo.duration;

    setTimeout(() => {
      window.print();
    }, 100);
  });

  /**
   * @param {Event} event
   */
  $('.contact_form').on('submit', (event) => {
    event.preventDefault();
    const $children = $(event.target).children();
    const $confirmContact = $children.filter('#confirmContact');
    const $name = $children.find('#c_name');
    const $email = $children.find('#c_email');

    const data = {
      name: $name.val(),
      email: $email.val(),
      url: competitorUrl,
      testOverviewId: testOverview ? testOverview.id : 'not existing',
      subject: 'from page speed analyzer',
    };

    $.post('https://bbq.app.baqend.com/v1/code/mailUs', data, () => {
      $name.val('');
      $email.val('');
      $confirmContact.removeClass('hidden');
    });
  });

  $('#showTestPool').on('click', () => {
    $('#showTestPool').addClass('hidden');
    $('#whitelist').addClass('hidden');
    $('#boostWorthiness').addClass('hidden');
    $('#printButton').addClass('hidden');
    $('.hideOnError').addClass('hidden');
    $('.hideOnDefault').removeClass('hidden');
  });
});

window.addEventListener('scroll', () => {
  const stop = Math.round($(window).scrollTop());
  if (stop > 50) {
    $('body').addClass('scrolled');
  } else {
    $('body').removeClass('scrolled');
  }
});

window.addEventListener('popstate', () => {
  window.history.pushState(null, document.title, window.location.href);
});

/**
 * @param {HTMLInputElement} radioButton
 */
window.handleLocationChange = (radioButton) => {
  if (radioButton.value === 'usa') {
    testOptions.location = 'us-east-1:Chrome.Native';
  } else if (radioButton.value === 'eu') {
    testOptions.location = 'eu-central-1:Chrome.Native';
  }
};

/**
 * @param {HTMLInputElement} radioButton
 */
window.handleCachingChange = (radioButton) => {
  testOptions.caching = !radioButton.value;
  if (radioButton.value === 'yes') {
    testOptions.caching = false;
  } else if (radioButton.value === 'no') {
    testOptions.caching = true;
  }
};

/**
 * @param {HTMLInputElement} radioButton
 */
window.handleMobileChange = (radioButton) => {
  testOptions.mobile = radioButton.value;
  if (radioButton.value === 'yes') {
    testOptions.mobile = true;
  } else if (radioButton.value === 'no') {
    testOptions.mobile = false;
  }
};

/**
 * @param {HTMLVideoElement} videoElement
 */
window.playVideos = (videoElement) => {
  const firstVideo = videoElement;
  firstVideo.currentTime = 0;
  const playPromise = firstVideo.play();
  if (!isDeviceIOS()) {
    /** @type {HTMLVideoElement} */
    const secondVideo = document.getElementById(videoElement.id === 'video-speedKit' ? 'video-competitor' : 'video-speedKit');

    secondVideo.currentTime = 0;
    playPromise.then(() => secondVideo.play()).catch(() => {});
  }
};

window.handleTestExampleClick = (testId) => {
  window.history.pushState({}, title, `/?testId=${testId}`);
  $('#showTestPool').removeClass('hidden');
  $('.hideContact').removeClass('hidden');
  $('.hideOnError').removeClass('hidden');
  $('.hideOnDefault').addClass('hidden');
  initTest();
};

window.whitelistCandidateClicked = (elementId) => {
  const checkboxElement = document.getElementById(elementId);
  const wListInput = document.getElementById('wListInput');
  const regex = new RegExp(`,?\\s?\\b${elementId}\\s?\\b,?`);

  if (regex.test(wListInput.value)) {
    const inputArray = wListInput.value.split(',').map(item => item.trim());
    inputArray.splice(inputArray.indexOf(elementId), 1);
    wListInput.value = inputArray.join(', ');
  } else if (!checkboxElement.checked) {
    wListInput.value = wListInput.value.length !== 0 ? `${wListInput.value}, ${elementId}` : elementId;
  }
};

/**
 * @param {string} url The url to resolve
 * @param {boolean} mobile Resolves the url on desktop or mobile style
 * @return {Promise<{ url: string, speedkit: boolean }>}
 */
async function normalizeUrl(url, mobile) {
  return db.modules.post('normalizeUrl', db, { urls: url, mobile });
}

function initTest() {
  const testIdParam = getParameterByName('testId');

  if (testIdParam && (!testOverview || testOverview.key !== testIdParam)) {
    let dataView;
    let competitorResult;
    let speedKitResult;
    let whitelist;

    db.TestOverview.load(testIdParam, { depth: 1 }).then((result) => {
      if (!result || !result.competitorTestResult || !result.speedKitTestResult) {
        throw new Error();
      }

      dataView = result.caching ? 'repeatView' : 'firstView';
      competitorResult = result.competitorTestResult;
      speedKitResult = result.speedKitTestResult;
      // eslint-disable-next-line prefer-destructuring
      whitelist = result.whitelist;

      $('#skVersionCol').toggleClass('hidden', !result.isSpeedKitComparison);
      $('.skVersion').text(result.speedKitVersion);

      competitorUrl = result.competitorTestResult.url;
      $('#currentVendorUrl').val(competitorUrl);

      if (!competitorResult[dataView] || !speedKitResult[dataView]) {
        throw new Error();
      }

      if (competitorResult.isWordPress) {
        $('#wordPress').removeClass('hidden');
      }

      const isSatisfactory =
        isSpeedIndexSatisfactory(competitorResult[dataView], speedKitResult[dataView])
        || (shouldShowFirstMeaningfulPaint(competitorResult[dataView], speedKitResult[dataView])
            && isFMPSatisfactory(competitorResult[dataView], speedKitResult[dataView]));

      // If speed index is satisfactory ==> show the test result and a list of suggested domains
      // Else don´t show test result but an error message
      if (!isSatisfactory) {
        throw new Error('Bad result');
      }

      testOptions.speedKit = result.speedKit;
      testOptions.caching = result.caching;
      testOptions.mobile = !!result.mobile;
      testOptions.location = competitorResult.location;

      displayTestResultsById(testOptions, result);

      calculateFactors(competitorResult[dataView], speedKitResult[dataView], testOptions);
      $('#servedRequests').text(calculateServedRequests(speedKitResult.firstView));

      // if served rate is not satisfactory ==> show warning message and list of suggested domains
      // else don´t do anything
      if (!isServedRateSatisfactory(speedKitResult[dataView])) {
        verifyWarningMessage(new Error('Low served rate'));
      }

      // Check whether the speed index should be replaced by the first meaningful paint
      // only when the FMP is satisfactory
      if (shouldShowFirstMeaningfulPaint(competitorResult[dataView], speedKitResult[dataView]) &&
        isFMPSatisfactory(competitorResult[dataView], speedKitResult[dataView])) {
        $('.showSpeedIndex').addClass('hidden');
        $('.showFirstMeaningfulPaint').removeClass('hidden');
        verifyWarningMessage(new Error('Show FMC'));
        calculateRevenueBoost(
          competitorResult[dataView].firstMeaningfulPaint,
          speedKitResult[dataView].firstMeaningfulPaint,
        );
      } else {
        $('.showSpeedIndex').removeClass('hidden');
        $('.showFirstMeaningfulPaint').addClass('hidden');

        // check if firstMeaningfulPaint metric was computed (for legacy tests)
        if (!competitorResult[dataView].firstMeaningfulPaint || !speedKitResult[dataView].firstMeaningfulPaint) {
          $('.firstMeaningfulPaintMissing').addClass('hidden');
        }

        calculateRevenueBoost(competitorResult[dataView].speedIndex, speedKitResult[dataView].speedIndex);
      }

      // Handle whitelist candidates and add them to the UI
      handleWhitelistCandidates(speedKitResult[dataView], whitelist);
      $('#servedRequests').text(calculateServedRequests(speedKitResult.firstView));

      // If served rate is not satisfactory ==> show warning message and list of suggested domains
      // Else don´t do anything
      if (!isServedRateSatisfactory(speedKitResult[dataView])) {
        verifyWarningMessage(new Error('Low served rate'));
      }
    }).catch((e) => {
      if (e.message === 'Bad result') {
        // Handle whitelist candidates and add them to the UI
        handleWhitelistCandidates(speedKitResult[dataView], whitelist);
        $('#servedRequests').text(calculateServedRequests(speedKitResult.firstView));

        // If served rate is not satisfactory ==> show warning message and list of suggested domains
        // Else don´t do anything
        if (!isServedRateSatisfactory(speedKitResult[dataView])) {
          e.message = 'Low served rate';
        }
        verifyWarningMessage(e);
        resetViewAfterBadTestResult();
      } else {
        showComparisonError(e);
      }
    });
  }

  const url = getParameterByName('url');
  if (url) {
    submitComparison(url);
  }

  const examples = getParameterByName('examples');
  if (examples) {
    showExamples();
  }
}

/**
 * @param {string} [url]
 * @return {Promise<void>}
 */
async function submitComparison(url = $('#currentVendorUrl').val()) {
  try {
    await db.modules.get('testRateLimited');
    const normalizedResult = await normalizeUrl(url, testOptions.mobile);

    $('#currentVendorUrl').val(normalizedResult[0].url);
    if (!normalizedResult[0].isBaqendApp) {
      initComparison(normalizedResult[0]);
      return;
    }
    showComparisonError(new Error('Baqend app detected'));
  } catch (e) {
    showComparisonError(e);
  }
}

/**
 * Initializes the comparison of a website.
 *
 * @param {{ url: string, speedkit: boolean, speedkitVersion: string, type: string }} normalizedUrl
 *        The normalized URL to compare.
 * @return {Promise<void>} A promise which resolves when the test is done.
 */
async function initComparison(normalizedUrl) {
  // Reset the view
  resetComparison();
  resetView();

  // Enable the status text
  const statusText = $('.carousel').carousel({ interval: false, wrap: false });
  const $competitor = $('#competitor');
  const $speedKit = $('#speedKit');
  const $wListInput = $('#wListInput');
  const now = Date.now();

  statusText.carousel(0);
  testInstance = now;

  isSpeedKitComparison = normalizedUrl.speedkit;
  competitorUrl = normalizedUrl.url;
  $('#skVersionCol').toggleClass('hidden', !isSpeedKitComparison);
  $('.skVersion').text(normalizedUrl.speedkitVersion);

  // Show testing UI
  startTest();
  $('.center-vertical').animate({ marginTop: '0px' }, 500);
  const activityTimeout = parseInt($('.activityTimeout').val(), 10) || undefined;

  const uniqueId = await db.modules.post('generateUniqueId', { entityClass: 'TestOverview' });
  const tld = getTLD(competitorUrl);

  testOverview = new db.TestOverview();
  testOverview.id = uniqueId + tld.substring(0, tld.length - 1);
  testOverview.caching = testOptions.caching;
  testOverview.mobile = testOptions.mobile;
  testOverview.url = competitorUrl;
  testOverview.whitelist = $wListInput.val();
  testOverview.isSpeedKitComparison = isSpeedKitComparison;
  testOverview.speedKitVersion = normalizedUrl.speedkitVersion;

  try {
    const [competitorResult, speedKitResult] = await Promise.all([
      // Test the competitor site
      db.modules.post('queueTest', {
        url: competitorUrl,
        activityTimeout,
        isSpeedKitComparison,
        location: testOptions.location,
        isClone: false,
        caching: testOptions.caching,
        mobile: testOptions.mobile,
      }),
      // Test the Makefast site
      db.modules.post('queueTest', {
        url: competitorUrl,
        activityTimeout,
        isSpeedKitComparison,
        speedKitConfig: generateSpeedKitConfig(competitorUrl, $wListInput.val(), testOptions.mobile),
        location: testOptions.location,
        isClone: true,
        caching: testOptions.caching,
        mobile: testOptions.mobile,
      }),
    ]);

    try {
      const pageSpeedResult = await callPageSpeedInsightsAPI(competitorUrl, testOptions.mobile);
      statusText.carousel(1);
      const screenShot = pageSpeedResult.screenshot;
      setPageSpeedMetrics(pageSpeedResult);
      await sleep(1000);

      if (now === testInstance) {
        statusText.carousel(2);
      }
      await sleep(1000);

      if (now === testInstance) {
        statusText.carousel(3);
      }
      await sleep(1000);

      if (now === testInstance) {
        statusText.carousel(4);
        getTestStatus(competitorResult.baqendId);
      }
      await sleep(1000);

      if (now === testInstance) {
        $('#compareContent').removeClass('hidden');
        $('.hideOnWithSpeedKit').toggleClass('hidden', isSpeedKitComparison);
        $('.hideOnWoSpeedKit').toggleClass('hidden', !isSpeedKitComparison);
        $('#whitelist').toggleClass('hidden', isSpeedKitComparison);

        // Check whether the container elements don´t have any content (e.g. video already created)
        if ($competitor.children().length < 1 && $speedKit.children().length < 1) {
          $competitor.append(
            createImageElement(screenShot),
            createScannerElement(),
          );

          $speedKit.append(
            createImageElement(screenShot),
            createScannerElement(),
          );
        }

        await sleep(2000);
        // Subscribe on the test results
        subscribeOnResult(competitorResult.baqendId, speedKitResult.baqendId);
      }
    } catch (error) {
      statusText.carousel(4);
      pageSpeedInsightFailed = true;
      getTestStatus(competitorResult.baqendId);
      subscribeOnResult(competitorResult.baqendId, speedKitResult.baqendId);
    }
  } catch (e) {
    showComparisonError(e);
  }
}

/**
 * @param {string} competitorBaqendId
 * @param {string} speedKitBaqendId
 */
function subscribeOnResult(competitorBaqendId, speedKitBaqendId) {
  const competitorOnNext = result => resultStreamUpdate(result, competitorSubscription, 'competitor');
  const speedKitOnNext = result => resultStreamUpdate(result, speedKitSubscription, 'speedKit');
  const onError = err => showComparisonError(err);

  competitorSubscription = db.TestResult.find().equal('id', `/db/TestResult/${competitorBaqendId}`)
    .resultStream(competitorOnNext, onError);

  speedKitSubscription = db.TestResult.find().equal('id', `/db/TestResult/${speedKitBaqendId}`)
    .resultStream(speedKitOnNext, onError);
}

/**
 * @param {string} competitorBaqendId
 */
function getTestStatus(competitorBaqendId) {
  const interval = setInterval(() => {
    if (competitorBaqendId) {
      try {
        db.modules.get('getTestStatus', { baqendId: competitorBaqendId }).then((res) => {
          if (!res.error) {
            if (res.status.statusCode === 101) {
              $('#statusQueue').html(res.status.statusText);
            } else if (res.status.statusCode === 100 || res.status.statusCode === 200) {
              $('#statusQueue').html('Test has been started...');
              clearInterval(interval);
            }
          }
        });
      } catch (e) {
        clearInterval(interval);
      }
    }
  }, 2000);
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
  $('.numberOfBytes').html(formatFileSize(testOverview.psiResponseSize, 2));
}

function resetComparison() {
  if (competitorSubscription) {
    competitorSubscription.unsubscribe();
  }

  if (speedKitSubscription) {
    speedKitSubscription.unsubscribe();
  }

  pageSpeedInsightFailed = false;
  testResult = {};
  testVideo = {};

  window.history.pushState({}, title, '/');
}

/**
 * @param {Error} e
 */
function showComparisonError(e) {
  verifyWarningMessage(e);
  resetComparison();
  resetViewAfterBadTestResult();
}

function handleWhitelistCandidates(resultData, whitelist) {
  if (resultData.domains) {
    const sortedDomains = sortArray(resultData, 'domains');
    const totalRequestCount = resultData.requests;

    const rules = generateRules(competitorUrl, whitelist);
    const regexp = new RegExp(rules);

    createWhitelistCandidates(
      sortedDomains
        .filter(domainObject => (
          !regexp.test(domainObject.url)
            && domainObject.url.indexOf('makefast') === -1
            && domainObject.url.indexOf('app.baqend') === -1
            && !domainObject.isAdDomain
        ))
        .splice(0, 6),
      whitelist,
      totalRequestCount,
    );
  }
}

/**
 * @param competitorResult Result from the competitor's site.
 * @param speedKitResult Result from Speed Kit.
 * @return {boolean}
 */
function shouldShowFirstMeaningfulPaint(competitorResult, speedKitResult) {
  // Competitor fully loaded minus competitor time to first byte ist bigger than ten seconds
  const firstCondition = competitorResult.fullyLoaded - competitorResult.ttfb > 10000;

  // Speed kit served requests are 20% less than competitors served requests (exclude failed requests)
  const secondCondition = (speedKitResult.requests - speedKitResult.failedRequests)
    / (competitorResult.requests - competitorResult.failedRequests) <= 0.75;

  // Speed kit's (fully loaded - last visual change ) - competitor's (fully loaded - last visual change ) is
  // 20% bigger than the max of all four values
  const competitorNum = Math.abs(competitorResult.fullyLoaded - competitorResult.lastVisualChange);
  const speedKitNum = Math.abs(speedKitResult.fullyLoaded - speedKitResult.lastVisualChange);
  const max = Math.max(
    competitorResult.fullyLoaded,
    competitorResult.lastVisualChange,
    speedKitResult.fullyLoaded,
    speedKitResult.lastVisualChange,
  );
  const thirdCondition = max / Math.abs(competitorNum - speedKitNum) <= 0.8;

  return firstCondition || secondCondition || thirdCondition;
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

    if (!testOverview[`${elementId}TestResult`]) {
      testOverview[`${elementId}TestResult`] = entry;
    }

    try {
      if (!entry.hasFinished && entry.retryRequired) {
        throw new Error('Require retry');
      }

      if (entry.testDataMissing) {
        throw new Error('test data missing');
      }

      if (entry[dataView]) {
        testResult[elementId] = entry;
        if (Object.keys(testResult).length === 2) {
          const competitorResult = testResult.competitor;
          const speedKitResult = testResult.speedKit;
          // If speed index is satisfactory ==> show the test result and a list of suggested domains
          // Else don´t show test result but an error message
          const isSatisfactory = isSpeedIndexSatisfactory(competitorResult[dataView], speedKitResult[dataView])
            || (shouldShowFirstMeaningfulPaint(competitorResult[dataView], speedKitResult[dataView])
              && isFMPSatisfactory(competitorResult[dataView], speedKitResult[dataView]));

          if (!isSatisfactory) {
            throw new Error('Bad result');
          }

          displayTestResults('competitor', competitorResult[dataView], testOptions);
          displayTestResults('speedKit', speedKitResult[dataView], testOptions);
          calculateFactors(competitorResult[dataView], speedKitResult[dataView], testOptions);

          // Compensate missing psi metrics with wpt metrics
          if (pageSpeedInsightFailed) {
            const pageSpeedMetrics = {
              domains: competitorResult.firstView.domains.length,
              requests: competitorResult.firstView.requests,
              bytes: competitorResult.firstView.bytes,
            };
            setPageSpeedMetrics(pageSpeedMetrics);
            $('#compareContent').removeClass('hidden');
          }

          // Check whether the speed index should be replaced by the first meaningful paint
          // only when the FMP is satisfactory
          if (shouldShowFirstMeaningfulPaint(competitorResult[dataView], speedKitResult[dataView]) &&
            isFMPSatisfactory(competitorResult[dataView], speedKitResult[dataView])) {
            $('.showSpeedIndex').addClass('hidden');
            $('.showFirstMeaningfulPaint').removeClass('hidden');
            verifyWarningMessage(new Error('Show FMC'));
            calculateRevenueBoost(
              competitorResult[dataView].firstMeaningfulPaint,
              speedKitResult[dataView].firstMeaningfulPaint,
            );
          } else {
            $('.showSpeedIndex').removeClass('hidden');
            $('.showFirstMeaningfulPaint').addClass('hidden');
            calculateRevenueBoost(competitorResult[dataView].speedIndex, speedKitResult[dataView].speedIndex);
          }

          // Handle whitelist candidates and add them to the UI
          handleWhitelistCandidates(speedKitResult[dataView], testOverview.whitelist);
          $('#servedRequests').text(calculateServedRequests(speedKitResult.firstView));

          // If served rate is not satisfactory ==> show warning message and list of suggested domains
          // Else don´t do anything
          if (!isServedRateSatisfactory(speedKitResult[dataView])) {
            verifyWarningMessage(new Error('Low served rate'));
          }
        }
      }

      if (entry[videoView]) {
        testVideo[elementId] = entry[videoView].url;
        if (Object.keys(testVideo).length === 2) {
          const competitorElement = $('#competitor');
          const speedKitElement = $('#speedKit');

          competitorElement.empty();
          speedKitElement.empty();

          competitorElement.append(createVideoElement('video-competitor', testVideo.competitor));
          speedKitElement.append(createVideoElement('video-speedKit', testVideo.speedKit));

          // Create "open in new tab" button only if the original website has SSL
          if (/^https/.test(competitorUrl)) {
            $('#competitorLink').append(createLinkButton(competitorUrl));
            $('#speedKitLink').append(createLinkButton(getBaqendUrl(competitorUrl, testOverview.whitelist)));
          }

          testOverview.hasFinished = true;
          resetViewAfterTest();
        }
        subscription.unsubscribe();
      }
    } catch (e) {
      if (e.message === 'Bad result') {
        // Handle whitelist candidates and add them to the UI
        handleWhitelistCandidates(testResult.speedKit[dataView], testOverview.whitelist);
        $('#servedRequests').text(calculateServedRequests(testResult.speedKit.firstView));

        // If served rate is not satisfactory ==> show warning message and list of suggested domains
        // Else don´t do anything
        if (!isServedRateSatisfactory(testResult.speedKit[dataView])) {
          e.message = 'Low served rate';
        }
        verifyWarningMessage(e);
        resetViewAfterBadTestResult();
      } else if (e.message === 'Require retry') {
        if (testResult[elementId]) {
          testResult[elementId] = null;
        }
      } else {
        showComparisonError(e);
      }
    }

    if (entry.isWordPress) {
      $('#wordPress').removeClass('hidden');
    }

    testOverview.ready().then(() => testOverview.save()).then(() => {
      window.history.pushState({}, title, `/?testId=${testOverview.key}`);
    });
  }
}
