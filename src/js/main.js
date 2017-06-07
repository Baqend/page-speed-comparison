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

db.connect('makefast', true);

document.addEventListener("DOMContentLoaded", function() {
    $("#main").html(hbs.main(data));
    co_time_display = $('.co_time');
    bq_time_display = $('.bq_time');
});

window.reload = function() {
    co_url = $('#currentVendorUrl').val();
    if(co_url) {
        resetComparison();

        //$('#startTest').addClass('invisible');
        $('#preWarming').removeClass('hidden');
        $('.carousel').carousel({
            interval: 1500,
            wrap: false
        });

        db.ready().then(() => {
            db.modules.get('checkCors', {url: co_url}).then((isCors) => {
                if (isCors) {
                    document.getElementById("myButton").click();
                } else {
                    timeout = setTimeout(startComparison, 1);
                }
            });
        });
    }
};

window.contactUs = function(e){
    e.preventDefault();

    var data = {
        name: document.getElementById('c_name').value,
        email: document.getElementById('c_email').value,
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
    if(iframe !== 'competitor') {
        bq_time = (stop - bq_start) / 1000;
        clearInterval(timer);
    } else {
        co_time = (stop - co_start) / 1000;
        clearInterval(timer);
        $('.co_time').html(co_time.toFixed(3) + 's');
        timeout = setTimeout(function () {
            $('.iframe-baqend').html(
                '<iframe ' + '' +
                'src="about:blank" id="iframe_baqend" ' +
                'class="myframe" name="competitor" onload="frameLoaded()">' +
                '</iframe>');
            var frame = $('#iframe_baqend');
            frame.addClass('loading');
            frame.prop('src', 'https://makefast-clone.baqend.com/index.html?url=' + co_url);
            bq_start = new Date().getTime();
            timer = setInterval(updateTime, 1, bq_time_display, bq_start);
        }, 1000);
    }
};

function startComparison() {
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
