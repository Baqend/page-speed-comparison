const fetch = require('node-fetch');

const AD_SERVER_URL = 'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt';
let adHosts;

/**
 * Returns all domains that are ads.
 *
 * @returns {Promise<Set<string>>} A set of ad domain strings
 */
function getAdSet() {
    if (adHosts) {
        return Promise.resolve(adHosts);
    }

    return loadAdSet().then((adSet) => {
        adHosts = adSet;
        return adSet;
    });
}

/**
 * @return {Promise<Set<string>>} A set of ad domain strings
 */
function loadAdSet() {
    return fetch(AD_SERVER_URL).then((resp) => {
        return resp.text();
    }).then((text) => {
        const lines = text.split('\n')
            .filter(line => line.startsWith('||'))
            .map(line => line.substring(2, line.indexOf('^$')));

        return new Set(lines);
    });
}

exports.getAdSet = getAdSet;
