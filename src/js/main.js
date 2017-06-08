import '../styles/main.scss'
import * as hbs from '../templates'
import 'bootstrap';
import db from 'baqend';

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

var competitorLoadTimes = [];
var baqendLoadTimes = [];

db.connect('makefast', true);

document.addEventListener("DOMContentLoaded", function() {
    $("#main").html(hbs.main(data));
    co_time_display = $('.co_time');
    bq_time_display = $('.bq_time');
});

window.reload = function() {
    co_url = $('#currentVendorUrl').val();
    if(co_url) {
        db.ready().then(() => {
            db.modules.get('checkCors', {url: co_url}).then((isCors) => {
                if (isCors) {
                    $('#myButton').click();
                } else {
                    resetComparison();
                    //$('#startTest').addClass('invisible');
                    $('#preWarming').removeClass('hidden');
                    $('.carousel').carousel({
                        interval: 1500,
                        wrap: false
                    });

                    startPreWarming();
                }
            });
        });
    }
};

window.contactUs = function(e){
    e.preventDefault();

    var data = {
        name: $('#c_name').val(),
        email: $('#c_email').val(),
        url: co_url,
        subject: 'from page speed comparison'
    };

    $.post('https://bbq-bq.global.ssl.fastly.net/v1/code/mailUs', data,
     function(data, status, xhr) {
         var form = $('#contact_form');
         form.find('.modal-body').html("<p>Thanks. We will get in touch shortly. " +
             "Check out our <a href='https://benchmark.baqend.com' target='_blank'>benchmark</a> in the meantime</p>");
         form.find('.c_submit').remove();
     });
};

window.frameLoaded = function(iframe) {
    var stop = new Date().getTime();
    clearInterval(timer);
    if(iframe !== 'competitor') {
        if(bq_start > 0) {
            bq_time = (stop - bq_start) / 1000;
            baqendLoadTimes.push(stop);
        }
    } else {
        if(co_start > 0) {
            co_time = (stop - co_start) / 1000;
            competitorLoadTimes.push(stop);
            $('.co_time').html(co_time.toFixed(3) + 's');
            timeout = setTimeout(function () {
                $('.iframe-baqend').html(
                    '<iframe ' +
                    'src="about:blank" id="iframe_baqend" ' +
                    'class="myframe" name="competitor" onload="frameLoaded()">' +
                    '</iframe>');
                var frame = $('#iframe_baqend');
                frame.addClass('loading');
                frame.prop('src', 'https://makefast-clone.baqend.com?url=' + encodeURIComponent(co_url));
                bq_start = new Date().getTime();
                timer = setInterval(updateTime, 1, bq_time_display, bq_start);
            }, 1000);
        }
    }

    console.log(baqendLoadTimes);
    console.log(competitorLoadTimes);
};

window.startComparison = function() {
    var name = 'competitor';
    $('.iframe-competitor').html(
        '<iframe ' +
        'src="about:blank" id="iframe_competitor" ' +
        'class="myframe" name="competitor" onload="frameLoaded(name)">' +
        '</iframe>');
    var competitorFrame = $('#iframe_competitor');
    competitorFrame.addClass('loading');
    competitorFrame.prop('src', co_url);

    co_start = new Date().getTime();
    timer = setInterval(updateTime, 1, co_time_display, co_start);
};

function startPreWarming() {
    $('.iframe-baqend').html(
        '<iframe ' + '' +
        'src="about:blank" id="iframe_baqend" ' +
        'class="myframe" name="competitor" onload="startComparison()">' +
        '</iframe>');

    var frame = $('#iframe_baqend');
    frame.prop('src', 'https://makefast-clone.baqend.com?url=' + encodeURIComponent(co_url));
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
