const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const newEventLogic = `
  useEffect(() => {
    const handleUpdateConfig = (e: any) => {
      if (e.detail && typeof e.detail === 'object') {
        saveConfig(e.detail);
        refreshData();
      }
    };
    window.addEventListener('app:updateConfig', handleUpdateConfig);
    return () => {
      window.removeEventListener('app:updateConfig', handleUpdateConfig);
    };
  }, []);

  useEffect(() => {
    migrateExistingItemsOpeningAmount();
`;

content = content.replace(
  "  useEffect(() => {\n    migrateExistingItemsOpeningAmount();",
  newEventLogic
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched App.tsx for app:updateConfig');
