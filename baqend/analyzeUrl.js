/* global Abort */
const fetch = require('node-fetch');
const { parse, format } = require('url');
const { toUnicode } = require('punycode');

/**
 * Analyzes the website's type.
 *
 * @param {Response} response
 */
function analyzeType(response) {
  const via = response.headers.get('via');
  if (via === 'baqend' || response.url.includes('www.baqend.com')) {
    return Promise.resolve('baqend');
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
 * @param {string} url
 * @return {string}
 */
function urlToUnicode(url) {
  const { hostname, protocol, search, query, port, pathname } = parse(url);
  const obj = { hostname: toUnicode(hostname), protocol, search, query, port, pathname };
  return format(obj);
}

/**
 * @param {string} url
 * @param {number} limit
 * @return {Promise<*>}
 */
function fetchUrl(url, limit = 0) {
  return fetch(url, { redirect: 'manual', headers: {} })
    .then((response) => {
      const location = response.headers.get('location');

      // Redirect if location header found
      if (location) {
        if (limit > 20) {
          throw new Abort('The URL resolves in too many redirects.');
        }

        return fetchUrl(location, limit + 1);
      }

      // Retrieve properties of that domain
      const secured = url.startsWith('https://');
      const displayUrl = urlToUnicode(url);
      return analyzeType(response).then(type => ({ url, displayUrl, type, secured }));
    })
    .then(opts => Object.assign(opts, { supported: opts.enabled || opts.type === 'wordpress' }))
    .then(opts => testForSpeedKit(url).then(speedKit => Object.assign(opts, speedKit)))
    .catch(() => null);
}

/**
 * @param {string} query The URL to add a schema to.
 * @return {string[]} An array of URLs with schema.
 */
function addSchema(query) {
  if (/^https?:\/\//.test(query)) {
    return [query];
  }

  return [`https://${query}`, `http://${query}`];
}

/**
 * @param {T[]} results The results to find the best one of.
 * @return {T|undefined} The best matching result or undefined, if none such exists.
 * @type T
 */
function findBestResult(results) {
  if (results.length === 1) return results[0];
  if (results.length > 1) return results.find(result => result.secured);
  return undefined;
}

/**
 * @param {string} query The URL to test.
 * @return {Promise}
 */
function analyzeUrl(query) {
  const urlsToTest = addSchema(query);

  const fetchPromises = urlsToTest.map(url => fetchUrl(url));

  return Promise.all(fetchPromises)
    // Remove all nulls from the result
    // .then(results => results.filter(result => result ))
    // Find best result to use
    .then(results => findBestResult(results) || null)
    // Wrap it with the query
    .then(result => [query, result]);
}

/**
 * @param {string[]} urls
 */
function analyzeUrls(urls) {
  return Promise.all(urls.map(url => analyzeUrl(url)));
}

exports.call = (db, { urls }) => analyzeUrls([].concat(urls));
