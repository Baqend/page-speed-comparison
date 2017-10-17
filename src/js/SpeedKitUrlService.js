/* global APP document */

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
  const domain = getTLD(originalUrl);

  // Replace TLD with a wildcard
  const host = [`regexp:/^(?:[\\w-]*\\.){0,3}${domain}/`];

  // Create parts for the regexp
  if (whitelist.length) {
    host.push(`regexp:/^(?:[\\w-]*\\.){0,3}(?:${whitelist.map(item => escapeRegExp(item)).join('|')})/`);
  }

  // Create the final exp
  return JSON.stringify([{ host }]);
}

/**
 * Extracts the top level domain of a URL.
 *
 * @param {string} url The URL to extract the hostname of.
 * @return {string} The extracted hostname.
 */
export function getTLD(url) {
  const dummyElement = document.createElement('a');
  dummyElement.href = url;

  let { hostname } = dummyElement;
  // Remove "www" in the beginning
  if (hostname.includes('www.')) {
    hostname = hostname.substr(hostname.indexOf('www.') + 4);
  }

  const domainFilter = /^(?:[\w-]*\.){0,3}([\w-]*\.)[\w]*$/;
  const [, domain] = domainFilter.exec(hostname);

  return domain;
}

/**
 * Escapes a regular expression.
 *
 * @param {string} str
 * @return {string}
 */
export function escapeRegExp(str) {
  return str.replace(/[[\]/{}()*+?.\\^$|-]/g, '\\$&');
}
