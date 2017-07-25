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
let testOptions = {location: 'eu-central-1:Chrome', caching: false};
let testInstance;
let co_subscription;
let sk_subscription;
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

window.openBaqendFrame = () => {
    const win = window.open(speedKitUrlService.getBaqendUrl(co_url, document.getElementById('wListInput'), '_blank'));
    win.focus();
};

window.handleLocationChange =  function(radioButton) {
    if(radioButton.value === 'usa') {
        testOptions.location = 'us-east-1:Chrome';
    } else if(radioButton.value === 'eu') {
        testOptions.location = 'eu-central-1:Chrome';
    }
};

window.handleCachingChange =  function(radioButton) {
    testOptions.caching = radioButton.value;
    if(radioButton.value === 'yes') {
        testOptions.caching = false;
    } else if(radioButton.value === 'no') {
        testOptions.caching = true;
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

window.printReport = function() {
    const competitorVideo = document.getElementById('video-competitor');
    const speedKitVideo = document.getElementById('video-speedKit');
    competitorVideo.currentTime = competitorVideo.duration;
    speedKitVideo.currentTime = speedKitVideo.duration;

    setTimeout(function() {
        window.print();
    }, 100);

};

window.initComparison = () => {
    const now = Date.now();
    testInstance = now;

    resetComparison();
    showInfoBox();
    const urlInput = $('#currentVendorUrl').val();
    co_url = urlInput.indexOf('http://') !== -1 || urlInput.indexOf('https://') !== -1 ? urlInput : 'http://' + urlInput;

    if (co_url) {
        window.location.hash = '';
        $('.center-vertical').animate({'marginTop': '0px'}, 500);
        $('#configInfo').addClass('hidden');
        $('#runningInfo').removeClass('hidden');

        const carousel = $('.carousel').carousel({interval: false, wrap: false});
        carousel.carousel(0);

        db.modules.get('queueTest', {url: co_url, location: testOptions.location, isClone: false, caching: testOptions.caching})
            .then(res => co_testId = res.testId);

        db.modules.get('queueTest', {url: speedKitUrlService.getBaqendUrl(co_url, document.getElementById('wListInput')),
            location: testOptions.location, isClone: true, caching: testOptions.caching})
            .then(res => sk_testId = res.testId);

        pageSpeedInsightsAPIService.callPageSpeedInsightsAPI(encodeURIComponent(co_url)).then((results) => {
            testOverview = new db.TestOverview();
            testOverview.psiDomains = results.domains;
            testOverview.psiRequests = results.resources;
            testOverview.psiResponseSize = results.bytes;
            testOverview.caching = testOptions.caching;

            carousel.carousel(1);

            setTimeout(() => {
                if(now === testInstance) {
                    $('.numberOfHosts').html(results.domains);
                    $('#numberOfHostsCol').removeClass('invisible');
                    carousel.carousel(2);
                }
            }, 1000);

            setTimeout(() => {
                if(now === testInstance) {
                    $('.numberOfRequests').html(results.resources);
                    $('#numberOfRequestsCol').removeClass('invisible');
                    carousel.carousel(3);
                }
            }, 2000);

            setTimeout(() => {
                if(now === testInstance) {
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
                }
            }, 3000);

            setTimeout(() => {
                if(now === testInstance) {
                    $('#compareContent').removeClass('invisible');
                    $('#competitor').append(uiElementCreator.createImageElement(results.screenshot),
                        uiElementCreator.createScannerElement());

                    $('#speedKit').append(uiElementCreator.createImageElement(results.screenshot),
                        uiElementCreator.createScannerElement());
                }
            }, 4000);

            setTimeout(() => {
                if(now === testInstance) {
                    const co_query = db.TestResult.find().equal('testId', co_testId);
                    co_subscription = co_query.resultStream(result =>
                        resultStreamUpdate(result, co_subscription, 'competitor'));

                    const sk_query = db.TestResult.find().equal('testId', sk_testId);
                    sk_subscription = sk_query.resultStream(result =>
                        resultStreamUpdate(result, sk_subscription, 'speedKit'));
                }
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

function resultStreamUpdate(result, subscription, elementId) {
    const dataView = testOptions.caching ? 'repeatView' : 'firstView';
    const videoView = testOptions.caching ? 'videoIdRepeatedView' : 'videoIdFirstView';

    if(result.length > 0) {
        const entry = result[0];

        if(!entry.testDataMissing) {
            if(!testOverview[elementId + 'TestResult']) {
                testOverview[elementId + 'TestResult'] = entry;
            }

            if (entry[dataView]) {
                if(firstResult.owner && firstResult.owner !== elementId) {
                    clearInterval(interval);
                    displayTestResults(firstResult.owner, firstResult.result);
                    displayTestResults(elementId, entry[dataView]);
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
                    $('#runningInfo').addClass('hidden');
                    $('#configInfo').removeClass('hidden');
                    $('#wListConfig').removeClass('hidden');
                    $('#speedKit').append(uiElementCreator.createLinkButton());
                }
                subscription.unsubscribe();
            }
        } else {
            clearInterval(interval);
            subscription.unsubscribe();
            resetComparison();

            $('#info').removeClass('hidden');
            $('#testStatus').addClass('hidden');
            $('#runningInfo').addClass('hidden');
            $('#configInfo').removeClass('hidden');
            $('#wListConfig').removeClass('hidden');
        }

    }
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
    const lastVisualChange = ((data.lastVisualChange / 1000) % 60).toFixed(1);
    $('#' + elementId + '-speedIndex').html(data.speedIndex + 'ms');
    $('#' + elementId + '-dom').html(data.domLoaded + 'ms');
    $('#' + elementId + '-fullyLoaded').html(data.fullyLoaded + 'ms');
    $('#' + elementId + '-lastVisualChange').html(Math.round(lastVisualChange * 100)/100 + 's');

    if(testOptions.caching) {
        $('#' + elementId + '-ttfb').html('-');
    } else {
        $('#' + elementId + '-ttfb').html(data.ttfb + 'ms');
    }
    $('#testResults').removeClass('invisible');
}

function calculateFactors(competitorResult, speedKitResult) {
    const speedIndexFactor = (competitorResult.speedIndex / speedKitResult.speedIndex).toFixed(2);
    $('#speedIndex-factor').html(speedIndexFactor + 'x ' + (speedIndexFactor > 1 ? 'Faster' : ''));

    const domFactor = (competitorResult.domLoaded / speedKitResult.domLoaded).toFixed(2);
    $('#dom-factor').html(domFactor + 'x ' + (domFactor > 1 ? 'Faster' : ''));

    const fullyLoadedFactor = (competitorResult.fullyLoaded / speedKitResult.fullyLoaded).toFixed(2);
    $('#fullyLoaded-factor').html(fullyLoadedFactor + 'x ' + (fullyLoadedFactor > 1 ? 'Faster' : ''));

    const lastVisualChangeFactor = (competitorResult.lastVisualChange / speedKitResult.lastVisualChange).toFixed(2);
    $('#lastVisualChange-factor').html(lastVisualChangeFactor + 'x ' + (lastVisualChangeFactor > 1 ? 'Faster' : ''));

    if(!testOptions.caching) {
        const ttfbFactor = (competitorResult.ttfb / speedKitResult.ttfb).toFixed(2);
        $('#ttfb-factor').html(ttfbFactor + 'x ' + (ttfbFactor > 1 ? 'Faster' : ''));
    }
}

function displayTestResultsById(testId) {
    db.TestOverview.load(testId, {depth: 1}).then((result) => {
        const dataView = testOptions.caching ? 'repeatView' : 'firstView';
        const videoView = testOptions.caching ? 'videoIdRepeatedView' : 'videoIdFirstView';
        co_url = result.competitorTestResult.url;

        $('#currentVendorUrl').val(co_url);
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

        $('#caching_left').prop("checked", result.caching);
        testOptions.caching = result.caching;

        displayTestResults('competitor', result.competitorTestResult[dataView]);
        $('#competitor').append(uiElementCreator.createVideoElement('video-competitor',
            uiElementCreator.constructVideoLink(result.competitorTestResult, videoView)));

        displayTestResults('speedKit', result.speedKitTestResult[dataView]);
        $('#speedKit').append(uiElementCreator.createLinkButton(), uiElementCreator.createVideoElement('video-speedKit',
            uiElementCreator.constructVideoLink(result.speedKitTestResult, videoView)));

        calculateFactors(result.competitorTestResult[dataView], result.speedKitTestResult[dataView]);
    })
}

function resetComparison() {
    if(co_subscription)
        co_subscription.unsubscribe();

    if(sk_subscription)
        sk_subscription.unsubscribe();

    firstResult = {owner: null, result: null, videoSrc: null};

    $('#numberOfHostsCol').addClass('invisible');
    $('#numberOfRequestsCol').addClass('invisible');
    $('#numberOfBytesCol').addClass('invisible');
    $('#compareContent').addClass('invisible');
    $('#testResults').addClass('invisible');
    $('#info').addClass('hidden');
    $('#runningInfo').addClass('hidden');
    $('#testStatus').removeClass('hidden');
    $('#configInfo').removeClass('hidden');
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
}