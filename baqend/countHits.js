const { countBy } = require('lodash');

/**
 * @param {Request[]} requests
 * @return {Object<string, number>}
 */
function countHits(requests) {
  return countBy(requests, (req) => {
    const headers = req.headers.response.join(' ').toLowerCase();
    if (headers.indexOf('x-cache') !== -1 && headers.indexOf('x-cache-hits') !== -1
      && headers.indexOf('x-served-by') !== -1) {
      return headers.indexOf('x-cache: hit') !== -1 ? 'hit' : 'miss';
    }
    return 'other';
  });
}

exports.countHits = countHits;
