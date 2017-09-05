import 'whatwg-fetch';

const API_KEY = 'AIzaSyBVAGvv1O8d6H7mrTKZW6pds7KUlp8CixY';
const API_URL = 'https://www.googleapis.com/pagespeedonline/v1/runPagespeed?';

/**
 * @param {string} url The URL to run the Page Speed tests on.
 * @return {Promise<{ domains: number | null, requests: number | null, bytes: number | null, screenshot: string | null }>}
 */
export async function callPageSpeedInsightsAPI(url) {
    const query = ['url=' + encodeURIComponent(url),
        'screenshot=true',
        'strategy=desktop',
        'key=' + API_KEY,
    ].join('&');

    const response = await fetch(API_URL + query, { method: 'get' });
    if (!response.ok) {
        throw new Error('Page Speed failed with an error.');
    }

    return calculateResult(response);
}

/**
 * @param {Response} response
 * @return {Promise<{ domains: number | null, requests: number | null, bytes: number | null, screenshot: string | null }>}
 */
export async function calculateResult(response) {
    /** @type {{ domains: number | null, requests: number | null, bytes: number | null, screenshot: string | null }} */
    const results = { domains: null, requests: null, bytes: null, screenshot: null };
    const data = response.json();
    results.domains = data.pageStats.numberHosts || 0;
    results.requests = data.pageStats.numberResources || 0;

    let bytes = parseInt(data.pageStats.htmlResponseBytes) || 0;
    bytes += parseInt(data.pageStats.cssResponseBytes) || 0;
    bytes += parseInt(data.pageStats.imageResponseBytes) || 0;
    bytes += parseInt(data.pageStats.javascriptResponseBytes) || 0;
    bytes += parseInt(data.pageStats.otherResponseBytes) || 0;

    results.bytes = bytes;
    results.screenshot = data.screenshot;

    return results;
}
