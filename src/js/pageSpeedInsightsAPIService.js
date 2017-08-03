import 'whatwg-fetch';
const API_KEY = 'AIzaSyBVAGvv1O8d6H7mrTKZW6pds7KUlp8CixY';
const API_URL = 'https://www.googleapis.com/pagespeedonline/v1/runPagespeed?';

class PageSpeedInsightsAPIService {
    callPageSpeedInsightsAPI(url) {
        const query = ['url=' + url,
            'screenshot=true',
            'strategy=desktop',
            'key=' + API_KEY,
        ].join('&');

        return new Promise((resolve, reject) => {
            fetch(API_URL + query, {
                method: 'get'
            }).then((response) => {
                return resolve(this.calculateResult(response));
            }).catch((err) => {
                return reject(err);
            });
        });
    }

    calculateResult(response) {
        const results = {domains: null, resources: null, bytes: null, screenshot: null};
        return response.json().then((data) => {
            results.domains = data.pageStats.numberHosts || 0;
            results.resources = data.pageStats.numberResources || 0;

            let bytes = parseInt(data.pageStats.htmlResponseBytes) || 0;
            bytes += parseInt(data.pageStats.cssResponseBytes) || 0;
            bytes += parseInt(data.pageStats.imageResponseBytes) || 0;
            bytes += parseInt(data.pageStats.javascriptResponseBytes) || 0;
            bytes += parseInt(data.pageStats.otherResponseBytes) || 0;

            results.bytes = this.formatBytes(bytes, 2);
            results.screenshot = data.screenshot;

            return results;
        });
    }

    formatBytes(bytes, decimals) {
        if (bytes == 0) return '0 Bytes';
        let k = 1000,
            dm = decimals || 2,
            sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
            i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}
module.exports = PageSpeedInsightsAPIService;