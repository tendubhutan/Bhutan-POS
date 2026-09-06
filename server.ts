import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

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
      
      const systemInstruction = `
You are an advanced AI Co-Pilot and ERP analyst for a Point of Sale (POS) and accounting application.
The user is asking you a question about their business data, or asking you to perform an action.

If they ask to change a setting in the app (like enabling/disabling discounts, modules, etc.), DO NOT just tell them how to do it. Instead:
1. Ask them to confirm the exact change they want, e.g., "Are you sure you want to disable itemwise discount and enable lumpsum discount in POS?"
2. If they reply "yes", "sure", "do it" to confirm, you MUST output a special JSON command at the very end of your response inside triple backticks.

Use "UPDATE_CONFIG" for general settings (e.g. EnableNormalSale, EnablePayroll). Values must be strings ("true" or "false").
\`\`\`json
{
  "action": "UPDATE_CONFIG",
  "payload": {
    "EnableItemDiscount": "false"
  }
}
\`\`\`

Use "UPDATE_POS_SETTINGS" specifically for POS screen settings (e.g. enableItemDiscount, enableBillDiscount, autoPrintReceipt, enableSoundFeedback). Values must be true/false booleans.
\`\`\`json
{
  "action": "UPDATE_POS_SETTINGS",
  "payload": {
    "enableItemDiscount": false,
    "enableBillDiscount": true
  }
}
\`\`\`


Use "NAVIGATE" to guide the user to specific reports if they ask to see a report. 
For example, if they ask for an "itemwise profit report", "stock summary", or "trial balance".
\`\`\`json
{
  "action": "NAVIGATE",
  "payload": {
    "view": "reports",
    "report": "item-profit"
  }
}
\`\`\`
Possible report strings: "sales", "stock", "gst", "ledger", "trial balance", "profit & loss", "balance sheet", "item-profit".
You can also navigate to other views like "pos", "normalsale", "purchase", "masters", "vouchers", "dashboard".

Here is the context data extracted from their local search that matches their query:
\n\n${context}\n\n
Answer their query clearly, concisely, and professionally. 
If they ask for specific numbers or transactions, use the context provided.
If the context is empty and it is not a settings change, let them know you cannot see any matching records for that query.
Format your response using Markdown.
`;

      // Convert history to Gemini format if needed, but for simplicity we will just pass a single prompt with history stringified
      const historyText = (history || []).map(h => `${h.role}: ${h.content}`).join("\n");
      const fullPrompt = `${systemInstruction}\n\nConversation History:\n${historyText}\n\nUser: ${query}\n\nAI:`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: fullPrompt,
      });

      res.json({ text: response.text });
    } catch (e: any) {
      console.error('Gemini API error:', e);
      if (e.message?.includes('429') || e.message?.includes('quota')) {
        res.status(500).json({ text: "I have reached my current daily AI limit. Please check your Gemini API plan or try again later. In the meantime, I will fall back to local search!" });
      } else {
        res.status(500).json({ text: "Error communicating with AI model: " + e.message });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files with standard caching
    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
