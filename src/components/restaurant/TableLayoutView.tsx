import React, { useState, useEffect } from 'react';
import { RestaurantTable, TableStatus, RestaurantOrder, RestaurantStationRole } from '../../types/restaurant';
import { getTables, saveTables, getRestaurantOrders, clearTableOrder, transferTableOrder, createSubTableGroup, cancelRestaurantOrderItem, replaceRestaurantOrderItem, cancelEntireTableOrder } from '../../services/restaurantService';
import { Users, Utensils, Clock, CheckCircle2, AlertCircle, Plus, Search, Layers, ChevronRight, X, Printer, ArrowRight, ArrowRightLeft, GitFork, AlertTriangle, Smartphone, ShieldCheck, ShoppingBag, Receipt, Trash2 } from 'lucide-react';
import { Item } from '../../types';

interface TableLayoutViewProps {
  onSelectTableForOrder: (table: RestaurantTable, existingOrder?: RestaurantOrder) => void;
  onOpenKDS?: () => void;
  onOpenWaiterPad?: () => void;
  onOpenQRGenerator?: () => void;
  currencySymbol?: string;
  items?: Item[];
  activeStationRole?: RestaurantStationRole;
  onStationRoleChange?: (role: RestaurantStationRole) => void;
}

export const TableLayoutView: React.FC<TableLayoutViewProps> = ({
  onSelectTableForOrder,
  onOpenKDS,
  onOpenWaiterPad,
  onOpenQRGenerator,
  currencySymbol = 'Nu.',
  items = [],
  activeStationRole = 'billing',
  onStationRoleChange
}) => {
  const [tables, setTables] = useState<RestaurantTable[]>(() => getTables());
  const [orders, setOrders] = useState<RestaurantOrder[]>(() => getRestaurantOrders());
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddTableModal, setShowAddTableModal] = useState<boolean>(false);

  // Selected table action drawer / modal
  const [selectedTableForActions, setSelectedTableForActions] = useState<RestaurantTable | null>(null);

  // Move Table State
  const [moveFromTable, setMoveFromTable] = useState<RestaurantTable | null>(null);
  const [targetMoveTableId, setTargetMoveTableId] = useState<string>('');

  // Split Table State
  const [splitParentTable, setSplitParentTable] = useState<RestaurantTable | null>(null);

  // Quick Cancel / Void Modal
  const [tableToVoid, setTableToVoid] = useState<RestaurantTable | null>(null);
  const [voidReason, setVoidReason] = useState<string>('Customer left / cancelled');

  const [newTableName, setNewTableName] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
  const [newTableArea, setNewTableArea] = useState<string>('Main Hall');

  const refreshData = () => {
    setTables(getTables());
    setOrders(getRestaurantOrders());
  };

  useEffect(() => {
    refreshData();
    const handleUpdate = () => refreshData();
    window.addEventListener('restaurant_data_updated', handleUpdate);
    return () => window.removeEventListener('restaurant_data_updated', handleUpdate);
  }, []);

  const areas = Array.from(new Set(tables.map(t => t.area || 'Main Hall')));

  const filteredTables = tables.filter(t => {
    if (selectedAreaFilter !== 'all' && t.area !== selectedAreaFilter) return false;
    if (searchQuery.trim() && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return { label: 'FREE', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' };
      case 'occupied':
        return { label: 'SEATED', bg: 'bg-blue-50 text-blue-700 border-blue-300', dot: 'bg-blue-500' };
      case 'kot_sent':
        return { label: 'KITCHEN PREP', bg: 'bg-amber-50 text-amber-700 border-amber-300', dot: 'bg-amber-500' };
      case 'ready':
        return { label: 'FOOD READY', bg: 'bg-purple-50 text-purple-700 border-purple-300', dot: 'bg-purple-500' };
      case 'billed':
        return { label: 'BILLED', bg: 'bg-orange-50 text-orange-700 border-orange-300', dot: 'bg-orange-500' };
      default:
        return { label: 'FREE', bg: 'bg-slate-50 text-slate-700 border-slate-300', dot: 'bg-slate-500' };
    }
  };

  const handleAddNewTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;
    const newId = `T-${Date.now().toString().slice(-4)}`;
    const newTable: RestaurantTable = {
      id: newId,
      name: newTableName.trim(),
      capacity: newTableCapacity,
      area: newTableArea.trim() || 'Main Hall',
      status: 'available'
    };
    const updated = [...tables, newTable];
    saveTables(updated);
    setTables(updated);
    setShowAddTableModal(false);
    setNewTableName('');
  };

  const handleConfirmVoidTable = () => {
    if (!tableToVoid) return;
    cancelEntireTableOrder(tableToVoid.id, voidReason, true, 'Manager');
    setTableToVoid(null);
    refreshData();
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar & Station View Switcher */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Restaurant Floor Plan &amp; Table Billing</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Live Dining Grid
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">Select a table to take orders, issue KOTs, add extra running items, or settle bills</p>
          </div>
        </div>

        {/* Station Actions Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {onOpenKDS && (
            <button
              onClick={onOpenKDS}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Kitchen Order Display Screen"
            >
              <Utensils className="h-3.5 w-3.5 text-amber-400" />
              <span>Kitchen Screen (KDS)</span>
            </button>
          )}

          {onOpenWaiterPad && (
            <button
              onClick={onOpenWaiterPad}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Waiter Mobile Order Pad"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Waiter Order Pad</span>
            </button>
          )}

          {onOpenQRGenerator && (
            <button
              onClick={onOpenQRGenerator}
              className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Print Table QR Codes"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Table QR Codes</span>
            </button>
          )}

          <button
            onClick={() => setShowAddTableModal(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* Area Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedAreaFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
              selectedAreaFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Sections ({tables.length})
          </button>
          {areas.map(area => {
            const count = tables.filter(t => t.area === area).length;
            return (
              <button
                key={area}
                onClick={() => setSelectedAreaFilter(area)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
                  selectedAreaFilter === area
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {area} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search table number..."
            className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table Visual Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {filteredTables.map(table => {
          const badge = getStatusBadge(table.status);
          const order = orders.find(o => o.tableId === table.id && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'ready' || o.status === 'billed'));

          return (
            <div
              key={table.id}
              onClick={() => onSelectTableForOrder(table, order)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative group flex flex-col justify-between min-h-[150px] shadow-2xs hover:shadow-md ${
                table.status === 'ready'
                  ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/30'
                  : table.status === 'kot_sent'
                  ? 'bg-amber-50/70 border-amber-400'
                  : table.status === 'occupied'
                  ? 'bg-blue-50/70 border-blue-400'
                  : table.status === 'billed'
                  ? 'bg-orange-50/80 border-orange-400'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Header Badge */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  {table.area || 'Main Hall'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border flex items-center gap-1 ${badge.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
              </div>

              {/* Table Name & Capacity */}
              <div className="my-1">
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>{table.name}</span>
                  {order && order.kotSequence && order.kotSequence > 1 && (
                    <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-900 text-[9px] font-black border border-indigo-200">
                      {order.kotSequence} KOTs
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                  <Users className="h-3 w-3 text-slate-400" />
                  <span>Seats: {table.capacity}</span>
                  {table.waiterName && <span className="ml-1 text-slate-700 font-bold">• {table.waiterName}</span>}
                </p>
              </div>

              {/* Order summary if occupied */}
              {order ? (
                <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {order.items.filter(i => i.status !== 'cancelled').length} Items
                      </span>
                      <div className="font-extrabold text-slate-900 leading-tight">
                        {currencySymbol} {order.grandTotal.toFixed(2)}
                      </div>
                    </div>
                    <span className="p-1 rounded-lg bg-blue-600 text-white group-hover:scale-110 transition shrink-0">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>

                  {/* Quick Action Buttons for Occupied Tables */}
                  <div className="flex items-center gap-1 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenWaiterPad) {
                          onOpenWaiterPad();
                        } else {
                          onSelectTableForOrder(table, order);
                        }
                      }}
                      className="px-1.5 py-0.5 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-[9px] transition flex items-center gap-0.5 border border-blue-300"
                      title="Add extra order / running items"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      <span>Extra KOT</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoveFromTable(table);
                        const available = tables.find(t => t.id !== table.id && t.status === 'available');
                        if (available) setTargetMoveTableId(available.id);
                      }}
                      className="px-1.5 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[9px] transition flex items-center gap-0.5 border border-amber-300"
                      title="Move this order to another table"
                    >
                      <ArrowRightLeft className="h-2.5 w-2.5 text-amber-700" />
                      <span>Move</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTableToVoid(table);
                      }}
                      className="px-1.5 py-0.5 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-[9px] transition flex items-center gap-0.5 border border-rose-300"
                      title="Cancel entire order on this table"
                    >
                      <Trash2 className="h-2.5 w-2.5 text-rose-700" />
                      <span>Void</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Tap to start order</span>
                  <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add New Dining Table</h3>
              <button onClick={() => setShowAddTableModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewTable} className="space-y-3.5 mt-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Table Name / Number</label>
                <input
                  type="text"
                  required
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                  placeholder="e.g. Table 9, VIP Cabin 3"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Seating Capacity</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newTableCapacity}
                  onChange={e => setNewTableCapacity(parseInt(e.target.value) || 2)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Floor Section / Area</label>
                <input
                  type="text"
                  value={newTableArea}
                  onChange={e => setNewTableArea(e.target.value)}
                  placeholder="e.g. Main Hall, Roof Top, VIP"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Table Modal */}
      {moveFromTable && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                <span>Move Order from {moveFromTable.name}</span>
              </h3>
              <button onClick={() => setMoveFromTable(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 mt-3 text-xs">
              <p className="text-slate-600 font-medium">Select target destination table to move running order &amp; KOTs:</p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Table:</label>
                <select
                  value={targetMoveTableId}
                  onChange={e => setTargetMoveTableId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold text-slate-900 bg-white outline-none"
                >
                  {tables
                    .filter(t => t.id !== moveFromTable.id && t.status === 'available')
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.area})
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMoveFromTable(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!targetMoveTableId) return;
                    const res = transferTableOrder(moveFromTable.id, targetMoveTableId);
                    if (!res.success) {
                      alert(res.message);
                    } else {
                      setMoveFromTable(null);
                      refreshData();
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black cursor-pointer shadow-md"
                >
                  Confirm Table Move
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split Table Modal */}
      {splitParentTable && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <GitFork className="h-4 w-4 text-purple-600" />
                <span>Split {splitParentTable.name} for 2 Groups</span>
              </h3>
              <button onClick={() => setSplitParentTable(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 mt-3 text-xs">
              <p className="text-slate-600 font-medium">
                Host multiple separate parties/groups sitting at <strong className="text-slate-900">{splitParentTable.name}</strong> with independent running orders and separate bills.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSplitParentTable(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    createSubTableGroup(splitParentTable.id, 'Group A');
                    createSubTableGroup(splitParentTable.id, 'Group B');
                    setSplitParentTable(null);
                    refreshData();
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black cursor-pointer shadow-md"
                >
                  Create Sub-Tables (Group A &amp; B)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Table Order Modal */}
      {tableToVoid && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <Trash2 className="h-4 w-4 text-rose-600" />
                <span>Cancel Order on {tableToVoid.name}</span>
              </h3>
              <button onClick={() => setTableToVoid(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-slate-600">
              Are you sure you want to cancel the entire active order for <strong>{tableToVoid.name}</strong>? This will release the table and alert the kitchen.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Reason for Cancellation</label>
              <input
                type="text"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g. Guests left, cancelled order"
                className="w-full h-8 rounded-xl border border-slate-300 px-3 text-xs font-medium text-slate-900 outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTableToVoid(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmVoidTable}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer shadow-md"
              >
                Void &amp; Release Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

