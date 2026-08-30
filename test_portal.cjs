require('ts-node').register({ compilerOptions: { module: 'commonjs', jsx: 'react-jsx' } });
const ReactDom = require('react-dom');
console.log(Object.keys(ReactDom));
