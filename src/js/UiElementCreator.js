/**
 * @param {*} screenshotData
 * @return {HTMLImageElement}
 */
export function createImageElement(screenshotData) {
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
export function createVideoElement(elementId, videoSrc) {
    const video = document.createElement('video');
    video.setAttribute('playsinline', 'playsinline');
    video.setAttribute('type', 'video/mp4');
    video.setAttribute('autoplay', 'autoplay');
    video.setAttribute('controls', 'controls');
    video.setAttribute('onclick', 'playVideos(this)');
    video.setAttribute('onplay', 'playVideos(this)');
    video.setAttribute('id', elementId);
    video.setAttribute('src', videoSrc);
    video.setAttribute('class', 'embedVideo');
    return video;
}

/**
 * @return {HTMLDivElement}
 */
export function createScannerElement() {
    const scanner = document.createElement('div');
    scanner.setAttribute('class', 'laser');
    return scanner;
}

/**
 * @return {HTMLButtonElement}
 */
export function createLinkButton() {
    const button = document.createElement('button');
    button.setAttribute('id', 'openSpeedKitWebsite');
    button.setAttribute('type', 'button');
    button.setAttribute('class', 'btn openButton');
    button.setAttribute('onclick', 'openSpeedKitLink()');
    button.innerHTML = 'open in new tab';
    return button;
}

export function createWhitelistCandidates(domainArray, whitelist, totalRequestCount) {
    if( domainArray.length > 0 ) {
        $('#whitelistCandidatesInfo').removeClass('hidden');
        domainArray.forEach((domainObject) => {
            const domainUrl = domainObject.url;
            if(!document.getElementById(domainUrl)) {
                const divContainer = document.createElement('div');
                const checkbox = document.createElement('input');
                const checkboxLabel = document.createElement('label');
                const regex = new RegExp(',?\\s?\\b' + domainUrl + '\\s?\\b,?');

                divContainer.setAttribute('class', 'col-lg-6 col-md-6 col-sm-12 col-xs-12 mt-16 p-8');
                checkbox.setAttribute('type', 'checkbox');
                checkbox.setAttribute('id', domainUrl);

                if( regex.test(whitelist) ) {
                    checkbox.setAttribute('checked', 'checked');
                }

                checkboxLabel.setAttribute('for', domainUrl);
                checkboxLabel.setAttribute('onclick', 'whitelistCandidateClicked(this.htmlFor)');
                checkboxLabel.innerHTML = domainUrl + ' (' + Math.round((100 / totalRequestCount) * domainObject.requests) + '%)';
                divContainer.appendChild(checkbox);
                divContainer.appendChild(checkboxLabel);
                $('#whitelistCandidates').append(divContainer);
            }
        })
    }
}
