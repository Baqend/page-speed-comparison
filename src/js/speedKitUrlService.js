const bq_url = 'https://makefast-staging.app.baqend.com';

class SpeedKitUrlService {
    getBaqendUrl(originalUrl, wlist) {
        return bq_url + '?url=' + encodeURIComponent(originalUrl) + '&wlist=' + this.generateWhiteList(originalUrl, wlist);
    }

    generateWhiteList(originalUrl, wlist) {
        const dummyElement = document.createElement('a');
        dummyElement.href = originalUrl;

        let wListString = dummyElement.hostname;
        if (wListString.indexOf('www') !== -1) {
            wListString = wListString.substr(wListString.indexOf('.') + 1);
        }
        wListString = '"^(https?:\\/\\/)?([\\w-]*\.){0,3}' + wListString.substr(0, wListString.indexOf('.') + 1) + '.*$"';

        let wListInputArray = wlist.split(',');
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