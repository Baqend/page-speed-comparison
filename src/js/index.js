import { formatFileSize, sleep, isDeviceIOS, sortArray, getParameterByName } from './utils';
import { callPageSpeedInsightsAPI } from './pageSpeed';
import { resetView, resetViewAfterTest, showInfoBox, startTest, resetViewAfterBadTestResult } from './ResetVariablesService';
import { getBaqendUrl, getHostnameOfUrl } from './SpeedKitUrlService';
import { calculateServedRequests, calculateFactors, displayTestResults, displayTestResultsById, isBadTestResult, calculateRevenueBoost, verifyWarningMessage} from './TestResultHandler';
import { createImageElement, createLinkButton, createScannerElement, createVideoElement, createWhitelistCandidates } from './UiElementCreator';

import "bootstrap";
import "../styles/main.scss";
import * as hbs from "../templates";
import { db } from "baqend/realtime";
import { Subscription } from 'rxjs';

/** @type {string} */
let competitorUrl;
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

    /**
     * @param {Event} event
     */
    $('#implementation-toggle').on('click', (event) => {
        event.preventDefault();
        $('#implementation-toggle').hide();
        $('#implementation-dots').hide();
        $('.implementation-hidden').show("medium");
    });

    $('#printReport').on('click', () => {
        /** @type {HTMLVideoElement} */
        const competitorVideo = document.getElementById('video-competitor');
        /** @type {HTMLVideoElement} */
        const speedKitVideo = document.getElementById('video-speedKit');
        competitorVideo.currentTime = competitorVideo.duration;
        speedKitVideo.currentTime = speedKitVideo.duration;

        setTimeout(function () {
            window.print();
        }, 100);
    });

    /**
     * @param {Event} event
     */
    $('#contact_form').on('submit', (event) => {
        event.preventDefault();
        const $confirmContact = $('#confirmContact');
        const $name = $('#c_name');
        const $email = $('#c_email');
        let data = {
            name: $name.val(),
            email: $email.val(),
            url: competitorUrl,
            testOverviewId: testOverview.id || 'not existing',
            subject: 'from page speed analyzer',
        };

        $.post('https://bbq.app.baqend.com/v1/code/mailUs', data, (data, status, xhr) => {
            $name.val('');
            $email.val('');
            $confirmContact.removeClass('hidden');
        });
    });

    $('#showTestPool').on('click', () => {
        $('#showTestPool').addClass('hidden');
        $('.hideOnError').addClass('hidden');
        $('.hideOnDefault').removeClass('hidden');
    });
});

window.addEventListener("popstate", () => {
    if (db.isReady)
        initTest();
});

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

window.openSpeedKitLink = () => {
    const win = window.open(getBaqendUrl(competitorUrl, $('#wListInput').val()), '_blank');
    win.focus();
};

window.handleTestExampleClick = (testId) => {
    history.pushState({}, title, '/?testId=' + testId);
    $('#showTestPool').removeClass('hidden');
    $('.hideContact').removeClass('hidden');
    $('.hideOnError').removeClass('hidden');
    $('.hideOnDefault').addClass('hidden');
    initTest();
};

window.whitelistCandidateClicked = (elementId) => {
    const checkboxElement = document.getElementById(elementId);
    const wListInput = document.getElementById('wListInput');
    const regex = new RegExp(',?\\s?\\b' + elementId + '\\s?\\b,?');

    if(regex.test(wListInput.value)) {
        const inputArray = wListInput.value.split(',').map(item => item.trim());
        inputArray.splice(inputArray.indexOf(elementId), 1);
        wListInput.value = inputArray.join(', ');
    } else if(!checkboxElement.checked) {
        wListInput.value = wListInput.value.length !== 0 ? wListInput.value + ', ' + elementId : elementId;
    }
};

function initTest() {
    const testIdParam = getParameterByName('testId');
    if (testIdParam && (!testOverview || testOverview.key !== testIdParam)) {
        db.TestOverview.load(testIdParam, { depth: 1 }).then((result) => {
            if (result) {
                const dataView = result.caching ? 'repeatView' : 'firstView';
                competitorUrl = result.competitorTestResult.url;
                $('#currentVendorUrl').val(competitorUrl);

                //handle whitelist candidates and add them to the UI
                handleWhitelistCandidates(result.competitorTestResult[dataView], result.whitelist);

                if(result.speedKitTestResult && !isBadTestResult(result.competitorTestResult[dataView],
                        result.speedKitTestResult[dataView])) {
                    testOptions.speedKit = result.speedKit;
                    testOptions.caching = result.caching;
                    testOptions.location = result.competitorTestResult.location;

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
}

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
        showComparisonError(e);
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

    const speedKitUrl = isSpeedKitComparison ? competitorUrl : getBaqendUrl(competitorUrl, $wListInput.val());

    // Show testing UI
    startTest();
    $('.center-vertical').animate({ 'marginTop': '0px' }, 500);
    const activityTimeout = parseInt($('.activityTimeout').val()) || undefined;

    testOverview = new db.TestOverview();
    testOverview.caching = testOptions.caching;
    testOverview.whitelist = $wListInput.val();

    try {
        const [pageSpeedResult, competitorResult, speedKitResult] = await Promise.all([
            //Call Page Speed Insights
            callPageSpeedInsightsAPI(competitorUrl).catch(() => {
                const carousel = $('.carousel').carousel({ interval: false, wrap: false });
                carousel.carousel(4);
                pageSpeedInsightFailed = true;
                updateTestStatus();
            }),
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
            updateTestStatus(competitorResult.baqendId);
        }
        await sleep(1000);

        if (now === testInstance) {
            $('#compareContent').removeClass('hidden');
            //check whether the container elements don´t have any content (e.g. video already created)
            if($competitor.children().length < 1 && $speedKit.children().length < 1) {
                $competitor.append(createImageElement(screenShot),
                    createScannerElement());

                $speedKit.append(createImageElement(screenShot),
                    createScannerElement());
            }

            await sleep(2000);
            //subscribe on the test results
            subscribeOnResult(competitorResult.baqendId, speedKitResult.baqendId)
        }
    } catch (error) {
        showComparisonError(error);
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

    competitorSubscription = db.TestResult.find().equal('id', '/db/TestResult/' + competitorBaqendId)
        .resultStream(competitorOnNext, onError);

    speedKitSubscription = db.TestResult.find().equal('id', '/db/TestResult/' + speedKitBaqendId)
        .resultStream(speedKitOnNext, onError);
}

/**
 * @param {string} competitorBaqendId
 */
function updateTestStatus(competitorBaqendId) {
    const interval = setInterval(function () {
        if (competitorBaqendId) {
            try {
                db.modules.get('getTestStatus', { baqendId: competitorBaqendId }).then(res => {
                    if (!res.error) {
                        if (res.status.statusCode === 101) {
                            $('#statusQueue').html(res.status.statusText);
                        } else if (res.status.statusCode === 100 || res.status.statusCode === 200) {
                            $('#statusQueue').html('Test has been started...');
                            clearInterval(interval);
                        }
                    }
                });
            } catch(e) {
                clearInterval(interval);
            }
        }
    }, 2000);
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
                    //handle whitelist candidates and add them to the UI
                    handleWhitelistCandidates(testResult['competitor'][dataView], testOverview.whitelist);

                    //check if the result is unsatisfactory ==> show information view instead of test result
                    if(isBadTestResult(testResult['competitor'][dataView], testResult['speedKit'][dataView])) {
                        showComparisonError(new Error('This is a bad result'));
                        return;
                    }

                    displayTestResults('competitor', testResult['competitor'][dataView], testOptions);
                    displayTestResults('speedKit', testResult['speedKit'][dataView], testOptions);
                    calculateFactors(testResult['competitor'][dataView], testResult['speedKit'][dataView], testOptions);
                    calculateRevenueBoost(testResult['competitor'][dataView], testResult['speedKit'][dataView]);
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
    testOverview.psiDomains = result.domains.length;
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
    verifyWarningMessage(e);
    resetComparison();
    resetViewAfterBadTestResult();
}

function resetComparison() {
    if (competitorSubscription)
        competitorSubscription.unsubscribe();

    if (speedKitSubscription)
        speedKitSubscription.unsubscribe();

    pageSpeedInsightFailed = false;
    testResult = {};
    testVideo = {};

    history.pushState({}, title, "/");
}

function handleWhitelistCandidates(resultData, whitelist) {
    const sortedDomains = sortArray(resultData, 'domains');
    let hostname = getHostnameOfUrl(competitorUrl);
    if (hostname.includes('www.')) {
        hostname = hostname.substr(hostname.indexOf('www.') + 4);
    }

    createWhitelistCandidates(sortedDomains
        .filter(domainObject => domainObject.url.indexOf(hostname) === -1 )
        .splice(1,6), whitelist
    );
}
