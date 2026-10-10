import { jsPDF } from 'jspdf';

export interface QuickShareParams {
  title: string;
  text: string;
  pdfFileName: string;
  generatePdfDoc: () => jsPDF | Blob | Promise<jsPDF | Blob>;
  defaultPhone?: string;
  defaultEmail?: string;
  emailSubject?: string;
  emailBody?: string;
  companyName?: string;
}

/**
 * Universal one-click share helper that supports:
 * 1. Native Web Share API with PDF File attached (if supported)
 * 2. Fallback to WhatsApp / Email with auto-downloaded PDF attachment
 */
export async function executeDirectShare(
  channel: 'whatsapp' | 'email' | 'system',
  params: QuickShareParams
): Promise<void> {
  const docOrBlob = await params.generatePdfDoc();
  let blob: Blob;
  if (docOrBlob instanceof Blob) {
    blob = docOrBlob;
  } else {
    blob = docOrBlob.output('blob');
  }
  const file = new File([blob], params.pdfFileName, { type: 'application/pdf' });

  if (channel === 'system' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: params.title,
        text: params.text,
        files: [file]
      });
      return;
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      // Fallback
    }
  }

  // Auto-download PDF for attachment
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = params.pdfFileName;
  link.click();
  URL.revokeObjectURL(url);

  if (channel === 'whatsapp' || channel === 'system') {
    let cleanPhone = (params.defaultPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone && cleanPhone.length === 8 && !cleanPhone.startsWith('975')) {
      cleanPhone = `975${cleanPhone}`;
    }
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(params.text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(params.text)}`;
    window.open(waUrl, '_blank');
  } else if (channel === 'email') {
    const subject = params.emailSubject || `${params.title} - ${params.companyName || 'Business Report'}`;
    const body = params.emailBody || `${params.text}\n\n(Note: The official PDF report '${params.pdfFileName}' has been downloaded to your device for attachment.)`;
    const mailtoUrl = `mailto:${encodeURIComponent(params.defaultEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }
}
