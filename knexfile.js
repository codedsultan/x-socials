// knexfile.js
require('ts-node').register({
    project: './tsconfig.json',
    compilerOptions: {
        module: 'commonjs'
    }
});

module.exports = require('./knexfile.ts').default || require('./knexfile.ts');