import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  FileText,
  Printer,
  CheckCircle,
  Building2,
  Search,
  ShieldCheck,
  CreditCard,
  X,
  AlertCircle,
  Download,
  Calendar,
  Lock,
  ChevronRight,
  TrendingUp,
  Percent,
  FileSpreadsheet,
  WalletCards,
  Banknote
} from 'lucide-react';
import { EmployeeAdvances } from './payroll/EmployeeAdvances';
import { Config, PayHead, Employee, MonthlyPayroll, PayrollEntry, PayrollPayHeadItem, AdvanceType, EmployeeAdvance } from '../types';
import {
  getPayHeads,
  savePayHeads,
  getEmployees, getEmployeeAdvances,
  saveEmployees,
  getMonthlyPayrolls,
  saveMonthlyPayroll,
  postPayrollJournalVoucher,
  saveMultiLineVoucher,
  nextCounter,
  getVoucherPrefix,
  round2
} from '../services/storageService';

interface PayrollProps {
  config: Config;
  ledgers: import('../types').Ledger[];
  onDataRefresh?: () => void;
}

export const Payroll: React.FC<PayrollProps> = ({ config, ledgers, onDataRefresh }) => {
  const [activeTab, setActiveTab] = useState<'processing' | 'employees' | 'payheads' | 'advances'>('processing');

  const payrollTabs = [
    { id: 'processing', label: 'Salary Processing', icon: Calendar },
    { id: 'employees', label: 'Employee Master', icon: Users },
    { id: 'payheads', label: 'Flexible Pay Heads', icon: TrendingUp },
    ...(config.EnableEmployeeAdvances !== 'false' ? [{ id: 'advances', label: 'Advances & Loans', icon: WalletCards }] : [])
  ] as const;

  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow key navigation across Payroll tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInputFocused && !e.altKey) {
        return;
      }

      const currentIndex = payrollTabs.findIndex(t => t.id === activeTab);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowRight' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % payrollTabs.length;
        setActiveTab(payrollTabs[nextIndex].id as any);
        tabButtonRefs.current[nextIndex]?.focus();
      } else if (e.key === 'ArrowLeft' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + payrollTabs.length) % payrollTabs.length;
        setActiveTab(payrollTabs[prevIndex].id as any);
        tabButtonRefs.current[prevIndex]?.focus();
      } else if (e.key === 'Home' && !isInputFocused) {
        e.preventDefault();
        setActiveTab(payrollTabs[0].id as any);
        tabButtonRefs.current[0]?.focus();
      } else if (e.key === 'End' && !isInputFocused) {
        e.preventDefault();
        setActiveTab(payrollTabs[payrollTabs.length - 1].id as any);
        tabButtonRefs.current[payrollTabs.length - 1]?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Core Data States
  const [payHeads, setPayHeadsState] = useState<PayHead[]>([]);
  const [employees, setEmployeesState] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [payrolls, setPayrollsState] = useState<MonthlyPayroll[]>([]);

  // Selection States for Processing
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [currentPayroll, setCurrentPayroll] = useState<MonthlyPayroll | null>(null);

  // Search / Filter States
  const [empSearch, setEmpSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Modals
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empModalTab, setEmpModalTab] = useState<'profile' | 'salary'>('profile');
  const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({
    empCode: '',
    fullName: '',
    cidNo: '',
    designation: '',
    department: '',
    joiningDate: new Date().toISOString().split('T')[0],
    contactNo: '',
    email: '',
    bankName: 'Bank of Bhutan (BOB)',
    accountNo: '',
    basicSalary: 20000,
    status: 'Active',
    customPayHeads: {}
  });

  const [showPayHeadModal, setShowPayHeadModal] = useState(false);
  const [editingPayHead, setEditingPayHead] = useState<PayHead | null>(null);
  const [payHeadForm, setPayHeadForm] = useState<Partial<PayHead>>({
    name: '',
    type: 'Earning',
    calculationType: 'Fixed',
    defaultValue: 0,
    isStatutory: false,
    description: '',
    enabled: true
  });

  // Edit Single Payroll Entry Modal
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null);

  // Printable Payslip Modal
  const [payslipModalEntry, setPayslipModalEntry] = useState<PayrollEntry | null>(null);

  // Printable Bank Transfer Sheet Modal
  const [showBankSheetModal, setShowBankSheetModal] = useState(false);

  // DRC Form IT-1(a) Monthly Salary Schedule Modal
  const [showDrcFormModal, setShowDrcFormModal] = useState(false);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const monthsList = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const refreshAllData = () => {
    const ph = getPayHeads();
    const emp = getEmployees();
    const pr = getMonthlyPayrolls();
    setPayHeadsState(ph);
    setEmployeesState(emp);
    setAdvances(getEmployeeAdvances());
    setPayrollsState(pr);
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Update current monthly payroll view whenever month/year or payrolls list changes
  useEffect(() => {
    const monthName = monthsList.find(m => m.value === selectedMonth)?.label || '';
    const idStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const found = payrolls.find(p => p.id === idStr);
    if (found) {
      setCurrentPayroll(found);
    } else {
      setCurrentPayroll(null);
    }
  }, [selectedYear, selectedMonth, payrolls]);

  // Central Keyboard Shortcut Handler (Desktop Software UX)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Priority 1: Close top-most active modal
        if (showDrcFormModal) {
          e.preventDefault();
          e.stopPropagation();
          setShowDrcFormModal(false);
          return;
        }
        if (showBankSheetModal) {
          e.preventDefault();
          e.stopPropagation();
          setShowBankSheetModal(false);
          return;
        }
        if (payslipModalEntry) {
          e.preventDefault();
          e.stopPropagation();
          setPayslipModalEntry(null);
          return;
        }
        if (editingEntry) {
          e.preventDefault();
          e.stopPropagation();
          setEditingEntry(null);
          return;
        }
        if (showPayHeadModal) {
          e.preventDefault();
          e.stopPropagation();
          setShowPayHeadModal(false);
          return;
        }
        if (showEmployeeModal) {
          e.preventDefault();
          e.stopPropagation();
          setShowEmployeeModal(false);
          return;
        }

        // Priority 2: If no modal is open, navigate sub-tab back to main Processing tab
        if (activeTab !== 'processing') {
          e.preventDefault();
          e.stopPropagation();
          setActiveTab('processing');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    showDrcFormModal,
    showBankSheetModal,
    payslipModalEntry,
    editingEntry,
    showPayHeadModal,
    showEmployeeModal,
    activeTab
  ]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Helper to get rule label for pay heads
  const getPayHeadRuleLabel = (head: PayHead) => {
    if (head.id === 'ph_pit') {
      return 'Annexure-III Tax Slab (Gross - 15% Std Deduction)';
    }
    if (head.id === 'ph_health' || head.calculationType === 'PercentGross') {
      return `${head.defaultValue || 1}% of Gross Pay`;
    }
    if (head.calculationType === 'PercentBasic') {
      return `${head.defaultValue}% of Basic Pay`;
    }
    if (head.calculationType === 'Fixed') {
      return `${config.CurrencySymbol || 'Nu.'} ${head.defaultValue}`;
    }
    return 'Manual / Tax Slab';
  };

  // Helper function to calculate TDS/PIT tax for Bhutan DRC (Gross minus 15% Standard Deduction based on official Annexure III Slabs)
  const calculateBhutanTDS = (monthlyGrossPay: number): number => {
    if (monthlyGrossPay <= 0) return 0;

    // Step 1: Convert Monthly Gross to Annual Gross Salary
    const annualGross = monthlyGrossPay * 12;

    // Step 2: Subtract 15% Standard Deduction to get Annual Taxable Income
    const annualTaxable = round2(annualGross * 0.85);

    // If Annual Taxable Income <= Nu. 300,000 (Exemption limit Nu. 25,000/month taxable), Tax is Nu. 0
    if (annualTaxable <= 300000) return 0;

    let annualTax = 0;

    // Apply DRC Income Tax Amendment Act 2020 Slabs:
    if (annualTaxable <= 400000) {
      // Nu. 300,001 to 400,000 @ 10%
      annualTax = (annualTaxable - 300000) * 0.10;
    } else if (annualTaxable <= 650000) {
      // Nu. 400,001 to 650,000 @ 15%
      annualTax = 10000 + (annualTaxable - 400000) * 0.15;
    } else if (annualTaxable <= 1000000) {
      // Nu. 650,001 to 1,000,000 @ 20%
      annualTax = 47500 + (annualTaxable - 650000) * 0.20;
    } else if (annualTaxable <= 1500000) {
      // Nu. 1,000,001 to 1,500,000 @ 25%
      annualTax = 117500 + (annualTaxable - 1000000) * 0.25;
    } else {
      // Above Nu. 1,500,000 @ 30%
      annualTax = 242500 + (annualTaxable - 1500000) * 0.30;
    }

    // 10% Surcharge applicable if Annual Taxable Income >= Nu. 1,000,000
    if (annualTaxable >= 1000000) {
      annualTax += annualTax * 0.10;
    }

    // Step 3: Convert Annual Tax to Monthly Tax withholding
    return round2(annualTax / 12);
  };

  // Helper to calculate pay head value for an employee
  const calculatePayHeadAmount = (
    head: PayHead,
    emp: Employee,
    basicToUse: number,
    grossToUse?: number,
    currentPeriodIso?: string
  ): number => {
    const custom = emp.customPayHeads?.[head.id];

    if (custom && custom.enabled === false) return 0;

    // Check auto-stop month (e.g. Salary Advance until December)
    if (custom && custom.endMonth && currentPeriodIso) {
      if (currentPeriodIso > custom.endMonth) {
        return 0; // Automatically stopped
      }
    }

    const valToUse = custom && custom.overrideValue !== undefined ? custom.overrideValue : head.defaultValue;

    if (head.calculationType === 'Fixed') {
      return round2(valToUse);
    } else if (head.calculationType === 'PercentBasic') {
      return round2((basicToUse * valToUse) / 100);
    } else if (head.calculationType === 'PercentGross') {
      const grossBase = grossToUse !== undefined ? grossToUse : (basicToUse * 1.2);
      return round2((grossBase * valToUse) / 100);
    } else if (head.calculationType === 'Manual') {
      if (head.id === 'ph_pit') {
        if (custom && custom.overrideValue !== undefined) {
          return round2(custom.overrideValue);
        }
        const grossBase = grossToUse !== undefined ? grossToUse : basicToUse;
        return calculateBhutanTDS(grossBase);
      }
      return round2(valToUse);
    }
    return 0;
  };

  // Process / Generate Payroll for selected Month & Year
  const handleProcessPayroll = () => {
    const activeEmployees = employees.filter(e => e.status === 'Active' || e.exitDate);
    if (activeEmployees.length === 0) {
      showToast('No active employees found in the system. Add employees first.', 'error');
      return;
    }

    const monthName = monthsList.find(m => m.value === selectedMonth)?.label || '';
    const monthYearStr = `${monthName} ${selectedYear}`;
    const idStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

    const monthTotalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    const activePayHeads = payHeads.filter(h => h.enabled);

    let monthTotalGross = 0;
    let monthTotalDeductions = 0;
    let monthTotalNet = 0;

    const newEntries: PayrollEntry[] = activeEmployees.map(emp => {
      const fullBasic = Number(emp.basicSalary) || 0;
      let workingDays = monthTotalDays;

      // Check if employee joined mid-month
      if (emp.joiningDate) {
        const joinObj = new Date(emp.joiningDate);
        if (joinObj.getFullYear() === selectedYear && (joinObj.getMonth() + 1) === selectedMonth) {
          workingDays = monthTotalDays - joinObj.getDate() + 1;
        }
      }

      // Check if employee left mid-month
      if (emp.exitDate) {
        const exitObj = new Date(emp.exitDate);
        if (exitObj.getFullYear() === selectedYear && (exitObj.getMonth() + 1) === selectedMonth) {
          workingDays = Math.min(workingDays, exitObj.getDate());
        }
      }

      workingDays = Math.max(0, Math.min(monthTotalDays, workingDays));
      const prorationFactor = monthTotalDays > 0 ? workingDays / monthTotalDays : 1;
      const proratedBasic = round2(fullBasic * prorationFactor);

      const earnings: PayrollPayHeadItem[] = [
        {
          payHeadId: 'ph_basic',
          payHeadName: 'Basic Pay',
          type: 'Earning',
          amount: proratedBasic
        }
      ];

      // Calculate other earnings first
      activePayHeads.filter(ph => ph.type === 'Earning' && ph.id !== 'ph_basic').forEach(ph => {
        const amt = calculatePayHeadAmount(ph, emp, proratedBasic, undefined, idStr);
        const isExplicitlyDisabled = emp.customPayHeads?.[ph.id]?.enabled === false;
        if ((amt > 0 || ph.isStatutory) && !isExplicitlyDisabled) {
          earnings.push({
            payHeadId: ph.id,
            payHeadName: ph.name,
            type: 'Earning',
            amount: amt
          });
        }
      });

      const empGross = round2(earnings.reduce((sum, item) => sum + item.amount, 0));

      const deductions: PayrollPayHeadItem[] = [];

      // Calculate deductions (passing empGross for 1% Health Contribution and Tax)
      activePayHeads.filter(ph => ph.type === 'Deduction').forEach(ph => {
        const amt = calculatePayHeadAmount(ph, emp, proratedBasic, empGross, idStr);
        const isExplicitlyDisabled = emp.customPayHeads?.[ph.id]?.enabled === false;
        if ((amt > 0 || ph.isStatutory) && !isExplicitlyDisabled) {
          deductions.push({
            payHeadId: ph.id,
            payHeadName: ph.name,
            type: 'Deduction',
            amount: amt
          });
        }
      });

      const empDeductions = round2(deductions.reduce((sum, item) => sum + item.amount, 0));
      const empNet = round2(empGross - empDeductions);

      monthTotalGross += empGross;
      monthTotalDeductions += empDeductions;
      monthTotalNet += empNet;

      return {
        id: `pr_entry_${emp.id}_${idStr}`,
        empId: emp.id,
        empCode: emp.empCode,
        fullName: emp.fullName,
        cidNo: emp.cidNo,
        designation: emp.designation,
        department: emp.department,
        bankName: emp.bankName,
        accountNo: emp.accountNo,
        basicSalary: fullBasic,
        monthTotalDays,
        workingDays,
        earnings,
        deductions,
        grossPay: empGross,
        totalDeductions: empDeductions,
        netPay: empNet,
        paymentStatus: 'Unpaid',
        paymentMode: 'Bank Transfer'
      };
    });

    const newPayroll: MonthlyPayroll = {
      id: idStr,
      monthYear: monthYearStr,
      year: selectedYear,
      month: selectedMonth,
      processedDate: new Date().toISOString(),
      entries: newEntries,
      totalGrossPay: round2(monthTotalGross),
      totalDeductions: round2(monthTotalDeductions),
      totalNetPay: round2(monthTotalNet),
      isPostedToAccounting: false
    };

    saveMonthlyPayroll(newPayroll);
    refreshAllData();
    showToast(`Successfully processed payroll for ${monthYearStr}!`);
  };

  // Post Salary Journal Voucher to Accounting
  const handlePostToAccounting = () => {
    if (!currentPayroll) return;
    const res = postPayrollJournalVoucher(currentPayroll.id);
    if (res.success) {
      showToast(`Payroll posted to Accounting with Voucher No: ${res.voucherNo}!`);
      refreshAllData();
      if (onDataRefresh) onDataRefresh();
    } else {
      showToast(res.error || 'Failed to post voucher', 'error');
    }
  };

  // Export DRC Form IT-1(a) Official Styled Excel Schedule (.xls with exact DRC headers & formatting)
  const handleExportDrcExcelXls = () => {
    if (!currentPayroll) return;

    let rowsHtml = '';
    let sumBasic = 0, sumAllowance = 0, sumArrear = 0, sumGross = 0, sumPf = 0, sumGis = 0, sumNetSalary = 0, sumTds = 0, sumHealth = 0, sumTotalTax = 0;

    currentPayroll.entries.forEach(entry => {
      const emp = employees.find(e => e.empCode === entry.empCode);
      const basic = entry.earnings.find(e => e.payHeadId === 'ph_basic')?.amount || entry.basicSalary;
      const allowance = round2(entry.grossPay - basic);
      const arrear = 0;
      const gross = entry.grossPay;
      const pf = round2(gross * 0.15);
      const gis = entry.deductions.find(d => d.payHeadId === 'ph_gis')?.amount || 0;
      const netSalary = round2(gross - (pf + gis));
      const tds = entry.deductions.find(d => d.payHeadId === 'ph_pit')?.amount || calculateBhutanTDS(gross);
      const health = entry.deductions.find(d => d.payHeadId === 'ph_health')?.amount || round2(gross * 0.01);
      const totalTax = round2(tds + health);

      sumBasic += basic;
      sumAllowance += allowance;
      sumArrear += arrear;
      sumGross += gross;
      sumPf += pf;
      sumGis += gis;
      sumNetSalary += netSalary;
      sumTds += tds;
      sumHealth += health;
      sumTotalTax += totalTax;

      rowsHtml += `
        <tr>
          <td style="text-align: left; font-weight: bold; border: 1px solid #000;">${entry.fullName}</td>
          <td style="text-align: center; border: 1px solid #000; mso-number-format:'\\@';">${emp?.tpnNo || ''}</td>
          <td style="text-align: right; border: 1px solid #000; mso-number-format:'\\#\\,\\#\\#0\\.00';">${basic.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; mso-number-format:'\\#\\,\\#\\#0\\.00';">${allowance.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; mso-number-format:'\\#\\,\\#\\#0\\.00';">${arrear.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${gross.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; background-color: #FFFFCC; mso-number-format:'\\#\\,\\#\\#0\\.00';">${pf.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; background-color: #FFFFCC; mso-number-format:'\\#\\,\\#\\#0\\.00';">${gis.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${netSalary.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; color: #b91c1c; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${tds.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; color: #047857; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${health.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; color: #1d4ed8; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${totalTax.toFixed(2)}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>FORM IT-1(a)</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          th, td { border: 1px solid #000000; padding: 6px 10px; }
          .banner { background-color: #FFFF00; font-weight: bold; text-align: center; font-size: 14pt; padding: 10px; }
          .th-blue { background-color: #0d6efd; color: #FFFFFF; font-weight: bold; text-align: center; vertical-align: middle; }
          .th-yellow { background-color: #FFFF00; color: #000000; font-weight: bold; text-align: center; vertical-align: middle; }
          .total-row { background-color: #e2e8f0; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <col width="220" />
          <col width="120" />
          <col width="120" />
          <col width="150" />
          <col width="120" />
          <col width="130" />
          <col width="240" />
          <col width="240" />
          <col width="220" />
          <col width="140" />
          <col width="240" />
          <col width="130" />
          <thead>
            <tr>
              <th colspan="12" class="banner">FORM IT-1(a) MONTHLY SALARY SCHEDULE</th>
            </tr>
            <tr>
              <th rowspan="2" class="th-blue">Name of Employee</th>
              <th rowspan="2" class="th-blue">TPN</th>
              <th class="th-blue">1</th>
              <th class="th-blue">2</th>
              <th class="th-blue">3</th>
              <th class="th-blue">4</th>
              <th class="th-yellow">5</th>
              <th class="th-yellow">6</th>
              <th class="th-blue">7</th>
              <th class="th-blue">8</th>
              <th class="th-blue">9</th>
              <th class="th-blue">10</th>
            </tr>
            <tr>
              <th class="th-blue">Basic Salary</th>
              <th class="th-blue">Benefit / Allowance</th>
              <th class="th-blue">Salary Arrear</th>
              <th class="th-blue">Gross Salary</th>
              <th class="th-yellow">Provident Fun (PF)/15%of Gross Salary</th>
              <th class="th-yellow">Group Insurance Scheme (GIS) / Zero</th>
              <th class="th-blue">Net Salary (Gross Salary-(PF+GIS))</th>
              <th class="th-blue">TDS On Net Salary</th>
              <th class="th-blue">Health Contribution (1% of Gross Salary)</th>
              <th class="th-blue">Total (8+9)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="2" style="text-align: right; font-weight: bold; border: 1px solid #000;">TOTAL:</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumBasic.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumAllowance.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumArrear.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumGross.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; background-color: #FFFF99; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumPf.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; background-color: #FFFF99; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumGis.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumNetSalary.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; color: #b91c1c; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumTds.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; color: #047857; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumHealth.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; font-weight: bold; color: #1d4ed8; mso-number-format:'\\#\\,\\#\\#0\\.00';">${sumTotalTax.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DRC_FORM_IT_1a_${currentPayroll.monthYear.replace(/\s+/g, '_')}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('DRC Form IT-1(a) Official Excel (.xls) exported successfully!');
  };

  // Export DRC Form IT-1(a) Monthly Salary Schedule to native Excel (.xlsx)
  const handleExportDrcExcel = () => {
    if (!currentPayroll) return;

    // Build array of rows matching DRC Form IT-1(a) format
    const sheetData: (string | number)[][] = [
      ["FORM IT-1(a) MONTHLY SALARY SCHEDULE"],
      ["Name of Employee", "TPN", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      [
        "",
        "",
        "Basic Salary",
        "Benefit / Allowance",
        "Salary Arrear",
        "Gross Salary",
        "Provident Fun (PF)/15%of Gross Salary",
        "Group Insurance Scheme (GIS) / Zero",
        "Net Salary (Gross Salary-(PF+GIS))",
        "TDS On Net Salary",
        "Health Contribution (1% of Gross Salary)",
        "Total (8+9)"
      ]
    ];

    let sumBasic = 0, sumAllowance = 0, sumArrear = 0, sumGross = 0, sumPf = 0, sumGis = 0, sumNetSalary = 0, sumTds = 0, sumHealth = 0, sumTotalTax = 0;

    currentPayroll.entries.forEach(entry => {
      const emp = employees.find(e => e.empCode === entry.empCode);
      const basic = entry.earnings.find(e => e.payHeadId === 'ph_basic')?.amount || entry.basicSalary;
      const allowance = round2(entry.grossPay - basic);
      const arrear = 0;
      const gross = entry.grossPay;
      const pf = round2(gross * 0.15);
      const gis = entry.deductions.find(d => d.payHeadId === 'ph_gis')?.amount || 0;
      const netSalary = round2(gross - (pf + gis));
      const tds = entry.deductions.find(d => d.payHeadId === 'ph_pit')?.amount || calculateBhutanTDS(gross);
      const health = entry.deductions.find(d => d.payHeadId === 'ph_health')?.amount || round2(gross * 0.01);
      const totalTax = round2(tds + health);

      sumBasic += basic;
      sumAllowance += allowance;
      sumArrear += arrear;
      sumGross += gross;
      sumPf += pf;
      sumGis += gis;
      sumNetSalary += netSalary;
      sumTds += tds;
      sumHealth += health;
      sumTotalTax += totalTax;

      sheetData.push([
        entry.fullName,
        emp?.tpnNo || '',
        basic,
        allowance,
        arrear,
        gross,
        pf,
        gis,
        netSalary,
        tds,
        health,
        totalTax
      ]);
    });

    sheetData.push([
      "TOTAL:",
      "",
      round2(sumBasic),
      round2(sumAllowance),
      round2(sumArrear),
      round2(sumGross),
      round2(sumPf),
      round2(sumGis),
      round2(sumNetSalary),
      round2(sumTds),
      round2(sumHealth),
      round2(sumTotalTax)
    ]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Format all numeric cells with #,##0.00
    for (let R = 3; R < sheetData.length; R++) {
      for (let C = 2; C < 12; C++) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cellRef]) {
          ws[cellRef].z = '#,##0.00';
        }
      }
    }

    // Merge title banner (A1:L1), Name (A2:A3), TPN (B2:B3)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }
    ];

    // Set column widths
    ws['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 16 },
      { wch: 35 },
      { wch: 35 },
      { wch: 32 },
      { wch: 20 },
      { wch: 35 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FORM IT-1(a)");

    // Write binary XLSX OOXML data
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DRC_FORM_IT_1a_${currentPayroll.monthYear.replace(/\s+/g, '_')}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('DRC Form IT-1(a) Excel schedule exported successfully!');
  };

  // Employee CRUD & Salary Structure Helpers
  const handleToggleEmpPayHead = (payHeadId: string, isEnabled: boolean) => {
    const currentCustom = employeeForm.customPayHeads || {};
    const currentItem = currentCustom[payHeadId] || {};
    setEmployeeForm({
      ...employeeForm,
      customPayHeads: {
        ...currentCustom,
        [payHeadId]: {
          ...currentItem,
          enabled: isEnabled
        }
      }
    });
  };

  const handleSetEmpPayHeadOverride = (payHeadId: string, val: string) => {
    const numVal = val === '' ? undefined : Number(val);
    const currentCustom = employeeForm.customPayHeads || {};
    const currentItem = currentCustom[payHeadId] || {};
    setEmployeeForm({
      ...employeeForm,
      customPayHeads: {
        ...currentCustom,
        [payHeadId]: {
          ...currentItem,
          overrideValue: numVal
        }
      }
    });
  };

  const handleSetEmpPayHeadEndMonth = (payHeadId: string, monthVal: string) => {
    const currentCustom = employeeForm.customPayHeads || {};
    const currentItem = currentCustom[payHeadId] || {};
    setEmployeeForm({
      ...employeeForm,
      customPayHeads: {
        ...currentCustom,
        [payHeadId]: {
          ...currentItem,
          endMonth: monthVal || undefined
        }
      }
    });
  };

  const computeEmpSalarySummary = (empForm: Partial<Employee>, headsList: PayHead[]) => {
    const basic = Number(empForm.basicSalary) || 0;
    const customHeads = empForm.customPayHeads || {};

    let totalEarnings = basic;
    const earningsList: { head: PayHead; amount: number; enabled: boolean }[] = [];

    headsList.filter(h => h.type === 'Earning' && h.id !== 'ph_basic' && h.enabled).forEach(h => {
      const custom = customHeads[h.id];
      const isEnabled = custom?.enabled !== false;
      const valToUse = custom?.overrideValue !== undefined ? custom.overrideValue : h.defaultValue;
      let amt = 0;

      if (isEnabled) {
        if (h.calculationType === 'Fixed') amt = round2(valToUse);
        else if (h.calculationType === 'PercentBasic') amt = round2((basic * valToUse) / 100);
        else if (h.calculationType === 'Manual') amt = round2(valToUse);
      }

      if (isEnabled) totalEarnings += amt;
      earningsList.push({ head: h, amount: amt, enabled: isEnabled });
    });

    let totalDeductions = 0;
    const deductionsList: { head: PayHead; amount: number; enabled: boolean }[] = [];

    headsList.filter(h => h.type === 'Deduction' && h.enabled).forEach(h => {
      const custom = customHeads[h.id];
      const isEnabled = custom?.enabled !== false;
      const valToUse = custom?.overrideValue !== undefined ? custom.overrideValue : h.defaultValue;
      let amt = 0;

      if (isEnabled) {
        if (h.calculationType === 'Fixed') amt = round2(valToUse);
        else if (h.calculationType === 'PercentBasic') amt = round2((basic * valToUse) / 100);
        else if (h.calculationType === 'PercentGross') amt = round2((totalEarnings * valToUse) / 100);
        else if (h.calculationType === 'Manual') {
          if (h.id === 'ph_pit') {
            amt = custom?.overrideValue !== undefined ? round2(custom.overrideValue) : calculateBhutanTDS(totalEarnings);
          } else {
            amt = round2(valToUse);
          }
        }
      }

      if (isEnabled) totalDeductions += amt;
      deductionsList.push({ head: h, amount: amt, enabled: isEnabled });
    });

    const netSalary = round2(totalEarnings - totalDeductions);

    return { basic, totalEarnings, totalDeductions, netSalary, earningsList, deductionsList };
  };

  const handleOpenNewEmployee = () => {
    const newCode = `EMP-${String(employees.length + 1).padStart(3, '0')}`;
    setEditingEmployee(null);
    setEmployeeForm({
      empCode: newCode,
      fullName: '',
      cidNo: '',
      designation: '',
      department: 'Operations',
      joiningDate: new Date().toISOString().split('T')[0],
      contactNo: '',
      email: '',
      bankName: 'Bank of Bhutan (BOB)',
      accountNo: '',
      basicSalary: 20000,
      status: 'Active',
      customPayHeads: {}
    });
    setEmpModalTab('profile');
    setShowEmployeeModal(true);
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmployeeForm({
      ...emp,
      customPayHeads: emp.customPayHeads || {}
    });
    setEmpModalTab('profile');
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeForm.fullName || !employeeForm.empCode) {
      showToast('Please provide Employee Code and Full Name', 'error');
      return;
    }

    let updatedList = [...employees];
    if (editingEmployee) {
      updatedList = updatedList.map(e =>
        e.id === editingEmployee.id ? ({ ...e, ...employeeForm } as Employee) : e
      );
      showToast(`Employee ${employeeForm.fullName} updated successfully!`);
    } else {
      const newEmp: Employee = {
        id: `emp_${Date.now()}`,
        empCode: employeeForm.empCode || '',
        fullName: employeeForm.fullName || '',
        cidNo: employeeForm.cidNo || '',
        designation: employeeForm.designation || '',
        department: employeeForm.department || 'Operations',
        joiningDate: employeeForm.joiningDate || new Date().toISOString().split('T')[0],
        contactNo: employeeForm.contactNo || '',
        email: employeeForm.email || '',
        bankName: employeeForm.bankName || 'Bank of Bhutan (BOB)',
        accountNo: employeeForm.accountNo || '',
        basicSalary: Number(employeeForm.basicSalary) || 0,
        status: (employeeForm.status as 'Active' | 'Inactive') || 'Active',
        customPayHeads: employeeForm.customPayHeads || {}
      };
      updatedList.push(newEmp);
      showToast(`New Employee ${newEmp.fullName} added!`);
    }

    saveEmployees(updatedList);
    setEmployeesState(updatedList);
    setShowEmployeeModal(false);
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove employee "${name}"?`)) {
      const updatedList = employees.filter(e => e.id !== id);
      saveEmployees(updatedList);
      setEmployeesState(updatedList);
      showToast(`Employee "${name}" deleted.`);
    }
  };

  // Pay Head CRUD
  const handleOpenNewPayHead = () => {
    setEditingPayHead(null);
    setPayHeadForm({
      name: '',
      type: 'Earning',
      calculationType: 'Fixed',
      defaultValue: 0,
      isStatutory: false,
      description: '',
      enabled: true
    });
    setShowPayHeadModal(true);
  };

  const handleEditPayHead = (head: PayHead) => {
    setEditingPayHead(head);
    setPayHeadForm({ ...head });
    setShowPayHeadModal(true);
  };

  const handleSavePayHead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payHeadForm.name) {
      showToast('Pay Head Name is required.', 'error');
      return;
    }

    let updatedHeads = [...payHeads];
    if (editingPayHead) {
      updatedHeads = updatedHeads.map(h =>
        h.id === editingPayHead.id ? ({ ...h, ...payHeadForm } as PayHead) : h
      );
      showToast(`Pay Head "${payHeadForm.name}" updated!`);
    } else {
      const newHead: PayHead = {
        id: `ph_${Date.now()}`,
        name: payHeadForm.name || '',
        type: (payHeadForm.type as 'Earning' | 'Deduction') || 'Earning',
        calculationType: (payHeadForm.calculationType as PayHead['calculationType']) || 'Fixed',
        defaultValue: Number(payHeadForm.defaultValue) || 0,
        isStatutory: Boolean(payHeadForm.isStatutory),
        description: payHeadForm.description || '',
        enabled: true
      };
      updatedHeads.push(newHead);
      showToast(`New Pay Head "${newHead.name}" created!`);
    }

    savePayHeads(updatedHeads);
    setPayHeadsState(updatedHeads);
    setShowPayHeadModal(false);
  };

  const handleTogglePayHeadEnabled = (id: string) => {
    const updated = payHeads.map(h => (h.id === id ? { ...h, enabled: !h.enabled } : h));
    savePayHeads(updated);
    setPayHeadsState(updated);
    showToast('Pay Head status toggled!');
  };

  const handleDeletePayHead = (id: string, name: string) => {
    const target = payHeads.find(h => h.id === id);
    if (target?.isStatutory) {
      showToast('Statutory Pay Heads (NPPF, GIS, PIT) cannot be deleted. You can disable them instead.', 'error');
      return;
    }
    if (confirm(`Are you sure you want to delete Pay Head "${name}"?`)) {
      const updated = payHeads.filter(h => h.id !== id);
      savePayHeads(updated);
      setPayHeadsState(updated);
      showToast(`Pay Head "${name}" deleted.`);
    }
  };

  // Save changes from Entry Edit Modal
  const handleSaveEntryEdit = () => {
    if (!editingEntry || !currentPayroll) return;

    const newGross = round2(editingEntry.earnings.reduce((s, x) => s + x.amount, 0));
    const newDeductions = round2(editingEntry.deductions.reduce((s, x) => s + x.amount, 0));
    const newNet = round2(newGross - newDeductions);

    const updatedEntry: PayrollEntry = {
      ...editingEntry,
      grossPay: newGross,
      totalDeductions: newDeductions,
      netPay: newNet
    };

    const updatedEntries = currentPayroll.entries.map(e =>
      e.id === editingEntry.id ? updatedEntry : e
    );

    const totGross = round2(updatedEntries.reduce((s, x) => s + x.grossPay, 0));
    const totDed = round2(updatedEntries.reduce((s, x) => s + x.totalDeductions, 0));
    const totNet = round2(updatedEntries.reduce((s, x) => s + x.netPay, 0));

    const updatedPayroll: MonthlyPayroll = {
      ...currentPayroll,
      entries: updatedEntries,
      totalGrossPay: totGross,
      totalDeductions: totDed,
      totalNetPay: totNet
    };

    saveMonthlyPayroll(updatedPayroll);
    refreshAllData();
    setEditingEntry(null);
    showToast('Employee payroll entry updated successfully!');
  };

  // Convert Number to Words (Nu. Currency)
  const numberToWordsBhutan = (num: number): string => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

    const inWords = (n: number): string => {
      if ((n = n.toString() as any).length > 9) return 'overflow';
      const nStr = ('000000000' + n).substr(-9);
      const match = nStr.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!match) return '';
      let str = '';
      str += Number(match[1]) !== 0 ? (a[Number(match[1])] || b[match[1][0]] + a[match[1][1]]) + 'Crore ' : '';
      str += Number(match[2]) !== 0 ? (a[Number(match[2])] || b[match[2][0]] + a[match[2][1]]) + 'Lakh ' : '';
      str += Number(match[3]) !== 0 ? (a[Number(match[3])] || b[match[3][0]] + a[match[3][1]]) + 'Thousand ' : '';
      str += Number(match[4]) !== 0 ? (a[Number(match[4])] || b[match[4][0]] + a[match[4][1]]) + 'Hundred ' : '';
      str += Number(match[5]) !== 0 ? ((str !== '') ? 'and ' : '') + (a[Number(match[5])] || b[match[5][0]] + a[match[5][1]]) : '';
      return str;
    };

    const whole = Math.floor(num);
    const fraction = Math.round((num - whole) * 100);
    let result = 'Ngultrum ' + (whole === 0 ? 'Zero' : inWords(whole));
    if (fraction > 0) {
      result += ' and Chhertum ' + inWords(fraction);
    }
    result += ' Only';
    return result;
  };

  // Filtered Employee List
  const filteredEmployees = employees.filter(e => {
    const matchesSearch =
      e.fullName.toLowerCase().includes(empSearch.toLowerCase()) ||
      e.empCode.toLowerCase().includes(empSearch.toLowerCase()) ||
      e.cidNo.includes(empSearch);
    const matchesDept = !departmentFilter || e.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const departmentsList = Array.from(new Set(employees.map(e => e.department))).filter(Boolean);

  return (
    <div className="space-y-5 pb-10">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold text-white transition animate-bounce ${
            toastMsg.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toastMsg.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          <span>{toastMsg.text}</span>
      
        </div>
      )}

      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white shadow-md">
            <DollarSign className="h-6 w-6 text-white" />
      
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">Payroll & HR Management</h1>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                🇧🇹 Bhutan DRC Compliant
              </span>
      
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Flexible private company salary processing with customizable pay heads (NPPF, GIS, PIT) & bank transfer advice.
            </p>
      
          </div>
      
        </div>

        {/* Tab Selector Buttons */}
        <div 
          role="tablist"
          aria-label="Payroll Navigation Tabs"
          className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 self-start md:self-auto"
        >
          {payrollTabs.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={el => (tabButtonRefs.current[idx] = el)}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>
                  {tab.label}
                  {tab.id === 'employees' ? ` (${employees.length})` : ''}
                </span>
              </button>
            );
          })}
      
        </div>
      
      </div>

      {/* TAB 1: SALARY PROCESSING */}
      {activeTab === 'processing' && (
        <div className="space-y-4">
          {/* Month / Year Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Calendar className="h-4 w-4 text-indigo-600" />
                Payroll Period:
              </span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="h-9 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
              >
                {monthsList.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="h-9 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
      
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleProcessPayroll}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
              >
                <DollarSign className="h-4 w-4" />
                <span>{currentPayroll ? 'Recalculate / Reprocess Payroll' : 'Process Monthly Payroll'}</span>
              </button>

              {currentPayroll && (
                <>
                  <button
                    onClick={() => setShowBankSheetModal(true)}
                    className="h-9 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center gap-1.5"
                    title="Export Bank Salary Advice Letter"
                  >
                    <CreditCard className="h-4 w-4 text-indigo-600" />
                    <span className="hidden sm:inline">Bank Advice Sheet</span>
                  </button>

                  <button
                    onClick={() => setShowDrcFormModal(true)}
                    className="h-9 px-3 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                    title="Export DRC Form IT-1(a) Monthly Tax & Health Schedule"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>DRC Form IT-1(a)</span>
                  </button>

                  {currentPayroll.isPostedToAccounting ? (
                    <span className="h-9 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Posted ({currentPayroll.voucherRefNo})</span>
                    </span>
                  ) : (
                    <button
                      onClick={handlePostToAccounting}
                      className="h-9 px-3 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Post JV to Accounting</span>
                    </button>
                  )}
                </>
              )}
      
            </div>
      
          </div>

          {/* Current Payroll Statistics Cards */}
          {currentPayroll ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Active Staff Count
      
                </div>
                <div className="text-xl font-black text-slate-900">{currentPayroll.entries.length} Staff</div>
                <div className="text-[11px] text-slate-400 mt-1">Processed for {currentPayroll.monthYear}</div>
      
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Total Gross Earnings
      
                </div>
                <div className="text-xl font-black text-indigo-600">
                  {config.CurrencySymbol || 'Nu.'} {currentPayroll.totalGrossPay.toLocaleString('en-IN')}
      
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Basic + Allowances</div>
      
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Total Statutory Deductions
      
                </div>
                <div className="text-xl font-black text-rose-600">
                  {config.CurrencySymbol || 'Nu.'} {currentPayroll.totalDeductions.toLocaleString('en-IN')}
      
                </div>
                <div className="text-[11px] text-slate-400 mt-1">NPPF (11%) + GIS + PIT</div>
      
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl shadow-xs">
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                  Net Salary Payable
      
                </div>
                <div className="text-xl font-black text-emerald-700">
                  {config.CurrencySymbol || 'Nu.'} {currentPayroll.totalNetPay.toLocaleString('en-IN')}
      
                </div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">Net Direct Bank Transfer</div>
      
              </div>
      
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-400 stroke-1" />
              <div className="font-bold text-slate-800 text-sm">
                No processed payroll found for {monthsList.find(m => m.value === selectedMonth)?.label} {selectedYear}
      
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                Click "Process Monthly Payroll" above to automatically calculate Basic Pay, Allowances, NPPF (11%), GIS, and PIT for all active employees.
              </p>
              <button
                onClick={handleProcessPayroll}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-1.5"
              >
                <DollarSign className="h-4 w-4" />
                <span>Process Payroll Now</span>
              </button>
      
            </div>
          )}

          {/* Payroll Sheet Table */}
          {currentPayroll && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between">
                <div className="font-bold text-xs sm:text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  <span>Salary Register - {currentPayroll.monthYear}</span>
      
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {currentPayroll.entries.length} Records
                </span>
      
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Emp Code</th>
                      <th className="py-2.5 px-3 text-left">Employee Name</th>
                      <th className="py-2.5 px-3 text-left">Designation</th>
                      <th className="py-2.5 px-3 text-center">Days Worked</th>
                      <th className="py-2.5 px-3 text-right">Basic Pay</th>
                      <th className="py-2.5 px-3 text-right">Gross Pay</th>
                      <th className="py-2.5 px-3 text-right">Deductions</th>
                      <th className="py-2.5 px-3 text-right">Net Payable</th>
                      <th className="py-2.5 px-3 text-left">Bank / A/C No</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {currentPayroll.entries.map((entry) => {
                      const mDays = entry.monthTotalDays || 30;
                      const wDays = entry.workingDays !== undefined ? entry.workingDays : mDays;
                      const isProrated = wDays < mDays;

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{entry.empCode}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{entry.fullName}</div>
                            <div className="text-[10px] text-slate-500">CID: {entry.cidNo}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <div>{entry.designation}</div>
                            <div className="text-[10px] text-slate-400">{entry.department}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="font-mono font-bold text-slate-800">
                              {wDays} / {mDays} Days
      
                            </div>
                            {isProrated && (
                              <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full inline-block mt-0.5">
                                Mid-Month Prorated
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                            {entry.earnings.find(e => e.payHeadId === 'ph_basic')?.amount.toLocaleString('en-IN') || entry.basicSalary.toLocaleString('en-IN')}
                            {isProrated && (
                              <div className="text-[9px] text-slate-400 line-through font-normal">
                                Nu. {entry.basicSalary.toLocaleString('en-IN')}
      
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600">
                            {entry.grossPay.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                            {entry.totalDeductions.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                            {config.CurrencySymbol || 'Nu.'} {entry.netPay.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                            <div>{entry.bankName}</div>
                            <div className="text-[10px] text-slate-400 font-bold">{entry.accountNo}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setEditingEntry({ ...entry })}
                                className="p-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                                title="Edit Entry Amounts or Prorated Days"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setPayslipModalEntry(entry)}
                                className="px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-[11px] transition flex items-center gap-1"
                                title="Print Individual Payslip"
                              >
                                <Printer className="h-3 w-3" />
                                <span>Payslip</span>
                              </button>
      
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
      
              </div>
      
            </div>
          )}
      
        </div>
      )}

      {/* TAB 2: EMPLOYEE MASTER */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
              <button
                onClick={() => setActiveTab('processing')}
                className="h-9 px-3.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 shrink-0"
                title="Return to Salary Processing tab (Esc)"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                <span>Back to Processing</span>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-white rounded border border-slate-300 text-slate-500 font-mono shadow-2xs">Esc</kbd>
              </button>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Employee Name, CID, Code..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none"
                />
      
              </div>

              {departmentsList.length > 0 && (
                <select
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-slate-50 outline-none"
                >
                  <option value="">All Departments</option>
                  {departmentsList.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
      
            </div>

            <button
              onClick={handleOpenNewEmployee}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Employee</span>
            </button>
      
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Code</th>
                    <th className="py-2.5 px-3 text-left">Employee Name</th>
                    <th className="py-2.5 px-3 text-left">CID Number</th>
                    <th className="py-2.5 px-3 text-left">Designation / Dept</th>
                    <th className="py-2.5 px-3 text-right">Basic Salary</th>
                    <th className="py-2.5 px-3 text-left">Bank & Account No</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                        No employees found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{emp.empCode}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{emp.fullName}</div>
                          <div className="text-[10px] text-slate-400">{emp.contactNo || emp.email || '-'}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{emp.cidNo || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div>{emp.designation}</div>
                          <div className="text-[10px] text-indigo-600 font-semibold">{emp.department}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="font-mono font-bold text-slate-900">
                            {config.CurrencySymbol || 'Nu.'} {emp.basicSalary.toLocaleString('en-IN')}
      
                          </div>
                          <button
                            onClick={() => {
                              handleEditEmployee(emp);
                              setEmpModalTab('salary');
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition mt-0.5"
                            title="Configure customized allowances & deductions for this employee"
                          >
                            <DollarSign className="h-3 w-3 text-indigo-600" />
                            <span>Salary Package</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          <div>{emp.bankName}</div>
                          <div className="text-[10px] text-slate-400 font-bold">{emp.accountNo || '-'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              emp.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {emp.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditEmployee(emp)}
                              className="p-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              title="Edit Employee Details"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.fullName)}
                              className="p-1 rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                              title="Delete Employee"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
      
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
      
            </div>
      
          </div>
      
        </div>
      )}

      {/* TAB 3: FLEXIBLE PAY HEADS */}
      {activeTab === 'payheads' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('processing')}
                className="h-9 px-3.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 shrink-0"
                title="Return to Salary Processing tab (Esc)"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                <span>Back to Processing</span>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-white rounded border border-slate-300 text-slate-500 font-mono shadow-2xs">Esc</kbd>
              </button>

              <div>
                <h3 className="font-bold text-slate-900 text-sm">Flexible Pay Heads Configurator</h3>
                <p className="text-xs text-slate-500">
                  Add, remove, or modify Earnings & Deductions. Statutory Bhutan Heads (NPPF, GIS, PIT) are protected defaults.
                </p>
      
              </div>
      
            </div>

            <button
              onClick={handleOpenNewPayHead}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Pay Head</span>
            </button>
      
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earnings Column */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-emerald-700 text-white font-bold text-xs flex items-center justify-between">
                <span>Earnings (Allowances & Salary Additions)</span>
                <span>{payHeads.filter(h => h.type === 'Earning').length} Heads</span>
      
              </div>
              <div className="divide-y divide-slate-100">
                {payHeads
                  .filter(h => h.type === 'Earning')
                  .map(head => (
                    <div key={head.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{head.name}</span>
                          {!head.enabled && (
                            <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
      
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{head.description || head.calculationType}</p>
                        <div className="text-[11px] font-mono text-emerald-700 font-semibold mt-1">
                          Rule: {getPayHeadRuleLabel(head)}
      
                        </div>
      
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTogglePayHeadEnabled(head.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                            head.enabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {head.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button
                          onClick={() => handleEditPayHead(head)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-indigo-600 transition"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        {!head.isStatutory && (
                          <button
                            onClick={() => handleDeletePayHead(head.id, head.name)}
                            className="p-1.5 rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
      
                      </div>
      
                    </div>
                  ))}
      
              </div>
      
            </div>

            {/* Deductions Column */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-rose-700 text-white font-bold text-xs flex items-center justify-between">
                <span>Deductions (NPPF, GIS, PIT & Recoveries)</span>
                <span>{payHeads.filter(h => h.type === 'Deduction').length} Heads</span>
      
              </div>
              <div className="divide-y divide-slate-100">
                {payHeads
                  .filter(h => h.type === 'Deduction')
                  .map(head => (
                    <div key={head.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{head.name}</span>
                          {head.isStatutory && (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              Statutory
                            </span>
                          )}
                          {!head.enabled && (
                            <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
      
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{head.description || head.calculationType}</p>
                        <div className="text-[11px] font-mono text-rose-700 font-semibold mt-1">
                          Rule: {getPayHeadRuleLabel(head)}
      
                        </div>
      
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTogglePayHeadEnabled(head.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                            head.enabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {head.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button
                          onClick={() => handleEditPayHead(head)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-indigo-600 transition"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        {!head.isStatutory && (
                          <button
                            onClick={() => handleDeletePayHead(head.id, head.name)}
                            className="p-1.5 rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
      
                      </div>
      
                    </div>
                  ))}
      
              </div>
      
            </div>
      
          </div>
      
        </div>
      )}

      {/* MODAL 1: ADD / EDIT EMPLOYEE & SALARY STRUCTURE */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-5 border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingEmployee ? `Edit Employee: ${editingEmployee.fullName}` : 'Add New Employee'}
                </h3>
                <p className="text-[11px] text-slate-500">Configure personal details, bank account, and custom salary package/allowances.</p>
      
              </div>
              <button
                onClick={() => setShowEmployeeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
      
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setEmpModalTab('profile')}
                className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                  empModalTab === 'profile'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="h-4 w-4 text-indigo-600" />
                <span>1. Personal & Bank Details</span>
              </button>
              <button
                type="button"
                onClick={() => setEmpModalTab('salary')}
                className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                  empModalTab === 'salary'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span>2. Salary Structure (Allowances & Deductions)</span>
              </button>
      
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4 text-xs">
              {empModalTab === 'profile' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Emp Code *</label>
                      <input
                        type="text"
                        required
                        value={employeeForm.empCode || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, empCode: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold focus:border-indigo-500 outline-none"
                      />
      
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Status</label>
                      <select
                        value={employeeForm.status || 'Active'}
                        onChange={e => setEmployeeForm({ ...employeeForm, status: e.target.value as any })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold focus:border-indigo-500 outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
      
                    </div>
      
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sonam Tobgay"
                      value={employeeForm.fullName || ''}
                      onChange={e => setEmployeeForm({ ...employeeForm, fullName: e.target.value })}
                      className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold focus:border-indigo-500 outline-none"
                    />
      
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">CID Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 11502001832"
                        value={employeeForm.cidNo || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, cidNo: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono focus:border-indigo-500 outline-none"
                      />
      
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">DRC TPN No</label>
                      <input
                        type="text"
                        placeholder="e.g. TPN-982341"
                        value={employeeForm.tpnNo || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, tpnNo: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono focus:border-indigo-500 outline-none"
                      />
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">NPPF Account No</label>
                      <input
                        type="text"
                        placeholder="e.g. 1234567"
                        value={employeeForm.nppfNo || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, nppfNo: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono focus:border-indigo-500 outline-none"
                      />
      
                    </div>
      
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Department</label>
                      <input
                        type="text"
                        placeholder="e.g. Operations"
                        value={employeeForm.department || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold focus:border-indigo-500 outline-none"
                      />
      
                    </div>
      
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                      <input
                        type="text"
                        placeholder="e.g. Senior Accountant"
                        value={employeeForm.designation || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 focus:border-indigo-500 outline-none"
                      />
      
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Basic Salary ({config.CurrencySymbol || 'Nu.'}) *</label>
                      <input
                        type="number"
                        required
                        value={employeeForm.basicSalary || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, basicSalary: Number(e.target.value) })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold text-indigo-700 focus:border-indigo-500 outline-none"
                      />
      
                    </div>
      
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                      <select
                        value={employeeForm.bankName || 'Bank of Bhutan (BOB)'}
                        onChange={e => setEmployeeForm({ ...employeeForm, bankName: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 focus:border-indigo-500 outline-none"
                      >
                        <option value="Bank of Bhutan (BOB)">Bank of Bhutan (BOB)</option>
                        <option value="Bhutan National Bank (BNBL)">Bhutan National Bank (BNBL)</option>
                        <option value="T-Bank">T-Bank</option>
                        <option value="Druk PNB">Druk PNB</option>
                        <option value="BDBL">BDBL</option>
                        <option value="Cash / Hand">Cash Payment</option>
                      </select>
      
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bank Account Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 102938475"
                        value={employeeForm.accountNo || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, accountNo: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono focus:border-indigo-500 outline-none"
                      />
      
                    </div>
      
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Date of Joining</label>
                      <input
                        type="date"
                        value={employeeForm.joiningDate || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, joiningDate: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono focus:border-indigo-500 outline-none"
                      />
      
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Date of Leaving / Exit (If Resigned)
                      </label>
                      <input
                        type="date"
                        value={employeeForm.exitDate || ''}
                        onChange={e => setEmployeeForm({ ...employeeForm, exitDate: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono focus:border-indigo-500 outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">Leave blank if currently active.</p>
      
                    </div>
      
                  </div>
      
                </div>
              )}

              {empModalTab === 'salary' && (() => {
                const summary = computeEmpSalarySummary(employeeForm, payHeads);

                return (
                  <div className="space-y-4">
                    {/* Live Salary Estimation Header */}
                    <div className="bg-slate-900 text-white p-3.5 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 bg-slate-800/80 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Basic Pay</span>
                        <span className="font-mono font-extrabold text-sm text-white">
                          {config.CurrencySymbol || 'Nu.'} {summary.basic.toLocaleString('en-IN')}
                        </span>
      
                      </div>

                      <div className="p-2 bg-emerald-950/60 border border-emerald-800/50 rounded-xl">
                        <span className="text-[10px] text-emerald-400 block font-bold uppercase">Total Gross Pay</span>
                        <span className="font-mono font-extrabold text-sm text-emerald-300">
                          {config.CurrencySymbol || 'Nu.'} {summary.totalEarnings.toLocaleString('en-IN')}
                        </span>
      
                      </div>

                      <div className="p-2 bg-rose-950/60 border border-rose-800/50 rounded-xl">
                        <span className="text-[10px] text-rose-400 block font-bold uppercase">Total Deductions</span>
                        <span className="font-mono font-extrabold text-sm text-rose-300">
                          {config.CurrencySymbol || 'Nu.'} {summary.totalDeductions.toLocaleString('en-IN')}
                        </span>
      
                      </div>

                      <div className="p-2 bg-indigo-950/80 border border-indigo-700/60 rounded-xl">
                        <span className="text-[10px] text-indigo-300 block font-bold uppercase">Net Take-Home</span>
                        <span className="font-mono font-black text-sm text-amber-300">
                          {config.CurrencySymbol || 'Nu.'} {summary.netSalary.toLocaleString('en-IN')}
                        </span>
      
                      </div>
      
                    </div>

                    <p className="text-[11px] text-slate-500 italic">
                      Tick or untick pay heads to enable/disable them for this employee. You can also specify custom override amounts or percentage rates for specific allowances or deductions.
                    </p>

                    {/* Earnings Section */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <div className="bg-emerald-700 text-white font-bold px-3.5 py-2 text-xs flex justify-between items-center">
                        <span>Earnings & Allowances</span>
                        <span>{summary.earningsList.filter(e => e.enabled).length} Enabled</span>
      
                      </div>

                      <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                        {summary.earningsList.map(({ head, amount, enabled }) => {
                          const custom = employeeForm.customPayHeads?.[head.id];

                          return (
                            <div key={head.id} className={`p-3 flex items-center justify-between gap-3 ${enabled ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={e => handleToggleEmpPayHead(head.id, e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <div>
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                    <span>{head.name}</span>
                                    {custom?.overrideValue !== undefined && (
                                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-1 rounded">
                                        Custom
                                      </span>
                                    )}
      
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Rule: {getPayHeadRuleLabel(head)}
      
                                  </div>
      
                                </div>
      
                              </div>

                              {enabled ? (
                                <div className="flex items-center gap-2">
                                  <div>
                                    <span className="text-[9px] text-slate-400 block font-bold text-right">Custom Rate/Amt</span>
                                    <input
                                      type="number"
                                      placeholder={`Std: ${head.defaultValue}`}
                                      value={custom?.overrideValue !== undefined ? custom.overrideValue : ''}
                                      onChange={e => handleSetEmpPayHeadOverride(head.id, e.target.value)}
                                      className="w-24 h-7 rounded-lg border border-slate-300 px-2 text-right font-mono text-xs outline-none focus:border-indigo-500"
                                    />
      
                                  </div>
                                  <div className="w-24 text-right">
                                    <span className="text-[9px] text-slate-400 block font-bold">Monthly Calc</span>
                                    <span className="font-mono font-bold text-xs text-emerald-700">
                                      +{config.CurrencySymbol || 'Nu.'} {amount.toLocaleString('en-IN')}
                                    </span>
      
                                  </div>
      
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold italic">Not Applicable</span>
                              )}
      
                            </div>
                          );
                        })}
      
                      </div>
      
                    </div>

                    {/* Deductions Section */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <div className="bg-rose-700 text-white font-bold px-3.5 py-2 text-xs flex justify-between items-center">
                        <span>Deductions & Recoveries</span>
                        <span>{summary.deductionsList.filter(d => d.enabled).length} Enabled</span>
      
                      </div>

                      <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                        {summary.deductionsList.map(({ head, amount, enabled }) => {
                          const custom = employeeForm.customPayHeads?.[head.id];

                          return (
                            <div key={head.id} className={`p-3 flex items-center justify-between gap-3 ${enabled ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={e => handleToggleEmpPayHead(head.id, e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <div>
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                    <span>{head.name}</span>
                                    {head.isStatutory && (
                                      <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold px-1 rounded">
                                        Statutory
                                      </span>
                                    )}
                                    {custom?.overrideValue !== undefined && (
                                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-1 rounded">
                                        Custom
                                      </span>
                                    )}
      
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Rule: {getPayHeadRuleLabel(head)}
      
                                  </div>
      
                                </div>
      
                              </div>

                              {enabled ? (
                                <div className="flex items-center gap-2">
                                  <div>
                                    <span className="text-[9px] text-slate-400 block font-bold text-right">Deduction Amt</span>
                                    <input
                                      type="number"
                                      placeholder={`Std: ${head.defaultValue}`}
                                      value={custom?.overrideValue !== undefined ? custom.overrideValue : ''}
                                      onChange={e => handleSetEmpPayHeadOverride(head.id, e.target.value)}
                                      className="w-24 h-7 rounded-lg border border-slate-300 px-2 text-right font-mono text-xs outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
      
                                  </div>

                                  <div>
                                    <span className="text-[9px] text-slate-400 block font-bold text-right">Stop After Month</span>
                                    <input
                                      type="month"
                                      value={custom?.endMonth || ''}
                                      onChange={e => handleSetEmpPayHeadEndMonth(head.id, e.target.value)}
                                      className="h-7 rounded-lg border border-slate-300 px-1 font-mono text-[11px] outline-none focus:border-indigo-500"
                                      title="Auto-stops deduction after specified month (e.g., 2026-12)"
                                    />
      
                                  </div>

                                  <div className="w-20 text-right">
                                    <span className="text-[9px] text-slate-400 block font-bold">Monthly Calc</span>
                                    <span className="font-mono font-bold text-xs text-rose-700">
                                      -{config.CurrencySymbol || 'Nu.'} {amount.toLocaleString('en-IN')}
                                    </span>
      
                                  </div>
      
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold italic">Not Applicable</span>
                              )}
      
                            </div>
                          );
                        })}
      
                      </div>
      
                    </div>
      
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <div>
                  {empModalTab === 'profile' ? (
                    <button
                      type="button"
                      onClick={() => setEmpModalTab('salary')}
                      className="px-3 h-9 rounded-xl bg-slate-100 text-indigo-700 font-bold hover:bg-slate-200 transition flex items-center gap-1"
                    >
                      <span>Configure Salary Package &rarr;</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEmpModalTab('profile')}
                      className="px-3 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition flex items-center gap-1"
                    >
                      <span>&larr; Back to Details</span>
                    </button>
                  )}
      
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmployeeModal(false)}
                    className="px-4 h-9 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition"
                  >
                    Save Employee
                  </button>
      
                </div>
      
              </div>
            </form>
      
          </div>
      
        </div>
      )}

      {/* MODAL 2: ADD / EDIT PAY HEAD */}
      {showPayHeadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                {editingPayHead ? 'Edit Pay Head' : 'Add New Pay Head'}
              </h3>
              <button
                onClick={() => setShowPayHeadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
      
            </div>

            <form onSubmit={handleSavePayHead} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pay Head Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical Allowance or Phone Expense"
                  value={payHeadForm.name || ''}
                  onChange={e => setPayHeadForm({ ...payHeadForm, name: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold focus:border-indigo-500 outline-none"
                />
      
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Head Type</label>
                  <select
                    value={payHeadForm.type || 'Earning'}
                    onChange={e => setPayHeadForm({ ...payHeadForm, type: e.target.value as any })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold focus:border-indigo-500 outline-none"
                  >
                    <option value="Earning">Earning (+ Add)</option>
                    <option value="Deduction">Deduction (- Less)</option>
                  </select>
      
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Calculation Type</label>
                  <select
                    value={payHeadForm.calculationType || 'Fixed'}
                    onChange={e => setPayHeadForm({ ...payHeadForm, calculationType: e.target.value as any })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold focus:border-indigo-500 outline-none"
                  >
                    <option value="Fixed">Fixed Amount</option>
                    <option value="PercentBasic">% of Basic Pay</option>
                    <option value="PercentGross">% of Gross Salary</option>
                    <option value="Manual">Manual / Tax Slab</option>
                  </select>
      
                </div>
      
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Default Value ({payHeadForm.calculationType === 'PercentBasic' ? '%' : config.CurrencySymbol || 'Nu.'})
                </label>
                <input
                  type="number"
                  step="any"
                  value={payHeadForm.defaultValue || 0}
                  onChange={e => setPayHeadForm({ ...payHeadForm, defaultValue: Number(e.target.value) })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold focus:border-indigo-500 outline-none"
                />
      
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="Optional details..."
                  value={payHeadForm.description || ''}
                  onChange={e => setPayHeadForm({ ...payHeadForm, description: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 focus:border-indigo-500 outline-none"
                />
      
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayHeadModal(false)}
                  className="px-4 h-9 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition"
                >
                  Save Pay Head
                </button>
      
              </div>
            </form>
      
          </div>
      
        </div>
      )}

      {/* MODAL 3: EDIT INDIVIDUAL PAYROLL ENTRY */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Adjust Employee Salary Line</h3>
                <p className="text-xs text-slate-500">{editingEntry.fullName} ({editingEntry.empCode})</p>
      
              </div>
              <button onClick={() => setEditingEntry(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
      
            </div>

            <div className="space-y-4 text-xs">
              {/* Working Days Adjustment */}
              <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-indigo-900">Days Worked in Month</div>
                  <div className="text-[10px] text-indigo-700">
                    Full Base Salary: {config.CurrencySymbol || 'Nu.'} {editingEntry.basicSalary.toLocaleString('en-IN')} / month
      
                  </div>
      
                </div>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  <input
                    type="number"
                    min={0}
                    max={editingEntry.monthTotalDays || 31}
                    value={editingEntry.workingDays !== undefined ? editingEntry.workingDays : (editingEntry.monthTotalDays || 30)}
                    onChange={ev => {
                      const newDays = Math.max(0, Math.min(editingEntry.monthTotalDays || 31, Number(ev.target.value) || 0));
                      const mDays = editingEntry.monthTotalDays || 30;
                      const factor = mDays > 0 ? newDays / mDays : 1;
                      const baseSalary = editingEntry.basicSalary || 20000;
                      const newProratedBasic = round2(baseSalary * factor);

                      const newEarnings = editingEntry.earnings.map(item => {
                        if (item.payHeadId === 'ph_basic') return { ...item, amount: newProratedBasic };
                        if (item.payHeadId === 'ph_hra') return { ...item, amount: round2(newProratedBasic * 0.20) };
                        return item;
                      });

                      const newGross = round2(newEarnings.reduce((s, x) => s + x.amount, 0));

                      const newDeductions = editingEntry.deductions.map(item => {
                        if (item.payHeadId === 'ph_nppf') return { ...item, amount: round2(newProratedBasic * 0.11) };
                        if (item.payHeadId === 'ph_health' || item.payHeadName.toLowerCase().includes('health')) {
                          return { ...item, amount: round2(newGross * 0.01) };
                        }
                        if (item.payHeadId === 'ph_pit') return { ...item, amount: calculateBhutanTDS(newGross) };
                        return item;
                      });

                      setEditingEntry({
                        ...editingEntry,
                        workingDays: newDays,
                        earnings: newEarnings,
                        deductions: newDeductions
                      });
                    }}
                    className="w-16 h-8 text-center font-bold text-indigo-900 bg-white border border-indigo-300 rounded-lg outline-none focus:border-indigo-600"
                  />
                  <span className="text-slate-600 font-sans text-xs">/ {editingEntry.monthTotalDays || 30} Days</span>
      
                </div>
      
              </div>

              {/* Earnings Table */}
              <div>
                <h4 className="font-bold text-emerald-800 mb-2 uppercase text-[10px] tracking-wider">
                  Earnings Breakdown
                </h4>
                <div className="space-y-1.5">
                  {editingEntry.earnings.map((e, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 bg-emerald-50/50 p-2 rounded-xl">
                      <span className="font-semibold text-slate-800">{e.payHeadName}</span>
                      <input
                        type="number"
                        value={e.amount}
                        onChange={ev => {
                          const val = Number(ev.target.value) || 0;
                          const copy = [...editingEntry.earnings];
                          copy[idx].amount = val;
                          setEditingEntry({ ...editingEntry, earnings: copy });
                        }}
                        className="w-28 h-8 text-right font-mono font-bold rounded-lg border border-slate-300 px-2 outline-none focus:border-indigo-500"
                      />
      
                    </div>
                  ))}
      
                </div>
      
              </div>

              {/* Deductions Table */}
              <div>
                <h4 className="font-bold text-rose-800 mb-2 uppercase text-[10px] tracking-wider">
                  Deductions Breakdown
                </h4>
                <div className="space-y-1.5">
                  {editingEntry.deductions.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 bg-rose-50/50 p-2 rounded-xl">
                      <span className="font-semibold text-slate-800">{d.payHeadName}</span>
                      <input
                        type="number"
                        value={d.amount}
                        onChange={ev => {
                          const val = Number(ev.target.value) || 0;
                          const copy = [...editingEntry.deductions];
                          copy[idx].amount = val;
                          setEditingEntry({ ...editingEntry, deductions: copy });
                        }}
                        className="w-28 h-8 text-right font-mono font-bold rounded-lg border border-slate-300 px-2 outline-none focus:border-indigo-500"
                      />
      
                    </div>
                  ))}
      
                </div>
      
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between font-bold">
                <span>Net Payable:</span>
                <span className="text-base text-emerald-400 font-mono">
                  {config.CurrencySymbol || 'Nu.'}{' '}
                  {(
                    editingEntry.earnings.reduce((s, x) => s + x.amount, 0) -
                    editingEntry.deductions.reduce((s, x) => s + x.amount, 0)
                  ).toFixed(2)}
                </span>
      
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingEntry(null)}
                  className="px-4 h-9 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEntryEdit}
                  className="px-5 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs"
                >
                  Save Entry
                </button>
      
              </div>
      
            </div>
      
          </div>
      
        </div>
      )}

      {/* MODAL 4: PRINTABLE PAYSLIP */}
      {payslipModalEntry && currentPayroll && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between no-print border-b border-slate-200 pb-3">
              <span className="font-bold text-slate-800 text-sm">Official Employee Salary Slip</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 h-9 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setPayslipModalEntry(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
      
              </div>
      
            </div>

            {/* Print Slip Layout */}
            <div className="printable-area border border-slate-300 p-6 rounded-xl space-y-4 text-xs font-sans text-slate-900 bg-white">
              {/* Header */}
              <div className="text-center border-b border-slate-200 pb-3">
                <h2 className="text-lg font-black tracking-wide text-slate-900">{config.CompanyName}</h2>
                <p className="text-[11px] text-slate-500 font-medium">{config.Address}</p>
                <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-slate-800">
                  PAYSLIP FOR THE MONTH OF {currentPayroll.monthYear.toUpperCase()}
      
                </div>
      
              </div>

              {/* Employee Info Box */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px]">
                <div>
                  <div><span className="font-bold text-slate-500">Employee Name:</span> <strong className="text-slate-900">{payslipModalEntry.fullName}</strong></div>
                  <div><span className="font-bold text-slate-500">Employee Code:</span> <span className="font-mono font-bold">{payslipModalEntry.empCode}</span></div>
                  <div><span className="font-bold text-slate-500">CID Number:</span> <span className="font-mono">{payslipModalEntry.cidNo || '-'}</span></div>
      
                </div>
                <div>
                  <div><span className="font-bold text-slate-500">Designation:</span> <span>{payslipModalEntry.designation}</span></div>
                  <div><span className="font-bold text-slate-500">Department:</span> <span>{payslipModalEntry.department}</span></div>
                  <div><span className="font-bold text-slate-500">Bank A/C:</span> <span className="font-mono">{payslipModalEntry.bankName} ({payslipModalEntry.accountNo})</span></div>
      
                </div>
      
              </div>

              {/* Itemized Table */}
              <div className="grid grid-cols-2 gap-0 border border-slate-300 rounded-xl overflow-hidden">
                {/* Earnings Column */}
                <div className="border-r border-slate-300">
                  <div className="bg-emerald-800 text-white font-bold p-2 text-center uppercase text-[10px] tracking-wider">
                    Earnings
      
                  </div>
                  <div className="p-2 space-y-1.5 min-h-[140px]">
                    {payslipModalEntry.earnings.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <span>{item.payHeadName}</span>
                        <span className="font-mono font-bold">{item.amount.toFixed(2)}</span>
      
                      </div>
                    ))}
      
                  </div>
                  <div className="bg-emerald-50 border-t border-slate-300 p-2 flex justify-between font-bold text-emerald-900">
                    <span>Total Gross Pay:</span>
                    <span className="font-mono">{config.CurrencySymbol || 'Nu.'} {payslipModalEntry.grossPay.toFixed(2)}</span>
      
                  </div>
      
                </div>

                {/* Deductions Column */}
                <div>
                  <div className="bg-rose-800 text-white font-bold p-2 text-center uppercase text-[10px] tracking-wider">
                    Deductions
      
                  </div>
                  <div className="p-2 space-y-1.5 min-h-[140px]">
                    {payslipModalEntry.deductions.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <span>{item.payHeadName}</span>
                        <span className="font-mono font-bold text-rose-700">{item.amount.toFixed(2)}</span>
      
                      </div>
                    ))}
      
                  </div>
                  <div className="bg-rose-50 border-t border-slate-300 p-2 flex justify-between font-bold text-rose-900">
                    <span>Total Deductions:</span>
                    <span className="font-mono">{config.CurrencySymbol || 'Nu.'} {payslipModalEntry.totalDeductions.toFixed(2)}</span>
      
                  </div>
      
                </div>
      
              </div>

              {/* Net Payable Banner */}
              <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Net Salary Payable:</div>
                  <div className="text-xs font-semibold italic text-slate-300">
                    {numberToWordsBhutan(payslipModalEntry.netPay)}
      
                  </div>
      
                </div>
                <div className="text-lg font-black text-emerald-400 font-mono">
                  {config.CurrencySymbol || 'Nu.'} {payslipModalEntry.netPay.toLocaleString('en-IN')}
      
                </div>
      
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-500 font-bold">
                <div>
                  <div className="border-t border-slate-400 pt-1">Employer / Authorized Signature</div>
      
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1">Employee Signature</div>
      
                </div>
      
              </div>
      
            </div>
      
          </div>
      
        </div>
      )}

      {/* MODAL 5: BANK TRANSFER ADVICE SHEET */}
      {showBankSheetModal && currentPayroll && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="font-bold text-slate-800 text-sm">Bank Salary Advice Letter</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 h-9 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Advice Sheet</span>
                </button>
                <button
                  onClick={() => setShowBankSheetModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
      
              </div>
      
            </div>

            <div className="printable-area border border-slate-300 p-6 rounded-xl space-y-4 text-xs font-sans text-slate-900 bg-white">
              <div className="text-center border-b border-slate-200 pb-3">
                <h2 className="text-lg font-black tracking-wide text-slate-900">{config.CompanyName}</h2>
                <p className="text-[11px] text-slate-500">{config.Address}</p>
                <div className="mt-2 text-xs font-extrabold text-indigo-900 uppercase">
                  SALARY DISBURSAL BANK ADVICE SHEET - {currentPayroll.monthYear.toUpperCase()}
      
                </div>
      
              </div>

              <table className="w-full border-collapse text-xs border border-slate-300">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2 border-r border-slate-300 text-left">#</th>
                    <th className="p-2 border-r border-slate-300 text-left">Emp Code</th>
                    <th className="p-2 border-r border-slate-300 text-left">Employee Name</th>
                    <th className="p-2 border-r border-slate-300 text-left">Bank Name</th>
                    <th className="p-2 border-r border-slate-300 text-left">Account Number</th>
                    <th className="p-2 text-right">Net Amount (Nu.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {currentPayroll.entries.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="p-2 border-r border-slate-200">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold">{item.empCode}</td>
                      <td className="p-2 border-r border-slate-200 font-bold">{item.fullName}</td>
                      <td className="p-2 border-r border-slate-200">{item.bankName}</td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold">{item.accountNo}</td>
                      <td className="p-2 text-right font-mono font-black">{item.netPay.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black text-slate-900">
                    <td colSpan={5} className="p-2 border-r border-slate-300 text-right uppercase">
                      Total Disbursal Amount:
                    </td>
                    <td className="p-2 text-right font-mono text-emerald-700">
                      {config.CurrencySymbol || 'Nu.'} {currentPayroll.totalNetPay.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-500 font-bold">
                <div>
                  <div className="border-t border-slate-400 pt-1">Prepared By (Accountant)</div>
      
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1">Approved By (Managing Director)</div>
      
                </div>
      
              </div>
      
            </div>
      
          </div>
      
        </div>
      )}

      {/* MODAL 6: DRC FORM IT-1(a) MONTHLY SALARY SCHEDULE */}
      {showDrcFormModal && currentPayroll && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full p-6 border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  <span>DRC FORM IT-1(a) MONTHLY SALARY SCHEDULE</span>
                </span>
                <p className="text-[11px] text-slate-500">
                  Department of Revenue & Customs (DRC) Monthly TDS & 1% Health Contribution Deposit Schedule for {currentPayroll.monthYear}
                </p>
      
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportDrcExcelXls}
                  className="px-4 h-9 rounded-xl bg-amber-500 text-slate-900 font-bold text-xs hover:bg-amber-400 shadow-xs flex items-center gap-1.5 transition"
                  title="Official DRC Form IT-1(a) with exact yellow & blue header styling, cell borders, alignment and number formats"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Official DRC Excel (.xls)</span>
                </button>
                <button
                  onClick={() => setShowDrcFormModal(false)}
                  className="px-3 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5"
                  title="Close (Esc)"
                >
                  <X className="h-4 w-4" />
                  <span>Close</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-white rounded border border-slate-300 shadow-2xs text-slate-500 font-mono">Esc</kbd>
                </button>
      
              </div>
      
            </div>

            {/* Printable & Scrollable DRC Schedule Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-xl">
              <div className="bg-yellow-300 text-slate-900 font-bold text-center py-2 text-sm uppercase tracking-wide border-b border-slate-300">
                FORM IT-1(a) MONTHLY SALARY SCHEDULE
      
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white font-bold text-center">
                    <th rowSpan={2} className="p-2 border border-slate-300 min-w-[140px]">Name of Employee</th>
                    <th rowSpan={2} className="p-2 border border-slate-300 min-w-[90px]">TPN</th>
                    <th className="p-1.5 border border-slate-300 bg-blue-700">1</th>
                    <th className="p-1.5 border border-slate-300 bg-blue-700">2</th>
                    <th className="p-1.5 border border-slate-300 bg-blue-700">3</th>
                    <th className="p-1.5 border border-slate-300 bg-blue-700">4</th>
                    <th className="p-1.5 border border-slate-300 bg-yellow-400 text-slate-900">5</th>
                    <th className="p-1.5 border border-slate-300 bg-yellow-400 text-slate-900">6</th>
                    <th className="p-1.5 border border-slate-300 bg-blue-700">7</th>
                    <th className="p-1.5 border border-slate-300 bg-blue-700">8</th>
                    <th className="p-1.5 border border-slate-300 bg-blue-700">9</th>
                    <th className="p-1.5 border border-slate-300 bg-blue-700">10</th>
                  </tr>
                  <tr className="bg-blue-600 text-white font-bold text-center">
                    <th className="p-2 border border-slate-300">Basic Salary</th>
                    <th className="p-2 border border-slate-300">Benefit / Allowance</th>
                    <th className="p-2 border border-slate-300">Salary Arrear</th>
                    <th className="p-2 border border-slate-300">Gross Salary</th>
                    <th className="p-2 border border-slate-300 bg-yellow-300 text-slate-900 max-w-[120px]">
                      Provident Fun (PF)/15%of Gross Salary
                    </th>
                    <th className="p-2 border border-slate-300 bg-yellow-300 text-slate-900 max-w-[120px]">
                      Group Insurance Scheme (GIS) / Zero
                    </th>
                    <th className="p-2 border border-slate-300">Net Salary (Gross Salary-(PF+GIS))</th>
                    <th className="p-2 border border-slate-300">TDS On Net Salary</th>
                    <th className="p-2 border border-slate-300">Health Contribution (1% of Gross Salary)</th>
                    <th className="p-2 border border-slate-300">Total (8+9)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {(() => {
                    let sumBasic = 0, sumAllowance = 0, sumArrear = 0, sumGross = 0, sumPf = 0, sumGis = 0, sumNetSalary = 0, sumTds = 0, sumHealth = 0, sumTotalTax = 0;

                    return (
                      <>
                        {currentPayroll.entries.map((entry) => {
                          const emp = employees.find(e => e.empCode === entry.empCode);
                          const basic = entry.earnings.find(e => e.payHeadId === 'ph_basic')?.amount || entry.basicSalary;
                          const allowance = round2(entry.grossPay - basic);
                          const arrear = 0;
                          const gross = entry.grossPay;
                          const pf = round2(gross * 0.15);
                          const gis = entry.deductions.find(d => d.payHeadId === 'ph_gis')?.amount || 0;
                          const netSalary = round2(gross - (pf + gis));
                          const tds = entry.deductions.find(d => d.payHeadId === 'ph_pit')?.amount || calculateBhutanTDS(gross);
                          const health = entry.deductions.find(d => d.payHeadId === 'ph_health')?.amount || round2(gross * 0.01);
                          const totalTax = round2(tds + health);

                          sumBasic += basic;
                          sumAllowance += allowance;
                          sumArrear += arrear;
                          sumGross += gross;
                          sumPf += pf;
                          sumGis += gis;
                          sumNetSalary += netSalary;
                          sumTds += tds;
                          sumHealth += health;
                          sumTotalTax += totalTax;

                          return (
                            <tr key={entry.id} className="hover:bg-slate-50 transition text-slate-800">
                              <td className="p-2 border border-slate-200 font-bold">{entry.fullName}</td>
                              <td className="p-2 border border-slate-200 font-mono text-center">{emp?.tpnNo || '-'}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right">{basic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right">{allowance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right">{arrear.toFixed(2)}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right font-semibold">{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right bg-yellow-50">{pf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right bg-yellow-50">{gis.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right font-semibold">{netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right font-bold text-rose-700">{tds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right font-bold text-emerald-700">{health.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 border border-slate-200 font-mono text-right font-black text-indigo-700">{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}

                        <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                          <td colSpan={2} className="p-2 border border-slate-300 text-right uppercase">
                            TOTAL:
                          </td>
                          <td className="p-2 border border-slate-300 font-mono text-right">{sumBasic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-2 border border-slate-300 font-mono text-right">{sumAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-2 border border-slate-300 font-mono text-right">{sumArrear.toFixed(2)}</td>
                          <td className="p-2 border border-slate-300 font-mono text-right text-indigo-800">{sumGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-2 border border-slate-300 font-mono text-right bg-yellow-100">{sumPf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-2 border border-slate-300 font-mono text-right bg-yellow-100">{sumGis.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-2 border border-slate-300 font-mono text-right text-slate-900">{sumNetSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-2 border border-slate-300 font-mono text-right text-rose-800">{sumTds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-2 border border-slate-300 font-mono text-right text-emerald-800">{sumHealth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-2 border border-slate-300 font-mono text-right text-blue-900">{sumTotalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
      
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-500 italic">Press Esc key anytime to return to Payroll Processing</span>
              <button
                onClick={() => setShowDrcFormModal(false)}
                className="px-5 h-9 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
              >
                <X className="h-4 w-4" />
                <span>Close Schedule (Esc)</span>
              </button>
      
            </div>
      
          </div>
      
        </div>
      )}
      
    
      {/* TAB 4: ADVANCES & LOANS */}
      {activeTab === "advances" && (
        <EmployeeAdvances config={config} ledgers={ledgers} employees={employees} />
      )}
    </div>
  );
};
