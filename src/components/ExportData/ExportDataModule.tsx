import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Download, 
  FileSpreadsheet, 
  FileJson, 
  Printer, 
  Search, 
  Filter, 
  Boxes, 
  Cpu, 
  Compass, 
  Cloud, 
  History, 
  Database,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  Check,
  ArrowLeftRight
} from 'lucide-react';
import { Unit, ProtoUnit, FieldUnit, PpUnit, WORKFLOW_STAGES } from '../../types';
import { getProtoUnits } from '../../services/protoUnitStore';
import { getPpUnits } from '../../services/ppUnitStore';
import { getFieldUnits } from '../../services/fieldUnitStore';
import { getSmogUnits, subscribeSmogUnits, LeakUnitRecord } from '../Smog/SmogModule';
import { fetchSmogLeakUnitsFromFirebase } from '../../services/smogFirebaseStore';
import { getSmogQtyRecords, subscribeSmogQtyRecords, fetchSmogQtyFromFirestore, SmogQtyRecord } from '../../services/smogQtyStore';
import { 
  ELTRecord, 
  BSRRecord, 
  getELTRecords, 
  getBSRRecords, 
  subscribeELTRecords, 
  subscribeBSRRecords 
} from '../../services/eltBsrStore';
import { getActivityLogs } from '../../services/unitStore';

export type ExportCategory = 
  | 'smog-section'
  | 'in-out-records'
  | 'rd-units' 
  | 'proto-units' 
  | 'pp-units' 
  | 'pp-models' 
  | 'field-units' 
  | 'activity-logs' 
  | 'full-backup';

interface ExportDataModuleProps {
  units: Unit[];
  onNavigateToDashboard?: () => void;
}

export const ExportDataModule: React.FC<ExportDataModuleProps> = ({ units }) => {
  const [selectedCategory, setSelectedCategory] = useState<ExportCategory>('smog-section');
  const [smogSubFilter, setSmogSubFilter] = useState<'all' | 'leak' | 'qty'>('all');
  const [inOutSubFilter, setInOutSubFilter] = useState<'all' | 'elt' | 'bsr'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isExportSuccess, setIsExportSuccess] = useState<string | null>(null);

  // Retrieve all datasets with reactive state
  const [protoUnits, setProtoUnits] = useState<ProtoUnit[]>(() => getProtoUnits());
  const [ppUnits, setPpUnits] = useState<PpUnit[]>(() => getPpUnits());
  const [fieldUnits, setFieldUnits] = useState<FieldUnit[]>(() => getFieldUnits());
  const [smogUnits, setSmogUnits] = useState<LeakUnitRecord[]>(() => getSmogUnits());
  const [smogQtyRecords, setSmogQtyRecords] = useState<SmogQtyRecord[]>(() => getSmogQtyRecords());
  const [eltRecords, setEltRecords] = useState<ELTRecord[]>(() => getELTRecords());
  const [bsrRecords, setBsrRecords] = useState<BSRRecord[]>(() => getBSRRecords());
  const [activityLogs, setActivityLogs] = useState(() => getActivityLogs());

  // Subscribe to live updates and ensure fresh data from Firebase Firestore
  useEffect(() => {
    // 1. Fetch freshest Smog Leak Units from Firebase Firestore
    fetchSmogLeakUnitsFromFirebase().then(remoteUnits => {
      if (remoteUnits && remoteUnits.length > 0) {
        setSmogUnits(remoteUnits as LeakUnitRecord[]);
        try { localStorage.setItem('llt_smog_units_storage_v1', JSON.stringify(remoteUnits)); } catch {}
      }
    });

    // 2. Fetch freshest Smog Production Qty from Firebase Firestore
    fetchSmogQtyFromFirestore().then(remoteQty => {
      if (remoteQty && remoteQty.length > 0) {
        setSmogQtyRecords(remoteQty);
        try { localStorage.setItem('llt_smog_qty_entries_v1', JSON.stringify(remoteQty)); } catch {}
      }
    });

    // 3. Listen to state changes
    const unsubSmog = subscribeSmogUnits((updated) => setSmogUnits(updated));
    const unsubQty = subscribeSmogQtyRecords((updated) => setSmogQtyRecords(updated));
    const unsubELT = subscribeELTRecords((updated) => setEltRecords(updated));
    const unsubBSR = subscribeBSRRecords((updated) => setBsrRecords(updated));

    return () => {
      unsubSmog();
      unsubQty();
      unsubELT();
      unsubBSR();
    };
  }, []);

  // Helper for Native Excel (.xlsx) download
  const handleExportExcel = (filename: string, rows: Record<string, any>[]) => {
    if (!rows || rows.length === 0) {
      alert('No records available to export for the selected filter.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-calculate column widths for pristine Excel presentation
    const colWidths = Object.keys(rows[0] || {}).map(key => {
      const maxLen = Math.max(
        key.length,
        ...rows.slice(0, 80).map(r => String(r[key] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    const sheetName = selectedCategory.replace('-', ' ').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);

    triggerSuccessNotification(`Successfully exported ${rows.length} rows to Excel (.xlsx)!`);
  };

  // Dedicated Multi-Sheet Smog Excel Export (Includes Leak Units & Production Qty)
  const handleExportSmogExcelWorkbook = () => {
    const wb = XLSX.utils.book_new();

    const leakRows = getSmogLeakRows();
    if (leakRows.length > 0) {
      const wsLeak = XLSX.utils.json_to_sheet(leakRows);
      XLSX.utils.book_append_sheet(wb, wsLeak, 'Smog Leak Units');
    }

    const qtyRows = getSmogQtyRows();
    if (qtyRows.length > 0) {
      const wsQty = XLSX.utils.json_to_sheet(qtyRows);
      XLSX.utils.book_append_sheet(wb, wsQty, 'Smog Production Qty');
    }

    XLSX.writeFile(wb, `LLT_Lab_SMOG_SECTION_DATA_${new Date().toISOString().slice(0, 10)}.xlsx`);
    triggerSuccessNotification(`Exported Smog Section Workbook (Leak Units & Production Qty)!`);
  };

  // Dedicated Multi-Sheet In/Out Excel Export (Includes ELT Out & BSR In Records)
  const handleExportInOutExcelWorkbook = () => {
    const wb = XLSX.utils.book_new();

    const eltRows = getEltRows();
    if (eltRows.length > 0) {
      const wsELT = XLSX.utils.json_to_sheet(eltRows);
      XLSX.utils.book_append_sheet(wb, wsELT, 'ELT Records (Out)');
    }

    const bsrRows = getBsrRows();
    if (bsrRows.length > 0) {
      const wsBSR = XLSX.utils.json_to_sheet(bsrRows);
      XLSX.utils.book_append_sheet(wb, wsBSR, 'BSR Records (In)');
    }

    XLSX.writeFile(wb, `LLT_Lab_IN_OUT_RECORDS_${new Date().toISOString().slice(0, 10)}.xlsx`);
    triggerSuccessNotification(`Exported In/Out Records Workbook (ELT Out & BSR In)!`);
  };

  // Helper for Master Multi-Sheet Excel (.xlsx) Workbook (All Laboratory Sections in One File)
  const handleExportFullExcelWorkbook = () => {
    const wb = XLSX.utils.book_new();

    // 1. Smog Leak Units Sheet
    const smogLeakRows = getSmogLeakRows();
    if (smogLeakRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(smogLeakRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Smog Leak Units');
    }

    // 2. Smog Production Qty Sheet
    const smogQtyRows = getSmogQtyRows();
    if (smogQtyRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(smogQtyRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Smog Production Qty');
    }

    // 3. In/Out ELT Records Sheet
    const eltRows = getEltRows();
    if (eltRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(eltRows);
      XLSX.utils.book_append_sheet(wb, ws, 'In-Out ELT Records');
    }

    // 4. In/Out BSR Records Sheet
    const bsrRows = getBsrRows();
    if (bsrRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(bsrRows);
      XLSX.utils.book_append_sheet(wb, ws, 'In-Out BSR Records');
    }

    // 5. R&D Units Sheet
    const rdRows = getCategoryRows('rd-units');
    if (rdRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rdRows);
      XLSX.utils.book_append_sheet(wb, ws, 'R&D Units');
    }

    // 6. Proto Units Sheet
    const protoRows = getCategoryRows('proto-units');
    if (protoRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(protoRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Proto Units');
    }

    // 7. PP Units Sheet
    const ppRows = getCategoryRows('pp-units');
    if (ppRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(ppRows);
      XLSX.utils.book_append_sheet(wb, ws, 'PP Units');
    }

    // 8. Field Units Sheet
    const fieldRows = getCategoryRows('field-units');
    if (fieldRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(fieldRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Field Units');
    }

    // 9. Activity Logs Sheet
    const logRows = getCategoryRows('activity-logs');
    if (logRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(logRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Activity Logs');
    }

    XLSX.writeFile(wb, `LLT_Lab_Complete_All_Sections_${new Date().toISOString().slice(0, 10)}.xlsx`);
    triggerSuccessNotification(`Successfully exported Complete Master Excel (.xlsx) Workbook with all sections!`);
  };

  // Helper for CSV download
  const handleExportCSV = (filename: string, rows: Record<string, any>[]) => {
    if (!rows || rows.length === 0) {
      alert('No records available to export for the selected filter.');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(row => 
        headers.map(h => {
          let val = row[h];
          if (val === null || val === undefined) val = '';
          if (typeof val === 'object') val = JSON.stringify(val);
          const escaped = ('' + val).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerSuccessNotification(`Successfully exported ${rows.length} rows to CSV!`);
  };

  // Helper for JSON download
  const handleExportJSON = (filename: string, data: any) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerSuccessNotification(`Successfully exported JSON backup file!`);
  };

  // Clean printable report
  const handlePrintPDF = (title: string, rows: Record<string, any>[]) => {
    if (!rows || rows.length === 0) {
      alert('No records available to print.');
      return;
    }
    const headers = Object.keys(rows[0]);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup was blocked by the browser. Please allow popups for printing.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - LLT Laboratory System</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; margin: 20px; color: #111; }
            h1 { font-size: 18px; margin-bottom: 4px; border-bottom: 2px solid #333; padding-bottom: 6px; }
            .meta { font-size: 11px; margin-bottom: 16px; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #fafafa; }
            @media print {
              body { margin: 0; }
              @page { size: landscape; }
            }
          </style>
        </head>
        <body>
          <h1>LLT LABORATORY — ${title.toUpperCase()} REPORT</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()} | Total Records: ${rows.length}</div>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map(r => `<tr>${headers.map(h => `<td>${r[h] !== null && r[h] !== undefined ? String(r[h]) : '-'}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const triggerSuccessNotification = (msg: string) => {
    setIsExportSuccess(msg);
    setTimeout(() => {
      setIsExportSuccess(null);
    }, 4000);
  };

  // Raw dataset extractors
  const getSmogLeakRows = (): Record<string, any>[] => {
    return smogUnits.map((s, idx) => {
      const resolvedModel = s.modelName && s.modelName.trim() && s.modelName !== 'General Location'
        ? s.modelName
        : 'SAC-1.5T-INV-3S';
      const resolvedLocation = s.location && s.location.trim()
        ? s.location
        : 'General Location';
      const leakQty = s.qty ?? s.suspectCount ?? (s.serialNumbers?.length || 1);
      const passedCount = s.actualCount || (s.passedSerials ? s.passedSerials.length : 0);
      const suspectCount = s.suspectCount || (s.serialNumbers ? s.serialNumbers.length : 0);
      const serialsList = Array.isArray(s.serialNumbers) ? s.serialNumbers.filter(Boolean).join(', ') : '';
      const passedList = Array.isArray(s.passedSerials) ? s.passedSerials.filter(Boolean).join(', ') : '';
      const statusText = passedCount >= suspectCount && suspectCount > 0 
        ? 'PASSED (ALL)' 
        : passedCount > 0 
          ? `PARTIAL (${passedCount}/${suspectCount})` 
          : 'PENDING';

      return {
        'S.No': idx + 1,
        'Leak Record ID': s.id,
        'Model Name': resolvedModel,
        'Location': resolvedLocation,
        'Leak Qty': leakQty,
        'Shift': `Shift ${s.shift}`,
        'Smog Operator': s.smogPerson || (s as any).inspectorName || 'N/A',
        'All Serial Numbers (Sr. No.)': serialsList || 'N/A',
        'Passed Serials': passedList || 'None',
        'Suspect Count': suspectCount,
        'Actual (Passed) Count': passedCount,
        'Pending Leak Count': Math.max(0, suspectCount - passedCount),
        'Inspection Status': statusText,
        'Entry Date': s.date,
        'Entry Time': s.time,
        'Production Date': s.productionDate || 'N/A',
        'Smog Date': s.smogDate || 'N/A',
        'Notes / Remarks': s.notes || 'None',
        'Firebase Synced': 'Yes (Firestore: smog_leak_units)'
      };
    });
  };

  const getSmogQtyRows = (): Record<string, any>[] => {
    return smogQtyRecords.map((r, idx) => ({
      'S.No': idx + 1,
      'Record ID': r.id,
      'Date': r.date,
      'Shift': `Shift ${r.shift}`,
      'Smog Production Qty': r.smogQty,
      'Notes / Remarks': r.notes || 'None',
      'Created At': r.createdAt,
      'Firebase Synced': 'Yes (Firestore: smog_qty_records)'
    }));
  };

  const getEltRows = (): Record<string, any>[] => {
    return eltRecords.map((r, idx) => ({
      'S.No': idx + 1,
      'Process Type': 'ELT (Out to Test)',
      'Record ID': r.id,
      'Model Name': r.modelName,
      'Serial Number': r.serialNumber,
      'Material Code': r.materialCode,
      'Status': r.status,
      'ELT Date': r.eltDate,
      'ELT Time': r.eltTime,
      'Scanned By ID': r.scannedByUserId || 'ADMIN01',
      'Scanned By Name': r.scannedByName || 'Admin',
      'Created At': r.createdAt,
      'Firebase Synced': 'Yes (Firestore: elt_records)'
    }));
  };

  const getBsrRows = (): Record<string, any>[] => {
    return bsrRecords.map((r, idx) => ({
      'S.No': idx + 1,
      'Process Type': 'BSR Return (In)',
      'Record ID': r.id,
      'Model Name': r.modelName,
      'Serial Number': r.serialNumber,
      'Material Code': r.materialCode,
      'Status': r.status,
      'Original ELT Date & Time': r.originalELTDateTime,
      'BSR Return Date & Time': r.bsrReturnDateTime,
      'Scanned By (ELT)': r.scannedByName || r.scannedByUserId || 'ADMIN01',
      'Returned By ID': r.returnedByUserId || 'ADMIN01',
      'Returned By Name': r.returnedByName || 'Admin',
      'Created At': r.createdAt,
      'Firebase Synced': 'Yes (Firestore: bsr_records)'
    }));
  };

  // Helper to extract clean raw data per category
  const getCategoryRows = (cat: ExportCategory): Record<string, any>[] => {
    switch (cat) {
      case 'smog-section': {
        if (smogSubFilter === 'leak') {
          return getSmogLeakRows();
        }
        if (smogSubFilter === 'qty') {
          return getSmogQtyRows();
        }
        // Unified Smog Section Dataset
        const unifiedRows: Record<string, any>[] = [];
        let serialCounter = 1;

        // Add leak unit records
        smogUnits.forEach((s) => {
          const resolvedModel = s.modelName && s.modelName.trim() && s.modelName !== 'General Location'
            ? s.modelName
            : 'SAC-1.5T-INV-3S';
          const resolvedLocation = s.location && s.location.trim()
            ? s.location
            : 'General Location';
          const leakQty = s.qty ?? s.suspectCount ?? (s.serialNumbers?.length || 1);
          const passedCount = s.actualCount || (s.passedSerials ? s.passedSerials.length : 0);
          const suspectCount = s.suspectCount || (s.serialNumbers ? s.serialNumbers.length : 0);
          const serialsList = Array.isArray(s.serialNumbers) ? s.serialNumbers.filter(Boolean).join(', ') : '';
          const statusText = passedCount >= suspectCount && suspectCount > 0 
            ? 'PASSED (ALL)' 
            : passedCount > 0 
              ? `PARTIAL (${passedCount}/${suspectCount})` 
              : 'PENDING';

          unifiedRows.push({
            'S.No': serialCounter++,
            'Section Type': 'Smog Leak Record',
            'Record ID': s.id,
            'Date': s.date,
            'Shift': `Shift ${s.shift}`,
            'Model / Description': resolvedModel,
            'Location / Process': resolvedLocation,
            'Quantity': leakQty,
            'Passed / Actual': passedCount,
            'Pending': Math.max(0, suspectCount - passedCount),
            'Serials / Remarks': serialsList || s.notes || 'None',
            'Operator / User': s.smogPerson || (s as any).inspectorName || 'N/A',
            'Status': statusText,
            'Firebase Synced': 'Yes (Firestore)'
          });
        });

        // Add production qty records
        smogQtyRecords.forEach((r) => {
          unifiedRows.push({
            'S.No': serialCounter++,
            'Section Type': 'Smog Production Qty',
            'Record ID': r.id,
            'Date': r.date,
            'Shift': `Shift ${r.shift}`,
            'Model / Description': 'All Line Models (Daily Production Total)',
            'Location / Process': 'Smog Section Line Output',
            'Quantity': `${r.smogQty} units`,
            'Passed / Actual': `${r.smogQty} units`,
            'Pending': 0,
            'Serials / Remarks': r.notes ? `Prod Qty Entry: ${r.notes}` : `Shift ${r.shift} Smog Qty Record`,
            'Operator / User': 'Production Team',
            'Status': 'PROD QTY RECORDED',
            'Firebase Synced': 'Yes (Firestore)'
          });
        });

        return unifiedRows;
      }

      case 'in-out-records': {
        if (inOutSubFilter === 'elt') {
          return getEltRows();
        }
        if (inOutSubFilter === 'bsr') {
          return getBsrRows();
        }
        // Unified In/Out Records (ELT + BSR)
        const combined: Record<string, any>[] = [];
        let counter = 1;

        eltRecords.forEach((r) => {
          combined.push({
            'S.No': counter++,
            'Process Type': 'ELT (Out to Test)',
            'Record ID': r.id,
            'Model Name': r.modelName,
            'Serial Number': r.serialNumber,
            'Material Code': r.materialCode,
            'Status': r.status,
            'Date / Time Out': `${r.eltDate} ${r.eltTime}`,
            'Date / Time In': '-',
            'Handled By': r.scannedByName || r.scannedByUserId || 'Admin',
            'Created At': r.createdAt,
            'Firebase Synced': 'Yes (Firestore)'
          });
        });

        bsrRecords.forEach((r) => {
          combined.push({
            'S.No': counter++,
            'Process Type': 'BSR Return (In)',
            'Record ID': r.id,
            'Model Name': r.modelName,
            'Serial Number': r.serialNumber,
            'Material Code': r.materialCode,
            'Status': r.status,
            'Date / Time Out': r.originalELTDateTime || 'N/A',
            'Date / Time In': r.bsrReturnDateTime || 'N/A',
            'Handled By': r.returnedByName || r.returnedByUserId || 'Admin',
            'Created At': r.createdAt,
            'Firebase Synced': 'Yes (Firestore)'
          });
        });

        return combined;
      }

      case 'rd-units': {
        return units.map((u, idx) => {
          const latestStep = u.timeline && u.timeline.length > 0 ? u.timeline[u.timeline.length - 1] : null;
          const stageInfo = WORKFLOW_STAGES[u.currentStageIndex] || { stageName: `Stage ${u.currentStageIndex + 1}` };
          const obsText = u.observations && u.observations.length > 0 
            ? u.observations.map(o => `[${o.timestamp}] ${o.text}`).join(' | ') 
            : 'None';
          const historyText = u.timeline && u.timeline.length > 0
            ? u.timeline.map(t => `[${t.stageName}] ${t.personName} - ${t.status?.toUpperCase() || 'COMPLETED'} (${t.date || ''} ${t.time || ''})${t.remarks ? ` [Remarks: ${t.remarks}]` : ''}`).join(' | ')
            : 'Initial Registration';

          return {
            'S.No': idx + 1,
            'Unit ID': u.id,
            'Model Name': u.modelName,
            'Serial Number': u.serialNumber,
            'Status': u.status.toUpperCase(),
            'Current Stage': stageInfo.stageName,
            'Stage Step Number': `Step ${u.currentStageIndex + 1} of 10`,
            'Current Holder': u.currentHolder || 'Unassigned',
            'Priority': u.priority || 'Normal',
            'Required Date': u.requiredBy,
            'Day Duration': `${u.dayDuration} Days`,
            'Transfer Date & Time': u.transferDate || 'N/A',
            'BSR Person': u.bsrPerson || 'N/A',
            'ELT Person': u.eltPerson || 'N/A',
            'R&D Contact Person': u.rdPerson || 'N/A',
            'OQC Inspector': u.oqcPerson || 'N/A',
            'Notes / Remarks': u.notes || 'None',
            'Latest Tracking Step': latestStep ? `${latestStep.stageName} by ${latestStep.personName} (${latestStep.date} ${latestStep.time})` : 'Initial Stage',
            'Timeline Workflow History': historyText,
            'Observations Log': obsText,
            'Created At': u.createdAt,
            'Updated At': u.updatedAt || u.createdAt
          };
        });
      }

      case 'proto-units': {
        return protoUnits.map((p, idx) => {
          const namePlate = p.namePlate || {};
          const report = p.reportDetails || {};
          const parts = p.partsInfo || {};
          const photos = p.photos || {};
          const obsText = p.observations && p.observations.length > 0 
            ? p.observations.map(o => `[${o.timestamp}] ${o.text}`).join(' | ') 
            : 'None';

          const photoFields = [
            photos.indoorUnitPhoto, photos.productPhoto, photos.packingBoxPhoto,
            photos.iduNameplatePhoto, photos.oduNameplatePhoto, photos.iduPcbPhoto,
            photos.iduMotorPhoto, photos.oduPcbPhoto, photos.oduMotorPhoto,
            photos.oduCompressorPhoto, photos.oduEevPhoto, photos.stickerPhoto, photos.remotePhoto
          ];
          const attachedCount = photoFields.filter(val => val && val.length > 50).length;

          return {
            'S.No': idx + 1,
            'Proto ID': p.id,
            'Model Name': p.modelName,
            'Sample Type': p.sampleType || report.sampleType || 'Proto Sample',
            'Station Assigned': p.station || 'Station 01',
            'IDU Serial Number': p.iduSerialNumber || 'N/A',
            'ODU Serial Number': p.oduSerialNumber || 'N/A',
            'Requested By': p.requestBy || 'N/A',
            'Test Purpose': p.testPurpose || 'N/A',
            'Required Hours': `${p.requiredHour} hrs`,
            'Done Hours': `${p.doneHour ?? 0} hrs`,
            'Remaining Hours': `${Math.max(0, p.requiredHour - (p.doneHour || 0))} hrs`,
            'Status': p.status.toUpperCase(),
            'Four-Way Swing': p.fourWaySwing || namePlate.fourWaySwing || parts.fourWaySwing || 'N/A',
            'RPM': p.rpm || namePlate.rpm || parts.rpm || 'N/A',
            // Report Details
            'Report No': report.reportNo || 'N/A',
            'Sample Received Date': report.sampleReceived || 'N/A',
            'Test Commenced Date': report.testCommenced || 'N/A',
            'Test Completed Date': report.testCompleted || 'N/A',
            // Name Plate Details
            'Cooling Capacity': namePlate.coolingCapacity || 'N/A',
            'Rated Cooling Power': namePlate.ratedCoolingPower || 'N/A',
            'Rated Power': namePlate.ratedPower || 'N/A',
            'Rated Current': namePlate.ratedCurrent || 'N/A',
            'Voltage': namePlate.voltage || 'N/A',
            'ISEER Rating': namePlate.iseer || 'N/A',
            'Refrigerant': namePlate.refrigerant || 'N/A',
            'Gas Qty': namePlate.gasQty || 'N/A',
            'Power Mode': namePlate.powerMode || 'N/A',
            'Gas Injection Volume': namePlate.gasInjectionVolume || 'N/A',
            'Main Program Checksum IDU': namePlate.mainProgramChecksumIdu || 'N/A',
            'Main Program Checksum ODU': namePlate.mainProgramChecksumOdu || 'N/A',
            'EE Checksum IDU': namePlate.eeChecksumIdu || 'N/A',
            'EE Checksum ODU': namePlate.eeChecksumOdu || 'N/A',
            // Parts Info - IDU
            'IDU Motor Spec': parts.iduMotorSpec || 'N/A',
            'IDU Motor Part Code': parts.iduMotorPartCode || 'N/A',
            'IDU Motor Supplier': parts.iduMotorSupplier || 'N/A',
            'IDU PCB Part Code': parts.iduPcbPartCode || 'N/A',
            'IDU PCB Supplier': parts.iduPcbSupplier || 'N/A',
            // Parts Info - ODU
            'ODU Motor Spec': parts.oduMotorSpec || 'N/A',
            'ODU Motor Part Code': parts.oduMotorPartCode || 'N/A',
            'ODU Motor Supplier': parts.oduMotorSupplier || 'N/A',
            'ODU PCB Part Code': parts.oduPcbPartCode || 'N/A',
            'ODU PCB Supplier': parts.oduPcbSupplier || 'N/A',
            // Parts Info - Compressor
            'Compressor Spec': parts.compressorSpec || parts.oduCompressorSpec || 'N/A',
            'Compressor Part Code': parts.compressorPartCode || parts.oduCompressorPartCode || 'N/A',
            'Compressor Supplier': parts.compressorSupplier || parts.oduCompressorSupplier || 'N/A',
            // Parts Info - EEV
            'EEV Spec': parts.eevSpec || parts.oduEevSpec || 'N/A',
            'EEV Part Code': parts.eevPartCode || parts.oduEevPartCode || 'N/A',
            'EEV Supplier': parts.eevSupplier || parts.oduEevSupplier || 'N/A',
            // Photos Status
            'Total Photos Attached': `${attachedCount} / 13 Photos`,
            'Indoor Unit Photo': photos.indoorUnitPhoto?.length ? 'Attached' : 'None',
            'Product Photo': photos.productPhoto?.length ? 'Attached' : 'None',
            'Packing Box Photo': photos.packingBoxPhoto?.length ? 'Attached' : 'None',
            'IDU Nameplate Photo': photos.iduNameplatePhoto?.length ? 'Attached' : 'None',
            'ODU Nameplate Photo': photos.oduNameplatePhoto?.length ? 'Attached' : 'None',
            'IDU PCB Photo': photos.iduPcbPhoto?.length ? 'Attached' : 'None',
            'IDU Motor Photo': photos.iduMotorPhoto?.length ? 'Attached' : 'None',
            'ODU PCB Photo': photos.oduPcbPhoto?.length ? 'Attached' : 'None',
            'ODU Motor Photo': photos.oduMotorPhoto?.length ? 'Attached' : 'None',
            'ODU Compressor Photo': photos.oduCompressorPhoto?.length ? 'Attached' : 'None',
            'ODU EEV Photo': photos.oduEevPhoto?.length ? 'Attached' : 'None',
            'Sticker Photo': photos.stickerPhoto?.length ? 'Attached' : 'None',
            'Remote Photo': photos.remotePhoto?.length ? 'Attached' : 'None',
            // Observations & Remarks
            'Remarks': p.remarks || 'None',
            'Observations Log': obsText,
            'Created At': p.createdAt,
            'Updated At': p.updatedAt || p.createdAt
          };
        });
      }

      case 'pp-units':
      case 'pp-models': {
        return ppUnits.map((p, idx) => {
          const namePlate = p.namePlate || {};
          const report = p.reportDetails || {};
          const parts = p.partsInfo || {};
          const photos = p.photos || {};
          const obsText = p.observations && p.observations.length > 0 
            ? p.observations.map(o => `[${o.timestamp}] ${o.text}`).join(' | ') 
            : 'None';

          const photoFields = [
            photos.indoorUnitPhoto, photos.productPhoto, photos.packingBoxPhoto,
            photos.iduNameplatePhoto, photos.oduNameplatePhoto, photos.iduPcbPhoto,
            photos.iduMotorPhoto, photos.oduPcbPhoto, photos.oduMotorPhoto,
            photos.oduCompressorPhoto, photos.oduEevPhoto, photos.stickerPhoto, photos.remotePhoto
          ];
          const attachedCount = photoFields.filter(val => val && val.length > 50).length;

          return {
            'S.No': idx + 1,
            'PP ID': p.id,
            'Model Name': p.modelName,
            'Sample Type': p.sampleType || report.sampleType || 'PP Trial',
            'Unit Type': p.unitType || (p.iduSerialNumber && !p.oduSerialNumber ? 'IDU' : p.oduSerialNumber && !p.iduSerialNumber ? 'ODU' : 'BOTH'),
            'Material Code': p.materialCode || 'MAT-1001',
            'Version': p.version || 'V1.0',
            'Quantity': typeof p.quantity === 'number' ? p.quantity : 1,
            'Station Assigned': p.station || 'Station 01',
            'IDU Serial Number': p.iduSerialNumber || 'N/A',
            'ODU Serial Number': p.oduSerialNumber || 'N/A',
            'Requested By': p.requestBy || 'N/A',
            'Test Purpose': p.testPurpose || 'N/A',
            'Required Hours': `${p.requiredHour} hrs`,
            'Done Hours': `${p.doneHour ?? 0} hrs`,
            'Remaining Hours': `${Math.max(0, p.requiredHour - (p.doneHour || 0))} hrs`,
            'Status': (p.status || 'Active').toUpperCase(),
            'Four-Way Swing': p.fourWaySwing || namePlate.fourWaySwing || parts.fourWaySwing || 'N/A',
            'RPM': p.rpm || namePlate.rpm || parts.rpm || 'N/A',
            'Entry Source': p.entrySource === 'model_list' ? 'Model List' : 'Unit Testing',
            // Report Details
            'Report No': report.reportNo || 'N/A',
            'Sample Received Date': report.sampleReceived || 'N/A',
            'Test Commenced Date': report.testCommenced || 'N/A',
            'Test Completed Date': report.testCompleted || 'N/A',
            // Name Plate Details
            'Cooling Capacity': namePlate.coolingCapacity || 'N/A',
            'Rated Cooling Power': namePlate.ratedCoolingPower || 'N/A',
            'Rated Power': namePlate.ratedPower || 'N/A',
            'Rated Current': namePlate.ratedCurrent || 'N/A',
            'Voltage': namePlate.voltage || 'N/A',
            'ISEER Rating': namePlate.iseer || 'N/A',
            'Refrigerant': namePlate.refrigerant || 'N/A',
            'Gas Qty': namePlate.gasQty || 'N/A',
            'Power Mode': namePlate.powerMode || 'N/A',
            'Gas Injection Volume': namePlate.gasInjectionVolume || 'N/A',
            'Main Program Checksum IDU': namePlate.mainProgramChecksumIdu || 'N/A',
            'Main Program Checksum ODU': namePlate.mainProgramChecksumOdu || 'N/A',
            'EE Checksum IDU': namePlate.eeChecksumIdu || 'N/A',
            'EE Checksum ODU': namePlate.eeChecksumOdu || 'N/A',
            // Parts Info - IDU
            'IDU Motor Spec': parts.iduMotorSpec || 'N/A',
            'IDU Motor Part Code': parts.iduMotorPartCode || 'N/A',
            'IDU Motor Supplier': parts.iduMotorSupplier || 'N/A',
            'IDU PCB Part Code': parts.iduPcbPartCode || 'N/A',
            'IDU PCB Supplier': parts.iduPcbSupplier || 'N/A',
            // Parts Info - ODU
            'ODU Motor Spec': parts.oduMotorSpec || 'N/A',
            'ODU Motor Part Code': parts.oduMotorPartCode || 'N/A',
            'ODU Motor Supplier': parts.oduMotorSupplier || 'N/A',
            'ODU PCB Part Code': parts.oduPcbPartCode || 'N/A',
            'ODU PCB Supplier': parts.oduPcbSupplier || 'N/A',
            // Parts Info - Compressor
            'Compressor Spec': parts.compressorSpec || parts.oduCompressorSpec || 'N/A',
            'Compressor Part Code': parts.compressorPartCode || parts.oduCompressorPartCode || 'N/A',
            'Compressor Supplier': parts.compressorSupplier || parts.oduCompressorSupplier || 'N/A',
            // Parts Info - EEV
            'EEV Spec': parts.eevSpec || parts.oduEevSpec || 'N/A',
            'EEV Part Code': parts.eevPartCode || parts.oduEevPartCode || 'N/A',
            'EEV Supplier': parts.eevSupplier || parts.oduEevSupplier || 'N/A',
            // Photos Status
            'Total Photos Attached': `${attachedCount} / 13 Photos`,
            'Indoor Unit Photo': photos.indoorUnitPhoto?.length ? 'Attached' : 'None',
            'Product Photo': photos.productPhoto?.length ? 'Attached' : 'None',
            'Packing Box Photo': photos.packingBoxPhoto?.length ? 'Attached' : 'None',
            'IDU Nameplate Photo': photos.iduNameplatePhoto?.length ? 'Attached' : 'None',
            'ODU Nameplate Photo': photos.oduNameplatePhoto?.length ? 'Attached' : 'None',
            'IDU PCB Photo': photos.iduPcbPhoto?.length ? 'Attached' : 'None',
            'IDU Motor Photo': photos.iduMotorPhoto?.length ? 'Attached' : 'None',
            'ODU PCB Photo': photos.oduPcbPhoto?.length ? 'Attached' : 'None',
            'ODU Motor Photo': photos.oduMotorPhoto?.length ? 'Attached' : 'None',
            'ODU Compressor Photo': photos.oduCompressorPhoto?.length ? 'Attached' : 'None',
            'ODU EEV Photo': photos.oduEevPhoto?.length ? 'Attached' : 'None',
            'Sticker Photo': photos.stickerPhoto?.length ? 'Attached' : 'None',
            'Remote Photo': photos.remotePhoto?.length ? 'Attached' : 'None',
            // Observations & Remarks
            'Remarks': p.remarks || 'None',
            'Observations Log': obsText,
            'Created At': p.createdAt || 'N/A',
            'Updated At': p.updatedAt || p.createdAt || 'N/A'
          };
        });
      }

      case 'field-units': {
        return fieldUnits.map((f, idx) => {
          const obsText = f.observations && f.observations.length > 0 
            ? f.observations.map(o => `[${o.timestamp}] ${o.text}`).join(' | ') 
            : 'None';

          return {
            'S.No': idx + 1,
            'Field ID': f.id,
            'Model Name': f.modelName,
            'Product Type': f.productType,
            'Display Serial Number': f.serialNumber,
            'IDU Serial Number': f.iduSerialNumber || 'N/A',
            'ODU Serial Number': f.oduSerialNumber || 'N/A',
            'Requested By': f.requestBy,
            'Station Assigned': f.station,
            'Start Date & Time': f.startDateTime,
            'End Date & Time': f.endDateTime || 'In Progress',
            'Required Hours': `${f.requiredHour} hrs`,
            'Done Hours': `${f.doneHour ?? 0} hrs`,
            'Remaining Hours': `${Math.max(0, f.requiredHour - (f.doneHour || 0))} hrs`,
            'Status': f.status.toUpperCase(),
            'Remarks': f.remarks || 'None',
            'Observations Log': obsText,
            'Created At': f.createdAt,
            'Updated At': f.updatedAt || f.createdAt
          };
        });
      }

      case 'activity-logs': {
        return activityLogs.map((a, idx) => ({
          'S.No': idx + 1,
          'Log ID': a.id,
          'Action': a.action,
          'Model Name': a.modelName,
          'Serial Number': a.serialNumber,
          'Performed By': a.performedBy,
          'Stage Name': a.stageName || 'N/A',
          'Type': a.type.toUpperCase(),
          'Timestamp': a.timestamp
        }));
      }

      case 'full-backup': {
        return [{
          'System Version': 'LLT Lab v2.5',
          'Backup Time': new Date().toISOString(),
          'Smog Total Records': smogUnits.length + smogQtyRecords.length,
          'Smog Leak Records': smogUnits.length,
          'Smog Production Qty Entries': smogQtyRecords.length,
          'In/Out Records Total': eltRecords.length + bsrRecords.length,
          'In/Out ELT Records (Out)': eltRecords.length,
          'In/Out BSR Records (In)': bsrRecords.length,
          'Total R&D Units': units.length,
          'Total Proto Units': protoUnits.length,
          'Total PP Units': ppUnits.length,
          'Total Field Units': fieldUnits.length,
          'Total Activity Logs': activityLogs.length,
          'Cloud Storage': 'Firebase Firestore (Fully Synchronized)'
        }];
      }

      default:
        return [];
    }
  };

  // Filter datasets based on category, search, and status
  const getFilteredData = () => {
    const rawRows = getCategoryRows(selectedCategory);

    if (selectedCategory === 'full-backup') {
      return rawRows;
    }

    return rawRows.filter(row => {
      // 1. Search filter
      const matchSearch = searchQuery === '' || Object.values(row).some(v => 
        String(v ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      );

      // 2. Status filter
      let matchStatus = true;
      if (statusFilter !== 'all') {
        const statusVal = String(row['Inspection Status'] || row['Status'] || '').toLowerCase();
        if (statusFilter === 'live') {
          matchStatus = !statusVal.includes('passed (all)') && !statusVal.includes('completed') && !statusVal.includes('received');
        } else if (statusFilter === 'completed') {
          matchStatus = statusVal.includes('passed') || statusVal.includes('completed') || statusVal.includes('received');
        }
      }

      return matchSearch && matchStatus;
    });
  };

  const filteredRows = getFilteredData();
  const columnsList = filteredRows.length > 0 ? Object.keys(filteredRows[0]) : [];

  const handleExecuteExportCSV = () => {
    handleExportCSV(`LLT_Lab_${selectedCategory.toUpperCase()}`, filteredRows);
  };

  const handleExecuteExportJSON = () => {
    if (selectedCategory === 'full-backup') {
      const fullBackupData = {
        exportedAt: new Date().toISOString(),
        system: 'LLT Lab Operational System',
        data: {
          smogLeakUnits: smogUnits,
          smogProductionQty: smogQtyRecords,
          inOutEltRecords: eltRecords,
          inOutBsrRecords: bsrRecords,
          rdUnits: units,
          protoUnits,
          ppUnits,
          ppModelList: ppUnits,
          fieldUnits,
          activityLogs
        }
      };
      handleExportJSON('LLT_Lab_Full_System_Backup', fullBackupData);
    } else {
      handleExportJSON(`LLT_Lab_${selectedCategory.toUpperCase()}`, filteredRows);
    }
  };

  const handleExecuteExportExcel = () => {
    if (selectedCategory === 'full-backup') {
      handleExportFullExcelWorkbook();
    } else if (selectedCategory === 'smog-section') {
      if (smogSubFilter === 'all') {
        handleExportSmogExcelWorkbook();
      } else {
        handleExportExcel(`LLT_Lab_SMOG_${smogSubFilter.toUpperCase()}`, filteredRows);
      }
    } else if (selectedCategory === 'in-out-records') {
      if (inOutSubFilter === 'all') {
        handleExportInOutExcelWorkbook();
      } else {
        handleExportExcel(`LLT_Lab_IN_OUT_${inOutSubFilter.toUpperCase()}`, filteredRows);
      }
    } else {
      handleExportExcel(`LLT_Lab_${selectedCategory.toUpperCase()}`, filteredRows);
    }
  };

  const handleExecutePrintReport = () => {
    if (filteredRows.length === 0) {
      alert('No records to print in the report.');
      return;
    }
    handlePrintPDF(selectedCategory.replace('-', ' '), filteredRows);
  };

  const totalSmogCount = smogUnits.length + smogQtyRecords.length;
  const totalInOutCount = eltRecords.length + bsrRecords.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/60 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-950/50">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
              Export Data Center
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-extrabold uppercase">
                Excel (.XLSX) • CSV • JSON • PDF
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select Smog Section, In/Out Records, or any laboratory dataset to export formatted Excel spreadsheets or full cloud backups.
            </p>
          </div>
        </div>

        {/* Action Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          {/* Main Excel Export Button */}
          <button
            type="button"
            onClick={handleExecuteExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-black text-xs shadow-lg shadow-emerald-950/70 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
            title="Download formatted Excel Spreadsheet (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>

          {/* Quick All-in-One Master Excel */}
          <button
            type="button"
            onClick={handleExportFullExcelWorkbook}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80 font-mono font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Export all laboratory sections in a single Multi-Sheet Excel Workbook"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>All Sheets (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExecuteExportCSV}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExecuteExportJSON}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-400" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExecutePrintReport}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-purple-400" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Export Success Notification Toast */}
      {isExportSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 text-xs font-mono font-bold flex items-center gap-2 animate-in fade-in duration-200 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{isExportSuccess}</span>
        </div>
      )}

      {/* Category Selection Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2.5">
        {[
          { 
            id: 'smog-section' as ExportCategory, 
            label: 'Smog Section', 
            icon: Cloud, 
            count: totalSmogCount, 
            color: 'text-cyan-400', 
            badge: 'Leak + Qty' 
          },
          { 
            id: 'in-out-records' as ExportCategory, 
            label: 'In/Out Records', 
            icon: ArrowLeftRight, 
            count: totalInOutCount, 
            color: 'text-emerald-400', 
            badge: 'ELT + BSR' 
          },
          { id: 'rd-units' as ExportCategory, label: 'R&D Units', icon: Boxes, count: units.length, color: 'text-blue-400' },
          { id: 'proto-units' as ExportCategory, label: 'Proto Units', icon: Cpu, count: protoUnits.length, color: 'text-indigo-400' },
          { id: 'pp-units' as ExportCategory, label: 'PP Units', icon: Cpu, count: ppUnits.length, color: 'text-purple-400' },
          { id: 'pp-models' as ExportCategory, label: 'PP Models', icon: Layers, count: ppUnits.length, color: 'text-sky-400' },
          { id: 'field-units' as ExportCategory, label: 'Field Units', icon: Compass, count: fieldUnits.length, color: 'text-amber-400' },
          { id: 'activity-logs' as ExportCategory, label: 'Activity Logs', icon: History, count: activityLogs.length, color: 'text-teal-400' },
          { id: 'full-backup' as ExportCategory, label: 'Full Backup', icon: Database, count: 'ALL', color: 'text-rose-400' },
        ].map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const IconComp = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/50 scale-[1.02]'
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <IconComp className={`w-5 h-5 ${cat.color}`} />
                <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
                  {cat.count}
                </span>
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-slate-200 truncate">
                  {cat.label}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                  <span>{isSelected ? 'Selected' : 'Select'}</span>
                  {cat.badge && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold">
                      {cat.badge}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-Filters / Scope Selector for Unified Categories */}
      {selectedCategory === 'smog-section' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/50">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-slate-200">Smog Section Dataset:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSmogSubFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                smogSubFilter === 'all'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All Smog Records ({totalSmogCount})
            </button>
            <button
              type="button"
              onClick={() => setSmogSubFilter('leak')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                smogSubFilter === 'leak'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Leak Units Only ({smogUnits.length})
            </button>
            <button
              type="button"
              onClick={() => setSmogSubFilter('qty')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                smogSubFilter === 'qty'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Production Qty Only ({smogQtyRecords.length})
            </button>
          </div>
        </div>
      )}

      {selectedCategory === 'in-out-records' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-950/30 border border-emerald-800/50">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold text-slate-200">In/Out Section Dataset:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setInOutSubFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                inOutSubFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All In/Out Records ({totalInOutCount})
            </button>
            <button
              type="button"
              onClick={() => setInOutSubFilter('elt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                inOutSubFilter === 'elt'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              ELT Records (Out) ({eltRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setInOutSubFilter('bsr')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                inOutSubFilter === 'bsr'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              BSR Records (In) ({bsrRecords.length})
            </button>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      {selectedCategory !== 'full-backup' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${selectedCategory.replace('-', ' ')}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none text-xs font-bold cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Statuses</option>
                <option value="live" className="bg-slate-900">Live / Active</option>
                <option value="completed" className="bg-slate-900">Completed / Received</option>
              </select>
            </div>

            <div className="text-xs font-mono font-bold text-cyan-400 px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-800/60">
              {filteredRows.length} Records Ready
            </div>
          </div>
        </div>
      )}

      {/* Live Data Preview Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="uppercase">{selectedCategory.replace('-', ' ')} Live Preview</span>
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            Showing {filteredRows.length} exported items
          </span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs">
            No matching records found for the selected category and search filters.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-950/90 text-slate-400 font-mono text-[11px] uppercase sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  {columnsList.map((col) => (
                    <th key={col} className="px-4 py-3 whitespace-nowrap font-bold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono text-slate-300">
                {filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    {columnsList.map((col) => {
                      const val = row[col];
                      const isStatus = col.toLowerCase().includes('status');
                      return (
                        <td key={col} className="px-4 py-3 whitespace-nowrap max-w-xs truncate">
                          {isStatus ? (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-extrabold uppercase">
                              {String(val)}
                            </span>
                          ) : (
                            String(val ?? '-')
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
