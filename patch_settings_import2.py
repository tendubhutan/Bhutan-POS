import re

with open("src/components/SettingsView.tsx", "r") as f:
    content = f.read()

content = re.sub(
    r"import \{ saveConfig, getUsers, saveUsers, setActiveUser, getActiveUser \} from '\.\./services/storageService';",
    "import { saveConfig, getUsers, saveUsers, setActiveUser, getActiveUser, loadJson, saveJson, STORAGE_KEYS } from '../services/storageService';",
    content
)

with open("src/components/SettingsView.tsx", "w") as f:
    f.write(content)
