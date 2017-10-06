const fetch = require('node-fetch');
const urlModule = require('url');

exports.call = function(db, data, req) {
  let urlInput = data.url;

  const hasProtocol = /^https?:\/\//.test(urlInput);
  urlInput = hasProtocol? urlInput : 'http://' + urlInput;

  return fetchUrl(urlInput).then(url => {
    const parsedUrl = urlModule.parse(url);
    const swUrl = urlModule.format(Object.assign({}, parsedUrl, {pathname: '/sw.js'}));

    return fetch(swUrl).then(res => {
      if (!res.ok)
        return false;

      return res.text().then(text => {
        return text.indexOf('speed-kit') != -1;
      });
    }).catch(e => false).then((speedkit) => {
        return { url, speedkit };
    });
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
