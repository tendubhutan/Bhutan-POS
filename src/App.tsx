import React, { useState, useEffect } from 'react';
import { getInitialData, getVoucherTypes, saveLedger, getVoucherDetails } from './services/storageService';
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
import { TrashModal } from './components/TrashModal';
import { BulkDeleteModal } from './components/BulkDeleteModal';

interface DrillReturnContext {
  activeDrill: { type: 'group' | 'stock' | 'ledger' | 'voucher'; targetId: string; fromDate?: string; toDate?: string };
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
    type: 'group' | 'stock' | 'ledger' | 'voucher' | null;
    targetId: string | null;
    fromDate?: string;
    toDate?: string;
  }>({ type: null, targetId: null });
  const [drillInitialHistory, setDrillInitialHistory] = useState<TargetState[]>([]);
  const [drillReturnContext, setDrillReturnContext] = useState<DrillReturnContext | null>(null);

  // Firebase status
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'syncing' | 'offline' | 'error'>('syncing');
  const [firebaseMessage, setFirebaseMessage] = useState<string>('');

  // Pre-POS Voucher Type Selection State
  const [selectedSaleVoucherType, setSelectedSaleVoucherType] = useState<VoucherType | null>(null);

  // Sequential Navigation Functions
  const navigateTo = (view: string, reportTargetOverride?: any) => {
    if (view === 'trash') {
      setShowTrashModal(true);
      return;
    }
    if (view === 'pos') {
      handleOpenPOSBilling();
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

  const handleOpenPOSBilling = () => {
    setSelectedSaleVoucherType(null);
    setCurrentView('pos');
    setViewHistory(prev => (prev[prev.length - 1] === 'pos' ? prev : [...prev, 'pos']));
    setIsMobileOpen(false);
  };

  const navigateBack = () => {
    // 1. If drilldown modal is open, dispatch app:back so DrillModal steps back sequentially
    if (drillModal?.type) {
      const backEvent = new CustomEvent('app:back', { cancelable: true });
      window.dispatchEvent(backEvent);
      return;
    }

    // 2. Allow active sub-screen or modal to handle back navigation first
    const backEvent = new CustomEvent('app:back', { cancelable: true });
    const notPrevented = window.dispatchEvent(backEvent);
    if (!notPrevented) {
      return;
    }

    // 3. If we came from a Drilldown (via Open in Entry), restore the DrillModal with its exact history
    if (drillReturnContext) {
      const { activeDrill, drillHistory, fromView } = drillReturnContext;
      setDrillReturnContext(null);
      setCurrentView(fromView);
      setDrillInitialHistory(drillHistory);
      setDrillModal({
        type: activeDrill.type,
        targetId: activeDrill.targetId,
        fromDate: activeDrill.fromDate,
        toDate: activeDrill.toDate
      });
      return;
    }

    // 4. Pop standard view history
    setViewHistory(prev => {
      if (prev.length > 1) {
        const updated = [...prev];
        updated.pop(); // Pop current
        const targetView = updated[updated.length - 1] || 'dashboard';
        setCurrentView(targetView);
        return updated;
      } else {
        if (currentView !== 'dashboard') {
          setCurrentView('dashboard');
        }
        return ['dashboard'];
      }
    });
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
          // parse the report target
          const r = e.detail.report?.toLowerCase() || '';
          if (!r && !e.detail.ledgerName && !e.detail.category) {
            setReportTarget(null);
            navigateTo('reports', null);
          } else {
            const target: any = { timestamp: Date.now() };
            
            if (e.detail.fromDate) target.fromDate = e.detail.fromDate;
            if (e.detail.toDate) target.toDate = e.detail.toDate;

            if (r.includes('sales')) target.category = 'daily';
            else if (r.includes('stock')) target.category = 'inv';
            else if (r.includes('gst')) target.category = 'gst';
            else if (r.includes('ledger')) { target.category = 'fin'; target.finSubTab = 'LED'; target.ledgerName = e.detail.ledgerName; }
            else if (r.includes('trial')) { target.category = 'fin'; target.finSubTab = 'TB'; }
            else if (r.includes('profit')) { target.category = 'fin'; target.finSubTab = 'PNL'; }
            else if (r.includes('balance')) { target.category = 'fin'; target.finSubTab = 'BS'; }
            else if (e.detail.category) target.category = e.detail.category;
            
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

    window.addEventListener('app:navigate', handleAppNavigate);
    window.addEventListener('app:openTrash', handleOpenTrash);
    window.addEventListener('app:openBulkDelete', handleOpenBulkDelete);
    window.addEventListener('app:openVoucher', handleOpenVoucher);

    return () => {
      unsubStatus();
      unsubFirestore();
      window.removeEventListener('app:navigate', handleAppNavigate);
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

      // Change Report Period Shortcut (Alt+F2 / Alt+D)
      if (e.altKey && (e.key === 'F2' || e.code === 'F2' || rawKey === 'd' || e.code === 'KeyD')) {
        e.preventDefault();
        e.stopPropagation();
        const t = { category: 'daily' as const, openChangePeriod: true, timestamp: Date.now() };
        setReportTarget(t);
        navigateTo('reports', t);
        window.dispatchEvent(new CustomEvent('app:open-change-period'));
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
          const t = { category: 'fin' as const, finSubTab: 'LED' as const, openQuickLedgerSearch: true, timestamp: Date.now() };
          setReportTarget(t);
          navigateTo('reports', t);
          window.dispatchEvent(new CustomEvent('app:open-ledger-search'));
          return;
        }
      }

      // Escape key: step back in navigation history until reaching Main Menu
      if (e.key === 'Escape') { if (e.defaultPrevented) return;
        if (e.defaultPrevented) return;

        // 1. If drilldown modal is open, dispatch app:back so DrillModal steps back sequentially
        if (drillModal?.type) {
          e.preventDefault();
          const backEvent = new CustomEvent('app:back', { cancelable: true });
          window.dispatchEvent(backEvent);
          return;
        }

        // 2. Dispatch app:back event so active screen/modal/sub-flow handles step-back first
        const backEvent = new CustomEvent('app:back', { cancelable: true });
        const notPrevented = window.dispatchEvent(backEvent);
        if (!notPrevented) {
          e.preventDefault();
          return;
        }

        // 3. If typing inside an input/select/textarea and not handled by modal, blur it
        if (isInput) {
          (activeEl as HTMLElement)?.blur?.();
          e.preventDefault();
          return;
        }

        // 4. Navigate back to previous screen in history stack or restore drilldown context
        if (drillReturnContext || currentView !== 'dashboard' || viewHistory.length > 1) {
          e.preventDefault();
          navigateBack();
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
          onNavigateBack={navigateBack}
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
              onDrillStock={code => setDrillModal({ type: 'stock', targetId: code })}
              onDrillLedger={name => setDrillModal({ type: 'ledger', targetId: name })}
              onDrillGroup={grp => setDrillModal({ type: 'group', targetId: grp })}
              onDrillVoucher={refNo => setDrillModal({ type: 'voucher', targetId: refNo })}
              onDrillReport={target => {
                const t = { ...target, timestamp: Date.now() };
                setReportTarget(t);
                navigateTo('reports', t);
              }}
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
              onOpenNewItemModal={(onSelect) => {
                setQuickItemModalProps({isOpen: true, onSelect});
              }}
              onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Debtors', onSelect})}
              onEditLedger={name => {
                setOpenLedgerModalGroup('Sundry Debtors');
                navigateTo('masters');
              }}
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
                onOpenNewItemModal={(onSelect) => setQuickItemModalProps({isOpen: true, onSelect})}
                onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Debtors', onSelect})}
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
              onOpenNewItemModal={(onSelect) => setQuickItemModalProps({isOpen: true, onSelect})}
              onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Creditors', onSelect})}
              onPrintPurchaseBarcodes={queue => {
                setBarcodeQueueInitial(queue);
                navigateTo('barcode');
              }}
            />
          </div>

          {currentView === 'vouchers' && (
            <Vouchers
              config={config}
              items={items}
              ledgers={ledgers}
              onDataRefresh={refreshData}
              onNavigateTo={navigateTo}
              onOpenNewItemModal={(onSelect) => setQuickItemModalProps({isOpen: true, onSelect})}
              onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Creditors', onSelect})}
              initialVoucherTarget={voucherTarget}
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
              onDrillVoucher={refNo => setDrillModal({ type: 'voucher', targetId: refNo })}
              onDrillLedger={name => setDrillModal({ type: 'ledger', targetId: name })}
              onDrillStock={code => setDrillModal({ type: 'stock', targetId: code })}
              onDrillGroup={(cat, from, to) => setDrillModal({ type: 'group', targetId: cat, fromDate: from, toDate: to })}
            />
          )}

          {currentView === 'bankrecon' && <BankReconciliation />}

          {currentView === 'settings' && (
            <SettingsView
              config={config}
              ledgers={ledgers}
              onDataRefresh={refreshData}
            />
          )}
          <QuickLedgerModal
          isOpen={quickLedgerModalProps.isOpen}
          initialGroup={quickLedgerModalProps.group}
          config={config}
          onClose={() => setQuickLedgerModalProps(prev => ({...prev, isOpen: false}))}
          onSave={(ledger) => {
            saveLedger(ledger);
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

      {/* Universal Drilldown Modal */}
      <DrillModal
        config={config}
        type={drillModal.type}
        targetId={drillModal.targetId}
        initialHistory={drillInitialHistory}
        fromDate={drillModal.fromDate}
        toDate={drillModal.toDate}
        onClose={() => {
          setDrillModal({ type: null, targetId: null });
          setDrillInitialHistory([]);
        }}
        onRefresh={refreshData}
        onDrillVoucher={refNo => setDrillModal({ type: 'voucher', targetId: refNo })}
        onDrillLedger={name => setDrillModal({ type: 'ledger', targetId: name })}
        onDrillStock={code => setDrillModal({ type: 'stock', targetId: code })}
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
            const isNormalSale = inv && (
              inv.isPOS === false || 
              inv.voucherTypeId === 'VT-SALE-NORMAL' || 
              inv.invoiceNo?.startsWith('SAL-') || 
              inv.invoiceNo?.startsWith('INV-B2B-') || 
              Boolean(inv.orderNo) || 
              Boolean(inv.deliveryNoteNo) || 
              Boolean(inv.termsAndConditions)
            );
            if (isNormalSale && config.EnableNormalSale !== 'false') {
              navigateTo('normalsale');
            } else {
              navigateTo('pos');
            }
          } else if (vType === 'PUR') {
            navigateTo('purchase');
          } else {
            navigateTo('vouchers');
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
