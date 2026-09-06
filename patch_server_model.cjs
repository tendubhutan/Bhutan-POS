const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("model: 'gemini-2.5-flash',", "model: 'gemini-3.6-flash',");

content = content.replace(
  "res.status(500).json({ text: \\\"I have reached my current daily AI limit",
  "res.status(200).json({ text: \\\"I have reached my current daily AI limit"
);
content = content.replace(
  "res.status(500).json({ text: \\\"Error communicating with AI model",
  "res.status(200).json({ text: \\\"Error communicating with AI model"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched server model to gemini-3.6-flash and error codes');
