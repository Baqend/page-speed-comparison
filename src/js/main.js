const UiElementCreator = require('./uiElementCreator.js');
const PageSpeedInsightsAPIService = require('./pageSpeedInsightsAPIService.js');
const SpeedKitUrlService = require('./speedKitUrlService.js');
const ResetVariablesService = require('./resetViewService.js');
const TestResultHandler = require('./testResultHandler.js');

import "bootstrap";
import "../styles/main.scss";
import * as hbs from "../templates";
import db from "baqend/realtime";

const uiElementCreator = new UiElementCreator();
const pageSpeedInsightsAPIService = new PageSpeedInsightsAPIService();
const speedKitUrlService = new SpeedKitUrlService();
const resetViewService = new ResetVariablesService();
const testResultHandler = new TestResultHandler();
const data = {};

let co_url;
let testResult = {};
let testVideo = {};
let testOptions = {location: 'eu-central-1:Chrome', caching: false};
let testInstance;
let co_subscription;
let sk_subscription;
let testOverview;
let co_baqendId;
let sk_baqendId;
let interval;

document.addEventListener("DOMContentLoaded", () => {
    $("#main").html(hbs.main(data));
    $('[data-toggle="tooltip"]').tooltip();

    db.connect('makefast', true).then(() => {
        const testIdParam = getParameterByName('testId');
        if (testIdParam) {
            db.TestOverview.load(testIdParam, {depth: 1}).then((result) => {
                testOptions.caching = result.caching;
                testOptions.location = result.competitorTestResult.location;
                co_url = result.competitorTestResult.url;
                testResultHandler.displayTestResultsById(testOptions, result);
            });
        }
    });
});

window.showInfoBox = () => {
    $('.infoBox').fadeIn(1000);
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

    $.post('https://bbq-bq.global.ssl.fastly.net/v1/code/mailUs', data, (data, status, xhr) => {
        let form = $('#contact_form');
        form.find('.modal-body').html("<p>Thanks. We will get in touch shortly. " +
            "Check out our <a href='https://benchmark.baqend.com' target='_blank'>benchmark</a> in the meantime</p>");
        form.find('.c_submit').remove();
    });
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

        db.modules.post('queueTest', {
            url: co_url,
            location: testOptions.location,
            isClone: false,
            caching: testOptions.caching
        }).then(res => co_baqendId = res.baqendId);

        db.modules.post('queueTest', {
            url: speedKitUrlService.getBaqendUrl(co_url, $('#wListInput').val()),
            location: testOptions.location, isClone: true, caching: testOptions.caching
        }).then(res => sk_baqendId = res.baqendId);

        pageSpeedInsightsAPIService.callPageSpeedInsightsAPI(encodeURIComponent(co_url)).then((results) => {
            testOverview = new db.TestOverview();
            testOverview.psiDomains = results.domains;
            testOverview.psiRequests = results.resources;
            testOverview.psiResponseSize = results.bytes;
            testOverview.caching = testOptions.caching;
            testOverview.whitelist = $('#wListInput').val();

            carousel.carousel(1);

            setTimeout(() => {
                if (now === testInstance) {
                    $('.numberOfHosts').html(results.domains);
                    carousel.carousel(2);
                }
            }, 1000);

            setTimeout(() => {
                if (now === testInstance) {
                    $('.numberOfRequests').html(results.resources);
                    carousel.carousel(3);
                }
            }, 2000);

            setTimeout(() => {
                if (now === testInstance) {
                    $('.numberOfBytes').html(results.bytes);

                    carousel.carousel(4);
                    interval = setInterval(function () {
                        db.modules.get('getTestStatus', {baqendId: co_baqendId}).then(res => {
                            if(!res.error){
                                if (res.status.statusCode === 101) {
                                    $('#statusQueue').html(res.status.statusText);
                                } else if (res.status.statusCode === 100 || res.status.statusCode === 200) {
                                    $('#statusQueue').html('Test has been started...');
                                }
                            }
                        });
                    }, 2000);
                }
            }, 3000);

            setTimeout(() => {
                if (now === testInstance) {
                    $('#compareContent').removeClass('hidden');
                    $('#competitor').append(uiElementCreator.createImageElement(results.screenshot),
                        uiElementCreator.createScannerElement());

                    $('#speedKit').append(uiElementCreator.createImageElement(results.screenshot),
                        uiElementCreator.createScannerElement());
                }
            }, 4000);

            setTimeout(() => {
                if (now === testInstance) {
                    const co_query = db.TestResult.find().equal('id', '/db/TestResult/' + co_baqendId);
                    co_subscription = co_query.resultStream(result =>
                        resultStreamUpdate(result, co_subscription, 'competitor'));

                    const sk_query = db.TestResult.find().equal('id', '/db/TestResult/' + sk_baqendId);
                    sk_subscription = sk_query.resultStream(result =>
                        resultStreamUpdate(result, sk_subscription, 'speedKit'));
                }
            }, 6000)
        });
    }
};

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
                testResult[elementId] = entry[dataView];
                if (Object.keys(testResult).length === 2) {
                    clearInterval(interval);
                    testResultHandler.displayTestResults('competitor', testResult['competitor'], testOptions);
                    testResultHandler.displayTestResults('speedKit', testResult['speedKit'], testOptions);
                    testResultHandler.calculateFactors(testResult['competitor'], testResult['speedKit'], testOptions);
                }
            }

            if (entry[videoView]) {
                testVideo[elementId] = entry[videoView].url;
                if (Object.keys(testVideo).length === 2) {
                    const competitorElement = $('#competitor');
                    const speedKitElement = $('#speedKit');

                    const totalRequests = testResult['speedKit'].requests;
                    const cacheHits = testResult['speedKit'].hits.hit || 0;
                    const cacheMisses = testResult['speedKit'].hits.miss || 0;
                    const otherRequests = testResult['speedKit'].hits.other || 0;

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
            clearInterval(interval);
            subscription.unsubscribe();
            resetViewService.resetViewFromError();
        }

        testOverview.ready().then(() => {
            testOverview.save().then(() => window.location.hash = '?testId=' + testOverview.key);
        });
    }
}

function resetComparison() {
    if (co_subscription)
        co_subscription.unsubscribe();

    if (sk_subscription)
        sk_subscription.unsubscribe();

    testResult = {};
    testVideo = {};

    resetViewService.resetViewFromSuccess();
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
