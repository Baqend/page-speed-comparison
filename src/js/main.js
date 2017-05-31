import '../styles/main.scss'
import * as hbs from '../templates'

const data = {};
var co_url;
var co_start = 0;
var bq_start = 0;
var timer = 0;
var co_time = 0;
var bq_time = 0;
var co_time_display;
var bq_time_display;
var timeout;

document.addEventListener("DOMContentLoaded", function() {
    $("#main").html(hbs.main(data));
    co_time_display = $('.co_time');
    bq_time_display = $('.bq_time');
});

window.reload = function() {
    resetComparison();
    co_url = $('#currentVendorUrl').val();
    if(co_url) {
        timeout = setTimeout(startComparison, 1);
    }
};

window.frameLoaded = function() {
    var competitorFrame = $('#iframe_competitor');
    if(competitorFrame[0].contentWindow) {
        console.log(competitorFrame[0].contentWindow);
    }

    var stop = new Date().getTime();
    co_time = (stop - co_start) / 1000;
    clearInterval(timer);
    $('.co_time').html(co_time.toFixed(3) + 's');
};

function startComparison() {
    $('.iframe-competitor').html(
        '<iframe ' +
            'src="about:blank" id="iframe_competitor" ' +
            'class="myframe" name="competitor" onLoad="frameLoaded()">' +
        '</iframe>');
    var competitorFrame = $('#iframe_competitor');
    competitorFrame.addClass('loading');
    competitorFrame.prop('src', co_url);

    co_start = new Date().getTime();
    timer = setInterval(updateTime, 1, co_time_display, co_start);
}

function resetComparison() {
    clearInterval(timer);
    clearTimeout(timeout);
    co_start = 0;
    bq_start = 0;
    $('.co_time').html('...');
    $('.bq_time').html('...');
    $('#iframe_competitor').prop('src', '');
    $('#iframe_baqend').prop('src', '');
    $('.myframe').removeClass('loading');
}

function updateTime(time_display, start_time) {
    var now = new Date().getTime();
    var current = (now - start_time) / 1000;
    time_display.html(current.toFixed(3) + 's');
}