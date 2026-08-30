import re

with open("src/components/SettingsView.tsx", "r") as f:
    content = f.read()

# Fix import
old_import = "import { saveConfig } from '../services/storageService';"
new_import = "import { saveConfig, loadJson, saveJson, STORAGE_KEYS } from '../services/storageService';"
content = content.replace(old_import, new_import)

# Insert counters state
old_form = "  const [form, setForm] = useState<Config>({ ...config });"
new_form = """  const [form, setForm] = useState<Config>({ ...config });
  const [counters, setCounters] = useState<Record<string, number>>(() => loadJson(STORAGE_KEYS.COUNTERS, {}));
  
  const handleCounterChange = (key: string, value: number) => {
    const nextVal = Math.max(0, value - 1);
    const updated = { ...counters, [key]: nextVal };
    setCounters(updated);
    saveJson(STORAGE_KEYS.COUNTERS, updated);
  };"""
content = content.replace(old_form, new_form)

with open("src/components/SettingsView.tsx", "w") as f:
    f.write(content)
