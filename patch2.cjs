const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

content = content.replace(
`  const handleSaveConfig = (sectionKey: string, _label = 'Settings') => {
    setSavingSection(sectionKey);
    try {`,
`  const proceedSaveConfig = (sectionKey: string, _label = 'Settings') => {
    setSavingSection(sectionKey);
    try {`
);

content = content.replace(
`  const handleSavePOSSettings = (newSettings?: POSSettings) => {
    setSavingSection('pos');
    const toSave = newSettings || posSettings;`,
`  const proceedSavePOSSettings = (newSettings?: POSSettings) => {
    setSavingSection('pos');
    const toSave = newSettings || posSettings;`
);

content = content.replace(
`  const handleSaveUsers = (updatedUsers: AppUser[]) => {
    setSavingSection('security');
    saveUsers(updatedUsers);`,
`  const proceedSaveUsers = (updatedUsers: AppUser[]) => {
    setSavingSection('security');
    saveUsers(updatedUsers);`
);

fs.writeFileSync('src/components/SettingsView.tsx', content);
