/* global Abort */
const fetch = require('node-fetch');
const urlModule = require('url');

const mobileUserAgentString = 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_0_2 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13A452 Safari/601.1 PTST/396';

/**
 * @param {string} url
 * @param {boolean} mobile
 * @param {number} limit
 * @return {*}
 */
function fetchUrl(url, mobile, limit = 0) {
  const options = {
    redirect: 'manual',
    headers: {},
  };

  if (mobile) {
    options.headers['User-Agent'] = mobileUserAgentString;
  }

  return fetch(url, options).then((res) => {
    const location = res.headers.get('location');
    const via = res.headers.get('via');

    if (location) {
      if (limit > 20) { throw new Abort('The URL resolves in too many redirects.'); }

      return fetchUrl(location, mobile, limit + 1);
    }
    const isBaqendApp = via === 'baqend' || url.lastIndexOf('baqend') !== -1;
    const isSecured = url.startsWith('https://');
    return { url, isBaqendApp, isSecured };
  });
}

/**
 * @param {string} url
 * @return {Promise}
 */
function testForSpeedKit(url) {
  const parsedUrl = urlModule.parse(url);
  const swUrl = urlModule.format(Object.assign({}, parsedUrl, { pathname: '/sw.js' }));
  const error = { speedkit: false, speedkitVersion: null };

  return fetch(swUrl).then((res) => {
    if (!res.ok) { return error; }

    return res.text().then((text) => {
      const matches = /\/\* ! speed-kit ([\d.]+) \|/.exec(text);
      if (matches) {
        const [, speedkitVersion] = matches;
        return { speedkit: true, speedkitVersion };
      }
      return error;
    });
  }).catch(() => (error));
}

function flatten(array) {
  return Array.prototype.concat.apply([], array);
}

/**
 * @param {string[]} urls
 * @return {string[]}
 */
function addSchema(urls) {
  return flatten(urls.map((url) => {
    const hasProtocol = /^https?:\/\//.test(url);
    return hasProtocol ? [{ urlUnderTest: url, query: url }] : [{ urlUnderTest: `https://${url}`, query: url }, { urlUnderTest: `http://${url}`, query: url }];
  }));
}

/**
 * @param {string|string[]} urls The URLs to test.
 * @param {boolean} mobile Whether to test the mobile variant.
 * @return {Promise}
 */
function normalizeUrl({ urls, mobile }) {
  const inputArray = Array.isArray(urls) ? urls : [urls];

  const fetchPromises = addSchema(inputArray).map(({ urlUnderTest, query }) => fetchUrl(urlUnderTest, mobile)
    .then((fetchRes) => {
      const { url, isBaqendApp, isSecured } = fetchRes;
      return testForSpeedKit(url)
        .then(({ speedkit, speedkitVersion }) => ({ query, url, isBaqendApp, isSecured, speedkit, speedkitVersion }));
    })
    .catch(() => Promise.resolve(null)));

  return Promise.all(fetchPromises)
    // Reduce duplicates from same hostname
    .then(all => all.reduce((prev, curr) => {
      if (curr === null || prev.some(it => it.isSecured && it.query === curr.query)) {
        return prev;
      }

      return prev.concat(curr);
    }, []));
}

exports.call = (db, { urls, mobile }) => normalizeUrl({ urls, mobile: mobile === 'true' });
