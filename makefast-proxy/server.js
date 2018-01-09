const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const request = require('request');
const path = require('path');
const WebSocket = require('ws');

const httpPort = 80;
const sslPort = 443;
const app = express();

const httpServer = http.createServer(app);
const sslServer = https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
}, app);

const ws = new WebSocket.Server({ server: httpServer });
const wss = new WebSocket.Server({ server: sslServer });

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
  // Prevent infinite loop
  const makefastHeader = 'X-From-Makefast';
  if (req.get(makefastHeader)) {
    res.send('makefast-proxy');
    return;
  }

  // Pipe all other requests to original URL
  const host = req.get('host');
  const url = `${req.protocol}://${host}${req.originalUrl}`;

  if (debug) {
    console.log(`Pipe URL (${req.method}): ${url}`);
  }

  const headers = { [makefastHeader]: 'true' };
  req.pipe(request({ url, followRedirect: false, headers }, (err) => {
    if (err) {
      console.log(`Error piping URL (${req.method}) ${url}:`, err);
    }
  })).pipe(res);
});

const wsConnectClient = (wsServer, req, secure) => (
  new Promise((resolve) => {
    const { host } = req.headers;
    const url = `${secure ? 'wss' : 'ws'}://${host}${req.url}`;
    let options;
    if (req.headers.cookie) {
      options = {
        headers: {
          cookie: req.headers.cookie,
        },
      };
    }
    const wsClient = new WebSocket(url, options);

    wsClient.on('message', msg => wsServer.readyState === 1 && wsServer.send(msg));
    wsClient.on('close', wsServer.close);
    wsClient.on('error', (error) => {
      console.log('WebSocket error from server', error);
      wsServer.terminate();
    });
    wsClient.on('open', () => resolve(wsClient));
  })
);

const wsFactory = secure => (
  (wsServer, req) => {
    const wsClientConnect = wsConnectClient(wsServer, req, secure);

    wsServer.on('message', async message => (await wsClientConnect).send(message));
    wsServer.on('close', async (code, reason) => (await wsClientConnect).close(code, reason));
    wsServer.on('error', async (error) => {
      console.log('WebSocket error from client', error);
      (await wsClientConnect).terminate();
    });
  }
);

ws.on('connection', wsFactory(false));
wss.on('connection', wsFactory(true));

httpServer.listen(httpPort);
sslServer.listen(sslPort);

console.log(`Started makefast-proxy server on http: ${httpPort}, ssl: ${sslPort}`);

