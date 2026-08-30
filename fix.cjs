const fs = require('fs');
let code = fs.readFileSync('src/components/PurchaseEntry.tsx', 'utf8');

const s = `            </div>
          )}
        </div>
      {/* Save Actions Bar */}`;
const r = `            </div>
          )}
        </div>
      </div>
      {/* Save Actions Bar */}`;
code = code.replace(s, r);

fs.writeFileSync('src/components/PurchaseEntry.tsx', code);
