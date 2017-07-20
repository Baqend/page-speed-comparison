const UiElementCreator = require('./uiElementCreator.js');
const PageSpeedInsightsAPIService = require('./pageSpeedInsightsAPIService.js');
const SpeedKitUrlService = require('./speedKitUrlService.js');

import "../styles/main.scss";
import * as hbs from "../templates";
import "bootstrap";
import db from "baqend/realtime";

const uiElementCreator = new UiElementCreator();
const pageSpeedInsightsAPIService = new PageSpeedInsightsAPIService();
const speedKitUrlService = new SpeedKitUrlService();
const data = {};

let co_url;
let firstResult = {owner: null, result: null, videoSrc: null};
let testOptions = {location: 'eu-central-1:Chrome', noCaching: true};
let testOverview;
let co_testId;
let sk_testId;
let interval;

document.addEventListener("DOMContentLoaded", () => {
    $("#main").html(hbs.main(data));
    $('[data-toggle="tooltip"]').tooltip();

    db.connect('makefast', true).then(() => {
        const testIdParam = getParameterByName('testId');
        if(testIdParam) {
            displayTestResultsById(testIdParam);
        }
    });
});

window.showInfoBox = function() {
    $('.infoBox').fadeIn(1000);
};

window.handleLocationChange =  function(radioButton) {
    if(radioButton.value === 'usa') {
        testOptions.location = 'us-east-1:Chrome';
    } else if(radioButton.value === 'eu') {
        testOptions.location = 'eu-central-1:Chrome';
    }
};

window.handleCachingChange =  function(radioButton) {
    if(radioButton.value === 'yes') {
        testOptions.noCaching = true;
    } else if(radioButton.value === 'no') {
        testOptions.noCaching = false;
    }
};

window.playVideos = function(videoElement) {
    if(videoElement.id === 'video-competitor') {
        const videoSpeedKit = document.getElementById('video-speedKit');
        if(videoSpeedKit) {
            videoSpeedKit.currentTime = videoElement.currentTime;
            videoSpeedKit.play();
        }
    } else {
        const videoCompetitor = document.getElementById('video-competitor');
        if(videoCompetitor) {
            videoCompetitor.currentTime = videoElement.currentTime;
            videoCompetitor.play();
        }
    }
};

window.initComparison = () => {
    showInfoBox();
    const urlInput = $('#currentVendorUrl').val();
    co_url = urlInput.indexOf('http://') !== -1 || urlInput.indexOf('https://') !== -1 ? urlInput : 'http://' + urlInput;

    if (co_url) {
        window.location.hash = '';
        resetComparison();
        $('.center-vertical').animate({'marginTop': '0px'}, 500);

        const carousel = $('.carousel').carousel({interval: false, wrap: false});
        carousel.carousel(0);

        db.modules.get('queueTest', {url: co_url, location: testOptions.location}).then(res => co_testId = res.testId);

        db.modules.get('queueTest', {url: speedKitUrlService.getBaqendUrl(co_url, testOptions.noCaching,
            document.getElementById('wListInput')), location: testOptions.location}).then(res => sk_testId = res.testId);

        pageSpeedInsightsAPIService.callPageSpeedInsightsAPI(encodeURIComponent(co_url)).then((results) => {
            testOverview = new db.TestOverview();
            testOverview.psiDomains = results.domains;
            testOverview.psiRequests = results.resources;
            testOverview.psiResponseSize = results.bytes;
            testOverview.noCaching = testOptions.noCaching;

            carousel.carousel(1);

            setTimeout(() => {
                $('.numberOfHosts').html(results.domains);
                $('#numberOfHostsCol').removeClass('invisible');
                carousel.carousel(2);
            }, 1000);

            setTimeout(() => {
                $('.numberOfRequests').html(results.resources);
                $('#numberOfRequestsCol').removeClass('invisible');

                carousel.carousel(3);
            }, 2000);

            setTimeout(() => {
                $('.numberOfBytes').html(results.bytes);
                $('#numberOfBytesCol').removeClass('invisible');

                carousel.carousel(4);
                interval = setInterval(function() {
                    db.modules.get('getTestStatus', {testId: co_testId}).then(res => {
                        if(res.status.statusCode === 101) {
                            $('#statusQueue').html(res.status.statusText);
                        } else if(res.status.statusCode === 100 || res.status.statusCode === 200) {
                            $('#statusQueue').html('Test has been started...');
                        }
                    });
                }, 2000);
            }, 3000);

            setTimeout(() => {
                $('#compareContent').removeClass('invisible');
                $('#competitor').append(uiElementCreator.createImageElement(results.screenshot), uiElementCreator.createScannerElement());
                $('#speedKit').append(uiElementCreator.createImageElement(results.screenshot), uiElementCreator.createScannerElement());
            }, 4000);

            setTimeout(() => {
                const co_query = db.TestResult.find().equal('testId', co_testId);
                const co_subscription = co_query.resultStream(result =>
                    resultStreamUpdate(result, testOptions.noCaching ? 'firstView' : 'repeatView',
                        testOptions.noCaching ? 'videoIdFirstView' : 'videoIdRepeatedView',
                        co_subscription, 'competitor'));

                const sk_query = db.TestResult.find().equal('testId', sk_testId);
                const sk_subscription = sk_query.resultStream(result =>
                    resultStreamUpdate(result, 'repeatView', 'videoIdRepeatedView', sk_subscription, 'speedKit'));
            }, 6000)
        });
    }
};

/*window.contactUs = (e) => {
 e.preventDefault();

 let data = {
 name: $('#c_name').val(),
 email: $('#c_email').val(),
 url: co_url,
 subject: 'from page speed comparison'
 };

 $.post('https://bbq-bq.global.ssl.fastly.net/v1/code/mailUs', data, (data, status, xhr) => {
 let form = $('#contact_form');
 form.find('.modal-body').html("<p>Thanks. We will get in touch shortly. " +
 "Check out our <a href='https://benchmark.baqend.com' target='_blank'>benchmark</a> in the meantime</p>");
 form.find('.c_submit').remove();
 });
 };*/

function resultStreamUpdate(result, dataView, videoView, subscription, elementId) {
    result.forEach((entry) => {
        if(!testOverview[elementId + 'TestResult']) {
            testOverview[elementId + 'TestResult'] = entry;
        }

        if (entry[dataView]) {
            displayTestResults(elementId, entry[dataView]);
            if(firstResult.owner && firstResult.owner !== elementId) {
                clearInterval(interval);
                firstResult.owner === 'competitor' ? calculateFactors(firstResult.result, entry[dataView])
                    : calculateFactors(entry[dataView], firstResult.result);
            } else {
                firstResult.owner = elementId;
                firstResult.result = entry[dataView];
            }
        }

        if (entry[videoView]) {
            const videoLink = uiElementCreator.constructVideoLink(entry, videoView);

            if(!firstResult.videoSrc && firstResult.owner === elementId) {
                firstResult.videoSrc = videoLink;
            } else {
                const firstElement = $('#' + elementId);
                const secondElement = $('#' + firstResult.owner);
                firstElement.empty();
                secondElement.empty();
                firstElement.append(uiElementCreator.createVideoElement('video-' + elementId, videoLink));
                secondElement.append(uiElementCreator.createVideoElement('video-' + firstResult.owner, firstResult.videoSrc));
                testOverview.insert().then(() => window.location.hash = '?testId=' + testOverview.key);
                $('.infoBox').fadeOut(1000);
                $('#info').removeClass('hidden');
                $('#testStatus').addClass('hidden');
                $('#wListConfig').removeClass('hidden');
            }

            subscription.unsubscribe();
        }
    });
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

function displayTestResults(elementId, data) {
    $('#' + elementId + '-speedIndex').html(data.speedIndex + 'ms');
    $('#' + elementId + '-dom').html(data.domLoaded + 'ms');
    $('#' + elementId + '-lastVisualChange').html(data.lastVisualChange + 'ms');
    $('#' + elementId + '-fullyLoaded').html(data.fullyLoaded + 'ms');

    if(testOptions.noCaching) {
        $('#' + elementId + '-ttfb').html(data.ttfb + 'ms');
    } else {
        $('#' + elementId + '-ttfb').html('-');
    }
    $('#testResults').removeClass('invisible');
}

function calculateFactors(competitorResult, speedKitResult) {
    $('#speedIndex-factor').html((competitorResult.speedIndex / speedKitResult.speedIndex).toFixed(2) + 'x');
    $('#dom-factor').html((competitorResult.domLoaded / speedKitResult.domLoaded).toFixed(2) + 'x');
    $('#lastVisualChange-factor').html((competitorResult.lastVisualChange / speedKitResult.lastVisualChange).toFixed(2) + 'x');
    $('#fullyLoaded-factor').html((competitorResult.fullyLoaded / speedKitResult.fullyLoaded).toFixed(2) + 'x');

    if(testOptions.noCaching)
        $('#ttfb-factor').html((competitorResult.ttfb / speedKitResult.ttfb).toFixed(2) + 'x');
}

function displayTestResultsById(testId) {
    let competitorDataView = 'firstView';
    let competitorVideoView = 'videoIdFirstView';

    db.TestOverview.load(testId, {depth: 1}).then((result) => {
        $('#currentVendorUrl').val(result.competitorTestResult.url);
        $('.center-vertical').removeClass('center-vertical');
        $('.numberOfHosts').html(result.psiDomains);
        $('#numberOfHostsCol').removeClass('invisible');
        $('.numberOfRequests').html(result.psiRequests);
        $('#numberOfRequestsCol').removeClass('invisible');
        $('.numberOfBytes').html(result.psiResponseSize);
        $('#numberOfBytesCol').removeClass('invisible');
        $('#compareContent').removeClass('invisible');
        $('.infoBox').fadeOut(0);

        if(result.competitorTestResult.location.indexOf('us') !== -1) {
            testOptions.location = result.competitorTestResult.location;
            $('#location_left').prop("checked", true);
        }

        if(!result.noCaching) {
            competitorDataView = 'repeatView';
            competitorVideoView = 'videoIdRepeatedView';
            $('#caching_left').prop("checked", true);
            testOptions.noCaching = false;
        }

        displayTestResults('competitor', result.competitorTestResult[competitorDataView]);
        $('#competitor').append(uiElementCreator.createVideoElement('video-competitor',
            uiElementCreator.constructVideoLink(result.competitorTestResult, competitorVideoView)));

        displayTestResults('speedKit', result.speedKitTestResult.repeatView);
        $('#speedKit').append(uiElementCreator.createVideoElement('video-speedKit',
            uiElementCreator.constructVideoLink(result.speedKitTestResult, 'videoIdRepeatedView')));

        calculateFactors(result.competitorTestResult[competitorDataView], result.speedKitTestResult.repeatView);
    })
}

function resetComparison() {
    $('#numberOfHostsCol').addClass('invisible');
    $('#numberOfRequestsCol').addClass('invisible');
    $('#numberOfBytesCol').addClass('invisible');
    $('#compareContent').addClass('invisible');
    $('#testResults').addClass('invisible');
    $('#info').addClass('hidden');
    $('#testStatus').removeClass('hidden');
    $('#statusQueue').html('Initializing test');
    $('#competitor').empty();
    $('#speedKit').empty();
    $('#competitor-speedIndex').html('');
    $('#competitor-ttfb').html('');
    $('#competitor-dom').html('');
    $('#competitor-lastVisualChange').html('');
    $('#competitor-fullyLoaded').html('');
    $('#speedKit-speedIndex').html('');
    $('#speedKit-ttfb').html('');
    $('#speedKit-dom').html('');
    $('#speedKit-lastVisualChange').html('');
    $('#speedKit-fullyLoaded').html('');
    $('#speedIndex-factor').html('');
    $('#ttfb-factor').html('');
    $('#dom-factor').html('');
    $('#lastVisualChange-factor').html('');
    $('#fullyLoaded-factor').html('');
    firstResult = {owner: null, result: null, videoSrc: null};
}