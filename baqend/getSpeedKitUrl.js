const credentials = require('./credentials');
const BAQEND_URL = `https://${credentials.app}.speed-kit.com/`;

/**
 * Generates a reg exp representing the whitelist.
 *
 * @param {string} originalUrl The original URL to the site.
 * @param {string[]} whitelist An array of whitelist domains.
 * @return {string} A string representing the rules.
 */
function generateRules(originalUrl, whitelist) {
    let hostname = getHostnameOfUrl(originalUrl);
    // Remove "www" in the beginning
    if (hostname.includes('www.')) {
        hostname = hostname.substr(hostname.indexOf('www.') + 4);
    }

    // Replace TLD with a wildcard
    const host = [`regexp:/^(?:[\\w-]*\\.){0,3}${hostname.substr(0, hostname.indexOf('.'))}\\./`];

    // Create parts for the regexp
    if (whitelist.length) {
        host.push(`regexp:/^(?:[\\w-]*\\.){0,3}(?:${whitelist.map(item => escapeRegExp(item)).join('|')})/`);
    }

    // Create the final exp
    return JSON.stringify([{ host }]);
}

/**
 * Extracts the hostname of a URL.
 *
 * @param {string} url The URL to extract the hostname of.
 * @return {string} The extracted hostname.
 */
function getHostnameOfUrl(url) {
    const dummyElement = document.createElement('a');
    dummyElement.href = url;

    return dummyElement.hostname;
}

/**
 * Escapes a regular expression.
 *
 * @param {string} str
 * @return {string}
 */
function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

/**
 * Returns the URL to send to Speed Kit.
 *
 * @param {string} originalUrl The URL to make fast. ;-)
 * @param {string} whitelistStr The whitelist string with comma-separated values.
 * @return {string} A URL to send to Speed Kit.
 */
function getSpeedKitUrl(originalUrl, whitelistStr) {
    const whitelistDomains = whitelistStr
        .split(',')
        .map(item => item.trim())
        .filter(item => !!item);

    const whitelist = generateRules(originalUrl, whitelistDomains);

    return `${BAQEND_URL}#url=${encodeURIComponent(originalUrl)}&whitelist=${encodeURIComponent(whitelist)}`;
}

exports.getSpeedKitUrl = getSpeedKitUrl;
