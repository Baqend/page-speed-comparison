const fetch = require('node-fetch');
const url = require("url");

exports.call = function(db, data, req) {
  let urlInput = data.url;

  const hasProtocol = /^https?:\/\//.test(urlInput);
  urlInput = hasProtocol? urlInput : 'http://' + urlInput;

  return fetchUrl(urlInput).then(url => {
    return { url };
  });
};

function fetchUrl(url, redirects) {
  const limit = redirects || 0;
  return fetch(url, {redirect: 'manual'}).then(res => {
    const location = res.headers.get('location');
    if (location) {
      if (limit > 20)
        throw new Abort('The URL resolves in too many redirects.');

      return fetchUrl(location, limit + 1);
    }

    return url;
  });
}