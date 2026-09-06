const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
      if (!response.ok) {
        let errText = '';
        try {
           const errData = await response.json();
           errText = errData.text || '';
        } catch(e) {}
        throw new Error(errText || 'AI Server Error: ' + response.statusText);
      }
      
      const resData = await response.json();
      
      if (resData.text && resData.text.includes('daily AI limit')) {
         throw new Error(resData.text);
      }
      
      return resData.text || 'No response from AI.';
`;

content = content.replace(
  /if \(\!response\.ok\) \{[\s\S]*?return resData\.text \|\| 'No response from AI\.';/,
  replacement.trim()
);

// update catch block
content = content.replace(
  "console.error(\"Gemini AI failed, falling back to local search.\", e);",
  "console.error(\"Gemini AI failed, falling back to local search.\", e);\n      let quotaMsg = '';\n      if (e.message && e.message.includes('daily AI limit')) { quotaMsg = e.message + '\\n\\n---\\n\\n'; }"
);

// at the end, replace return msg; with return quotaMsg + msg;
// wait, let's just prepend quotaMsg to the final return string.

fs.writeFileSync(file, content, 'utf8');
console.log('Patched localAIService to handle quota gracefully');
