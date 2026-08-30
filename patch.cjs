const fs = require('fs');
let code = fs.readFileSync('src/components/PurchaseEntry.tsx', 'utf8');

const startStr = "  const selectItem = (item: Item, autoAdd: boolean = true) => {";
const endStr = "  const updateCartLine = (index: number, field: 'qty' | 'rate', val: number) => {";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end index");
  process.exit(1);
}

const replacement = `  const selectItem = (item: Item, autoAdd: boolean = true) => {
    const qty = 1;
    const rate = item['Purchase Rate'] || 0;

    const existingIdx = cart.findIndex(l => l.itemCode === item['Item Code']);
    let updatedCart = [...cart];
    let targetIndex = existingIdx;

    if (existingIdx > -1) {
      updatedCart[existingIdx].qty += qty;
    } else {
      const newLine: CartLine = {
        itemCode: item['Item Code'],
        itemName: item['Item Name'],
        unit: item.Unit || 'Pcs',
        qty,
        rate,
        discount: 0,
        gstPct: Number(item['GST %']) || 0,
        zeroRated: item['Zero Rated (Y/N)'] || 'N',
        purchaseRate: rate,
        isSerialized: item['Is Serialized'],
        serials: []
      };
      updatedCart.push(newLine);
      targetIndex = updatedCart.length - 1;
    }

    setCart(updatedCart);

    if (item['Is Serialized'] === 'Y' && showSerials) {
      setActiveSerialIndex(targetIndex);
      setSerialModalOpen(true);
    } else {
      setTimeout(() => {
        document.getElementById('pur-fast-item-picker')?.focus();
      }, 50);
    }
  };

`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync('src/components/PurchaseEntry.tsx', code);
console.log("Patched successfully");
