const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
    // 3. If we came from a Drilldown (via Open in Entry), go back to the original view but DO NOT restore the floating modal
    if (drillReturnContext) {
      const { fromView } = drillReturnContext;
      setDrillReturnContext(null);
      setCurrentView(fromView);
      return;
    }
`;

content = content.replace(
  /\/\/ 3\. If we came from a Drilldown \(via Open in Entry\)[\s\S]*?return;\n    \}/,
  replacement.trim()
);

fs.writeFileSync(file, content, 'utf8');
