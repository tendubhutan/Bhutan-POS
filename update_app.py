import re

with open("src/components/Sidebar.tsx", "r") as f:
    content = f.read()

content = content.replace("{ id: 'purchase', label: 'Purchase Entry', icon: ShoppingBag, shortcut: 'U' },",
"""...(config.EnableNormalSale !== 'false' ? [{ id: 'normalsale', label: 'Sales Invoice (B2B)', icon: ShoppingBag, shortcut: 'N' }] : []),
    { id: 'purchase', label: 'Purchase Entry', icon: ShoppingBag, shortcut: 'U' },""")

with open("src/components/Sidebar.tsx", "w") as f:
    f.write(content)

with open("src/App.tsx", "r") as f:
    app_content = f.read()

app_content = app_content.replace("import { Dashboard } from './components/Dashboard';",
"""import { Dashboard } from './components/Dashboard';
import { SalesInvoiceEntry } from './components/SalesInvoiceEntry';""")

app_content = app_content.replace("{currentView === 'purchase' && (",
"""{currentView === 'normalsale' && config.EnableNormalSale !== 'false' && (
            <SalesInvoiceEntry config={config} onDataRefresh={refreshData} />
          )}
          {currentView === 'purchase' && (""")

app_content = app_content.replace("currentView === 'pos' || currentView === 'purchase'",
"currentView === 'pos' || currentView === 'purchase' || currentView === 'normalsale'")

with open("src/App.tsx", "w") as f:
    f.write(app_content)
