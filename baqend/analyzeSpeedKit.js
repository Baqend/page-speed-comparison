const fetch = require('node-fetch');
const URL = require('url');
const credentials = require('./credentials');

const ORIGIN = credentials.makefast_ip;

function analyzeSpeedKit(urlToTest) {
  const url = {
    protocol: 'http',
    host: ORIGIN,
    pathname: '/config',
    search: `url=${encodeURIComponent(urlToTest)}`,
  };

  const urlString = URL.format(url);
  return fetch(urlString)
    .then((res) => {
      if (res.status === 404) {
        throw new Error(`Not a valid Speed Kit URL: ${urlString}`);
      }

      return res.json();
    });
}

exports.analyzeSpeedKit = analyzeSpeedKit;
