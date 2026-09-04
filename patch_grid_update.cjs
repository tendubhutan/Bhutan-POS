const fs = require('fs');
let content = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

content = content.replace(
`  const updateGridLine = (id: string, field: keyof VoucherGridLine, value: any) => {
    if (field === 'ledger' && typeof value === 'string') {
      const idx = lines.findIndex(l => l.id === id);
      const line = idx >= 0 ? lines[idx] : undefined;
      const targetId = idx >= 0 ? (line?.type === 'Dr' ? \`grid-debit-\${idx}\` : \`grid-credit-\${idx}\`) : undefined;
      checkAndPromptBankLedger(value, targetId);
    }
    setLines(prev =>
      prev.map(l => {
        if (l.id === id) {
          const updated = { ...l, [field]: value };
          if (field === 'ledger' && l.ledger !== value) {
            updated.billAllocations = [];
          }
          if (field === 'type') {
            if (value === 'Dr') {
              updated.credit = 0;
              if (!updated.debit) updated.debit = '';
            } else {
              updated.debit = 0;
              if (!updated.credit) updated.credit = '';
            }
          }
          return updated;
        }
        return l;
      })
    );
  };`,
`  const updateGridLine = (id: string, field: keyof VoucherGridLine, value: any) => {
    if (field === 'ledger' && typeof value === 'string') {
      const idx = lines.findIndex(l => l.id === id);
      const line = idx >= 0 ? lines[idx] : undefined;
      const targetId = idx >= 0 ? (line?.type === 'Dr' ? \`grid-debit-\${idx}\` : \`grid-credit-\${idx}\`) : undefined;
      checkAndPromptBankLedger(value, targetId);
    }
    setLines(prev => {
      const newLines = prev.map(l => {
        if (l.id === id) {
          const updated = { ...l, [field]: value };
          if (field === 'ledger' && l.ledger !== value) {
            updated.billAllocations = [];
          }
          if (field === 'type') {
            if (value === 'Dr') {
              updated.credit = 0;
              if (!updated.debit) updated.debit = '';
            } else {
              updated.debit = 0;
              if (!updated.credit) updated.credit = '';
            }
          }
          return updated;
        }
        return l;
      });

      // Auto-catch figure in Dr/Cr if there are exactly 2 lines
      if (newLines.length === 2 && (field === 'debit' || field === 'credit')) {
        const editedIdx = newLines.findIndex(l => l.id === id);
        const otherIdx = editedIdx === 0 ? 1 : 0;
        const editedLine = newLines[editedIdx];
        const otherLine = newLines[otherIdx];

        // If the other line's amount is zero or empty, we auto-fill it
        const otherAmt = otherLine.type === 'Dr' ? Number(otherLine.debit) || 0 : Number(otherLine.credit) || 0;
        
        // Also auto-update if the other amount was exactly matching the OLD amount of the edited line
        const oldEditedAmt = prev[editedIdx].type === 'Dr' ? Number(prev[editedIdx].debit) || 0 : Number(prev[editedIdx].credit) || 0;
        
        const newEditedAmt = editedLine.type === 'Dr' ? Number(editedLine.debit) || 0 : Number(editedLine.credit) || 0;

        if (otherAmt === 0 || (otherAmt === oldEditedAmt && oldEditedAmt !== 0)) {
           if (otherLine.type === 'Cr') {
             otherLine.credit = newEditedAmt || '';
           } else {
             otherLine.debit = newEditedAmt || '';
           }
        }
      }

      return newLines;
    });
  };`
);

fs.writeFileSync('src/components/Vouchers.tsx', content);
