const { countBy } = require('lodash');

/**
 * @param {Request[]} requests
 * @return {Object<string, number>}
 */
function countHits(requests) {
  return countBy(requests, (req) => {
    const headers = req.headers;
    if (headers) {
      const resHeaders = headers.response.join(' ').toLowerCase();
      if (resHeaders.indexOf('x-cache') !== -1 && resHeaders.indexOf('x-cache-hits') !== -1
        && resHeaders.indexOf('x-served-by') !== -1) {
        return resHeaders.indexOf('x-cache: hit') !== -1 ? 'hit' : 'miss';
      }
    }
    return 'other';
  });
}

exports.countHits = countHits;
