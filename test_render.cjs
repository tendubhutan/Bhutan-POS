require('ts-node').register({
  compilerOptions: { module: 'commonjs', jsx: 'react-jsx' }
});
try {
  const App = require('./src/App.tsx');
  console.log("App imported successfully");
} catch(e) {
  console.error("Error importing App:", e);
}
