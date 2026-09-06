const fs = require('fs');
const file = 'src/components/AIAssistant.tsx';
let content = fs.readFileSync(file, 'utf8');

const newParseLogic = `
      // Parse for ACTION JSON
      const actionMatch = responseText.match(/\`\`\`json[\\s\\n]*([\\s\\S]*?)[\\s\\n]*\`\`\`/i);
      if (actionMatch) {
        try {
          const actionData = JSON.parse(actionMatch[1]);
          if (actionData.action === 'UPDATE_CONFIG' && actionData.payload) {
            window.dispatchEvent(new CustomEvent('app:updateConfig', { detail: actionData.payload }));
            responseText = responseText.replace(actionMatch[0], '').trim();
          } else if (actionData.action === 'UPDATE_POS_SETTINGS' && actionData.payload) {
            // we load current, merge, and save
            const savedStr = localStorage.getItem('tally_pos_settings_v1');
            let curSettings = {};
            if (savedStr) curSettings = JSON.parse(savedStr);
            const newSettings = { ...curSettings, ...actionData.payload };
            localStorage.setItem('tally_pos_settings_v1', JSON.stringify(newSettings));
            window.dispatchEvent(new CustomEvent('pos_settings_changed', { detail: newSettings }));
            responseText = responseText.replace(actionMatch[0], '').trim();
          }
        } catch (err) {
          console.error("Failed to parse AI action JSON", err);
        }
      }
`;

content = content.replace(
  /\/\/ Parse for ACTION JSON[\s\S]*?\} catch \(err\) \{\s*console\.error\("Failed to parse AI action JSON", err\);\s*\}\s*\}/,
  newParseLogic.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched AIAssistant json parser');
