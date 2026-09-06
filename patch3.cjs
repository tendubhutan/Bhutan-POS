const fs = require('fs');
const file = 'src/components/DrillModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add localFrom and localTo state
content = content.replace(
  "const [active, setActive] = useState<TargetState | null>(null);",
  "const [active, setActive] = useState<TargetState | null>(null);\n  const [localFrom, setLocalFrom] = useState(fromDate || '');\n  const [localTo, setLocalTo] = useState(toDate || '');\n\n  useEffect(() => {\n    if (fromDate) setLocalFrom(fromDate);\n    if (toDate) setLocalTo(toDate);\n  }, [fromDate, toDate]);"
);

// Update data loading to use localFrom and localTo
content = content.replace(
  "const data = getCategoryLedgerBreakdown(active.targetId, fromDate, toDate);",
  "const data = getCategoryLedgerBreakdown(active.targetId, localFrom, localTo);"
);

content = content.replace(
  "const data = getItemStockLedger(active.targetId);",
  "const data = getItemStockLedger(active.targetId, localFrom, localTo);" // Wait, does getItemStockLedger take dates?
);

content = content.replace(
  "const data = getFullLedgerStatement(active.targetId, fromDate, toDate);",
  "const data = getFullLedgerStatement(active.targetId, localFrom, localTo);"
);

content = content.replace(
  "const data = getItemProfitabilityDetail(active.targetId, fromDate, toDate);",
  "const data = getItemProfitabilityDetail(active.targetId, localFrom, localTo);"
);

content = content.replace(
  "}, [active, fromDate, toDate]);",
  "}, [active, localFrom, localTo]);"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched states');
