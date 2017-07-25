class UiElementCreator {
    createImageElement(screenshotData) {
        const img = document.createElement('IMG');
        img.setAttribute('src', 'data:' + screenshotData.mime_type + ';base64,' +
            screenshotData.data.replace(/_/g, '/').replace(/-/g, '+'));
        img.setAttribute('alt', 'preview of website screen');
        img.setAttribute('id', 'preview-image');
        img.setAttribute('class', 'blur');
        return img;
    }

    createVideoElement(elementId, videoSrc) {
        const video = document.createElement('video');
        video.setAttribute('controls', 'controls');
        video.setAttribute('type', 'video/mp4');
        video.setAttribute('poster', videoSrc.substr(0, videoSrc.lastIndexOf('.')) + '.png');
        video.setAttribute('autoplay', 'autoplay');
        video.setAttribute('onplay', 'playVideos(this)');
        video.setAttribute('id', elementId);
        video.setAttribute('src', videoSrc);
        video.setAttribute('class', 'embedVideo');
        return video;
    }

    createScannerElement() {
        const scanner = document.createElement('div');
        scanner.setAttribute('class', 'laser');
        return scanner;
    }

    createLinkButton() {
        const button = document.createElement('button');
        button.setAttribute('class', 'btn openButton');
        button.setAttribute('onclick', 'openBaqendFrame()');
        button.innerHTML = 'open in new tab';
        return button;
    }

    constructVideoLink(data, videoAttr) {
        const date = data.testId.substr(0, 2) + '/' + data.testId.substr(2, 2) + '/' + data.testId.substr(4, 2);
        return 'http://ec2-35-159-2-124.eu-central-1.compute.amazonaws.com/results/video/' +
            date + '/' + data[videoAttr].substr(data[videoAttr].indexOf('_') + 1,
                data[videoAttr].length) + '/video.mp4';
    }
}

module.exports = UiElementCreator;