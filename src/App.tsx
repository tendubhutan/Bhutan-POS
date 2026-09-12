import React, { useState, useEffect, useRef } from 'react';
import { getInitialData, getVoucherTypes, saveLedger, getVoucherDetails, migrateExistingItemsOpeningAmount, saveConfig } from './services/storageService';
import { initFirestoreSync, subscribeFirebaseStatus, seedInitialLocalDataToFirestore } from './services/firebaseSyncService';
import { Config, Item, Unit, UnitGroup, ItemGroup, Ledger, LedgerGroup, HeldBill, BarcodeQueueItem, VoucherType } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { SalesInvoiceEntry } from './components/SalesInvoiceEntry';
import { POSBilling } from './components/POSBilling';
import { QuickLedgerModal } from './components/QuickLedgerModal';
import { QuickItemModal } from './components/QuickItemModal';
import { PurchaseEntry } from './components/PurchaseEntry';
import { Vouchers } from './components/Vouchers';
import { Masters } from './components/Masters';
import { BarcodePrinting } from './components/BarcodePrinting';
import { Payroll } from './components/Payroll';
import { AssetManagementModule } from './components/assetManagement/AssetManagementModule';
import { Reports, ReportTarget } from './components/Reports';
import { SettingsView } from './components/SettingsView';
import { BankReconciliation } from './components/BankReconciliation';
import { DrillModal, TargetState } from './components/DrillModal';
import { QuickLedgerSearchModal } from './components/QuickLedgerSearchModal';
import { TrashModal } from './components/TrashModal';
import { BulkDeleteModal } from './components/BulkDeleteModal';

interface DrillReturnContext {
  activeDrill: { type: 'group' | 'stock' | 'ledger' | 'voucher' | 'item-profit'; targetId: string; fromDate?: string; toDate?: string };
  drillHistory: TargetState[];
  fromView: string;
}

export default function App() {
  const [viewHistory, setViewHistory] = useState<string[]>(['dashboard']);
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  // Drilldown Modal State & History Stack
  const [drillModal, setDrillModal] = useState<{
    type: 'group' | 'stock' | 'ledger' | 'voucher' | 'item-profit' | null;
    targetId: string | null;
    fromDate?: string;
    toDate?: string;
  }>({ type: null, targetId: null });
  const [drillInitialHistory, setDrillInitialHistory] = useState<TargetState[]>([]);
  const [drillReturnContext, setDrillReturnContext] = useState<DrillReturnContext | null>(null);
  const [showGlobalLedgerSearch, setShowGlobalLedgerSearch] = useState(false);

  // Firebase status
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'syncing' | 'offline' | 'error'>('syncing');
  const [firebaseMessage, setFirebaseMessage] = useState<string>('');

  // Pre-POS Voucher Type Selection State
  const [selectedSaleVoucherType, setSelectedSaleVoucherType] = useState<VoucherType | null>(null);

  // Sequential Navigation Functions
  const navigateTo = (view: string, reportTargetOverride?: any, keepTarget?: boolean) => {
    if (!keepTarget) setVoucherTarget(null);
    if (view === 'trash') {
      setShowTrashModal(true);
      return;
    }
    if (view === 'pos') {
      handleOpenPOSBilling(keepTarget);
      return;
    }
    if (view === 'reports' && reportTargetOverride !== undefined) {
      setReportTarget(reportTargetOverride);
    }
    if (view === currentView && view !== 'reports') return;
    setCurrentView(view);
    setViewHistory(prev => {
      if (prev[prev.length - 1] === view) return prev;
      return [...prev, view];
    });
  };

  const handleOpenPOSBilling = (keepTarget?: boolean) => {
    if (!keepTarget) setVoucherTarget(null);
    setSelectedSaleVoucherType(null);
    setCurrentView('pos');
    setViewHistory(prev => (prev[prev.length - 1] === 'pos' ? prev : [...prev, 'pos']));
    setIsMobileOpen(false);
  };

  const navigateBackDirect = () => {
    setVoucherTarget(null);

    // 3. If we came from a Drilldown (via Open in Entry), go back to the original view
    if (drillReturnContext) {
      const { fromView, activeDrill, drillHistory } = drillReturnContext;
      setDrillReturnContext(null);
      setCurrentView(fromView);

      // If activeDrill was a voucher, we don't re-open the exact same voucher detailed view modal
      // that we just opened in full entry! Instead, step back to its parent in drillHistory (if any).
      if (activeDrill.type === 'voucher') {
        if (drillHistory && drillHistory.length > 0) {
          const parentDrill = drillHistory[drillHistory.length - 1];
          const parentHistory = drillHistory.slice(0, -1);
          setDrillInitialHistory(parentHistory);
          setDrillModal({
            type: parentDrill.type,
            targetId: parentDrill.targetId
          });
        } else {
          setDrillModal({ type: null, targetId: null });
          setDrillInitialHistory([]);
        }
      } else {
        setDrillInitialHistory(drillHistory);
        setDrillModal({
          type: activeDrill.type,
          targetId: activeDrill.targetId
        });
      }

      setViewHistory(prev => {
        const idx = prev.lastIndexOf(fromView);
        if (idx !== -1) {
          return prev.slice(0, idx + 1);
        }
        return ['dashboard', fromView];
      });
      return;
    }

    // 4. Pop standard view history relative to currentView
    setViewHistory(prev => {
      let updated = [...prev];
      while (updated.length > 0 && updated[updated.length - 1] === currentView) {
        updated.pop();
      }
      const targetView = updated.length > 0 ? updated[updated.length - 1] : 'dashboard';
      setCurrentView(targetView);
      return updated.length > 0 ? updated : ['dashboard'];
    });
  };

  const navigateBack = (forceDirect: boolean = true) => {
    if (forceDirect === true) {
      navigateBackDirect();
      return;
    }

    // 1. If drilldown modal is open, dispatch app:back so DrillModal steps back sequentially
    if (drillModal?.type) {
      const backEvent = new CustomEvent('app:back', { cancelable: true });
      window.dispatchEvent(backEvent);
      return;
    }

    // 2. Allow active sub-screen or modal to handle back navigation first
    const backEvent = new CustomEvent('app:back', { cancelable: true });
    const handled = window.dispatchEvent(backEvent);
    if (!handled) return;

    navigateBackDirect();
  };

  // Store State
  const [config, setConfig] = useState<Config>({
    CompanyName: 'My Store',
    Address: '',
    CompanyGSTNo: '',
    CompanyTPNNo: '',
    GSTRate: '5',
    CurrencySymbol: 'Nu.',
    Bank1Ledger: 'BOB Account',
    Bank2Ledger: 'BNBL Account',
    CompanyBankDetails: '',
    EnableGST: 'true',
    EnableSerials: 'true',
    BarcodePrefix: '20',
    ReceiptHeaderImage: '',
    ReceiptSignatureImage: ''
  });
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitGroups, setUnitGroups] = useState<UnitGroup[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerGroups, setLedgerGroups] = useState<LedgerGroup[]>([]);
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);

  // Drilldown Modal
  // (State declared above with drillReturnContext)

  // Direct Voucher Navigation Target (from drill-down or reports into voucher entry)
  const [voucherTarget, setVoucherTarget] = useState<{ voucherNo: string; timestamp: number } | null>(null);

  // Trash & Bulk Delete Modals
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Quick Masters Trigger
  const [openItemModalCode, setOpenItemModalCode] = useState<string | null>(null);
  const [openLedgerModalGroup, setOpenLedgerModalGroup] = useState<string | null>(null);

  // Barcode Printing Queue State
  const [barcodeQueueInitial, setBarcodeQueueInitial] = useState<BarcodeQueueItem[]>([]);
  const [quickLedgerModalProps, setQuickLedgerModalProps] = useState<{isOpen: boolean, group: string, onSelect?: (name: string) => void}>({isOpen: false, group: 'Sundry Debtors'});
  const [quickItemModalProps, setQuickItemModalProps] = useState<{isOpen: boolean, onSelect?: (item: Item) => void}>({isOpen: false});

  // State Ref to prevent stale closures in global key listeners
  const appStateRef = useRef({
    showTrashModal,
    showBulkDeleteModal,
    showGlobalLedgerSearch,
    quickLedgerModalProps,
    quickItemModalProps,
    drillModal,
    drillReturnContext,
    currentView,
    viewHistory
  });
  appStateRef.current = {
    showTrashModal,
    showBulkDeleteModal,
    showGlobalLedgerSearch,
    quickLedgerModalProps,
    quickItemModalProps,
    drillModal,
    drillReturnContext,
    currentView,
    viewHistory
  };

  const refreshData = () => {
    const data = getInitialData();
    setConfig(data.config);
    setItems(data.items);
    setUnits(data.units);
    setUnitGroups(data.unitGroups);
    setItemGroups(data.itemGroups);
    setCategories(data.categories || []);
    setLedgers(data.ledgers);
    setLedgerGroups(data.ledgerGroups);
    setHeldBills(data.heldBills);
  };


  useEffect(() => {
    const handleUpdateConfig = (e: any) => {
      if (e.detail && typeof e.detail === 'object') {
        saveConfig(e.detail);
        refreshData();
      }
    };
    window.addEventListener('app:updateConfig', handleUpdateConfig);
    return () => {
      window.removeEventListener('app:updateConfig', handleUpdateConfig);
    };
  }, []);

  useEffect(() => {
    migrateExistingItemsOpeningAmount();

    refreshData();
    
    // Subscribe to Firestore sync status updates
    const unsubStatus = subscribeFirebaseStatus((status, msg) => {
      setFirebaseStatus(status);
      if (msg) setFirebaseMessage(msg);
    });

    // Initialize real-time Firestore synchronization
    const unsubFirestore = initFirestoreSync(() => {
      refreshData();
    });

    // Seed local items & ledgers to Firestore on initial load
    seedInitialLocalDataToFirestore().catch(() => {});

    const handleAppNavigate = (e: any) => {
      if (e.detail?.view) {
        if (e.detail.view === 'reports') {
          const target: any = { timestamp: Date.now(), ...e.detail };
          delete target.view;
          delete target.report;

          // Legacy mappings
          const r = e.detail.report?.toLowerCase() || '';
          if (r) {
            if (r.includes('sales')) target.category = 'daily';
            else if (r.includes('stock')) target.category = 'inv';
            else if (r.includes('gst')) target.category = 'gst';
            else if (r.includes('ledger')) { target.category = 'fin'; target.finSubTab = 'LED'; target.ledgerName = e.detail.ledgerName; }
            else if (r.includes('trial')) { target.category = 'fin'; target.finSubTab = 'TB'; }
            else if (r.includes('itemwise') || r.includes('item-profit') || r.includes('item profit')) { target.category = 'inv'; target.invSubTab = 'prof'; }
            else if (r.includes('profit')) { target.category = 'fin'; target.finSubTab = 'PNL'; }
            else if (r.includes('balance')) { target.category = 'fin'; target.finSubTab = 'BS'; }
          }
          
          if (!target.category && !target.ledgerName) {
            setReportTarget(null);
            navigateTo('reports', null);
          } else {
            setReportTarget(target);
            navigateTo('reports', target);
          }
        } else {
          navigateTo(e.detail.view);
        }
      }
    };
    const handleOpenTrash = () => setShowTrashModal(true);
    const handleOpenBulkDelete = () => setShowBulkDeleteModal(true);
    const handleOpenVoucher = (e: any) => {
      if (e.detail?.refNo) {
        setDrillModal({ type: 'voucher', targetId: e.detail.refNo });
      }
    };

    const handleDirectBack = () => {
      navigateBackDirect();
    };

    window.addEventListener('app:navigate', handleAppNavigate);
    window.addEventListener('app:navigate-back-direct', handleDirectBack);
    window.addEventListener('app:openTrash', handleOpenTrash);
    window.addEventListener('app:openBulkDelete', handleOpenBulkDelete);
    window.addEventListener('app:openVoucher', handleOpenVoucher);

    return () => {
      unsubStatus();
      unsubFirestore();
      window.removeEventListener('app:navigate', handleAppNavigate);
      window.removeEventListener('app:navigate-back-direct', handleDirectBack);
      window.removeEventListener('app:openTrash', handleOpenTrash);
      window.removeEventListener('app:openBulkDelete', handleOpenBulkDelete);
      window.removeEventListener('app:openVoucher', handleOpenVoucher);
    };
  }, []);

  // Global Keyboard Shortcuts (Report Shortcuts + Main Navigation)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      const rawKey = e.key ? e.key.toLowerCase() : '';
      const isKeyD = e.code === 'KeyD' || rawKey === 'd' || rawKey === '∂';
      const isKeyT = e.code === 'KeyT' || rawKey === 't' || rawKey === '†';

      // Bulk Delete Modal: Ctrl+Alt+D, Cmd+Alt+D, or Alt+Shift+D
      if (((e.ctrlKey || e.metaKey) && e.altKey && isKeyD) || (e.altKey && e.shiftKey && isKeyD)) {
        e.preventDefault();
        e.stopPropagation();
        setShowBulkDeleteModal(true);
        return;
      }

      // Trash Bin Modal: Ctrl+Alt+T or Cmd+Alt+T
      if ((e.ctrlKey || e.metaKey) && e.altKey && isKeyT) {
        e.preventDefault();
        e.stopPropagation();
        setShowTrashModal(true);
        return;
      }

      // Change Period Shortcut (Alt+F2 / Alt+D)
      if (e.altKey && (e.key === 'F2' || e.code === 'F2' || rawKey === 'd' || e.code === 'KeyD')) {
        e.preventDefault();
        e.stopPropagation();
        if (drillModal.type !== null) {
          window.dispatchEvent(new CustomEvent('app:drill-open-change-period'));
          return;
        }

        if (currentView === 'dashboard') {
          window.dispatchEvent(new CustomEvent('app:dashboard-open-change-period'));
          return;
        }

        if (currentView === 'reports') {
          window.dispatchEvent(new CustomEvent('app:open-change-period'));
          return;
        }

        const t = { category: 'daily' as const, openChangePeriod: true, timestamp: Date.now() };
        setReportTarget(t);
        navigateTo('reports', t);
        window.dispatchEvent(new CustomEvent('app:open-change-period'));
        return;
      }

      // Voucher Register Shortcut (Alt+V) - Options: Option B (Reports view) + Auto-filter by active voucher type
      const isKeyV = e.code === 'KeyV' || rawKey === 'v' || rawKey === '√';
      if (e.altKey && !e.ctrlKey && !e.metaKey && isKeyV) {
        e.preventDefault();
        e.stopPropagation();
        
        let vTypeFilter = 'ALL';
        if (currentView === 'pos' || currentView === 'normalsale') {
          vTypeFilter = 'Sales';
        } else if (currentView === 'purchase') {
          vTypeFilter = 'Purchase';
        }

        (window as any).__lastActiveVoucherType = undefined;
        window.dispatchEvent(new CustomEvent('app:get-active-voucher-type'));
        if ((window as any).__lastActiveVoucherType) {
          vTypeFilter = (window as any).__lastActiveVoucherType;
          delete (window as any).__lastActiveVoucherType;
        }

        const t: ReportTarget = {
          category: 'reg',
          regSubTab: 'vouchers',
          voucherTypeFilter: vTypeFilter,
          timestamp: Date.now()
        };
        setReportTarget(t);
        navigateTo('reports', t);
        return;
      }

      // Report Shortcuts (Ctrl+D, Ctrl+G, Ctrl+L)
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (rawKey === 'd' || e.code === 'KeyD') {
          e.preventDefault();
          const t = { category: 'daily' as const, timestamp: Date.now() };
          setReportTarget(t);
          navigateTo('reports', t);
          return;
        } else if (rawKey === 'g' || e.code === 'KeyG') {
          e.preventDefault();
          const t = { category: 'gst' as const, timestamp: Date.now() };
          setReportTarget(t);
          navigateTo('reports', t);
          return;
        } else if (rawKey === 'l' || e.code === 'KeyL') {
          e.preventDefault();
          setShowGlobalLedgerSearch(true);
          return;
        }
      }

      // Escape key: step back in navigation history until reaching Main Menu
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;

        const state = appStateRef.current;

        // 1. Check if top-level global dialogs in App.tsx are open
        if (state.showTrashModal) {
          e.preventDefault();
          setShowTrashModal(false);
          return;
        }
        if (state.showBulkDeleteModal) {
          e.preventDefault();
          setShowBulkDeleteModal(false);
          return;
        }
        if (state.showGlobalLedgerSearch) {
          e.preventDefault();
          setShowGlobalLedgerSearch(false);
          return;
        }
        if (state.quickLedgerModalProps.isOpen) {
          e.preventDefault();
          setQuickLedgerModalProps(p => ({ ...p, isOpen: false }));
          return;
        }
        if (state.quickItemModalProps.isOpen) {
          e.preventDefault();
          setQuickItemModalProps(p => ({ ...p, isOpen: false }));
          return;
        }

        // 2. If drilldown modal is open, dispatch app:back so DrillModal steps back sequentially
        if (state.drillModal?.type) {
          e.preventDefault();
          const backEvent = new CustomEvent('app:back', { cancelable: true });
          window.dispatchEvent(backEvent);
          return;
        }

        // 3. Dispatch app:back event so active screen/modal/sub-flow handles step-back first
        const backEvent = new CustomEvent('app:back', { cancelable: true });
        const notHandled = window.dispatchEvent(backEvent);
        if (!notHandled) {
          // Handled by child component (e.preventDefault was called)
          e.preventDefault();
          return;
        }

        // 4. If typing inside an input/select/textarea and not handled by modal, blur it
        if (isInput) {
          (activeEl as HTMLElement)?.blur?.();
        }

        // 5. Navigate back to previous screen in history stack or restore drilldown context
        if (state.drillReturnContext || state.currentView !== 'dashboard' || state.viewHistory.length > 1) {
          e.preventDefault();
          navigateBackDirect();
          return;
        }

        return;
      }

      // Main Menu Single-Key Shortcuts (when NOT typing inside inputs/textareas/selects)
      if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'p') {
          e.preventDefault();
          navigateTo('pos');
        } else if (key === 'r') {
          e.preventDefault();
          navigateTo('reports');
        } else if (key === 'v') {
          e.preventDefault();
          navigateTo('vouchers');
        } else if (key === 'd') {
          e.preventDefault();
          navigateTo('dashboard');
        } else if (key === 'i' || key === 'm') {
          e.preventDefault();
          navigateTo('masters');
        } else if (key === 'b') {
          e.preventDefault();
          navigateTo('barcode');
        } else if (key === 's') {
          e.preventDefault();
          navigateTo('settings');
        } else if (key === 'u') {
          e.preventDefault();
          navigateTo('purchase');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [drillModal.type, currentView, viewHistory]);

  const isHighDensityView = currentView === 'pos' || currentView === 'purchase' || currentView === 'normalsale' || currentView === 'vouchers';

  const isAnyModalOpen = Boolean(
    drillModal.type ||
    showGlobalLedgerSearch ||
    showTrashModal ||
    showBulkDeleteModal ||
    quickLedgerModalProps.isOpen ||
    quickItemModalProps.isOpen
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={view => navigateTo(view)}
        isOpenMobile={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        hideDesktop={true}
        config={config}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          config={config}
          onToggleMobileMenu={() => setIsMobileOpen(!isMobileOpen)}
          onRefresh={refreshData}
          canNavigateBack={currentView !== 'dashboard' || viewHistory.length > 1 || !!drillModal.type}
          onNavigateBack={() => navigateBack(false)}
          isPosMode={true}
          firebaseStatus={firebaseStatus}
          firebaseMessage={firebaseMessage}
        />

        <main className={`flex-1 ${currentView === 'reports' ? 'overflow-y-auto' : isHighDensityView ? 'p-1.5 sm:p-2 pb-1.5 overflow-hidden flex flex-col min-h-0' : 'p-3 sm:p-6 pb-6 lg:pb-8 overflow-y-auto'} relative`}>
          {currentView === 'dashboard' && (
            <Dashboard
              config={config}
              items={items}
              ledgers={ledgers}
              onNavigate={view => navigateTo(view)}
              onDrillStock={(code, from, to) => setDrillModal({ type: 'stock', targetId: code, fromDate: from, toDate: to })}
              onDrillLedger={(name, from, to) => setDrillModal({ type: 'ledger', targetId: name, fromDate: from, toDate: to })}
              onDrillGroup={(grp, from, to) => setDrillModal({ type: 'group', targetId: grp, fromDate: from, toDate: to })}
              onDrillVoucher={(refNo, from, to) => setDrillModal({ type: 'voucher', targetId: refNo, fromDate: from, toDate: to })}
              onDrillReport={target => {
                const t = { ...target, timestamp: Date.now() };
                setReportTarget(t);
                navigateTo('reports', t);
              }}
              isActive={currentView === 'dashboard' && !isAnyModalOpen}
            />
          )}

          {/* POS Billing is rendered and kept active to preserve cart state */}
          <div className={currentView === 'pos' ? 'flex-1 min-h-0 flex flex-col h-full' : 'hidden'}>
            <POSBilling
              config={config}
              items={items}
              ledgers={ledgers}
              heldBills={heldBills}
              selectedVoucherType={selectedSaleVoucherType}
              onOpenVoucherTypeModal={() => handleOpenPOSBilling()}
              onDataRefresh={refreshData}
              initialVoucherTarget={voucherTarget}
              onBack={navigateBack}
              onOpenNewItemModal={(onSelect) => {
                setQuickItemModalProps({isOpen: true, onSelect});
              }}
              onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Debtors', onSelect})}
              onEditLedger={name => {
                setOpenLedgerModalGroup('Sundry Debtors');
                navigateTo('masters');
              }}
              isActive={currentView === 'pos' && !isAnyModalOpen}
            />
          </div>

          {config.EnableNormalSale !== 'false' && (
            <div className={currentView === 'normalsale' ? 'flex-1 min-h-0 flex flex-col h-full w-full' : 'hidden'}>
              <SalesInvoiceEntry
                config={config}
                items={items}
                ledgers={ledgers}
                onDataRefresh={refreshData}
                initialVoucherTarget={voucherTarget}
                onBack={navigateBack}
                onOpenNewItemModal={(onSelect) => setQuickItemModalProps({isOpen: true, onSelect})}
                onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Debtors', onSelect})}
                isActive={currentView === 'normalsale' && !isAnyModalOpen}
              />
            </div>
          )}
          <div className={currentView === 'purchase' ? 'flex-1 min-h-0 flex flex-col h-full w-full' : 'hidden'}>
            <PurchaseEntry
              config={config}
              items={items}
              ledgers={ledgers}
              onDataRefresh={refreshData}
              initialVoucherTarget={voucherTarget}
              onBack={navigateBack}
              onOpenNewItemModal={(onSelect) => setQuickItemModalProps({isOpen: true, onSelect})}
              onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Creditors', onSelect})}
              onPrintPurchaseBarcodes={queue => {
                setBarcodeQueueInitial(queue);
                navigateTo('barcode');
              }}
              isActive={currentView === 'purchase' && !isAnyModalOpen}
            />
          </div>

          {currentView === 'vouchers' && (
            <Vouchers
              config={config}
              items={items}
              ledgers={ledgers}
              onDataRefresh={refreshData}
              onNavigateTo={navigateTo}
              onBack={navigateBack}
              onOpenNewItemModal={(onSelect) => setQuickItemModalProps({isOpen: true, onSelect})}
              onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Creditors', onSelect})}
              initialVoucherTarget={voucherTarget}
              isActive={currentView === 'vouchers' && !isAnyModalOpen}
            />
          )}

          {currentView === 'masters' && (
            <Masters
              config={config}
              items={items}
              itemGroups={itemGroups}
              units={units}
              unitGroups={unitGroups}
              categories={categories}
              ledgers={ledgers}
              ledgerGroups={ledgerGroups}
              onDataRefresh={refreshData}
              openItemModalCode={openItemModalCode}
              openLedgerModalGroup={openLedgerModalGroup}
              isActive={currentView === 'masters' && !isAnyModalOpen}
            />
          )}

          {currentView === 'barcode' && (
            <BarcodePrinting config={config} items={items} initialQueue={barcodeQueueInitial} />
          )}

          {currentView === 'payroll' && config.EnablePayroll !== 'false' && (
            <Payroll config={config} ledgers={ledgers} onDataRefresh={refreshData} />
          )}

          {currentView === 'assets' && config.EnableAssetManagement !== 'false' && (
            <AssetManagementModule config={config} ledgers={ledgers} onDataRefresh={refreshData} />
          )}

          {currentView === 'reports' && (
            <Reports
              config={config}
              items={items}
              ledgers={ledgers}
              initialReportTarget={reportTarget}
              onBack={navigateBack}
              onDrillVoucher={(refNo, from, to) => setDrillModal({ type: 'voucher', targetId: refNo, fromDate: from, toDate: to })}
              onDrillLedger={(name, from, to) => setDrillModal({ type: 'ledger', targetId: name, fromDate: from, toDate: to })}
              onDrillStock={(code, from, to) => setDrillModal({ type: 'stock', targetId: code, fromDate: from, toDate: to })}
              onDrillItemProfit={(code, from, to) => setDrillModal({ type: 'item-profit', targetId: code, fromDate: from, toDate: to })}
              onDrillGroup={(cat, from, to) => setDrillModal({ type: 'group', targetId: cat, fromDate: from, toDate: to })}
              isActive={currentView === 'reports' && !isAnyModalOpen}
            />
          )}

          {currentView === 'bankrecon' && <BankReconciliation />}

          {currentView === 'settings' && (
            <SettingsView
              config={config}
              ledgers={ledgers}
              onDataRefresh={refreshData}
              isActive={currentView === 'settings' && !isAnyModalOpen}
            />
          )}
          <QuickLedgerModal
          isOpen={quickLedgerModalProps.isOpen}
          initialGroup={quickLedgerModalProps.group}
          config={config}
          onClose={() => setQuickLedgerModalProps(prev => ({...prev, isOpen: false}))}
          onSave={(ledger) => {
            const res = saveLedger(ledger);
            if (res && res.ok === false) {
              alert(res.error || 'Failed to save ledger');
              return;
            }
            refreshData();
            setQuickLedgerModalProps(prev => ({...prev, isOpen: false}));
            if (quickLedgerModalProps.onSelect) {
              quickLedgerModalProps.onSelect(ledger['Ledger Name']);
            }
          }}
        />
        <QuickItemModal
          isOpen={quickItemModalProps.isOpen}
          config={config}
          onClose={() => setQuickItemModalProps(prev => ({...prev, isOpen: false}))}
          onSave={(item) => {
            refreshData();
            setQuickItemModalProps(prev => ({...prev, isOpen: false}));
            if (quickItemModalProps.onSelect) {
              quickItemModalProps.onSelect(item);
            }
          }}
        />
        </main>
      </div>

      {showGlobalLedgerSearch && (
        <QuickLedgerSearchModal
          ledgers={ledgers}
          onClose={() => setShowGlobalLedgerSearch(false)}
          onSelect={(ledgerName) => {
            setShowGlobalLedgerSearch(false);
            setDrillModal({ type: 'ledger', targetId: ledgerName });
          }}
        />
      )}

      {/* Universal Drilldown Modal */}
      <DrillModal
        config={config}
        type={drillModal.type}
        targetId={drillModal.targetId}
        initialHistory={drillInitialHistory}
        fromDate={drillModal.fromDate}
        toDate={drillModal.toDate}
        onClose={() => {
          setDrillModal({ type: null, targetId: null, fromDate: undefined, toDate: undefined });
          setDrillInitialHistory([]);
        }}
        onRefresh={refreshData}
        onDrillVoucher={(refNo, from, to) => setDrillModal({ type: 'voucher', targetId: refNo, fromDate: from || drillModal.fromDate, toDate: to || drillModal.toDate })}
        onDrillLedger={(name, from, to) => setDrillModal({ type: 'ledger', targetId: name, fromDate: from || drillModal.fromDate, toDate: to || drillModal.toDate })}
        onDrillStock={(code, from, to) => setDrillModal({ type: 'stock', targetId: code, fromDate: from || drillModal.fromDate, toDate: to || drillModal.toDate })}
        onOpenVoucherInEntry={(refNo, vType, currentActive, currentHistory) => {
          if (currentActive) {
            setDrillReturnContext({
              activeDrill: currentActive,
              drillHistory: currentHistory || [],
              fromView: currentView
            });
          }
          setDrillModal({ type: null, targetId: null });
          setDrillInitialHistory([]);
          setVoucherTarget({ voucherNo: refNo, timestamp: Date.now() });
          if (vType === 'INV' || vType === 'S') {
            const details = getVoucherDetails(refNo);
            const inv = details?.header as any;
            const isNormalSale = inv && inv.isPOS !== true && (
              inv.isPOS === false || 
              inv.voucherTypeId === 'VT-SALE-NORMAL' || 
              inv.invoiceNo?.startsWith('SAL-') || 
              inv.invoiceNo?.startsWith('INV-B2B-') || 
              Boolean(inv.orderNo) || 
              Boolean(inv.deliveryNoteNo) || 
              (Boolean(inv.termsAndConditions) && !inv.invoiceNo?.startsWith('POS-'))
            );
            if (isNormalSale && config.EnableNormalSale !== 'false') {
              navigateTo('normalsale', undefined, true);
            } else {
              navigateTo('pos', undefined, true);
            }
          } else if (vType === 'PUR') {
            navigateTo('purchase', undefined, true);
          } else {
            navigateTo('vouchers', undefined, true);
          }
        }}
      />

      {/* Trash & Recycle Bin Modal */}
      <TrashModal
        isOpen={showTrashModal}
        onClose={() => setShowTrashModal(false)}
        onDataChanged={refreshData}
        currencySymbol={config.CurrencySymbol}
      />

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onDataCleared={refreshData}
      />
    </div>
  );
}
