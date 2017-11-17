const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const request = require('request');
const path = require('path');

const httpPort = 80;
const sslPort = 443;
const app = express();

function createPage(config, snippet) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Makefast Speed-Kit Installer</title>
<script type="application/javascript">
  var config = ${config};
  ${snippet}
</script>
</head>
<body>
</body>
</html>`;
}

// to debug this proxy:
// - Create a /etc/hosts entry with `127.0.0.1     example.com`
// - run `npm link` in the speed-kit project
// - build a dev version of speed-kit
// - run `npm link speed-kit` in the makefast-proxy folder
// - start this server with `node server.js --debug`
const debug = process.argv[2] === '--debug';

app.use((req, res, next) => {
  if (debug) {
    console.log(req.url);
  }
  next();
});

app.get('/sw.js', (req, res) => {
  if (debug) {
    res.sendFile(require.resolve('speed-kit/build/speedkit/sw.js'));
    return;
  }
  request('https://www.baqend.com/speed-kit/latest/sw.js').pipe(res);
});

app.get('/install-speed-kit', (req, res) => {
  const { config } = req.query;
  if (debug) {
    fs.readFile(require.resolve('speed-kit/build/speedkit/snippet.js'), { encoding: 'utf8' }, (err, data) => {
      if (err) {
        res.status(500).send('Snippet was not build!');
        return;
      }

      res.send(createPage(config, data));
    });
    return;
  }

  request('https://www.baqend.com/speed-kit/latest/snippet.js', (err, response, body) => {
    res.send(createPage(config, body));
  });
});

app.use((req, res) => {
  // Pipe all other requests to original URL
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  req.pipe(request(url)).pipe(res);
});


const httpServer = http.createServer(app);
httpServer.listen(httpPort);

const sslServer = https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
}, app);
sslServer.listen(sslPort);

console.log(`Started makefast-proxy server on http: ${httpPort}, ssl: ${sslPort}`);

