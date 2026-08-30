const http = require('http');

function makeReq(contents) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.write(JSON.stringify({ contents }));
    req.end();
  });
}

(async () => {
  let contents = [{ role: 'user', parts: [{ text: 'what are my sales today' }] }];
  let res1 = await makeReq(contents);
  console.log("Res1:", JSON.stringify(res1));
  let candidateContent = res1.candidates[0].content;
  contents.push(candidateContent);
  
  let functionResponses = candidateContent.parts.filter(p => p.functionCall).map(p => {
    return {
      functionResponse: {
        id: p.functionCall.id,
        name: p.functionCall.name,
        response: { result: { sales: 1000 } }
      }
    };
  });
  contents.push({ role: 'user', parts: functionResponses });
  
  let res2 = await makeReq(contents);
  console.log("Res2:", JSON.stringify(res2));
})();
