const fs = require('fs');
let content = fs.readFileSync('src/components/SearchableItemSelect.tsx', 'utf8');

// Add onInputChange to props
content = content.replace(
  '  onFocusDate?: () => void;',
  '  onFocusDate?: () => void;\n  onInputChange?: (value: string) => void;'
);

// Call it in onChange
content = content.replace(
  '        onChange={e => {\n          setSearchTerm(e.target.value);\n          setIsOpen(true);\n        }}',
  '        onChange={e => {\n          setSearchTerm(e.target.value);\n          setIsOpen(true);\n          if (onInputChange) onInputChange(e.target.value);\n        }}'
);

fs.writeFileSync('src/components/SearchableItemSelect.tsx', content);
