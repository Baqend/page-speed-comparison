/* global $ */

import { createLinkButton, createVideoElement } from './UiElementCreator';
import { formatFileSize } from './utils';
import { roundToHundredths, roundToTenths, formatPercentage, zeroSafeDiv } from './maths';
import { getBaqendUrl } from './SpeedKitUrlService';

/**
 * @param {string} elementId
 * @param {*} data
 * @param {{ caching: boolean }} testOptions
 */
export function displayTestResults(elementId, data, testOptions) {
  const lastVisualChange = roundToTenths((data.lastVisualChange / 1000) % 60);
  $(`.${elementId}-speedIndex`).html(`${data.speedIndex}ms`);
  $(`.${elementId}-firstMeaningfulPaint`).html(`${data.firstMeaningfulPaint}ms`);
  $(`.${elementId}-dom`).html(`${data.domLoaded}ms`);
  $(`.${elementId}-fullyLoaded`).html(`${data.fullyLoaded}ms`);
  $(`.${elementId}-lastVisualChange`).html(`${roundToHundredths(lastVisualChange)}s`);

  if (testOptions.caching) {
    $(`.${elementId}-ttfb`).html('-');
  } else {
    $(`.${elementId}-ttfb`).html(`${data.ttfb}ms`);
  }
  $('.testResults').removeClass('invisible');
}

/**
 * @param {{ caching: boolean }} testOptions
 * @param {*} result
 */
export function displayTestResultsById(testOptions, result) {
  const dataView = testOptions.caching ? 'repeatView' : 'firstView';
  const videoView = testOptions.caching ? 'videoFileRepeatView' : 'videoFileFirstView';
  const competitorResult = result.competitorTestResult;
  const speedKitResult = result.speedKitTestResult;

  $('.center-vertical').removeClass('center-vertical');
  $('.numberOfHosts').html(result.psiDomains);
  $('.numberOfRequests').html(result.psiRequests);

  // Test whether the bytes value is a string or an integer
  // (needed because the data type was switched from string to int)
  if (/^\d+$/.test(result.psiResponseSize)) {
    $('.numberOfBytes').html(formatFileSize(result.psiResponseSize, 2));
  } else {
    $('.numberOfBytes').html(result.psiResponseSize);
  }

  $('#compareContent').removeClass('hidden');
  $('#printButton').removeClass('hidden');
  $('#informationContent').removeClass('hidden');
  $('#boostWorthiness').removeClass('hidden');
  $('.infoBox').fadeOut(0);
  $('.hideOnDefault').addClass('hidden');
  $('#competitorLink').removeClass('hidden').empty();
  $('#speedKitLink').removeClass('hidden').empty();

  if (competitorResult.location.indexOf('us') !== -1) {
    $('#location_left').prop('checked', true);
  }

  $('#caching_left').prop('checked', result.caching);

  displayTestResults('competitor', competitorResult[dataView], testOptions);
  $('#competitor').empty().append(createVideoElement('video-competitor', competitorResult[videoView].url));

  displayTestResults('speedKit', speedKitResult[dataView], testOptions);

  if (/^https/.test(competitorResult.url)) {
    $('#competitorLink').append(createLinkButton(competitorResult.url));
    $('#speedKitLink').append(createLinkButton(getBaqendUrl(competitorResult.url, result.whitelist)));
  }

  $('#speedKit').empty().append(createVideoElement('video-speedKit', speedKitResult[videoView].url));
}

/**
 * @param {Error} error
 */
export function verifyWarningMessage(error) {
  if (error) {
    $('#warningMessage').text(() => {
      switch (error.message) {
        case 'Too many requests':
          return 'You reached the maximum number of running tests. Please wait at least one ' +
            'minute until you start further tests!';
        case 'Baqend app detected':
          return 'Your website already uses baqend´s technology. Please choose another website ' +
            'to be tested!';
        case 'Low served rate':
          return 'The number of resources served by the Speed Kit is quite low. Choose some of the suggested ' +
            'domains to improve the test result.';
        case 'Bad result':
          return 'It looks like some fine-tuning or configuration is required to measure your site. Please contact our ' +
            'web performance experts for further information and assistance!';
        case 'Show FMC':
          return 'Because your website uses a lot of asynchronous resources, we replaced the speed index metric ' +
            'by the first meaningful paint!';
        default:
          return 'While running the test an error occurred. Please retry the test or contact our ' +
            'web performance experts for further information and assistance!';
      }
    });

    $('#warningAlert').removeClass('hidden');
  }
}

/**
 * @param {*} competitorData
 * @param {*} speedKitData
 */
export function isSpeedIndexSatisfactory(competitorData, speedKitData) {
  if (competitorData.speedIndex > 0 && speedKitData.speedIndex > 0) {
    const speedIndexFactor = roundToHundredths(competitorData.speedIndex / speedKitData.speedIndex);
    return speedIndexFactor > 1.2;
  }
  return false;
}

/**
 * @param {*} competitorData
 * @param {*} speedKitData
 */
export function isFMPSatisfactory(competitorData, speedKitData) {
  if (competitorData.firstMeaningfulPaint > 0 && speedKitData.firstMeaningfulPaint > 0) {
    const firstMeaningfulPaintFactor =
      roundToHundredths(competitorData.firstMeaningfulPaint / speedKitData.firstMeaningfulPaint);
    return firstMeaningfulPaintFactor > 1.2;
  }
  return false;
}

/**
 * @param {*} data
 * @return {string}
 */
export function calculateServedRequests(data) {
  const totalRequests = data.requests || 0;

  const cacheHits = data.hits.hit || 0;
  const cacheMisses = data.hits.miss || 0;
  const otherRequests = data.hits.other || 0;

  // eslint-disable-next-line no-console
  console.log(`hit: ${cacheHits} miss: ${cacheMisses} other: ${otherRequests} total: ${totalRequests}`);

  const servedFactor = (totalRequests - otherRequests) / totalRequests;
  return formatPercentage(servedFactor);
}

/**
 * @param {*} speedKitData
 */
export function isServedRateSatisfactory(speedKitData) {
  return calculateServedRequests(speedKitData) >= 30;
}

/**
 * @param {number} competitorValue
 * @param {number} speedKitValue
 */
export function calculateFactor(competitorValue, speedKitValue) {
  return roundToHundredths(zeroSafeDiv(competitorValue, speedKitValue));
}

/**
 * @param {*} competitorValue
 * @param {*} speedKitValue
 */
export function calculateRevenueBoost(competitorValue, speedKitValue) {
  const factor = calculateFactor(competitorValue, speedKitValue);
  $('.boostValue').text(factor);

  const publisherRevenue = Math.round(((competitorValue - speedKitValue) / (19000 - 5000)) * 100);
  $('.publisherRevenue').text(`${publisherRevenue}%`);

  const eCommerceRevenue = Math.round((competitorValue - speedKitValue) * 0.01);
  $('.eCommerceRevenue').text(`${eCommerceRevenue}%`);
}

/**
 * @param {*} competitor A data view of the competitor's page results.
 * @param {*} speedKit A data view of Speed Kit's page results.
 * @param {{ caching: boolean }} testOptions
 */
export function calculateFactors(competitor, speedKit, testOptions) {
  const fasterStr = factor => `${factor}x ${factor > 1 ? 'Faster' : ''}`;

  const props = {
    speedIndex: $('.speedIndex-factor'),
    firstMeaningfulPaint: $('.firstMeaningfulPaint-factor'),
    domLoaded: $('.dom-factor'),
    fullyLoaded: $('.fullyLoaded-factor'),
    lastVisualChange: $('.lastVisualChange-factor'),
  };

  Object.entries(props).forEach(([key, $element]) => {
    const factor = calculateFactor(competitor[key], speedKit[key]);
    $element.html(fasterStr(factor));
  });

  if (!testOptions.caching) {
    const ttfbFactor = calculateFactor(competitor.ttfb, speedKit.ttfb);
    $('.ttfb-factor').html(fasterStr(ttfbFactor));
  } else {
    $('.ttfb-factor').html('');
  }
}
