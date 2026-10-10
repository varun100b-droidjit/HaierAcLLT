import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Send, 
  RotateCcw, 
  Search, 
  ScanBarcode, 
  Download, 
  Clock, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Calendar,
  Trash2,
  Filter,
  RefreshCw,
  LayoutGrid,
  List,
  Copy,
  Check,
  Tag,
  User,
  Database,
  X,
  Code2,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  ELTRecord, 
  BSRRecord, 
  subscribeELTRecords, 
  subscribeBSRRecords, 
  deleteELTRecord, 
  deleteBSRRecord, 
  returnMachineToBSR 
} from '../../services/eltBsrStore';
import { SUPABASE_SQL_SCHEMA, IN_OUT_UNITS_SQL_CHANGES } from '../../lib/supabase';
import * as XLSX from 'xlsx';

interface InOutUnitsModuleProps {
  onOpenScanner?: () => void;
}

export type InOutTab = 'ELT_RECORD' | 'BSR_RECORD';

export const InOutUnitsModule: React.FC<InOutUnitsModuleProps> = ({
  onOpenScanner
}) => {
  const { user } = useAuth();
  // Requirement 8: Top 2 buttons/tabs: 1. ELT RECORD, 2. BSR RECORD. Default tab: ELT RECORD
  const [activeTab, setActiveTab] = useState<InOutTab>('ELT_RECORD');
  const [viewMode, setViewMode] = useState<'expanded' | 'table'>('expanded');
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [copiedChoice, setCopiedChoice] = useState<string | null>(null);
  const [sqlPreviewTab, setSqlPreviewTab] = useState<'inout' | 'all'>('inout');
  const [eltRecords, setEltRecords] = useState<ELTRecord[]>([]);
  const [bsrRecords, setBsrRecords] = useState<BSRRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null);
  const [confirmDeleteEltId, setConfirmDeleteEltId] = useState<string | null>(null);
  const [confirmDeleteBsrId, setConfirmDeleteBsrId] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setActionToast({ message, type });
    setTimeout(() => {
      setActionToast(null);
    }, 3500);
  };

  const handleCopySerial = (serial: string) => {
    navigator.clipboard.writeText(serial);
    setCopiedSerial(serial);
    showToast(`Copied ${serial} to clipboard!`);
    setTimeout(() => setCopiedSerial(null), 2000);
  };

  const handleCopySyncSql = () => {
    navigator.clipboard.writeText(IN_OUT_UNITS_SQL_CHANGES);
    setCopiedSql(true);
    showToast('Copied In/Out (ELT & BSR) SQL Changes script to clipboard!', 'success');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleCopyChoice = (type: 'inout_sql' | 'all_sql' | 'elt_json' | 'bsr_json' | 'serials') => {
    let text = '';
    let label = '';
    if (type === 'inout_sql') {
      text = IN_OUT_UNITS_SQL_CHANGES;
      label = 'In/Out (ELT & BSR) SQL Script';
    } else if (type === 'all_sql') {
      text = SUPABASE_SQL_SCHEMA;
      label = 'Complete Lab SQL Schema';
    } else if (type === 'elt_json') {
      text = JSON.stringify(eltRecords, null, 2);
      label = `${eltRecords.length} ELT Records (JSON)`;
    } else if (type === 'bsr_json') {
      text = JSON.stringify(bsrRecords, null, 2);
      label = `${bsrRecords.length} BSR Records (JSON)`;
    } else if (type === 'serials') {
      const allSerials = [
        ...eltRecords.map(r => r.serialNumber),
        ...bsrRecords.map(r => r.serialNumber)
      ];
      text = Array.from(new Set(allSerials)).join('\n');
      label = `${allSerials.length} Serial Numbers`;
    }
    navigator.clipboard.writeText(text);
    setCopiedChoice(type);
    showToast(`Copied ${label} to clipboard!`, 'success');
    setTimeout(() => setCopiedChoice(null), 2500);
  };

  useEffect(() => {
    const unsubELT = subscribeELTRecords((records) => {
      setEltRecords(records);
    });
    const unsubBSR = subscribeBSRRecords((records) => {
      setBsrRecords(records);
    });
    return () => {
      unsubELT();
      unsubBSR();
    };
  }, []);

  // Filtered lists
  const filteredELT = eltRecords.filter(r => {
    const term = searchTerm.toLowerCase();
    return (
      r.serialNumber.toLowerCase().includes(term) ||
      r.modelName.toLowerCase().includes(term) ||
      r.materialCode.toLowerCase().includes(term) ||
      r.eltDate.toLowerCase().includes(term) ||
      (r.scannedByUserId && r.scannedByUserId.toLowerCase().includes(term)) ||
      (r.scannedByName && r.scannedByName.toLowerCase().includes(term))
    );
  });

  const filteredBSR = bsrRecords.filter(r => {
    const term = searchTerm.toLowerCase();
    return (
      r.serialNumber.toLowerCase().includes(term) ||
      r.modelName.toLowerCase().includes(term) ||
      r.materialCode.toLowerCase().includes(term) ||
      r.originalELTDateTime.toLowerCase().includes(term) ||
      r.bsrReturnDateTime.toLowerCase().includes(term) ||
      (r.scannedByUserId && r.scannedByUserId.toLowerCase().includes(term)) ||
      (r.returnedByUserId && r.returnedByUserId.toLowerCase().includes(term)) ||
      (r.returnedByName && r.returnedByName.toLowerCase().includes(term))
    );
  });

  // Quick Action: Return from BSR directly from table
  const handleQuickReturnBSR = async (serialNumber: string) => {
    setIsProcessingAction(serialNumber);
    try {
      const res = await returnMachineToBSR(serialNumber, {
        userId: user?.userId || 'ADMIN01',
        name: user?.name || 'Admin'
      });
      if (res.success) {
        showToast(`Machine ${serialNumber} successfully returned to BSR!`, 'success');
      } else {
        showToast(res.error || 'Failed to return to BSR', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error processing BSR return', 'error');
    } finally {
      setIsProcessingAction(null);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const eltData = eltRecords.map((r, i) => ({
      'S.No': i + 1,
      'Model Name': r.modelName,
      'Series No.': r.serialNumber,
      'Material Code / Prefix': r.materialCode,
      'Process Type': r.processType,
      'ELT Send Date': r.eltDate,
      'ELT Send Time': r.eltTime,
      'Scanned By ID': r.scannedByUserId || 'ADMIN01',
      'Scanned By User': r.scannedByName || 'Admin',
      'Status': r.status,
      'Created At': r.createdAt
    }));
    const wsELT = XLSX.utils.json_to_sheet(eltData);
    XLSX.utils.book_append_sheet(wb, wsELT, 'ELT Records');

    const bsrData = bsrRecords.map((r, i) => ({
      'S.No': i + 1,
      'Model Name': r.modelName,
      'Series No.': r.serialNumber,
      'Material Code / Prefix': r.materialCode,
      'Process Type': r.processType,
      'Original ELT Date & Time': r.originalELTDateTime,
      'Scanned By ID (ELT)': r.scannedByUserId || 'ADMIN01',
      'BSR Return Date & Time': r.bsrReturnDateTime,
      'Returned By ID (BSR)': r.returnedByUserId || 'ADMIN01',
      'Returned By User': r.returnedByName || 'Admin',
      'Status': r.status,
      'Created At': r.createdAt
    }));
    const wsBSR = XLSX.utils.json_to_sheet(bsrData);
    XLSX.utils.book_append_sheet(wb, wsBSR, 'BSR Records');

    XLSX.writeFile(wb, `LLT_Lab_InOut_Records_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Toast Notification */}
      {actionToast && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-lg transition-all animate-in slide-in-from-top-2 ${
            actionToast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-emerald-950/40'
              : 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-rose-950/40'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionToast(null)}
            className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Compact Tab Controls & Actions (Clean & sleek without bulky banner) */}
      <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        
        {/* 2 MAIN TOP BUTTONS / TABS + EXPORT BUTTON */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-2.5 sm:max-w-md w-full">
            <button
              type="button"
              onClick={() => setActiveTab('ELT_RECORD')}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                activeTab === 'ELT_RECORD'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-lg shadow-cyan-950/80 ring-2 ring-cyan-400/40'
                  : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Send className="w-4 h-4 text-cyan-300" />
              <span>1. ELT RECORD</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                activeTab === 'ELT_RECORD' ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}>
                {eltRecords.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('BSR_RECORD')}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                activeTab === 'BSR_RECORD'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/80 ring-2 ring-emerald-400/40'
                  : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-emerald-300" />
              <span>2. BSR RECORD</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                activeTab === 'BSR_RECORD' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}>
                {bsrRecords.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('expanded')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'expanded'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Expanded Card View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Expanded</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopySyncSql}
                className={`px-3 py-2.5 rounded-l-xl border-y border-l font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                  copiedSql
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
                    : 'bg-slate-950 hover:bg-slate-800 text-cyan-300 hover:text-white border-cyan-800/60 hover:border-cyan-500'
                }`}
                title="1-Click Quick Copy In/Out (ELT & BSR) SQL Changes"
              >
                {copiedSql ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-cyan-400" />
                )}
                <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCopyModal(true)}
                className="px-2.5 py-2.5 rounded-r-xl border font-bold text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border-cyan-800/60 hover:border-cyan-500 transition-all cursor-pointer shrink-0"
                title="All Copy Options (SQL changes, All tables, JSON export, Serials)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
              title="Export all records to Excel (.xlsx)"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export Excel</span>
            </button>

            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/60 transition-all cursor-pointer shrink-0 active:scale-95"
                title="Open Scanner to Send ELT or Return BSR"
              >
                <ScanBarcode className="w-4 h-4 text-cyan-200" />
                <span>Scan Barcode</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === 'ELT_RECORD'
                ? "Search by Model Name, Series No., or Prefix..."
                : "Search by Model Name, Series No., or Return Date..."
            }
            className="w-full pl-10 pr-16 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

      </div>

      {/* =========================================================================
          TAB 1: ELT RECORD (Currently available ELT machines)
          ========================================================================= */}
      {activeTab === 'ELT_RECORD' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-cyan-400" />
              <span>Currently in ELT ({filteredELT.length} Units)</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Machines sent to ELT awaiting BSR return
            </span>
          </div>

          {filteredELT.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 space-y-2">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">No ELT Machine Records Found</p>
              <p className="text-xs text-slate-500">
                {searchTerm ? 'Try a different search term.' : 'Use the Barcode Scanner icon in header to scan and send machines to ELT.'}
              </p>
            </div>
          ) : viewMode === 'expanded' ? (
            /* ================= EXPANDED CARDS VIEW (ELT) ================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredELT.map((r, idx) => (
                <div 
                  key={r.id || idx}
                  className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 hover:border-cyan-500/50 shadow-lg shadow-black/40 hover:shadow-cyan-950/20 transition-all space-y-3"
                >
                  {/* Card Header: Unit # & Status */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                      Unit #{idx + 1}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-950 text-cyan-400 border border-cyan-800 inline-flex items-center gap-1">
                      <Send className="w-2.5 h-2.5" />
                      <span>{r.status || 'Sent to ELT'}</span>
                    </span>
                  </div>

                  {/* Model Name - Expanded, prominent display */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Model Name
                    </span>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-extrabold text-sm sm:text-base text-white tracking-wide">
                        {r.modelName}
                      </span>
                    </div>
                  </div>

                  {/* Series No. / Barcode with 1-Click Copy */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Series No. (Barcode)
                    </span>
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs font-bold text-cyan-300">
                      <span className="truncate pr-2">{r.serialNumber}</span>
                      <button
                        type="button"
                        onClick={() => handleCopySerial(r.serialNumber)}
                        className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                        title="Copy Serial Number"
                      >
                        {copiedSerial === r.serialNumber ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Material Code / Date & Time Details */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Prefix / Code</span>
                      <span className="font-mono text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 inline-block mt-0.5">
                        {r.materialCode}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">ELT Date & Time</span>
                      <span className="font-mono text-[11px] text-slate-300 inline-block mt-0.5">
                        {r.eltDate} {r.eltTime}
                      </span>
                    </div>
                  </div>

                  {/* Scanned By Operator ID */}
                  <div className="pt-2 border-t border-slate-900/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <User className="w-3 h-3 text-cyan-400" />
                      <span>Scanned By ID</span>
                    </span>
                    <span className="font-mono text-[11px] font-bold text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 inline-flex items-center gap-1">
                      {r.scannedByUserId || 'ADMIN01'}
                    </span>
                  </div>

                  {/* Action Buttons: Quick Return BSR & Delete */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isProcessingAction === r.serialNumber}
                      onClick={() => handleQuickReturnBSR(r.serialNumber)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 shadow-sm"
                    >
                      {isProcessingAction === r.serialNumber ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Return to BSR</span>
                        </>
                      )}
                    </button>

                    {confirmDeleteEltId === r.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await deleteELTRecord(r.id);
                            setConfirmDeleteEltId(null);
                            if (res && !res.success) {
                              showToast(res.error || `Failed to delete ${r.serialNumber}`, 'error');
                            } else {
                              showToast(`Deleted ELT record: ${r.serialNumber}`);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteEltId(null)}
                          className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEltId(r.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors cursor-pointer shrink-0"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ================= TABLE VIEW (ELT) ================= */
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[860px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3.5">#</th>
                    <th className="py-3 px-3.5">Model Name</th>
                    <th className="py-3 px-3.5">Series No.</th>
                    <th className="py-3 px-3.5">Material Code / Prefix</th>
                    <th className="py-3 px-3.5">ELT Send Date</th>
                    <th className="py-3 px-3.5">ELT Send Time</th>
                    <th className="py-3 px-3.5">Scanned By ID</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredELT.map((r, idx) => (
                    <tr key={r.id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-3.5 font-bold text-white text-xs whitespace-nowrap">
                        <span className="text-slate-100">{r.modelName}</span>
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-cyan-300 text-xs whitespace-nowrap">
                        {r.serialNumber}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-400 text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400">
                          {r.materialCode}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {r.eltDate}
                      </td>
                      <td className="py-3 px-3.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {r.eltTime}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400 font-bold inline-flex items-center gap-1.5">
                          <User className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span>{r.scannedByUserId || 'ADMIN01'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-950 text-cyan-400 border border-cyan-800 inline-flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          {r.status || 'Sent to ELT'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isProcessingAction === r.serialNumber}
                          onClick={() => handleQuickReturnBSR(r.serialNumber)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                          title="Return this machine to BSR"
                        >
                          {isProcessingAction === r.serialNumber ? (
                            <RefreshCw className="w-3 h-3 animate-spin inline" />
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" />
                              <span>BSR Return</span>
                            </span>
                          )}
                        </button>

                        {confirmDeleteEltId === r.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await deleteELTRecord(r.id);
                                setConfirmDeleteEltId(null);
                                if (res && !res.success) {
                                  showToast(res.error || `Failed to delete ${r.serialNumber}`, 'error');
                                } else {
                                  showToast(`Deleted ELT record: ${r.serialNumber}`);
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteEltId(null)}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteEltId(r.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: BSR RECORD (Returned machines data)
          ========================================================================= */}
      {activeTab === 'BSR_RECORD' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-400" />
              <span>Returned to BSR ({filteredBSR.length} Units)</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Machines completed in ELT and returned to BSR
            </span>
          </div>

          {filteredBSR.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">No BSR Return Records Found</p>
              <p className="text-xs text-slate-500">
                {searchTerm ? 'Try a different search term.' : 'Use Barcode Scanner (RETURN BSR) to return machines from ELT.'}
              </p>
            </div>
          ) : viewMode === 'expanded' ? (
            /* ================= EXPANDED CARDS VIEW (BSR) ================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredBSR.map((r, idx) => (
                <div 
                  key={r.id || idx}
                  className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 hover:border-emerald-500/50 shadow-lg shadow-black/40 hover:shadow-emerald-950/20 transition-all space-y-3"
                >
                  {/* Card Header: Unit # & Status */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                      Unit #{idx + 1}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 text-emerald-400 border border-emerald-800 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>{r.status || 'Returned to BSR'}</span>
                    </span>
                  </div>

                  {/* Model Name - Expanded, prominent display */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Model Name
                    </span>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-extrabold text-sm sm:text-base text-white tracking-wide">
                        {r.modelName}
                      </span>
                    </div>
                  </div>

                  {/* Series No. / Barcode with 1-Click Copy */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Series No. (Barcode)
                    </span>
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs font-bold text-emerald-300">
                      <span className="truncate pr-2">{r.serialNumber}</span>
                      <button
                        type="button"
                        onClick={() => handleCopySerial(r.serialNumber)}
                        className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                        title="Copy Serial Number"
                      >
                        {copiedSerial === r.serialNumber ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Prefix & Date/Time & Operator ID Details */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-900 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">Prefix / Code</span>
                      <span className="font-mono text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {r.materialCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">Sent to ELT</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {r.originalELTDateTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3 text-cyan-400" />
                        <span>Scanned By ID</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {r.scannedByUserId || 'ADMIN01'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-500 font-semibold">Returned to BSR</span>
                      <span className="font-mono text-[11px] text-emerald-400 font-bold">
                        {r.bsrReturnDateTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Returned By ID</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-emerald-800/60">
                        {r.returnedByUserId || 'ADMIN01'}
                      </span>
                    </div>
                  </div>

                  {/* Delete Action */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                    {confirmDeleteBsrId === r.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await deleteBSRRecord(r.id);
                            setConfirmDeleteBsrId(null);
                            if (res && !res.success) {
                              showToast(res.error || `Failed to delete ${r.serialNumber}`, 'error');
                            } else {
                              showToast(`Deleted BSR record: ${r.serialNumber}`);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-sm"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteBsrId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteBsrId(r.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg border border-transparent hover:border-rose-900/50 transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ================= TABLE VIEW (BSR) ================= */
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[940px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3.5">#</th>
                    <th className="py-3 px-3.5">Model Name</th>
                    <th className="py-3 px-3.5">Series No.</th>
                    <th className="py-3 px-3.5">Material Code / Prefix</th>
                    <th className="py-3 px-3.5">ELT Date & Time</th>
                    <th className="py-3 px-3.5">Scanned By ID</th>
                    <th className="py-3 px-3.5">BSR Return Time</th>
                    <th className="py-3 px-3.5">Returned By ID</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredBSR.map((r, idx) => (
                    <tr key={r.id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-3.5 font-bold text-white text-xs whitespace-nowrap">
                        <span className="text-slate-100">{r.modelName}</span>
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-emerald-300 text-xs whitespace-nowrap">
                        {r.serialNumber}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-400 text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400">
                          {r.materialCode}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {r.originalELTDateTime}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400 font-bold inline-flex items-center gap-1.5">
                          <User className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span>{r.scannedByUserId || 'ADMIN01'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-emerald-400 font-mono text-[11px] font-semibold whitespace-nowrap">
                        {r.bsrReturnDateTime}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 font-bold inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{r.returnedByUserId || 'ADMIN01'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 text-emerald-400 border border-emerald-800 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {r.status || 'Returned from BSR'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        {confirmDeleteBsrId === r.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await deleteBSRRecord(r.id);
                                setConfirmDeleteBsrId(null);
                                if (res && !res.success) {
                                  showToast(res.error || `Failed to delete ${r.serialNumber}`, 'error');
                                } else {
                                  showToast(`Deleted BSR record: ${r.serialNumber}`);
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteBsrId(null)}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBsrId(r.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete BSR record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Interactive Copy & SQL Options Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-bold shadow-lg shadow-cyan-950">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Copy Options & SQL Setup</h3>
                  <p className="text-xs text-slate-400">
                    Copy database scripts, SQL changes, or export active unit data to clipboard
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
              {/* Quick Action Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleCopyChoice('inout_sql')}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-800/60 hover:border-cyan-500 text-left transition-all group cursor-pointer hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-cyan-300 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-cyan-400" />
                      1. Copy In/Out SQL Changes
                    </span>
                    {copiedChoice === 'inout_sql' ? (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Only <code className="text-cyan-300 font-mono">elt_records</code> & <code className="text-cyan-300 font-mono">bsr_records</code> tables, RLS policies, replica identity full & Realtime.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyChoice('all_sql')}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-800/60 hover:border-emerald-500 text-left transition-all group cursor-pointer hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      2. Copy Complete Database SQL
                    </span>
                    {copiedChoice === 'all_sql' ? (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Full production script with all 13 tables, security policies, and indexes.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyChoice('elt_json')}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-all group cursor-pointer hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-white flex items-center gap-2">
                      <Send className="w-4 h-4 text-cyan-400" />
                      3. Copy ELT Records (JSON)
                    </span>
                    {copiedChoice === 'elt_json' ? (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Copies all {eltRecords.length} active ELT machines in structured JSON format.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyChoice('bsr_json')}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-all group cursor-pointer hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-white flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-emerald-400" />
                      4. Copy BSR Records (JSON)
                    </span>
                    {copiedChoice === 'bsr_json' ? (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Copies all {bsrRecords.length} active BSR machines in structured JSON format.
                  </p>
                </button>
              </div>

              {/* SQL Viewer & Selector */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSqlPreviewTab('inout')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        sqlPreviewTab === 'inout'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      In/Out SQL Script
                    </button>
                    <button
                      type="button"
                      onClick={() => setSqlPreviewTab('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        sqlPreviewTab === 'all'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Complete Schema SQL
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyChoice(sqlPreviewTab === 'inout' ? 'inout_sql' : 'all_sql')}
                    className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy This Script</span>
                  </button>
                </div>

                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-cyan-200/90 font-mono overflow-x-auto max-h-56 leading-relaxed select-all">
                  {sqlPreviewTab === 'inout' ? IN_OUT_UNITS_SQL_CHANGES : SUPABASE_SQL_SCHEMA}
                </pre>
              </div>

              {/* Instructions */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                <strong className="text-white font-bold block">Kaise use karein:</strong>
                <p>1. Upar diya gaya <strong>"Copy In/Out SQL Changes"</strong> button click karein.</p>
                <p>2. Supabase Dashboard (<span className="text-cyan-300 font-mono">supabase.com/dashboard</span>) me jakar apna project kholein.</p>
                <p>3. Left menu me <strong>SQL Editor</strong> par click karein aur New Query me paste karke <strong>Run</strong> button dabayein.</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
