import { Ledger, Config } from '../types';

/**
 * Determines whether a ledger represents a Bank Account
 * based on its Group ('Bank Accounts', 'Bank OD A/c', 'Bank OCC A/c'),
 * system config (Bank1Ledger, Bank2Ledger), or ledger name heuristics.
 */
export function isBankLedger(ledgerName: string, ledgers: Ledger[] = [], config?: Config): boolean {
  if (!ledgerName || !ledgerName.trim()) return false;
  const nameLower = ledgerName.trim().toLowerCase();

  // Check system config bank ledgers first
  if (config?.Bank1Ledger && config.Bank1Ledger.trim().toLowerCase() === nameLower) return true;
  if (config?.Bank2Ledger && config.Bank2Ledger.trim().toLowerCase() === nameLower) return true;

  // Look up ledger definition in master ledger list
  const found = ledgers.find(l => (l["Ledger Name"] || '').toLowerCase() === nameLower);
  if (found) {
    const grp = (found.Group || '').toLowerCase();
    if (grp.includes('bank') || grp.includes('od') || grp.includes('occ')) return true;
    if (grp.includes('expense') || grp.includes('income') || grp.includes('direct') || grp.includes('indirect')) return false;
  }

  // Common heuristic checks for bank accounts
  if (
    nameLower.includes('bank') ||
    nameLower.includes('mbob') ||
    nameLower.includes('bnb') ||
    nameLower.includes('tdbank') ||
    nameLower.includes('bob') ||
    nameLower.includes('account')
  ) {
    // Exclude standard expense/fee ledgers
    if (nameLower.includes('charge') || nameLower.includes('fee') || nameLower.includes('interest')) return false;
    return true;
  }

  return false;
}
