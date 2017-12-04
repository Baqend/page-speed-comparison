/* global Abort */
const fetch = require('node-fetch');
const { parse, format } = require('url');

const mobileUserAgentString = 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_0_2 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13A452 Safari/601.1 PTST/396';

/**
 * Analyzes the website's type.
 *
 * @param {Response} response
 */
function analyzeType(response) {
  const via = response.headers.get('via');
  if (via === 'baqend' || response.url.lastIndexOf('baqend') !== -1) {
    return 'baqend';
  }

  const xGenerator = response.headers.get('x-generator');
  if (xGenerator && xGenerator.toLocaleLowerCase().includes('sulu')) {
    return Promise.resolve('sulu');
  }

  if (response.headers.has('x-wix-request-id') || response.headers.has('x-wix-route-id')) {
    return Promise.resolve('wix');
  }

  if (response.headers.has('x-host') && response.headers.get('x-host').includes('weebly.net')) {
    return Promise.resolve('weebly');
  }

  if (response.headers.has('x-jimdo-instance')) {
    return Promise.resolve('jimdo');
  }

  return response.text()
    .then((text) => {
      const result = /<meta\s+name=["']generator["']\s*content=["']([^"']+)["']/i.exec(text);
      if (result) {
        const [, generator] = result;
        const s = generator.toLocaleLowerCase();
        if (s.includes('joomla')) {
          return 'joomla';
        }
        if (s.includes('wordpress')) {
          return 'wordpress';
        }
        if (s.includes('drupal')) {
          return 'drupal';
        }
        if (s.includes('typo3')) {
          return 'typo3';
        }
      }

      if (text.includes('<!-- This is Squarespace. -->')) {
        return 'squarespace';
      }

      return null;
    });
}

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

  return fetch(url, options)
    .then((response) => {
      const location = response.headers.get('location');

      // Redirect if location header found
      if (location) {
        if (limit > 20) {
          throw new Abort('The URL resolves in too many redirects.');
        }

        return fetchUrl(location, mobile, limit + 1);
      }

      // Retrieve properties of that domain
      const secured = url.startsWith('https://');
      return analyzeType(response)
        .then(type => ({ url, type, secured }))
        .then(opts => Object.assign(opts, { supported: opts.enabled || opts.type === 'wordpress' }));
    });
}

/**
 * @param {string} url
 * @return {Promise}
 */
function testForSpeedKit(url) {
  const parsedUrl = parse(url);
  const swUrl = format(Object.assign({}, parsedUrl, { pathname: '/sw.js' }));
  const error = { enabled: false, version: null };

  return fetch(swUrl).then((res) => {
    if (!res.ok) { return error; }

    return res.text().then((text) => {
      const matches = /\/\* ! speed-kit ([\d.]+) \|/.exec(text);
      if (matches) {
        const [, version] = matches;
        return { enabled: true, version };
      }
      return error;
    });
  }).catch(() => (error));
}

/**
 * Flattens an array.
 *
 * @param {Array} array An array to flatten.
 * @return {Array} A flattened array.
 */
function flatten(array) {
  return Array.prototype.concat.apply([], array);
}

/**
 * @param {string[]} urls The URLs to add a schema to.
 * @return {string[]} An array of URLs with schema.
 */
function addSchema(urls) {
  return flatten(urls.map((query) => {
    if (/^https?:\/\//.test(query)) {
      return [{ urlUnderTest: query, query }];
    }
    return [{ urlUnderTest: `https://${query}`, query }, { urlUnderTest: `http://${query}`, query }];
  }));
}

/**
 * @param {string|string[]} urls The URLs to test.
 * @param {boolean} mobile Whether to test the mobile variant.
 * @return {Promise}
 */
function analyzeUrl({ urls, mobile }) {
  const inputArray = Array.isArray(urls) ? urls : [urls];

  const fetchPromises = addSchema(inputArray).map(({ urlUnderTest, query }) => fetchUrl(urlUnderTest, mobile)
    .then((fetchRes) => {
      const { url } = fetchRes;
      return testForSpeedKit(url)
        .then(({ enabled, version }) => Object.assign(fetchRes, { query, enabled, version }));
    })
    .catch(() => Promise.resolve(null)));

  return Promise.all(fetchPromises)
    // Reduce duplicates from same hostname
    .then(all => all.reduce((prev, curr) => {
      if (curr === null || prev.some(it => it.secured && it.query === curr.query)) {
        return prev;
      }

      return prev.concat(curr);
    }, []));
}

exports.call = (db, { urls, mobile }) => analyzeUrl({ urls, mobile: mobile === 'true' });
