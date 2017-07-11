import "../styles/main.scss";
import * as hbs from "../templates";
import "bootstrap";
import db from "baqend/realtime";

const data = {};
let co_url;
let bq_url = 'https://makefast-staging.app.baqend.com';
let co_video = null;
let bq_video = null;

db.connect('page-test', true);

document.addEventListener("DOMContentLoaded", () => {
    $("#main").html(hbs.main(data));

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

        callPageSpeedInsightsAPI(encodeURIComponent(co_url)).then((response) => {
            let bytes = parseInt(response.pageStats.htmlResponseBytes) || 0;
            bytes += parseInt(response.pageStats.cssResponseBytes) || 0;
            bytes += parseInt(response.pageStats.imageResponseBytes) || 0;
            bytes += parseInt(response.pageStats.javascriptResponseBytes) || 0;
            bytes += parseInt(response.pageStats.otherResponseBytes) || 0;

            carousel.carousel(1);

            setTimeout(() => {
                $('.numberOfHosts').html(response.pageStats.numberHosts || 0);
                $('#numberOfHostsCol').removeClass('invisible');
                carousel.carousel(2);
            }, 1000);

            setTimeout(() => {
                $('.numberOfRequests').html(response.pageStats.numberResources || 0);
                $('#numberOfRequestsCol').removeClass('invisible');

                carousel.carousel(3);
            }, 2000);

            setTimeout(() => {
                $('.numberOfBytes').html(bytes);
                $('#numberOfBytesCol').removeClass('invisible');

                carousel.carousel(4);
            }, 3000);

            setTimeout(() => {
                $('#compareContent').removeClass('invisible');
                $('#competitor').append(createScannerElement(), createImageElement(response));
                $('#speedKit').append(createScannerElement(), createImageElement(response));
            }, 4000);

            setTimeout(() => {
                const competitorPromise = checkCompetitorVideoAvailability('competitor');
                const speedKitPromise = checkSpeedKitVideoAvailability('speedKit');

                Promise.all([competitorPromise, speedKitPromise]).then(() => {
                    $('#info').removeClass('hidden');
                    $('#preWarming').addClass('hidden');
                });
            }, 6000)
        });

        db.modules.get('queueTest', {url: co_url}).then((res) => {
            if (res) {
                const query = db.TestResult.find().equal('testId', res.testId);
                const subscription = query.resultStream(result => resultStreamUpdate(result, subscription, 'competitor'));
            }
        });

        db.modules.get('queueTest', {url: getBaqendUrl(true)}).then((res) => {
            if (res) {
                const query = db.TestResult.find().equal('testId', res.testId);
                const subscription = query.resultStream(result => resultStreamUpdate(result, subscription, 'speedKit'));
            }
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
    result.forEach((entry) => {
        if (entry.videoId) {
            subscription.unsubscribe();
            if(elementId === 'competitor') {
                co_video = createVideoElement('video-' + elementId, entry);
            } else {
                bq_video = createVideoElement('video-' + elementId, entry);
            }
        } else if (entry.repeatView) {
            console.log(entry.repeatView);
        }
    });
}

function callPageSpeedInsightsAPI(url) {
    const API_KEY = 'AIzaSyBVAGvv1O8d6H7mrTKZW6pds7KUlp8CixY';
    const API_URL = 'https://www.googleapis.com/pagespeedonline/v1/runPagespeed?';
    const query = ['url=' + url,
        'screenshot=true',
        'strategy=desktop',
        'key=' + API_KEY,
    ].join('&');

    return new Promise((resolve, reject) => {
        fetch(API_URL + query, {
            method: 'get'
        }).then((response) => {
            return resolve(response.json());
        }).catch((err) => {
            return reject(err);
        });
    });
}

function getBaqendUrl(noCaching) {
    let url = bq_url + '?url=' + encodeURIComponent(co_url) + '&wlist=' + generateWhiteList();
    if (noCaching) {
        url += '&noCaching=' + noCaching;
    }
    return url;
}

function getUrlParam(name) {
    return (location.search.split(name + '=')[1] || '').split('&')[0];
}

function createImageElement(srcData) {
    let img = document.createElement('IMG');
    img.setAttribute('src', 'data:' + srcData.screenshot.mime_type + ';base64,' +
        srcData.screenshot.data.replace(/_/g, '/').replace(/-/g, '+'));
    img.setAttribute('alt', 'preview of website screen');
    img.setAttribute('id', 'preview-image');

    return img;
}

function createVideoElement(elementId, data) {
    const date = data.testId.substr(0, 2) + '/' + data.testId.substr(2, 2) + '/' + data.testId.substr(4, 2);

    let video = document.createElement('video');
    video.setAttribute('controls', 'controls');
    video.setAttribute('autoplay', 'autoplay');
    video.setAttribute('type', 'video/mp4');
    video.setAttribute('preload', 'auto');
    video.setAttribute('onplay', 'playVideos(this)');
    video.setAttribute('id', elementId);
    video.setAttribute('src', 'http://ec2-52-57-25-151.eu-central-1.compute.amazonaws.com/results/video/' +
        date + '/' + data.videoId.substr(data.videoId.indexOf('_') + 1, data.videoId.length) + '/video.mp4');
    video.setAttribute('class', 'embedVideo');

    return video;
}

function createScannerElement() {
    const scanner = document.createElement('div');
    scanner.setAttribute('class', 'laser');
    return scanner;
}

function checkCompetitorVideoAvailability(elementId) {
    if(co_video){
        const element = $('#' + elementId);
        element.empty();
        element.append(co_video);
    }
    else{
        setTimeout(checkCompetitorVideoAvailability, 500, elementId);
    }
}

function checkSpeedKitVideoAvailability(elementId) {
    if(bq_video){
        const element = $('#' + elementId);
        element.empty();
        element.append(bq_video);
    }
    else{
        setTimeout(checkSpeedKitVideoAvailability, 500, elementId);
    }
}

function generateWhiteList() {
    let wListString = new URL(co_url).host;
    if (wListString.indexOf('www') !== -1) {
        wListString = wListString.substr(wListString.indexOf('.') + 1);
    }
    wListString = '"^(https?:\\/\\/)?([\\w-]*\.){0,3}' + wListString.substr(0, wListString.indexOf('.') + 1) + '.*$"';

    let wListInputArray = document.getElementById('wListInput').value.split(',');
    if (wListInputArray[0] !== '') {
        for (let i = 0; i < wListInputArray.length; i++) {
            wListString += ',';
            wListString += '"^(https?:\\/\\/)?([\\w-]*\.){0,3}' + wListInputArray[i] + '.*$"';
        }
    }

    return encodeURIComponent(wListString);
}

function resetComparison() {
    $('#numberOfHostsCol').addClass('invisible');
    $('#numberOfRequestsCol').addClass('invisible');
    $('#numberOfBytesCol').addClass('invisible');
    $('#compareContent').addClass('invisible');
    $('#competitor').empty();
    $('#speedKit').empty();
    $('#info').addClass('hidden');
    $('#preWarming').removeClass('hidden');
    co_video = null;
    bq_video = null;
}