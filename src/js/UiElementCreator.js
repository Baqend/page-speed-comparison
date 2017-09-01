export class UiElementCreator {

    /**
     * @param {*} screenshotData
     * @return {HTMLImageElement}
     */
    createImageElement(screenshotData) {
        const img = document.createElement('img');
        img.setAttribute('src', 'data:' + screenshotData.mime_type + ';base64,' +
            screenshotData.data.replace(/_/g, '/').replace(/-/g, '+'));
        img.setAttribute('alt', 'preview of website screen');
        img.setAttribute('id', 'preview-image');
        img.setAttribute('class', 'blur');
        return img;
    }

    /**
     * @param {string} elementId
     * @param {string} videoSrc
     * @return {HTMLVideoElement}
     */
    createVideoElement(elementId, videoSrc) {
        const video = document.createElement('video');
        video.setAttribute('controls', 'controls');
        video.setAttribute('type', 'video/mp4');
        video.setAttribute('autoplay', 'autoplay');
        video.setAttribute('onplay', 'playVideos(this)');
        video.setAttribute('id', elementId);
        video.setAttribute('src', videoSrc);
        video.setAttribute('class', 'embedVideo');
        return video;
    }

    /**
     * @return {HTMLDivElement}
     */
    createScannerElement() {
        const scanner = document.createElement('div');
        scanner.setAttribute('class', 'laser');
        return scanner;
    }

    /**
     * @return {HTMLButtonElement}
     */
    createLinkButton() {
        const button = document.createElement('button');
        button.setAttribute('class', 'btn openButton');
        button.setAttribute('onclick', 'openBaqendFrame()');
        button.innerHTML = 'open in new tab';
        return button;
    }
}