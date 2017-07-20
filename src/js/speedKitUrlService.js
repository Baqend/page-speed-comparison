const bq_url = 'https://makefast-staging.app.baqend.com';

class SpeedKitUrlService {
    getBaqendUrl(originalUrl, noCaching, wlist) {
        let url = bq_url + '?url=' + encodeURIComponent(originalUrl) + '&wlist=' + this.generateWhiteList(originalUrl, wlist);
        if (noCaching) {
            url += '&noCaching=' + noCaching;
        }
        return url;
    }

    generateWhiteList(originalUrl, wlist) {
        let wListString = new URL(originalUrl).host;
        if (wListString.indexOf('www') !== -1) {
            wListString = wListString.substr(wListString.indexOf('.') + 1);
        }
        wListString = '"^(https?:\\/\\/)?([\\w-]*\.){0,3}' + wListString.substr(0, wListString.indexOf('.') + 1) + '.*$"';

        let wListInputArray = wlist.value.split(',');
        if (wListInputArray[0] !== '') {
            for (let i = 0; i < wListInputArray.length; i++) {
                wListString += ',';
                wListString += '"^(https?:\\/\\/)?([\\w-]*\.){0,3}' + wListInputArray[i].replace(/\s+/, "") + '..*$"';
            }
        }
        return encodeURIComponent(wListString);
    }
}
module.exports = SpeedKitUrlService;