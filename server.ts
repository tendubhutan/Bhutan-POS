import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
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

  // ==========================================
  // WEBSITE CONFIG FILE PERSISTENCE
  // ==========================================
  app.post("/api/save-website-config", async (req, res) => {
    try {
      const config = req.body;
      const fs = await import("fs/promises");
      const configPath = path.resolve("./src/config/websiteConfig.json");
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
      console.log("Successfully saved website config to src/config/websiteConfig.json");
      return res.json({ success: true, message: "Saved to src/config/websiteConfig.json" });
    } catch (err: any) {
      console.error("Error saving website config to file:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/get-website-config", async (_req, res) => {
    try {
      const fs = await import("fs/promises");
      const configPath = path.resolve("./src/config/websiteConfig.json");
      const data = await fs.readFile(configPath, "utf8");
      return res.json(JSON.parse(data));
    } catch {
      return res.json(null);
    }
  });

  // ==========================================
  // WIRELESS CUSTOMER DISPLAY LIVE RELAY ENDPOINTS
  // ==========================================
  const customerDisplayStore = new Map<string, any>();

  // 1. POS Cashier updates the live customer display state
  app.post("/api/customer-display/update", (req, res) => {
    try {
      const state = req.body;
      const companyId = state?.companyId || 'default';
      
      const currentState = customerDisplayStore.get(companyId);
      let shouldOverwrite = true;
      
      if (currentState && currentState.status === 'completed') {
        const timeElapsed = Date.now() - (currentState.serverTimestamp || 0);
        // If the current screen is completed, hold it for 12 seconds instead of overwriting with idle
        if (state?.status === 'idle' && timeElapsed < 12000) {
          shouldOverwrite = false;
        }
      }
      
      if (shouldOverwrite) {
        customerDisplayStore.set(companyId, {
          ...state,
          serverTimestamp: Date.now()
        });
      }
      
      res.json({ ok: true, companyId, timestamp: Date.now(), held: !shouldOverwrite });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 2. Wireless Tablet / Phone fetches the live customer display state
  app.get("/api/customer-display/state", (req, res) => {
    try {
      const companyId = (req.query.companyId as string) || (req.query.company as string) || 'default';
      const liveState = customerDisplayStore.get(companyId) || customerDisplayStore.get('default') || null;
      res.json(liveState);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ==========================================
  // LOCAL WIFI HUB (SHOP LAN MODE) DISPATCHER
  // ==========================================
  const hubCounters: Record<string, number> = {
    POSInvoice: 1000,
    SalesInvoice: 1000
  };
  const hubTerminals = new Map<string, { id: string; name: string; ip: string; lastSeen: number; role: string }>();
  const hubDispatchedLogs: Array<{ id: string; number: number; invoiceNo: string; terminalId: string; terminalName: string; timestamp: string }> = [];

  // 1. Get Hub Status and Info
  app.get("/api/lan-hub/info", (req, res) => {
    res.json({
      status: "online",
      role: "host",
      mode: "shop_wifi_lan_hub",
      counters: hubCounters,
      terminalsCount: hubTerminals.size,
      recentLogs: hubDispatchedLogs.slice(0, 20),
      timestamp: new Date().toISOString()
    });
  });

  // 2. Heartbeat registration from connected counters (PC1, PC2, ACC, Mobile)
  app.post("/api/lan-hub/heartbeat", (req, res) => {
    const { terminalId, terminalName, role } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const id = terminalId || 'C1';
    hubTerminals.set(id, {
      id,
      name: terminalName || `Counter ${id}`,
      ip,
      role: role || 'Cashier',
      lastSeen: Date.now()
    });
    res.json({ ok: true, registered: id, totalActive: hubTerminals.size });
  });

  // 3. Atomically Request Next Consecutive Number Over Shop WiFi (Solution 2)
  app.post("/api/lan-hub/request-number", (req, res) => {
    const { isPOS = true, prefix = 'POS-', terminalId = 'C1', terminalName = 'Counter 1' } = req.body;
    const counterKey = isPOS ? 'POSInvoice' : 'SalesInvoice';
    
    // Atomically increment central consecutive counter
    const current = (hubCounters[counterKey] || 1000) + 1;
    hubCounters[counterKey] = current;

    const cleanPrefix = prefix || (isPOS ? 'POS-' : 'SAL-');
    const invoiceNo = `${cleanPrefix}${current}`;

    const logEntry = {
      id: `hub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      number: current,
      invoiceNo,
      terminalId,
      terminalName,
      timestamp: new Date().toISOString()
    };

    hubDispatchedLogs.unshift(logEntry);
    if (hubDispatchedLogs.length > 100) hubDispatchedLogs.length = 100;

    console.log(`[Shop WiFi Hub] Dispatched #${current} (${invoiceNo}) to ${terminalName} [${terminalId}]`);

    res.json({
      ok: true,
      number: current,
      invoiceNo,
      dispatchedTo: terminalId,
      timestamp: logEntry.timestamp
    });
  });

  // 4. List Active Terminals and Live Logs
  app.get("/api/lan-hub/terminals", (req, res) => {
    const now = Date.now();
    const active = Array.from(hubTerminals.values()).map(t => ({
      ...t,
      status: (now - t.lastSeen < 35000) ? 'active' : 'offline'
    }));
    res.json({ terminals: active, logs: hubDispatchedLogs });
  });

  // ==========================================
  // ATTENDANCE OFFICE NETWORK VERIFICATION
  // ==========================================
  app.all("/api/attendance/verify-network", (req, res) => {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                  req.socket.remoteAddress || 
                  req.ip || 
                  '';
    const cleanIp = rawIp.replace(/^.*:ffff:/, '').trim();

    // Check if client is on Private/Local Subnet (Shop/Office WiFi or LAN)
    const isLan = cleanIp === '127.0.0.1' || 
                  cleanIp === '::1' || 
                  cleanIp === 'localhost' ||
                  cleanIp.startsWith('192.168.') || 
                  cleanIp.startsWith('10.') ||
                  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp);

    const allowedIpsQuery = (req.query.allowedIps as string) || '';
    const allowedIpsBody = Array.isArray(req.body?.allowedIps) ? req.body.allowedIps : [];
    const allowedList = [
      ...allowedIpsQuery.split(',').map(s => s.trim()).filter(Boolean),
      ...allowedIpsBody.map((s: string) => String(s).trim()).filter(Boolean)
    ];

    const allowLocalLan = req.query.allowLocalLan !== 'false' && req.body?.allowLocalLan !== false;

    let isMatch = false;
    if (allowLocalLan && isLan) {
      isMatch = true;
    } else if (allowedList.length > 0) {
      isMatch = allowedList.some(rule => {
        if (!rule) return false;
        if (rule.endsWith('*')) {
          return cleanIp.startsWith(rule.slice(0, -1));
        }
        return cleanIp === rule || cleanIp.startsWith(rule);
      });
    }

    res.json({
      ok: true,
      clientIp: cleanIp,
      isLan,
      isOfficeNetwork: isMatch,
      timestamp: new Date().toISOString()
    });
  });

  // Superadmin path redirection to root with portal parameter (avoids relative path asset loading failures)
  app.get(["/superadmin", "/superadmin/"], (req, res) => {
    res.redirect("/?portal=superadmin");
  });

  // Vite middleware for development or fallback if dist is missing
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(path.join(distPath, "index.html"));

  if (process.env.NODE_ENV === "production" && hasDist) {
    // Serve static files with standard caching
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    
    // Fallback for SPA client-side routing (compatible with Express 5)
    app.use((req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
