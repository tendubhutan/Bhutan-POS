const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const newRoutes = `
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: "50mb" }));

  // AI Chat Route
  app.post("/api/chat", async (req, res) => {
    try {
      const { query, history, context } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ text: "Error: GEMINI_API_KEY environment variable is missing on the server. Please check your settings." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const systemInstruction = \`
You are an advanced AI Co-Pilot and ERP analyst for a Point of Sale (POS) and accounting application.
The user is asking you a question about their business data.
Here is the context data extracted from their local search that matches their query:
\\n\\n\${context}\\n\\n
Answer their query clearly, concisely, and professionally. 
If they ask for specific numbers or transactions, use the context provided.
If the context is empty, let them know you cannot see any matching records for that query.
Format your response using Markdown.
\`;

      // Convert history to Gemini format if needed, but for simplicity we will just pass a single prompt with history stringified
      const historyText = (history || []).map(h => \`\${h.role}: \${h.content}\`).join("\\n");
      const fullPrompt = \`\${systemInstruction}\\n\\nConversation History:\\n\${historyText}\\n\\nUser: \${query}\\n\\nAI:\`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
      });

      res.json({ text: response.text });
    } catch (e: any) {
      console.error('Gemini API error:', e);
      res.status(500).json({ text: "Error communicating with AI model: " + e.message });
    }
  });

  // Vite middleware for development
`;

content = content.replace(
  /async function startServer\(\) \{[\s\S]*?\/\/ Vite middleware for development/,
  newRoutes.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched server.ts');
