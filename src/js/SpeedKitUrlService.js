const BAQEND_URL = `https://${APP}.speed-kit.com/`;

/**
 * Returns the URL to send to Speed Kit.
 *
 * @param {string} originalUrl The URL to make fast. ;-)
 * @param {string} whitelistStr The whitelist string with comma-separated values.
 * @return {string} A URL to send to Speed Kit.
 */
export function getBaqendUrl(originalUrl, whitelistStr) {
    const whitelist = whitelistStr
        .split(',')
        .map(item => item.trim())
        .filter(item => !!item);

    const rules = generateRules(originalUrl, whitelist);

    return `${BAQEND_URL}#url=${encodeURIComponent(originalUrl)}&rules=${encodeURIComponent(rules)}`;
}

/**
 * Generates a reg exp representing the whitelist.
 *
 * @param {string} originalUrl The original URL to the site.
 * @param {string[]} whitelist An array of whitelist domains.
 * @return {string} A string representing the rules.
 */
export function generateRules(originalUrl, whitelist) {
    let hostname = getHostnameOfUrl(originalUrl);
    // Remove "www" in the beginning
    if (hostname.includes('www.')) {
        hostname = hostname.substr(hostname.indexOf('www.') + 4);
    }

    // Replace TLD with a wildcard
    let whitelistRegExp = `${hostname.substr(0, hostname.indexOf('.'))}\\.`;

    // Create parts for the regexp
    if (whitelist.length) {
        whitelist.forEach((item) => {
            whitelistRegExp += '|' + item + '\\.';
        });
    }

    // Create the final exp
    return JSON.stringify([{ whitelist: `^(?:https?:\\/\\/)?(?:[\\w-]*\\.){0,3}(?:${whitelistRegExp}).*$` }]);
}

/**
 * Extracts the hostname of a URL.
 *
 * @param {string} url The URL to extract the hostname of.
 * @return {string} The extracted hostname.
 */
export function getHostnameOfUrl(url) {
    const dummyElement = document.createElement('a');
    dummyElement.href = url;

    return dummyElement.hostname;
}
