const BAQEND_URL = `https://${APP}.speed-kit.com/`;

export class SpeedKitUrlService {

    /**
     * Returns the URL to send to Speed Kit.
     *
     * @param {string} originalUrl The URL to make fast. ;-)
     * @param {string} whitelist The whitelist string with comma-separated values.
     * @return {string}
     */
    getBaqendUrl(originalUrl, whitelist) {
        return `${BAQEND_URL}#url=${originalUrl}&wlist=${this.generateWhitelist(originalUrl, whitelist)}`;
    }

    /**
     * Generates a reg exp representing the whitelist.
     *
     * @param {string} originalUrl The original URL to the site.
     * @param {string} whitelist A comma-separated string.
     * @return {string} A string representing the whitelist as a RegExp.
     */
    generateWhitelist(originalUrl, whitelist) {
        let hostname = this.getHostnameOfUrl(originalUrl);
        // Remove "www" in the beginning
        if (hostname.includes('www.')) {
            hostname = hostname.substr(hostname.indexOf('www.') + 4);
        }

        // Replace TLD with a wildcard
        let whitelistRegExp = `${hostname.substr(0, hostname.indexOf('.'))}\\.`;

        // Create an array out of the whitelist string
        const whitelistArray = whitelist.split(',').filter((item) => !!item);

        // Create parts for the regexp
        if (whitelistArray.length) {
            whitelistArray.forEach((item) => {
                whitelistRegExp += '|';
                whitelistRegExp += item.replace(/\s+/, '') + '\\.';
            });
        }

        // Create the final exp
        return `^(?:https?:\\/\\/)?(?:[\\w-]*\\.){0,3}(?:${whitelistRegExp}).*$`;
    }

    /**
     * Extracts the hostname of a URL.
     *
     * @param {string} url The URL to extract the hostname of.
     * @return {string} The extracted hostname.
     */
    getHostnameOfUrl(url) {
        const dummyElement = document.createElement('a');
        dummyElement.href = url;

        return dummyElement.hostname;
    }
}
