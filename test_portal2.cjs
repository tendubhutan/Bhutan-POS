const fs = require('fs');
console.log(fs.readFileSync('package.json', 'utf8').includes('react-dom'));
