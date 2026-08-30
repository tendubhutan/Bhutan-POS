import React from 'react';
import { Config } from '../../types';
import { FileText } from 'lucide-react';

export const AssetReports: React.FC<{config: Config}> = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
      <FileText className="h-12 w-12 text-slate-300 mb-4" />
      <h2 className="text-xl font-bold text-slate-800 mb-2">Asset Reports & PPE Schedule</h2>
      <p>View the Fixed Asset Register, PPE Schedule, and Depreciation Reports.</p>
    </div>
  );
};
