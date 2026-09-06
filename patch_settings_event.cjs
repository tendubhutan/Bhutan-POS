const fs = require('fs');
const file = 'src/components/SettingsView.tsx';
let content = fs.readFileSync(file, 'utf8');

const newEventLogic = `
  const [posSettings, setPosSettings] = useState<POSSettings>(loadPOSSettings());

  useEffect(() => {
    const handlePosChanged = (e: any) => {
      if (e.detail) {
        setPosSettings(e.detail);
      }
    };
    window.addEventListener('pos_settings_changed', handlePosChanged);
    return () => window.removeEventListener('pos_settings_changed', handlePosChanged);
  }, []);
`;

content = content.replace(
  "  const [posSettings, setPosSettings] = useState<POSSettings>(loadPOSSettings());",
  newEventLogic
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched SettingsView event');
