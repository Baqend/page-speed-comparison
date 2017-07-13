class UiElementCreator {
    createImageElement(screenshotData) {
        let img = document.createElement('IMG');
        img.setAttribute('src', 'data:' + screenshotData.mime_type + ';base64,' +
            screenshotData.data.replace(/_/g, '/').replace(/-/g, '+'));
        img.setAttribute('alt', 'preview of website screen');
        img.setAttribute('id', 'preview-image');
        return img;
    }

    createVideoElement(elementId, videoSrc) {
        let video = document.createElement('video');
        video.setAttribute('controls', 'controls');
        video.setAttribute('autoplay', 'autoplay');
        video.setAttribute('type', 'video/mp4');
        video.setAttribute('preload', 'auto');
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

    createDownloadButton(videoSrc) {
        let downloadLink = document.createElement('a');
        downloadLink.setAttribute('download', 'download');
        downloadLink.setAttribute('href', videoSrc);
        downloadLink.setAttribute('class', 'btn btn-blue btn-ghost mt-5');
        downloadLink.innerHTML = 'Download';
        return downloadLink;
    }

    constructVideoLink(data, videoAttr) {
        const date = data.testId.substr(0, 2) + '/' + data.testId.substr(2, 2) + '/' + data.testId.substr(4, 2);
        return 'http://ec2-52-57-25-151.eu-central-1.compute.amazonaws.com/results/video/' +
            date + '/' + data[videoAttr].substr(data[videoAttr].indexOf('_') + 1,
                data[videoAttr].length) + '/video.mp4';
    }
}

module.exports = UiElementCreator;