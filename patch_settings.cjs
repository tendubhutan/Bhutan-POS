const fs = require('fs');
const file = 'src/components/SettingsView.tsx';
let content = fs.readFileSync(file, 'utf8');

const newFormLogic = `
  const [form, setForm] = useState<Config>({ ...config });

  useEffect(() => {
    setForm({ ...config });
  }, [config]);
`;

content = content.replace(
  "  const [form, setForm] = useState<Config>({ ...config });",
  newFormLogic
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched SettingsView.tsx');
