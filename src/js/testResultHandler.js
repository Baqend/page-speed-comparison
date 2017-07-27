const UiElementCreator = require('./uiElementCreator.js');
const uiElementCreator = new UiElementCreator();

class TestResultHandler {
    displayTestResultsById(testId, testOptions, db) {
        db.TestOverview.load(testId, {depth: 1}).then((result) => {
            const dataView = testOptions.caching ? 'repeatView' : 'firstView';
            const videoView = testOptions.caching ? 'videoIdRepeatedView' : 'videoIdFirstView';

            $('#currentVendorUrl').val(result.competitorTestResult.url);
            $('.center-vertical').removeClass('center-vertical');
            $('.numberOfHosts').html(result.psiDomains);
            $('#numberOfHostsCol').removeClass('invisible');
            $('.numberOfRequests').html(result.psiRequests);
            $('#numberOfRequestsCol').removeClass('invisible');
            $('.numberOfBytes').html(result.psiResponseSize);
            $('#numberOfBytesCol').removeClass('invisible');
            $('#compareContent').removeClass('invisible');
            $('#wListConfig').removeClass('hidden');
            $('#wListInput').val(result.whitelist);
            $('.infoBox').fadeOut(0);

            if (result.competitorTestResult.location.indexOf('us') !== -1) {
                testOptions.location = result.competitorTestResult.location;
                $('#location_left').prop("checked", true);
            }

            $('#caching_left').prop("checked", result.caching);
            testOptions.caching = result.caching;

            this.displayTestResults('competitor', result.competitorTestResult[dataView], testOptions);
            $('#competitor').append(uiElementCreator.createVideoElement('video-competitor',
                uiElementCreator.constructVideoLink(result.competitorTestResult, videoView)));

            this.displayTestResults('speedKit', result.speedKitTestResult[dataView], testOptions);
            $('#speedKit').append(uiElementCreator.createLinkButton(), uiElementCreator.createVideoElement('video-speedKit',
                uiElementCreator.constructVideoLink(result.speedKitTestResult, videoView)));

            this.calculateFactors(result.competitorTestResult[dataView], result.speedKitTestResult[dataView], testOptions);
        })
    }

    displayTestResults(elementId, data, testOptions) {
        const lastVisualChange = ((data.lastVisualChange / 1000) % 60).toFixed(1);
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

    calculateFactors(competitorResult, speedKitResult, testOptions) {
        const speedIndexFactor = (competitorResult.speedIndex / speedKitResult.speedIndex).toFixed(2);
        $('.speedIndex-factor').html(speedIndexFactor + 'x ' + (speedIndexFactor > 1 ? 'Faster' : ''));

        const domFactor = (competitorResult.domLoaded / speedKitResult.domLoaded).toFixed(2);
        $('.dom-factor').html(domFactor + 'x ' + (domFactor > 1 ? 'Faster' : ''));

        const fullyLoadedFactor = (competitorResult.fullyLoaded / speedKitResult.fullyLoaded).toFixed(2);
        $('.fullyLoaded-factor').html(fullyLoadedFactor + 'x ' + (fullyLoadedFactor > 1 ? 'Faster' : ''));

        const lastVisualChangeFactor = (competitorResult.lastVisualChange / speedKitResult.lastVisualChange).toFixed(2);
        $('.lastVisualChange-factor').html(lastVisualChangeFactor + 'x ' + (lastVisualChangeFactor > 1 ? 'Faster' : ''));

        if (!testOptions.caching) {
            const ttfbFactor = (competitorResult.ttfb / speedKitResult.ttfb).toFixed(2);
            $('.ttfb-factor').html(ttfbFactor + 'x ' + (ttfbFactor > 1 ? 'Faster' : ''));
        }
    }
}
module.exports = TestResultHandler;