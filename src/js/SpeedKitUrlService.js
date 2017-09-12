const BAQEND_URL = `https://${APP}.speed-kit.com/`;

/**
 * Returns the URL to send to Speed Kit.
 *
 * @param {string} originalUrl The URL to make fast. ;-)
 * @param {string} whitelistStr The whitelist string with comma-separated values.
 * @return {string} A URL to send to Speed Kit.
 */
export function getBaqendUrl(originalUrl, whitelistStr) {
    const whitelistDomains = whitelistStr
        .split(',')
        .map(item => item.trim())
        .filter(item => !!item);

    const whitelist = generateRules(originalUrl, whitelistDomains);

    return `${BAQEND_URL}#url=${encodeURIComponent(originalUrl)}&whitelist=${encodeURIComponent(whitelist)}`;
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
    const host = [`regexp:/^(?:[\\w-]*\\.){0,3}${hostname.substr(0, hostname.indexOf('.'))}\\./`];

    // Create parts for the regexp
    if (whitelist.length) {
        whitelist.forEach((item) => {
            host.push(`regexp:/^(?:[\\w-]*\\.){0,3}${item}\\./`);
        });
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
export function getHostnameOfUrl(url) {
    const dummyElement = document.createElement('a');
    dummyElement.href = url;

    return dummyElement.hostname;
}
