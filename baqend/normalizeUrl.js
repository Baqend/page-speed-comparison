const fetch = require('node-fetch');
const urlModule = require('url');

const mobileUserAgentString = 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_0_2 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13A452 Safari/601.1 PTST/396';

function fetchUrl(url, mobile, redirects) {
  const limit = redirects || 0;

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
    return { url, isBaqendApp: via === 'baqend' || url.lastIndexOf('baqend') !== -1 };
  });
}

exports.call = (db, data) => {
  let urlInput = data.url;
  const { mobile } = data;

  const hasProtocol = /^https?:\/\//.test(urlInput);
  urlInput = hasProtocol ? urlInput : `http://${urlInput}`;

  return fetchUrl(urlInput, mobile).then((fetchRes) => {
    const parsedUrl = urlModule.parse(fetchRes.url);
    const swUrl = urlModule.format(Object.assign({}, parsedUrl, { pathname: '/sw.js' }));

    return fetch(swUrl).then((res) => {
      if (!res.ok) { return false; }

      return res.text().then(text => text.indexOf('speed-kit') !== -1);
    }).catch(() => false).then(speedkit => ({ url: fetchRes.url, isBaqendApp: fetchRes.isBaqendApp, speedkit }));
  });
};
