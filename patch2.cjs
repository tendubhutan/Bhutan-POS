const fs = require('fs');
let code = fs.readFileSync('src/components/PurchaseEntry.tsx', 'utf8');

const startStr = "              {/* Search input with auto-dropdown */}";
const endStr = "            </div>\n          </div>\n        </div>\n\n        {/* Populated Table Below */}";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end index");
  process.exit(1);
}

const replacement = `              {/* Search input with auto-dropdown */}
              <div className="sm:col-span-12 relative">
                <SearchableItemSelect
                  id="pur-fast-item-picker"
                  items={items}
                  placeholder="Search Item / Barcode (Auto-Add on Select)..."
                  currencySymbol={config.CurrencySymbol || 'Nu.'}
                  onSelect={item => selectItem(item, true)}
                  autoClearAfterSelect={true}
                  onCreateNew={onOpenNewItemModal}
                />
              </div>
`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync('src/components/PurchaseEntry.tsx', code);
console.log("Patched UI successfully");
