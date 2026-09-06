const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const newProcessLocalQuery = `
export async function processLocalQuery(query: string, history: any[] = []): Promise<string> {
  const config = loadJson(STORAGE_KEYS.CONFIG, {});

  if (config.EnableAdvancedAI === 'true') {
    // Advanced Gemini AI Mode via Server
    try {
      // First, get basic summary data to send as context so Gemini has something to work with.
      // We'll give it the same entryMatches just to give it raw text data to analyze, 
      // but let the backend format it conversationally.
      const rawMatches = searchAllEntries(query);
      const dataContext = rawMatches.slice(0, 50).map(m => 
        \`[Ref: \${m.refNo}, Date: \${m.date}, Type: \${m.typeLabel}, Party: \${m.party}, Amount: \${m.amount}]\`
      ).join('\\n');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query, 
          history: history.map(h => ({
            role: h.role,
            content: h.parts[0].text
          })),
          context: dataContext
        })
      });

      if (!response.ok) {
        throw new Error('AI Server Error: ' + response.statusText);
      }
      
      const resData = await response.json();
      return resData.text || 'No response from AI.';
    } catch (e: any) {
      console.error("Gemini AI failed, falling back to local search.", e);
      // Fallback below
    }
  }

  // Normal Local Regex Search Mode
  // Simulate slight thinking delay for UI polish
  await new Promise(r => setTimeout(r, 600));

  // 1. First search for specific entry matches (Transaction ID, Cheque No, Narration, Voucher No, Item/Serial, etc.)
  const entryMatches = searchAllEntries(query);
  if (entryMatches.length > 0) {
    let msg = \`🔍 **Found \${entryMatches.length} matching entry\${entryMatches.length > 1 ? 'ies' : ''} for "\${query}"**:\\n\\n\`;
    entryMatches.slice(0, 6).forEach(m => {
      msg += \`• **\${m.typeLabel} \${m.refNo}** (\${m.date}) - **Nu. \${m.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\\n\`;
      msg += \`  Party/Account: \${m.party}\\n\`;
      if (m.matchedField && m.matchedText) {
        msg += \`  Matched \${m.matchedField}: _"\${m.matchedText}"_\\n\`;
      }
      msg += \`  [View Voucher: \${m.refNo}]\\n\\n\`;
    });
    if (entryMatches.length > 6) {
      msg += \`_Showing top 6 of \${entryMatches.length} total matches._\\n\`;
    }
    return msg;
  }
`;

content = content.replace(
  /export async function processLocalQuery\([\s\S]*?return msg;\n  }/,
  newProcessLocalQuery.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched localAIService.ts');
