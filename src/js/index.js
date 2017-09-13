import { formatFileSize, sleep, isDeviceIOS } from './utils';
import { callPageSpeedInsightsAPI } from './pageSpeed';
import { resetView, resetViewAfterTest, showInfoBox, startTest, resetViewAfterBadTestResult } from './ResetVariablesService';
import { getBaqendUrl } from './SpeedKitUrlService';
import { calculateServedRequests, calculateFactors, displayTestResults, displayTestResultsById, isBadTestResult} from './TestResultHandler';
import { createImageElement, createLinkButton, createScannerElement, createVideoElement } from './UiElementCreator';

import "bootstrap";
import "../styles/main.scss";
import * as hbs from "../templates";
import { db } from "baqend/realtime";
import { Subscription } from 'rxjs';

/** @type {string} */
let competitorUrl, speedKitUrl;
let testResult = {};
let testVideo = {};
let testOptions = { location: 'eu-central-1:Chrome', caching: false };
/** @type {boolean} */
let pageSpeedInsightFailed = false;
let testInstance;
/** @type {Subscription} */
let competitorSubscription;
/** @type {Subscription} */
let speedKitSubscription;
/** @type {db.TestOverview} */
let testOverview;
/** @type {string | null} */
let competitorBaqendId;
/** @type {string | null} */
let speedKitBaqendId;
/** @type {Object} */
let interval;
/** @type {string} */
let title;
/** @type {boolean} */
let isSpeedKitComparison;

document.addEventListener("DOMContentLoaded", () => {
    $("#main").html(hbs.main({}));
    $('[data-toggle="tooltip"]').tooltip();

    db.connect(APP, true).then(() => {
        initTest();
    });

    // Simplified version for report view
    if (REPORT_PAGE) {
        $('#testConfiguration').remove();
        $('#wList').remove();
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
});

window.addEventListener("popstate", () => {
    if (db.isReady)
        initTest();
});

window.initTest = () => {
    const testIdParam = getParameterByName('testId');
    if (testIdParam && (!testOverview || testOverview.key !== testIdParam)) {
        db.TestOverview.load(testIdParam, { depth: 1 }).then((result) => {
            if (result) {
                const dataView = result.caching ? 'repeatView' : 'firstView';
                $('#currentVendorUrl').val(result.competitorTestResult.url);

                if(result.speedKitTestResult && !isBadTestResult(result.competitorTestResult[dataView],
                        result.speedKitTestResult[dataView])) {
                    testOptions.speedKit = result.speedKit;
                    testOptions.caching = result.caching;
                    testOptions.location = result.competitorTestResult.location;
                    competitorUrl = result.competitorTestResult.url;
                    speedKitUrl = result.speedKitTestResult.url;

                    try {
                        displayTestResultsById(testOptions, result);
                    } catch(e) {
                        showComparisonError(e);
                    }
                } else {
                    showComparisonError(new Error('This is a bad result'));
                }
            }
        });
    }

    const url = getParameterByName("url");
    if (url) {
        submitComparison(url);
    }
};

window.showImplementation = (event) => {
    event.preventDefault();
    $('#implementation-toggle').hide();
    $('#implementation-dots').hide();
    $('.implementation-hidden').show("medium");
};

window.openBaqendFrame = () => {
    const win = window.open(getBaqendUrl(competitorUrl, $('#wListInput').val()), '_blank');
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
    if(!isDeviceIOS()) {
        /** @type {HTMLVideoElement} */
        const secondVideo = document.getElementById(videoElement.id === 'video-speedKit' ? 'video-competitor' : 'video-speedKit');

        secondVideo.currentTime = 0;
        secondVideo.play();
    }

    videoElement.currentTime = 0;
    videoElement.play();
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
        url: competitorUrl,
        testOverviewId: testOverview.id,
        subject: 'from page speed comparison',
    };

    $.post('https://bbq.app.baqend.com/v1/code/mailUs', data, (data, status, xhr) => {
        let form = $('#contact_form');
        form.find('.modal-body').html("<p>Thanks. We will get in touch shortly. " +
            "Check out our <a href='https://benchmark.baqend.com' target='_blank'>benchmark</a> in the meantime</p>");
        form.find('.c_submit').remove();
    });
};

window.handleTestExampleClick = (testId) => {
    history.pushState({}, title, '/?testId=' + testId);
    $('.hideContact').removeClass('hidden');
    $('.hideOnError').removeClass('hidden');
    $('.hideOnDefault').addClass('hidden');
    window.initTest();
};

/**
 * @param {string} [url]
 * @return {Promise<void>}
 */
async function submitComparison(url) {
    const $currentVendorUrl = $('#currentVendorUrl');
    url = url || $currentVendorUrl.val();
    try {
        await db.modules.get('testRateLimited');
        const normalizedResult = await normalizeUrl(url);

        $currentVendorUrl.val(normalizedResult.url);
        return initComparison(normalizedResult);
    } catch (e) {
        const $currentVendorUrlInvalid = $('#currentVendorUrlInvalid');
        $currentVendorUrlInvalid.text(e.message);
        $currentVendorUrlInvalid.show();
    }
}

/**
 * @param {string} url
 * @return {Promise<{ url: string, speedkit: boolean }>}
 */
async function normalizeUrl(url) {
    return await db.modules.get('normalizeUrl', { url });
}

/**
 * Initializes the comparison of a website.
 *
 * @param {{ url: string, speedkit: boolean }} normalizedUrl The normalized URL to compare.
 * @return {Promise<void>} A promise which resolves when the test is done.
 */
async function initComparison(normalizedUrl) {
    // Reset the view
    resetComparison();
    resetView();

    const $wListInput = $('#wListInput');
    const now = Date.now();
    testInstance = now;

    isSpeedKitComparison = normalizedUrl.speedkit;
    competitorUrl = normalizedUrl.url;
    speedKitUrl = isSpeedKitComparison? competitorUrl: getBaqendUrl(competitorUrl, $wListInput.val());

    // Show testing UI
    startTest();
    $('.center-vertical').animate({ 'marginTop': '0px' }, 500);
    const activityTimeout = parseInt($('.activityTimeout').val()) || undefined;

    testOverview = new db.TestOverview();
    testOverview.caching = testOptions.caching;
    testOverview.whitelist = $wListInput.val();

    // Start Google Page speed
    callPageSpeed(now).catch(() => {
        const carousel = $('.carousel').carousel({ interval: false, wrap: false });
        carousel.carousel(4);
        pageSpeedInsightFailed = true;
        updateTestStatus();
    });

    try {
        const [competitorResult, speedKitResult] = await Promise.all([
            // Test the competitor's site
            db.modules.post('queueTest', {
                url: competitorUrl,
                activityTimeout,
                isSpeedKitComparison,
                location: testOptions.location,
                isClone: false,
                caching: testOptions.caching,
            }),
            // Test the Makefast's site
            db.modules.post('queueTest', {
                url: speedKitUrl,
                activityTimeout,
                isSpeedKitComparison,
                location: testOptions.location,
                isClone: true,
                caching: testOptions.caching,
            }),
        ]);

        competitorBaqendId = competitorResult.baqendId;
        speedKitBaqendId = speedKitResult.baqendId;

        // Sleep for 6 seconds
        await sleep(6000);

        if (now === testInstance) {
            competitorSubscription = db.TestResult.find().equal('id', '/db/TestResult/' + competitorBaqendId)
                .resultStream(result => resultStreamUpdate(result, competitorSubscription, 'competitor'));

            speedKitSubscription = db.TestResult.find().equal('id', '/db/TestResult/' + speedKitBaqendId)
                .resultStream(result => resultStreamUpdate(result, speedKitSubscription, 'speedKit'));
        }
    } catch (error) {
        showComparisonError(error);
    }
}

function updateTestStatus() {
    interval = setInterval(function () {
        if (competitorBaqendId) {
            db.modules.get('getTestStatus', { baqendId: competitorBaqendId }).then(res => {
                if (!res.error) {
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
async function callPageSpeed(now) {
    // Enable the status text
    const statusText = $('.carousel').carousel({ interval: false, wrap: false });
    const $competitor = $('#competitor');
    const $speedKit = $('#speedKit');
    statusText.carousel(0);

    const results = await callPageSpeedInsightsAPI(competitorUrl);

    statusText.carousel(1);
    const screenShot = results.screenshot;
    setPageSpeedMetrics(results);
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
        updateTestStatus();
    }
    await sleep(1000);

    if (now === testInstance) {
        $('#compareContent').removeClass('hidden');
        //check whether it container elements don´t have any content (e.g. video already created)
        if($competitor.children().length < 1 && $speedKit.children().length < 1) {
            $competitor.append(createImageElement(screenShot),
                createScannerElement());

            $speedKit.append(createImageElement(screenShot),
                createScannerElement());
        }
    }
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

                    //check if the result is unsatisfactory ==> show information view instead of test result
                    if(isBadTestResult(testResult['competitor'][dataView], testResult['speedKit'][dataView])) {
                        showComparisonError(new Error('This is a bad result'));
                        return;
                    }

                    displayTestResults('competitor', testResult['competitor'][dataView], testOptions);
                    displayTestResults('speedKit', testResult['speedKit'][dataView], testOptions);
                    calculateFactors(testResult['competitor'][dataView], testResult['speedKit'][dataView], testOptions);
                    $('#servedRequests').text(calculateServedRequests(testResult['speedKit']['firstView']));

                    if (pageSpeedInsightFailed) {
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

                    competitorElement.empty();
                    speedKitElement.empty();

                    competitorElement.append(createVideoElement('video-competitor', testVideo['competitor']));
                    speedKitElement.append(createVideoElement('video-speedKit', testVideo['speedKit']));

                    //create "open in new tab" button only if the original website has SSL
                    if(/^https/.test(competitorUrl)) {
                        speedKitElement.append(createLinkButton());
                    }

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
    $('.numberOfBytes').html(formatFileSize(testOverview.psiResponseSize, 2));
}

/**
 * @param {Error} e
 */
function showComparisonError(e) {
    resetComparison();
    resetViewAfterBadTestResult();
}

function resetComparison() {
    if (competitorSubscription)
        competitorSubscription.unsubscribe();

    if (speedKitSubscription)
        speedKitSubscription.unsubscribe();

    competitorBaqendId = speedKitBaqendId = null;
    pageSpeedInsightFailed = false;
    testResult = {};
    testVideo = {};

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
