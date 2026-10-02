import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  Share2, 
  Download, 
  Check, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Layers, 
  MapPin, 
  Hash, 
  Sparkles, 
  AlertCircle, 
  UserCheck,
  ArrowLeft,
  Copy
} from 'lucide-react';
import { LeakUnitRecord, resolveRecordShift } from './SmogModule';

export interface SmogWhatsAppReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  productionDate: string;
  smogDate?: string;
  shift: 'A' | 'B' | 'all';
  smogQty: number;
  prQty?: number;
  pendingQty?: number;
  records: LeakUnitRecord[];
  inspectorName?: string;
  models?: {
    modelName: string;
    prQty: number;
    smogQty: number;
    pendingQty: number;
  }[];
  autoRedirectWhatsApp?: boolean;
  notes?: string;
}

export const SmogWhatsAppReportModal: React.FC<SmogWhatsAppReportModalProps> = ({
  isOpen,
  onClose,
  productionDate,
  shift,
  smogQty,
  prQty,
  pendingQty,
  records,
  inspectorName = 'Indrajit',
  models = [],
  autoRedirectWhatsApp = false,
  notes
}) => {
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const hasAutoSharedRef = useRef<boolean>(false);

  // Copy structured report text to clipboard
  const handleCopyReportText = async () => {
    const modelsText = models && models.length > 0 
      ? models.map((m, i) => `${i + 1}. ${m.modelName} | Pr: ${m.prQty} | Smog: ${m.smogQty} | Pending: ${m.pendingQty}`).join('\n')
      : 'No models listed';

    const suspectsText = suspectList && suspectList.length > 0
      ? suspectList.map((s, i) => `${i + 1}. ${s.modelName} (${s.location}): ${s.suspectQty} units`).join('\n')
      : 'None (Zero Suspects)';

    const text = `*SMOG OPERATION REPORT*
Date: ${productionDate || 'Today'} (Shift ${shift === 'all' ? 'A & B' : shift})
Inspector: ${inspectorName}

*QUANTITY SUMMARY:*
- Pr. Qty: ${displayPrQty}
- Smog Qty: ${displaySmogQty}
- Pending Qty: ${displayPendingQty}
- Total Suspects: ${totalSuspectQty}

*MODELS BREAKDOWN:*
${modelsText}

*SUSPECT LOCATIONS:*
${suspectsText}
${notes && notes.trim() ? `\n*Remarks:*\n${notes.trim()}` : ''}`.trim();

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  // Filter records relevant to this shift & date
  const filteredRecords = records.filter(r => {
    const recordShift = resolveRecordShift(r);
    const shiftMatch = shift === 'all' || recordShift === shift;
    const dateMatch = !productionDate || r.productionDate === productionDate || r.date === productionDate;
    return shiftMatch && dateMatch;
  });

  // Calculate totals
  const totalPassed = filteredRecords.reduce((sum, r) => {
    return sum + (r.passedSerials?.length || 0);
  }, 0);

  // Model & Location wise Suspect units aggregation
  // "aur Suspect Qty Model Wise Location bhi"
  const suspectMap = new Map<string, { modelName: string; location: string; suspectQty: number }>();
  filteredRecords.forEach(r => {
    const model = (r.modelName && r.modelName.trim() && r.modelName !== 'General Location' && r.modelName !== 'General Smog Unit') 
      ? r.modelName.trim() 
      : (models && models.length > 0 ? models[0].modelName : 'SAC-1.5T-INV-3S');
    const loc = (r.location && r.location.trim()) || 'General Line Location';
    const q = r.qty ?? r.suspectCount ?? (r.serialNumbers?.length || 1);
    const key = `${model}:::${loc}`;
    const existing = suspectMap.get(key) || { modelName: model, location: loc, suspectQty: 0 };
    existing.suspectQty += q;
    suspectMap.set(key, existing);
  });

  const suspectList = Array.from(suspectMap.values());
  const totalSuspectQty = suspectList.reduce((sum, item) => sum + item.suspectQty, 0);

  // Auto-calculated display quantities
  const displayPrQty = prQty !== undefined 
    ? prQty 
    : (models && models.length > 0 ? models.reduce((s, m) => s + (Number(m.prQty) || 0), 0) : smogQty);
  const displaySmogQty = smogQty;
  const displayPendingQty = pendingQty !== undefined 
    ? pendingQty 
    : Math.max(0, displayPrQty - displaySmogQty);

  // Safe RoundRect helper supporting all browser environments
  const safeRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  };

  // Render Image onto Canvas
  useEffect(() => {
    if (!isOpen) return;

    setIsGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      const width = 1080;
      
      // Calculate dynamic canvas height
      const modelRowsCount = models && models.length > 0 ? models.length : 1;
      const suspectRowsCount = suspectList.length > 0 ? suspectList.length : 1;
      const hasNotes = Boolean(notes && notes.trim());
      const notesHeight = hasNotes ? 100 : 0;
      const height = Math.max(1350, 780 + modelRowsCount * 54 + suspectRowsCount * 52 + notesHeight);
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsGenerating(false);
        return;
      }

      // 1. Background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#0a0f1d');
      bgGradient.addColorStop(0.5, '#070b14');
      bgGradient.addColorStop(1, '#05070c');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Decorative top radial glow
      const glowGradient = ctx.createRadialGradient(width / 2, 80, 10, width / 2, 80, 480);
      glowGradient.addColorStop(0, 'rgba(6, 182, 212, 0.16)');
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, 450);

      // Outer border
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, width - 32, height - 32);

      // Inner cyan border
      ctx.strokeStyle = '#0e7490';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(24, 24, width - 48, height - 48);

      // 2. Header Banner
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LEAK TESTING & SMOG INSPECTION SYSTEM', width / 2, 68);

      // Main Title
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 40px sans-serif';
      ctx.fillText('SMOG OPERATION SUMMARY', width / 2, 118);

      // Operation Closed Pill Badge
      const badgeW = 340;
      const badgeH = 42;
      const badgeX = (width - badgeW) / 2;
      const badgeY = 138;
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      safeRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 21);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 17px monospace';
      ctx.fillText('● STATUS: OPERATION CLOSED', width / 2, badgeY + 27);

      // Divider Line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, 205);
      ctx.lineTo(width - 50, 205);
      ctx.stroke();

      // 3. Info Parameters Grid (Date, Shift, Inspector Profile Name)
      // "Inspector Name Profile se Uthayega"
      const cardY = 225;
      const colW = (width - 100 - 30) / 3;

      // Card 1: Production Date
      drawParamCard(ctx, 50, cardY, colW, 90, 'PRODUCTION DATE', productionDate || 'N/A', '#38bdf8');
      // Card 2: Shift
      drawParamCard(ctx, 50 + colW + 15, cardY, colW, 90, 'SHIFT', `SHIFT ${shift === 'all' ? 'ALL' : shift}`, '#fbbf24');
      // Card 3: Inspector Name from Profile
      drawParamCard(ctx, 50 + (colW + 15) * 2, cardY, colW, 90, 'INSPECTOR (PROFILE)', inspectorName || 'Indrajit', '#34d399');

      // 4. Primary Metric Highlights (Pr. Qty, Smog Qty, Pending Qty, Suspect Qty)
      const metricY = 335;
      const mColW = (width - 100 - 45) / 4;

      drawMetricCard(ctx, 50, metricY, mColW, 115, 'PR. QTY', String(displayPrQty), 'From Photo', '#fb7185', '#e11d48');
      drawMetricCard(ctx, 50 + mColW + 15, metricY, mColW, 115, 'SMOG QTY', String(displaySmogQty), 'Inspected', '#fbbf24', '#d97706');
      drawMetricCard(ctx, 50 + (mColW + 15) * 2, metricY, mColW, 115, 'PENDING QTY', String(displayPendingQty), 'Pr – Smog', '#38bdf8', '#0284c7');
      drawMetricCard(ctx, 50 + (mColW + 15) * 3, metricY, mColW, 115, 'SUSPECT QTY', String(totalSuspectQty), 'Units Logged', '#f87171', '#b91c1c');

      // 5. Section 1: Model Wise Quantities Table
      // "Jisme Shift Model Name With Pr.qty, Smog Qty, Pending Qty"
      let curY = 480;
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('MODEL WISE QUANTITIES (PR. QTY | SMOG QTY | PENDING QTY)', 50, curY);

      curY += 15;
      // Table 1 Header
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      safeRoundRect(ctx, 50, curY, width - 100, 42, 10);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('#', 75, curY + 26);
      ctx.fillText('MODEL NAME', 120, curY + 26);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fb7185';
      ctx.fillText('PR. QTY', width - 360, curY + 26);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('SMOG QTY', width - 230, curY + 26);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('PENDING QTY', width - 100, curY + 26);

      curY += 48;

      if (!models || models.length === 0) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        safeRoundRect(ctx, 50, curY, width - 100, 46, 10);
        ctx.fill();
        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No specific models loaded', width / 2, curY + 28);
        curY += 56;
      } else {
        models.forEach((item, idx) => {
          ctx.fillStyle = idx % 2 === 0 ? '#0f172a' : '#141d33';
          ctx.beginPath();
          safeRoundRect(ctx, 50, curY, width - 100, 48, 8);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Index
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 15px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(String(idx + 1), 75, curY + 30);

          // Model Name
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 17px monospace';
          ctx.fillText(item.modelName, 120, curY + 30);

          // Pr Qty
          ctx.fillStyle = '#fb7185';
          ctx.font = '900 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(String(item.prQty), width - 360, curY + 30);

          // Smog Qty
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(String(item.smogQty), width - 230, curY + 30);

          // Pending Qty
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(String(item.pendingQty), width - 100, curY + 30);

          curY += 54;
        });
      }

      // 6. Section 2: Suspect Qty (Model Wise & Location)
      // "aur Suspect Qty Model Wise Location bhi"
      curY += 20;
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SUSPECT UNITS • MODEL WISE & LOCATION BREAKDOWN', 50, curY);

      curY += 15;
      // Table 2 Header
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      safeRoundRect(ctx, 50, curY, width - 100, 42, 10);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('#', 75, curY + 26);
      ctx.fillText('MODEL NAME', 120, curY + 26);
      ctx.fillText('SUSPECT LOCATION', 480, curY + 26);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f87171';
      ctx.fillText('SUSPECT QTY', width - 85, curY + 26);

      curY += 48;

      if (suspectList.length === 0) {
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        safeRoundRect(ctx, 50, curY, width - 100, 48, 10);
        ctx.fill();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓ 0 Suspect Units Logged for this Shift (All Units Clear)', width / 2, curY + 30);
        curY += 58;
      } else {
        suspectList.forEach((item, idx) => {
          ctx.fillStyle = idx % 2 === 0 ? '#0f172a' : '#141d33';
          ctx.beginPath();
          safeRoundRect(ctx, 50, curY, width - 100, 48, 8);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Index
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 15px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(String(idx + 1), 75, curY + 30);

          // Model Name
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px monospace';
          const mName = item.modelName.length > 24 ? item.modelName.slice(0, 22) + '...' : item.modelName;
          ctx.fillText(mName, 120, curY + 30);

          // Location
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 16px sans-serif';
          const locName = item.location.length > 30 ? item.location.slice(0, 28) + '...' : item.location;
          ctx.fillText(locName, 480, curY + 30);

          // Suspect Qty
          ctx.fillStyle = '#f87171';
          ctx.font = '900 18px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${item.suspectQty} Units`, width - 85, curY + 30);

          curY += 54;
        });
      }

      // 7. Operational Notes / Remarks (Included in photo if user added any)
      // "aur Photo me Agar koi Notes me kuch Add kr raha hai to wo bhi Photo me dikhana hai"
      if (notes && notes.trim()) {
        curY += 18;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        safeRoundRect(ctx, 50, curY, width - 100, 78, 12);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('📝 OPERATIONAL REMARKS / NOTES:', 75, curY + 28);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        const displayNote = notes.trim().length > 85 ? notes.trim().slice(0, 82) + '...' : notes.trim();
        ctx.fillText(`"${displayNote}"`, 75, curY + 56);

        curY += 88;
      }

      // 8. Verification & Operation Details Box
      curY += 15;
      ctx.fillStyle = '#091021';
      ctx.beginPath();
      safeRoundRect(ctx, 50, curY, width - 100, 100, 14);
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('VERIFIED INSPECTION METRICS', 75, curY + 32);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '15px monospace';
      const now = new Date();
      const formattedStamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      ctx.fillText(`• Shift Inspector: ${inspectorName || 'Indrajit'}`, 75, curY + 62);
      ctx.fillText(`• Operation Status: CLOSED & UPLOADED`, 75, curY + 85);

      ctx.textAlign = 'right';
      ctx.fillText(`• Timestamp: ${formattedStamp}`, width - 75, curY + 62);
      ctx.fillText(`• Models Monitored: ${models ? models.length : 0}`, width - 75, curY + 85);

      // 9. Footer
      ctx.fillStyle = '#475569';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SMOG & LEAK TESTING AUTOMATED REPORT • POWERED BY LLT LAB SYSTEM', width / 2, height - 36);

      // Save as data URL
      const dataUrl = canvas.toDataURL('image/png');
      setGeneratedImageUrl(dataUrl);

      // Auto-redirect to WhatsApp if autoRedirectWhatsApp is true!
      // "fir WhatsApp Per Redirect kr dega"
      if (autoRedirectWhatsApp && !hasAutoSharedRef.current) {
        hasAutoSharedRef.current = true;
        setTimeout(() => {
          handleShareWhatsAppDirect(dataUrl);
        }, 500);
      }
    } catch (e) {
      console.error('Failed to generate report canvas:', e);
    } finally {
      setIsGenerating(false);
    }
  }, [isOpen, productionDate, shift, smogQty, prQty, pendingQty, inspectorName, models.length, filteredRecords.length, notes]);

  // Helper to draw parameter cards
  function drawParamCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    val: string,
    accentColor: string
  ) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    safeRoundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 16, y + 28);

    ctx.fillStyle = accentColor;
    ctx.font = '900 20px monospace';
    const cleanVal = val.length > 18 ? val.slice(0, 16) + '..' : val;
    ctx.fillText(cleanVal, x + 16, y + 64);
  }

  // Helper to draw metric cards
  function drawMetricCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    val: string,
    sub: string,
    textColor: string,
    borderColor: string
  ) {
    ctx.fillStyle = '#0b1120';
    ctx.beginPath();
    safeRoundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 14, y + 28);

    ctx.fillStyle = textColor;
    ctx.font = '900 36px monospace';
    ctx.fillText(val, x + 14, y + 74);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px monospace';
    ctx.fillText(sub, x + 14, y + 98);
  }

  // Helper to convert data URL to File synchronously without async fetch delay
  function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  // Open WhatsApp directly across Android, iOS and Desktop
  const openWhatsAppDirect = () => {
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      // 1. Android Intent directly opens WhatsApp application
      try {
        const intentLink = document.createElement('a');
        intentLink.href = 'intent://send#Intent;package=com.whatsapp;scheme=whatsapp;end;';
        intentLink.target = '_top';
        intentLink.rel = 'noopener noreferrer';
        document.body.appendChild(intentLink);
        intentLink.click();
        document.body.removeChild(intentLink);
      } catch {}

      // 2. Also trigger whatsapp:// protocol
      setTimeout(() => {
        try {
          const waLink = document.createElement('a');
          waLink.href = 'whatsapp://send';
          waLink.target = '_blank';
          waLink.rel = 'noopener noreferrer';
          document.body.appendChild(waLink);
          waLink.click();
          document.body.removeChild(waLink);
        } catch {}
      }, 150);

      // 3. Fallback to api.whatsapp.com
      setTimeout(() => {
        try {
          window.open('https://api.whatsapp.com/send', '_blank');
        } catch {}
      }, 350);
    } else if (isMobile) {
      // iOS
      try {
        const waLink = document.createElement('a');
        waLink.href = 'whatsapp://send';
        waLink.target = '_blank';
        waLink.rel = 'noopener noreferrer';
        document.body.appendChild(waLink);
        waLink.click();
        document.body.removeChild(waLink);
      } catch {}

      setTimeout(() => {
        try {
          window.open('https://api.whatsapp.com/send', '_blank');
        } catch {}
      }, 250);
    } else {
      // Desktop: WhatsApp Web
      window.open('https://web.whatsapp.com', '_blank');
    }
  };

  // Trigger WhatsApp share and direct opening (Photo copied to clipboard & downloaded, WhatsApp opens directly)
  const handleShareWhatsAppDirect = async (imageUrl?: string) => {
    const targetUrl = imageUrl || generatedImageUrl;
    const fileName = `Smog_Report_${productionDate || 'Today'}_Shift_${shift}.png`;

    if (targetUrl) {
      // 1. Try to copy photo to clipboard so it can be pasted directly in WhatsApp
      try {
        const file = dataURLtoFile(targetUrl, fileName);
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ [file.type]: file })
            ]);
          } catch {}
        }

        // 2. Try native Web Share if supported and allowed
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file] // Strictly only the photo file
            });
            setShareSuccess('Report photo shared to WhatsApp successfully!');
            return;
          } catch (e: any) {
            // If user closed share dialog or if web share failed, proceed to direct WhatsApp open
            console.log('Direct WhatsApp fallback triggered');
          }
        }
      } catch (err) {
        console.warn('Share preparation notice:', err);
      }

      // 3. Download image so it is immediately accessible in Gallery/Downloads
      handleDownloadImage(targetUrl);
    }

    // 4. Open WhatsApp directly!
    openWhatsAppDirect();
    setShareSuccess('Opening WhatsApp... Photo copied to clipboard & downloaded!');
  };

  // Handle WhatsApp Share from button
  const handleShareWhatsApp = async () => {
    await handleShareWhatsAppDirect();
  };

  // Handle Download Image
  const handleDownloadImage = (customUrl?: string) => {
    const url = customUrl || generatedImageUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `Smog_Operation_Report_${productionDate || 'date'}_Shift_${shift}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Back to Smog Main Screen"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Back</span>
            </button>

            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2 truncate">
                <span>Share WhatsApp Report</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 hidden sm:inline-block">
                  Image Ready
                </span>
              </h3>
              <p className="text-[10px] sm:text-[11px] font-mono text-slate-400 truncate">
                Shift {shift}, Inspector ({inspectorName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyReportText}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 hover:border-cyan-500/60 text-cyan-400 hover:text-cyan-300 font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Copy Report Text to Clipboard"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span className="text-emerald-400 font-bold hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy Text</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {shareSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{shareSuccess}</span>
            </div>
          )}

          {/* Quick Metrics Summary Bar */}
          <div className="grid grid-cols-4 gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-center">
            <div>
              <span className="text-[9px] text-rose-400 uppercase font-bold block">Pr. Qty</span>
              <span className="text-lg sm:text-xl font-black text-rose-300">{displayPrQty}</span>
            </div>
            <div className="border-l border-slate-800">
              <span className="text-[9px] text-amber-400 uppercase font-bold block">Smog Qty</span>
              <span className="text-lg sm:text-xl font-black text-amber-300">{displaySmogQty}</span>
            </div>
            <div className="border-l border-slate-800">
              <span className="text-[9px] text-cyan-400 uppercase font-bold block">Pending</span>
              <span className="text-lg sm:text-xl font-black text-cyan-300">{displayPendingQty}</span>
            </div>
            <div className="border-l border-slate-800">
              <span className="text-[9px] text-red-400 uppercase font-bold block">Suspect</span>
              <span className="text-lg sm:text-xl font-black text-red-300">{totalSuspectQty}</span>
            </div>
          </div>

          {/* Inspector & Shift Badge Bar */}
          <div className="p-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-cyan-300">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inspector: <strong className="text-white">{inspectorName}</strong></span>
            </div>
            <div className="text-slate-400">
              Shift: <strong className="text-amber-300">Shift {shift === 'all' ? 'All' : shift}</strong>
            </div>
          </div>

          {/* Notes badge if notes are present */}
          {notes && notes.trim() && (
            <div className="p-2.5 px-3 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-mono flex items-start gap-2 shadow-inner">
              <span className="text-amber-400 font-bold shrink-0">📝 Remarks:</span>
              <span className="text-slate-200 font-sans italic break-words flex-1">"{notes.trim()}"</span>
            </div>
          )}

          {/* Generated Image Preview Container */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Generated Report Image Preview</span>
              </span>
              <span className="text-[10px] text-slate-500">1080px High-Res PNG</span>
            </div>

            <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-2 overflow-hidden flex items-center justify-center max-h-72">
              {isGenerating ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-mono">
                  <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Generating Report Image for WhatsApp...</span>
                </div>
              ) : generatedImageUrl ? (
                <img 
                  src={generatedImageUrl} 
                  alt="Smog Operation Report" 
                  className="w-full h-auto max-h-68 object-contain rounded-xl border border-slate-800/80 shadow-lg"
                />
              ) : (
                <div className="py-10 text-slate-500 text-xs font-mono">Failed to render image</div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {/* WhatsApp Share Button */}
            <button
              onClick={handleShareWhatsApp}
              className="w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-green-500 hover:from-emerald-300 hover:to-green-400 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 stroke-[2.5]" />
              <span>Share on WhatsApp</span>
            </button>

            {/* Copy Report Text & Download Photo Buttons Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyReportText}
                className="w-full py-2.5 px-3 rounded-xl font-bold text-xs text-cyan-300 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-700"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                    <span className="text-emerald-400">Report Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Report Text</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleDownloadImage()}
                className="w-full py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download Report (PNG)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
