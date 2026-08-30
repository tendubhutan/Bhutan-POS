import React, { useState } from 'react';
import { 
  Building, 
  List, 
  PlusCircle, 
  Tags, 
  Users as UsersIcon, 
  ArrowRightLeft, 
  Calculator, 
  Trash2,
  FileText,
  Activity
} from 'lucide-react';
import { Config, Ledger } from '../../types';

import { AssetRegister } from './AssetRegister';
import { AssetCategories } from './AssetCategories';
import { Custodians } from './Custodians';
import { AssetTransfers } from './AssetTransfers';
import { Depreciation } from './Depreciation';
import { Disposal } from './Disposal';
import { AssetReports } from './AssetReports';
import { AssetForm } from './AssetForm';

interface AssetManagementModuleProps {
  config: Config;
  ledgers: Ledger[];
  onDataRefresh: () => void;
}

export type AssetTab = 
  | 'dashboard'
  | 'register'
  | 'add'
  | 'edit'
  | 'categories'
  | 'custodians'
  | 'transfers'
  | 'depreciation'
  | 'disposal'
  | 'reports';

export const AssetManagementModule: React.FC<AssetManagementModuleProps> = ({
  config,
  ledgers,
  onDataRefresh
}) => {
  const [activeTab, setActiveTab] = useState<AssetTab>('register');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  const handleEditAsset = (assetId: string) => {
    setEditingAssetId(assetId);
    setActiveTab('edit');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'register':
        return <AssetRegister onEditAsset={handleEditAsset} config={config} />;
      case 'add':
        return <AssetForm 
                 mode="create" 
                 config={config} 
                 ledgers={ledgers} 
                 onSave={() => setActiveTab('register')} 
                 onCancel={() => setActiveTab('register')} 
               />;
      case 'edit':
        return <AssetForm 
                 mode="edit" 
                 assetId={editingAssetId || undefined} 
                 config={config} 
                 ledgers={ledgers} 
                 onSave={() => setActiveTab('register')} 
                 onCancel={() => setActiveTab('register')} 
               />;
      case 'categories':
        return <AssetCategories ledgers={ledgers} config={config} />;
      case 'custodians':
        return <Custodians config={config} />;
      case 'transfers':
        return <AssetTransfers config={config} />;
      case 'depreciation':
        return <Depreciation config={config} onDataRefresh={onDataRefresh} />;
      case 'disposal':
        return <Disposal config={config} ledgers={ledgers} onDataRefresh={onDataRefresh} />;
      case 'reports':
        return <AssetReports config={config} />;
      default:
        return <AssetRegister onEditAsset={handleEditAsset} config={config} />;
    }
  };

  const tabs = [
    { id: 'register', label: 'Asset Register', icon: List },
    { id: 'add', label: 'Add Asset', icon: PlusCircle },
    { id: 'categories', label: 'Categories', icon: Tags },
    { id: 'custodians', label: 'Custodians', icon: UsersIcon },
    { id: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
    { id: 'depreciation', label: 'Depreciation', icon: Calculator },
    { id: 'disposal', label: 'Disposal / Sale', icon: Trash2 },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top Navigation */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          <div className="flex items-center gap-2 mr-4 text-slate-800 font-bold bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Building className="h-4 w-4 text-indigo-600" />
            <span>Asset Management</span>
          </div>
          
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id || (tab.id === 'add' && activeTab === 'edit');
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AssetTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-200' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
