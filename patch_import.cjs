const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { loadJson, STORAGE_KEYS, getItems, getLedgers, getVouchers, getVoucherTypes, getTrashLog, getPhysicalStockRecords, getCategories, getUnitGroups, getUnits, getItemGroups, getLedgerGroups, getDashboardData, getDailyColumnarReport, getGSTReport, getFullLedgerStatement, getSerialNumbersStockReport, getAdvancedReports, getFinancialReports, migrateExistingItemsOpeningAmount, saveLedger, getQuotations, getDeliveryNotes, getPayHeads, getEmployees, getMonthlyPayrolls, getAdvancedDashboardData, getEmployeeAdvances, rebuildAccountingLogs, getBankRecon } from './services/storageService';",
  "import { loadJson, STORAGE_KEYS, getItems, getLedgers, getVouchers, getVoucherTypes, getTrashLog, getPhysicalStockRecords, getCategories, getUnitGroups, getUnits, getItemGroups, getLedgerGroups, getDashboardData, getDailyColumnarReport, getGSTReport, getFullLedgerStatement, getSerialNumbersStockReport, getAdvancedReports, getFinancialReports, migrateExistingItemsOpeningAmount, saveLedger, saveConfig, getQuotations, getDeliveryNotes, getPayHeads, getEmployees, getMonthlyPayrolls, getAdvancedDashboardData, getEmployeeAdvances, rebuildAccountingLogs, getBankRecon } from './services/storageService';"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched App.tsx import');
