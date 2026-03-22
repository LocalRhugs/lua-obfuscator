const https = require('https');
const fs = require('fs');

const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return download(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error('Failed to download: ' + response.statusCode));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

(async () => {
    try {
        console.log('Downloading zip...');
        await download('https://jaist.dl.sourceforge.net/project/luabinaries/5.1.5/Tools%20Executables/lua-5.1.5_Win64_bin.zip', 'lua.zip');
        console.log('Done!');
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
