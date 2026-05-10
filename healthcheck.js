const http = require('http');

const options = {
    host: 'localhost',
    port: 5000,
    path: '/health',
    timeout: 2000
};

const request = http.get(options, (res) => {
    if (res.statusCode === 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

request.on('error', () => {
    process.exit(1);
});

request.on('timeout', () => {
    request.destroy();
    process.exit(1);
});