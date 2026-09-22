import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Radio,
  Server,
  Monitor,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Zap,
  Layers,
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  getLanHubConfig,
  saveLanHubConfig,
  getDispatchedLogs,
  getActiveTerminalsList,
  requestLanConsecutiveNumber,
  LanHubConfig,
  DispatchedNumberLog,
  LanTerminal
} from '../services/localLanHubService';
import { getDeviceCounterId } from '../services/storageService';

interface LocalLanHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocalLanHubModal: React.FC<LocalLanHubModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<LanHubConfig>(() => getLanHubConfig());
  const [terminals, setTerminals] = useState<LanTerminal[]>(() => getActiveTerminalsList());
  const [logs, setLogs] = useState<DispatchedNumberLog[]>(() => getDispatchedLogs());
  const [testResult, setTestResult] = useState<{ number: number; invoiceNo: string; terminal: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [hubStatus, setHubStatus] = useState<'connected' | 'connecting' | 'standalone'>('connecting');
  const [serverInfo, setServerInfo] = useState<any>(null);

  const deviceId = getDeviceCounterId();

  const refreshHubData = async () => {
    try {
      const targetHost = config.hostUrl ? config.hostUrl.replace(/\/+$/, '') : '';
      const res = await fetch(`${targetHost}/api/lan-hub/info`);
      if (res.ok) {
        const data = await res.json();
        setServerInfo(data);
        setHubStatus('connected');
        if (data.recentLogs) {
          setLogs(data.recentLogs);
        }
      } else {
        setHubStatus('standalone');
      }
    } catch {
      setHubStatus('standalone');
    }
    setTerminals(getActiveTerminalsList());
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshHubData();
    const interval = setInterval(refreshHubData, 4000);
    return () => clearInterval(interval);
  }, [isOpen, config.hostUrl]);

  if (!isOpen) return null;

  const handleTestDispatch = async (simulatedTerminalId: string, name: string) => {
    setIsTesting(true);
    try {
      const res = await requestLanConsecutiveNumber({
        isPOS: true,
        terminalId: simulatedTerminalId,
        terminalName: name
      });
      if (res.ok) {
        setTestResult({
          number: res.number || 0,
          invoiceNo: res.invoiceNo,
          terminal: `${name} (${simulatedTerminalId})`
        });
        refreshHubData();
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl border border-white/20 backdrop-blur-md">
              <Radio className="h-6 w-6 text-indigo-100 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Shop WiFi Hub (LAN Mode)</h2>
                <span className="px-2 py-0.5 bg-emerald-400 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider">
                  Solution 2
                </span>
              </div>
              <p className="text-xs text-indigo-100">
                100% consecutive numbering over shop WiFi router without external internet.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
          {/* Status Bar */}
          <div className="p-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3.5 w-3.5 rounded-full ${hubStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              <div>
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>{hubStatus === 'connected' ? 'Shop LAN Dispatcher Online' : 'Local Fallback Mode Active'}</span>
                  <span className="text-[10px] font-mono text-indigo-600 font-normal">
                    (This PC: {deviceId})
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {hubStatus === 'connected'
                    ? 'All 4 counters and accountants get consecutive numbers in <10ms.'
                    : 'Running in collision-free terminal identifier fallback.'}
                </div>
              </div>
            </div>
            <button
              onClick={refreshHubData}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl border border-slate-200 transition cursor-pointer"
              title="Refresh LAN status"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* How It Works Diagram */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-inner space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
              <span className="flex items-center gap-1">
                <Wifi className="h-3.5 w-3.5" />
                Zero-Internet Local Dispatch Flow
              </span>
              <span className="text-[10px] text-slate-400 font-mono">LAN Port :3000</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="p-2 bg-slate-800 rounded-xl border border-slate-700">
                <div className="font-bold text-amber-300">Counter 1</div>
                <div className="text-[10px] text-slate-400">Prints bill ➔</div>
                <div className="font-mono font-black text-emerald-400 mt-1">POS-1001</div>
              </div>
              <div className="p-2 bg-slate-800 rounded-xl border border-slate-700">
                <div className="font-bold text-blue-300">Counter 2</div>
                <div className="text-[10px] text-slate-400">Same second ➔</div>
                <div className="font-mono font-black text-emerald-400 mt-1">POS-1002</div>
              </div>
              <div className="p-2 bg-slate-800 rounded-xl border border-slate-700">
                <div className="font-bold text-purple-300">Accountant</div>
                <div className="text-[10px] text-slate-400">Next second ➔</div>
                <div className="font-mono font-black text-emerald-400 mt-1">POS-1003</div>
              </div>
            </div>
          </div>

          {/* Test Live Simultaneous Dispatching */}
          <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-indigo-600" />
                Test Live Multi-Counter Dispatching:
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">Click to simulate simultaneous bills:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isTesting}
                onClick={() => handleTestDispatch('C1', 'Counter 1')}
                className="px-3 py-1.5 bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200 text-indigo-950 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer shadow-xs"
              >
                Simulate Counter 1 Bill
              </button>
              <button
                type="button"
                disabled={isTesting}
                onClick={() => handleTestDispatch('C2', 'Counter 2')}
                className="px-3 py-1.5 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-950 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer shadow-xs"
              >
                Simulate Counter 2 Bill
              </button>
              <button
                type="button"
                disabled={isTesting}
                onClick={() => handleTestDispatch('ACC1', 'Accountant Desk')}
                className="px-3 py-1.5 bg-white hover:bg-purple-600 hover:text-white border border-purple-200 text-purple-950 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer shadow-xs"
              >
                Simulate Accountant Bill
              </button>
            </div>

            {testResult && (
              <div className="p-2.5 bg-emerald-100/80 border border-emerald-300 rounded-xl text-xs flex items-center justify-between animate-in zoom-in-95">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span className="font-bold text-emerald-950">
                    Dispatched to {testResult.terminal}:
                  </span>
                </div>
                <span className="font-mono font-black text-sm text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                  {testResult.invoiceNo}
                </span>
              </div>
            )}
          </div>

          {/* Live Recent Dispatched Feed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                Live Dispatched Numbers Log (Recent 10)
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Realtime LAN audit</span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-1.5 bg-slate-50/50">
              {logs.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  No bills dispatched yet. Ready to issue consecutive numbers.
                </div>
              ) : (
                logs.slice(0, 10).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[11px]">
                        {item.invoiceNo}
                      </span>
                      <span className="font-medium text-slate-700">
                        {item.terminalName || `Counter ${item.terminalId}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Guarantees zero duplicate bills & consecutive sequence across all shop devices.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
          >
            Close & Continue Billing
          </button>
        </div>
      </div>
    </div>
  );
};
