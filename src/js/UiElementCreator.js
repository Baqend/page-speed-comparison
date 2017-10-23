/* global $ document */

/**
 * @param {*} data
 * @return {HTMLImageElement}
 */
export function createImageElement(data) {
  const img = document.createElement('img');
  img.setAttribute('src', `data:${data.mime_type};base64,${data.data.replace(/_/g, '/').replace(/-/g, '+')}`);
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
 * @return {HTMLAnchorElement}
 */
export function createLinkButton(targetUrl) {
  const link = document.createElement('a');
  const italic = document.createElement('i');
  italic.setAttribute('class', 'fa fa-external-link');
  italic.setAttribute('aria-hidden', 'true');
  link.setAttribute('href', targetUrl);
  link.setAttribute('style', 'color: #000000;');
  link.setAttribute('target', '_blank');
  link.appendChild(italic);

  return link;
}

export function createWhitelistCandidates(domainArray, whitelist, totalRequestCount) {
  if (domainArray.length > 0) {
    $('#whitelist').removeClass('hidden');
    $('#wListInput').val(whitelist);
    domainArray.forEach((domainObject) => {
      const domainUrl = domainObject.url;
      if (!document.getElementById(domainUrl) && document.getElementById('whitelistCandidates').children.length < 6) {
        const divContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        const checkboxLabel = document.createElement('label');
        const regex = new RegExp(`,?\\s?\\b${domainUrl}\\s?\\b,?`);

        divContainer.setAttribute('class', 'col-lg-6 col-md-6 col-sm-12 col-xs-12 mt-16 p-8');
        checkbox.setAttribute('type', 'checkbox');
        checkbox.setAttribute('id', domainUrl);

        if (regex.test(whitelist)) {
          checkbox.setAttribute('checked', 'checked');
        }

        checkboxLabel.setAttribute('for', domainUrl);
        checkboxLabel.setAttribute('onclick', 'whitelistCandidateClicked(this.htmlFor)');
        checkboxLabel.innerHTML = `${domainUrl} (${Math.floor((100 / totalRequestCount) * domainObject.requests)}%)`;
        divContainer.appendChild(checkbox);
        divContainer.appendChild(checkboxLabel);
        $('#whitelistCandidates').append(divContainer);
      }
    });
  }
}
