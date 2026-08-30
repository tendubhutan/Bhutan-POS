const http = require('http');
const req = http.request('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});
req.write(JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: 'what are my sales today' }] }]
}));
req.end();
