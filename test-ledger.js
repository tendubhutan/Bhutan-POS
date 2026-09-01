const fs = require('fs');

try {
  const ledgers = JSON.parse(fs.readFileSync('deep_pos_ledgers') || '[]');
  const logs = JSON.parse(fs.readFileSync('deep_pos_ledger_log') || '[]');
  
  const yogitaLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase() === 'yogita');
  console.log('Yogita Ledger:', yogitaLedger);
  
  const yogitaLogs = logs.filter(r => (r['Ledger Name'] || '').toLowerCase() === 'yogita');
  console.log('Yogita Logs:', yogitaLogs);
  
  console.log('Total Logs:', logs.length);
} catch(e) {
  console.log('Files not found locally. Since this is localStorage in browser, I need to fetch it via the app.');
}
