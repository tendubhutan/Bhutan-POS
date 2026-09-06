const fs = require('fs');
const file = 'src/components/AIAssistant.tsx';
let content = fs.readFileSync(file, 'utf8');

const newParseLogic = `
  const handleQuery = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    const newHistory = [...history, { role: 'user', parts: [{ text: query }] }];
    setHistory(newHistory);
    setQuery('');
    setLoading(true);

    try {
      let responseText = await processLocalQuery(query, newHistory);
      
      // Parse for ACTION JSON
      const actionMatch = responseText.match(/\`\`\`json[\\s\\n]*([\\s\\S]*?)[\\s\\n]*\`\`\`/);
      if (actionMatch) {
        try {
          const actionData = JSON.parse(actionMatch[1]);
          if (actionData.action === 'UPDATE_CONFIG' && actionData.payload) {
            window.dispatchEvent(new CustomEvent('app:updateConfig', { detail: actionData.payload }));
            // Remove the JSON block from the text shown to user
            responseText = responseText.replace(actionMatch[0], '').trim();
          }
        } catch (err) {
          console.error("Failed to parse AI action JSON", err);
        }
      }

      setHistory([...newHistory, { role: 'model', parts: [{ text: responseText }] }]);
    } catch (error: any) {
      console.error(error);
      setHistory([...newHistory, { role: 'model', parts: [{ text: error.message || 'Sorry, I encountered a local error.' }] }]);
    } finally {
      setLoading(false);
    }
  };
`;

content = content.replace(
  /const handleQuery = async \(\e\?: React\.FormEvent\) => \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};/,
  newParseLogic.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched AIAssistant.tsx correctly');
