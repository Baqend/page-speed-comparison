const fetch = require('node-fetch');

let adHosts;

/**
 * Checks if an IP address is rate-limited.
 *
 * @returns {boolean} true if the domain is a ad domain
 */
exports.getAdSet = () => {
    if (adHosts) {
        return Promise.resolve(adHosts);
    }

    return loadAdList().then(adSet => {
        adHosts = adSet;
        return adSet;
    });
}

function loadAdList() {
    return fetch('https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt').then(resp => {
        return resp.text();
    }).then(text => {
        const lines = text.split('\n')
            .filter(line => line.startsWith('||'))
            .map(line => line.substring(2, line.indexOf('^$')));

        return new Set(lines);
    });
}
