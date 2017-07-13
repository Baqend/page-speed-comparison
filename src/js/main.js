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
let firstResultComplete = false;
let firstResult = {owner: null, result: null};
let co_testId;
let sk_testId;

db.connect('page-test', true);

document.addEventListener("DOMContentLoaded", () => {
    $("#main").html(hbs.main(data));
    $('[data-toggle="tooltip"]').tooltip();

    if (getUrlParam('url') !== '') {
        $('#currentVendorUrl').val(getUrlParam('url'));
    }

    if (getUrlParam('wlist') !== '') {
        $('#wListInput').val(getUrlParam('wlist'));
        $('#wListConfig').removeClass('hide');
    }
});

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
    const urlInput = $('#currentVendorUrl').val();
    co_url = urlInput.indexOf('http://') !== -1 || urlInput.indexOf('https://') !== -1 ? urlInput : 'http://' + urlInput;

    if (co_url) {
        resetComparison();

        $('.center-vertical').animate({'marginTop': '0px'}, 500);

        const carousel = $('.carousel').carousel({interval: false, wrap: false});
        carousel.carousel(0);

        db.modules.get('queueTest', {url: co_url}).then(res => co_testId = res.testId);
        db.modules.get('queueTest', {url: speedKitUrlService.getBaqendUrl(co_url, true, document.getElementById('wListInput'))})
            .then(res => sk_testId = res.testId);

        pageSpeedInsightsAPIService.callPageSpeedInsightsAPI(encodeURIComponent(co_url)).then((results) => {
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
            }, 3000);

            setTimeout(() => {
                $('#compareContent').removeClass('invisible');
                $('#competitor').append(uiElementCreator.createScannerElement(),uiElementCreator.createImageElement(results.screenshot));
                $('#speedKit').append(uiElementCreator.createScannerElement(), uiElementCreator.createImageElement(results.screenshot));
            }, 4000);

            setTimeout(() => {
                const co_query = db.TestResult.find().equal('testId', co_testId);
                const co_subscription = co_query.resultStream(result =>
                    resultStreamUpdate(result, 'firstView', 'videoIdFirstView', co_subscription, 'competitor'));

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
        if (entry[dataView]) {
            displayTestResults(elementId, entry[dataView]);
            if(firstResult.owner) {
                calculateFactors(entry[dataView]);
            } else {
                firstResult.owner = elementId;
                firstResult.result = entry[dataView];
            }
        }

        if (entry[videoView]) {
            const element = $('#' + elementId);
            element.empty();
            setTimeout(() => {
                const videoLink = uiElementCreator.constructVideoLink(entry, videoView);
                element.append(uiElementCreator.createVideoElement('video-' + elementId, videoLink));
                element.append(uiElementCreator.createDownloadButton(videoLink));
                if(firstResultComplete) {
                    $('#info').removeClass('hidden');
                    $('#testStatus').addClass('hidden');
                }
                firstResultComplete = true;
            }, 2000);
            subscription.unsubscribe();
        }
    });
}

function getUrlParam(name) {
    return (location.search.split(name + '=')[1] || '').split('&')[0];
}

function displayTestResults(elementId, data) {
    $('#' + elementId + '-speedIndex').html(data.speedIndex + 'ms');
    $('#' + elementId + '-ttfb').html(data.ttfb + 'ms');
    $('#' + elementId + '-dom').html(data.domLoaded + 'ms');
    $('#' + elementId + '-fullyLoaded').html(data.fullyLoaded + 'ms');
    $('#testResults').removeClass('invisible');
}

function calculateFactors(compareResult) {
    if(firstResult.owner === 'competitor') {
        $('#speedIndex-factor').html('x' + (firstResult.result.speedIndex / compareResult.speedIndex).toFixed(2));
        $('#ttfb-factor').html('x' + (firstResult.result.ttfb / compareResult.ttfb).toFixed(2));
        $('#dom-factor').html('x' + (firstResult.result.domLoaded / compareResult.domLoaded).toFixed(2));
        $('#fullyLoaded-factor').html('x' + (firstResult.result.fullyLoaded / compareResult.fullyLoaded).toFixed(2));
    } else if (firstResult.owner === 'speedKit') {
        $('#speedIndex-factor').html('x' + (compareResult.speedIndex / firstResult.result.speedIndex).toFixed(2));
        $('#ttfb-factor').html('x' + (compareResult.ttfb / firstResult.result.ttfb).toFixed(2));
        $('#dom-factor').html('x' + (compareResult.domLoaded / firstResult.result.domLoaded).toFixed(2));
        $('#fullyLoaded-factor').html('x' + (compareResult.fullyLoaded / firstResult.result.fullyLoaded).toFixed(2));
    }
}

function resetComparison() {
    $('#numberOfHostsCol').addClass('invisible');
    $('#numberOfRequestsCol').addClass('invisible');
    $('#numberOfBytesCol').addClass('invisible');
    $('#compareContent').addClass('invisible');
    $('#testResults').addClass('invisible');
    $('#info').addClass('hidden');
    $('#testStatus').removeClass('hidden');
    $('#competitor').empty();
    $('#speedKit').empty();
    $('#competitor-speedIndex').html('');
    $('#competitor-ttfb').html('');
    $('#competitor-dom').html('');
    $('#competitor-fullyLoaded').html('');
    $('#speedIndex-speedIndex').html('');
    $('#speedIndex-ttfb').html('');
    $('#speedIndex-dom').html('');
    $('#speedIndex-fullyLoaded').html('');
    $('#speedIndex-factor').html('');
    $('#ttfb-factor').html('');
    $('#dom-factor').html('');
    $('#fullyLoaded-factor').html('');
    firstResultComplete = false;
    firstResult = {owner: null, result: null};
}