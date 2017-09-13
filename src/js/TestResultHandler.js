import { createVideoElement, createLinkButton } from './UiElementCreator';
import { formatFileSize } from './utils';
import { roundToTenths, roundToHundredths } from './maths';

/**
 * @param {{ caching: boolean }} testOptions
 * @param {*} result
 */
export function displayTestResultsById(testOptions, result) {
    const dataView = testOptions.caching ? 'repeatView' : 'firstView';
    const videoView = testOptions.caching ? 'videoFileRepeatView' : 'videoFileFirstView';

    $('.center-vertical').removeClass('center-vertical');
    $('.numberOfHosts').html(result.psiDomains);
    $('.numberOfRequests').html(result.psiRequests);

    //test whether the bytes value is a string or an integer (needed because the data type was switched from string to int)
    if (/^\d+$/.test(result.psiResponseSize)) {
        $('.numberOfBytes').html(formatFileSize(result.psiResponseSize, 2));
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
    $('.hideOnDefault').addClass('hidden');
    $('#warningMessage').addClass('hidden');

    if (result.competitorTestResult.location.indexOf('us') !== -1) {
        $('#location_left').prop('checked', true);
    }

    $('#caching_left').prop('checked', result.caching);

    displayTestResults('competitor', result.competitorTestResult[dataView], testOptions);
    $('#competitor').empty().append(createVideoElement('video-competitor',
        result.competitorTestResult[videoView].url));

    displayTestResults('speedKit', result.speedKitTestResult[dataView], testOptions);
    $('#speedKit').empty().append(/^https/.test(result.competitorTestResult.url) ? createLinkButton() : '',
        createVideoElement('video-speedKit', result.speedKitTestResult[videoView].url));

    calculateFactors(result.competitorTestResult[dataView], result.speedKitTestResult[dataView], testOptions);
    $('#servedRequests').text(calculateServedRequests(result.speedKitTestResult.firstView));
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
}


/**
 * @param {*} competitorData
 *  * @param {*} SpeedKitData
 */
export function isBadTestResult(competitorData, SpeedKitData) {
    const speedIndexFactor = roundToHundredths(competitorData.speedIndex / (SpeedKitData.speedIndex > 0 ? SpeedKitData.speedIndex : 1));
    return speedIndexFactor < 1.2 || calculateServedRequests(SpeedKitData) < 20;
}

/**
 * @param {*} data
 */
export function calculateServedRequests(data) {
    const totalRequests = data.requests;

    const cacheHits = data.hits.hit || 0;
    const cacheMisses = data.hits.miss || 0;
    const otherRequests = data.hits.other || 0;

    console.log('hit: ' + cacheHits + ' miss: ' + cacheMisses + ' other: ' +
        otherRequests + ' total: ' + (totalRequests || 0));

    return (100 / totalRequests * ((totalRequests || 0) - otherRequests)).toFixed(0);
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
