import '../styles/main.scss'
import * as hbs from '../templates'
import 'bootstrap';
import db from 'baqend';

const data = {};
let co_url;
let bq_url = 'https://makefast-staging.app.baqend.com';
let co_start = 0;
let bq_start = 0;
let co_time = 0;
let bq_time = 0;
let timer = 0;
let timeout = 0;
let co_time_display;
let bq_time_display;
let bq_frame;

db.connect('makefast', true);

document.addEventListener("DOMContentLoaded", () => {
    $("#main").html(hbs.main(data));
    co_time_display = $('.co_time');
    bq_time_display = $('.bq_time');
    bq_frame = $('#iframe-baqend');

    if(getUrlParam('url') !== '') {
        $('#currentVendorUrl').val(getUrlParam('url'));
    }

    if(getUrlParam('wlist') !== '') {
        $('#wListInput').val(getUrlParam('wlist'));
        $('#wListConfig').removeClass('hide');
    }

    bq_frame.hover(() =>{
            $('.openButton').animate({opacity:1},100)
        },function(){
            $('.openButton').animate({opacity:0},100)
        }
    );
});

window.addEventListener('message', (event) => {
    if(event.data === 'reload') {
        clearTimeout(timeout);
    }
});

window.openBaqendFrame = () => {
    let win = window.open(getBaqendUrl(false), '_blank');
    win.focus();
};

window.reload = () => {
    let urlInput = $('#currentVendorUrl').val();
    co_url = urlInput.indexOf('http://') !== -1 || urlInput.indexOf('https://') !== -1 ? urlInput : 'http://' + urlInput;

    if(co_url) {
        $('.center-vertical').animate({ 'marginTop': '0px'}, 500);
        db.ready().then(() => {
            db.modules.get('checkCors', {url: co_url}).then((check) => {
                if (check.isDenied) {
                    $('#modalButton').click();
                } else {
                    resetComparison();
                    $('#compareContent').addClass('invisible');
                    $('#info').addClass('hidden');
                    $('#preWarming').removeClass('hidden');

                    const carousel = $('.carousel').carousel({
                        interval: 1200,
                        wrap: false
                    });

                    carousel.carousel(0);
                    carousel.carousel('cycle');

                    startPreWarming();
                }
            });
        });
    }
};

window.contactUs = (e) => {
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
};

window.frameLoaded = (iframe) => {
    let stop = new Date().getTime();
    clearInterval(timer);
    if(iframe !== 'competitor') {
        if(bq_start > 0) {
            bq_time = (stop - bq_start) / 1000;
            bq_time_display.html(bq_time.toFixed(3) + 's');

            if(co_time / bq_time >= 1) {
                $('#resultInfo').html('Baqend makes your site <strong>' + (co_time / bq_time).toFixed(2) + 'x</strong> faster.');
            }
        }
    } else {
        if(co_start > 0) {
            co_time = (stop - co_start) / 1000;
            co_time_display.html(co_time.toFixed(3) + 's');

            setTimeout(() => {
                let frame = createFrame('baqend', 'baqendFrame', 'myframe loading', getBaqendUrl(false));
                frame.onload = () => {
                    frameLoaded();
                };

                bq_frame.append(frame);
                bq_frame.removeClass('hide');
                $('#wListConfig').removeClass('hide');

                bq_start = new Date().getTime();
                timer = setInterval(updateTime, 1, bq_time_display, bq_start);
            }, 1000);
        }
    }
};

window.startComparison = () => {
    $('#competitorFrame').remove();

    let frame = createFrame('competitor', 'competitorFrame', 'myframe loading', co_url);

    frame.onload = () => {
        frameLoaded('competitor');
    };

    $('#iframe-competitor').append(frame);

    co_start = new Date().getTime();

    timer = setInterval(updateTime, 1, co_time_display, co_start);
};

function getBaqendUrl(noCaching) {
    let url = bq_url + '?url=' + encodeURIComponent(co_url) + '&wlist=' +  generateWhiteList();
    if(noCaching) {
        url += '&noCaching=' + noCaching;
    }
    return url;
}

function getUrlParam(name) {
    return (location.search.split(name + '=')[1] || '').split('&')[0];
}

function startPreWarming() {
    $('#baqendFrame').remove();
    let frame = createFrame('baqend', 'baqendFrame', 'myframe', getBaqendUrl(true));

    frame.onload = () => {
        timeout = setTimeout(() => {
            $('#compareContent').removeClass('invisible');
            $('#info').removeClass('hidden');
            $('#preWarming').addClass('hidden');
            $('#baqendFrame').remove();
            startComparison();
        }, 5000);
    };
    bq_frame.append(frame);
}

function resetComparison() {
    clearInterval(timer);
    timer = 0;
    co_start = 0;
    bq_start = 0;
    co_time = 0;
    bq_time = 0;
    $('.co_time').html('...');
    $('.bq_time').html('...');
    $('#resultInfo').html('Can Baqend speed up your site?');
    $('#iframe_competitor').prop('src', '');
    $('#iframe_baqend').prop('src', '');
    $('.myframe').removeClass('loading');
}

function createFrame(name, id, classString, source) {
    let frame = document.createElement('iframe');
    frame.setAttribute('name', name);
    frame.setAttribute('id', id);
    frame.setAttribute('class', classString);
    frame.setAttribute('src', source);
    return frame;
}

function generateWhiteList() {
    let wListString = new URL(co_url).host;
    if(wListString.indexOf('www') !== -1) {
        wListString = wListString.substr(wListString.indexOf('.') + 1);
    }
    wListString = '"^(https?:\\/\\/)?([\\w-]*\.){0,3}' + wListString.substr(0, wListString.indexOf('.') + 1) + '.*$"';

    let wListInputArray = document.getElementById('wListInput').value.split(',');
    if(wListInputArray[0] !== '') {
        for(let i = 0; i < wListInputArray.length; i++)
        {
            wListString += ',';
            wListString += '"^(https?:\\/\\/)?([\\w-]*\.){0,3}' + wListInputArray[i] + '.*$"';
        }
    }

    return encodeURIComponent(wListString);
}

function updateTime(time_display, start_time) {
    let now = new Date().getTime();
    let current = (now - start_time) / 1000;
    time_display.html(current.toFixed(3) + 's');
}