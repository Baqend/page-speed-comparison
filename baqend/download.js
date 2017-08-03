const http = require('http');
exports.call = function(db, url, target) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            const file = new db.File({path: target});
            const size = res.headers['content-length'];
            const mimeType = res.headers['content-type'];
            if (size) {
                resolve(file.upload({mimeType, size, type: 'stream', data: res}));
                return;
            }
            const chunks = [];
            res.on('data', chunks.push.bind(chunks));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                resolve(file.upload({mimeType, size: buf.length, type: 'buffer', data: buf, force: true}));
            });
        }).on('error', (e) => {
            reject(e);
        });
    });
};