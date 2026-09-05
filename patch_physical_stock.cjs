const fs = require('fs');
let content = fs.readFileSync('src/components/vouchers/PhysicalStockEntry.tsx', 'utf8');

content = content.replace(
`  // Prepopulate initial stock lines
  useEffect(() => {
    if (stockLines.length === 0 && items.length > 0) {
      const initial = items.slice(0, 8).map(it => {
        const book = Number(it['Current Stock']) || 0;
        return {
          itemCode: it['Item Code'],
          itemName: it['Item Name'],
          unit: it.Unit || 'Pcs',
          bookQty: book,
          physicalQty: book,
          differenceQty: 0,
          rate: Number(it['Purchase Rate']) || 0,
          varianceValue: 0
        };
      });
      setStockLines(initial);
    }
  }, [items]);`,
`  // Prepopulate initial stock lines
  useEffect(() => {
    // Disabled auto-fill to keep grid empty by default
  }, [items]);`
);

fs.writeFileSync('src/components/vouchers/PhysicalStockEntry.tsx', content);
