const fetch = require('node-fetch');
const URL = require('url');

const ORIGIN = '18.195.228.187';

function analyzeSpeedKit(urlToTest) {
  const url = {
    protocol: 'http',
    host: ORIGIN,
    pathname: '/config',
    search: `url=${encodeURIComponent(urlToTest)}`,
  };

  return fetch(URL.format(url))
    .then((res) => {
      if (res.status === 404) {
        throw new Error(`Not a valid Speed Kit URL: ${url}`);
      }

      return res.json();
    });
}

exports.analyzeSpeedKit = analyzeSpeedKit;
