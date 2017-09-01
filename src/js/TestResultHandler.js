import { createVideoElement, createLinkButton } from './UiElementCreator';
import { convertBytes } from './ConvertBytesService';
import { roundToTenths, roundToHundredths } from './maths';

/**
 * @param {{ caching: boolean }} testOptions
 * @param {*} result
 */
export function displayTestResultsById(testOptions, result) {
    const dataView = testOptions.caching ? 'repeatView' : 'firstView';
    const videoView = testOptions.caching ? 'videoFileRepeatView' : 'videoFileFirstView';

    const totalRequests = result.speedKitTestResult[dataView].requests;
    const cacheHits = result.speedKitTestResult[dataView].hits.hit || 0;
    const cacheMisses = result.speedKitTestResult[dataView].hits.miss || 0;
    const otherRequests = result.speedKitTestResult[dataView].hits.other || 0;

    console.log('hit: ' + cacheHits + ' miss: ' + cacheMisses + ' other: ' +
        otherRequests + ' total: ' + (totalRequests || 0));

    $('#currentVendorUrl').val(result.competitorTestResult.url);
    $('.center-vertical').removeClass('center-vertical');
    $('.numberOfHosts').html(result.psiDomains);
    $('.numberOfRequests').html(result.psiRequests);

    //test whether the bytes value is a string or an integer (needed because the data type was switched from string to int)
    if (/^\d+$/.test(result.psiResponseSize)) {
        $('.numberOfBytes').html(convertBytes(result.psiResponseSize, 2));
    } else {
        $('.numberOfBytes').html(result.psiResponseSize);
    }

    $('#compareContent').removeClass('hidden');
    $('#printButton').removeClass('hidden');
    $('#wListConfig').removeClass('hidden');
    $('#wListInput').val(result.whitelist);
    $('#servedRequestsInfo').removeClass('hidden');
    $('#informationContent').removeClass('hidden');
    $('.infoBox').fadeOut(0);

    if (result.competitorTestResult.location.indexOf('us') !== -1) {
        $('#location_left').prop('checked', true);
    }

    $('#caching_left').prop('checked', result.caching);

    this.displayTestResults('competitor', result.competitorTestResult[dataView], testOptions);
    $('#competitor').empty().append(createVideoElement('video-competitor',
        result.competitorTestResult[videoView].url));

    this.displayTestResults('speedKit', result.speedKitTestResult[dataView], testOptions);
    $('#speedKit').empty().append(createLinkButton(), createVideoElement('video-speedKit',
        result.speedKitTestResult[videoView].url));

    this.calculateFactors(result.competitorTestResult[dataView], result.speedKitTestResult[dataView], testOptions);

    $('#servedRequests').text((100 / totalRequests * ((totalRequests || 0) - otherRequests)).toFixed(0));
}

/**
 * @param {string} elementId
 * @param {*} data
 * @param {{ caching: boolean }} testOptions
 */
export function displayTestResults(elementId, data, testOptions) {
    const lastVisualChange = roundToTenths((data.lastVisualChange / 1000) % 60);
    $('.' + elementId + '-speedIndex').html(data.speedIndex + 'ms');
    $('.' + elementId + '-dom').html(data.domLoaded + 'ms');
    $('.' + elementId + '-fullyLoaded').html(data.fullyLoaded + 'ms');
    $('.' + elementId + '-lastVisualChange').html(Math.round(lastVisualChange * 100) / 100 + 's');

    if (testOptions.caching) {
        $('.' + elementId + '-ttfb').html('-');
    } else {
        $('.' + elementId + '-ttfb').html(data.ttfb + 'ms');
    }
    $('.testResults').removeClass('invisible');

    if (elementId === 'competitor' && data.fullyLoaded >= 10000) {
        $('#warningMessage').removeClass('hidden');
    }
}

/**
 * @param {*} competitorResult
 * @param {*} speedKitResult
 * @param {{ caching: boolean }} testOptions
 */
export function calculateFactors(competitorResult, speedKitResult, testOptions) {
    const speedIndexFactor = roundToHundredths(competitorResult.speedIndex / (speedKitResult.speedIndex > 0 ? speedKitResult.speedIndex : 1));
    $('.speedIndex-factor').html(speedIndexFactor + 'x ' + (speedIndexFactor > 1 ? 'Faster' : ''));

    const domFactor = roundToHundredths(competitorResult.domLoaded / (speedKitResult.domLoaded > 0 ? speedKitResult.domLoaded : 1));
    $('.dom-factor').html(domFactor + 'x ' + (domFactor > 1 ? 'Faster' : ''));

    const fullyLoadedFactor = roundToHundredths(competitorResult.fullyLoaded / (speedKitResult.fullyLoaded > 0 ? speedKitResult.fullyLoaded : 1));
    $('.fullyLoaded-factor').html(fullyLoadedFactor + 'x ' + (fullyLoadedFactor > 1 ? 'Faster' : ''));

    const lastVisualChangeFactor = roundToHundredths(competitorResult.lastVisualChange / (speedKitResult.lastVisualChange > 0 ? speedKitResult.lastVisualChange : 1));
    $('.lastVisualChange-factor').html(lastVisualChangeFactor + 'x ' + (lastVisualChangeFactor > 1 ? 'Faster' : ''));

    if (!testOptions.caching) {
        const ttfbFactor = roundToHundredths(competitorResult.ttfb / (speedKitResult.ttfb > 0 ? speedKitResult.ttfb : 1));
        $('.ttfb-factor').html(ttfbFactor + 'x ' + (ttfbFactor > 1 ? 'Faster' : ''));
    } else {
        $('.ttfb-factor').html('');
    }
}
