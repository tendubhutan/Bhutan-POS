import React, { useState } from 'react';
import { X, Share2, Smartphone, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

export interface ReportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle: string;
  reportSubtitle?: string;
  pdfFileName: string;
  generatePdfDoc: () => jsPDF | Blob | Promise<jsPDF | Blob>;
  textSummary: string;
  emailSubject?: string;
  emailBody?: string;
  whatsappText?: string;
  defaultPhone?: string;
  defaultEmail?: string;
  companyName?: string;
}

export const ReportShareModal: React.FC<ReportShareModalProps> = ({
  isOpen,
  onClose,
  reportTitle,
  reportSubtitle,
  pdfFileName,
  generatePdfDoc,
  textSummary,
  whatsappText
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  // Helper to resolve PDF Blob & File
  const getPdfBlobAndFile = async (): Promise<{ blob: Blob; file: File }> => {
    const docOrBlob = await generatePdfDoc();
    let blob: Blob;
    if (docOrBlob instanceof Blob) {
      blob = docOrBlob;
    } else {
      blob = docOrBlob.output('blob');
    }
    const file = new File([blob], pdfFileName, { type: 'application/pdf' });
    return { blob, file };
  };

  // Share via System Share (Native Web Share API with attached PDF file)
  const handleSystemShare = async () => {
    setIsProcessing(true);
    setShareStatus('Preparing PDF file for sharing...');
    try {
      const { blob, file } = await getPdfBlobAndFile();

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: reportTitle,
          text: whatsappText || textSummary,
          files: [file]
        });
        setShareStatus('Shared successfully via system dialog!');
        setTimeout(() => {
          onClose();
        }, 1200);
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: reportTitle,
          text: whatsappText || textSummary
        });
        setShareStatus('Shared successfully via system dialog!');
        setTimeout(() => {
          onClose();
        }, 1200);
        return;
      }

      // If navigator.share is not supported on this browser/desktop
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfFileName;
      link.click();
      URL.revokeObjectURL(url);
      setShareStatus('PDF file downloaded for sharing to WhatsApp / Email!');
      setTimeout(() => {
        setShareStatus(null);
      }, 4000);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        setShareStatus('Error initiating sharing');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{reportTitle}</h3>
              {reportSubtitle ? (
                <p className="text-[11px] text-slate-300 font-medium">{reportSubtitle}</p>
              ) : (
                <p className="text-[11px] text-slate-400 font-mono">{pdfFileName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Status Alert */}
          {shareStatus && (
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold flex items-center justify-between animate-in fade-in">
              <span>{shareStatus}</span>
              <button onClick={() => setShareStatus(null)} className="text-indigo-400 hover:text-indigo-700 cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Primary Share Action Card (Device / App Share - PDF File Direct) */}
          <div className="space-y-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
              Select Sharing Channel
            </div>

            <button
              type="button"
              onClick={handleSystemShare}
              disabled={isProcessing}
              className="w-full p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100/90 active:scale-[0.99] transition text-left flex items-center justify-between group cursor-pointer shadow-xs hover:border-indigo-300"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
                  {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Smartphone className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-indigo-950 text-xs sm:text-sm flex items-center gap-1.5">
                    <span>Device / App Share (PDF File Direct)</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-extrabold">All Apps</span>
                  </div>
                  <div className="text-[11px] text-indigo-700/90 font-medium mt-0.5">
                    Share PDF directly to WhatsApp, Gmail, Outlook, or AirDrop
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
