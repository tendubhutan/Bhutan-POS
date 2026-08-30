import React from 'react';
import { Config } from '../../types';

export const AssetTransfers: React.FC<{config: Config}> = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
      <h2 className="text-xl font-bold text-slate-800 mb-2">Asset Transfers</h2>
      <p>Transfer fixed assets between custodians, locations, and departments.</p>
    </div>
  );
};
