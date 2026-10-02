import React, { useState, useEffect } from 'react';
import { 
  FolderArchive, 
  Search, 
  Filter, 
  FileText, 
  Download, 
  Printer, 
  Trash2, 
  Eye, 
  Sparkles, 
  Cpu, 
  Activity, 
  Layers, 
  Calendar, 
  User, 
  CheckCircle2, 
  Copy, 
  Check, 
  ArrowUpRight,
  PlusCircle,
  FileSpreadsheet,
  RefreshCw,
  LayoutGrid,
  List,
  AlertTriangle,
  X,
  Package,
  Loader2
} from 'lucide-react';
import { 
  SavedReport, 
  ReportTagType, 
  getSavedReports, 
  deleteSavedReport, 
  subscribeReportRoom 
} from '../../services/reportRoomStore';
import { ReportPreviewModal } from '../Reports/ReportPreviewModal';
import { getMasterTemplate } from '../../services/reportTemplateStore';
import { downloadFile, downloadElementAsPdf, generateDocxBlob, generateReportBundleZip } from '../../utils/docxGenerator';

interface ReportRoomModuleProps {
  onNavigateToReportSection?: (initialTab?: 'proto' | 'reliability') => void;
  onNavigateToDashboard?: () => void;
}

export const ReportRoomModule: React.FC<ReportRoomModuleProps> = ({
  onNavigateToReportSection,
  onNavigateToDashboard
}) => {
  const [reports, setReports] = useState<SavedReport[]>(() => getSavedReports());
  const [activeTag, setActiveTag] = useState<ReportTagType | 'ALL'>('C Simulation');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'proto' | 'pp'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Preview Modal state
  const [previewReport, setPreviewReport] = useState<SavedReport | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom Delete Confirmation state
  const [deleteTarget, setDeleteTarget] = useState<SavedReport | null>(null);

  // Active download state for instant visual feedback
  const [downloadingState, setDownloadingState] = useState<{ id: string; type: 'docx' | 'zip' } | null>(null);
  const [downloadToast, setDownloadToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Subscribe to real-time report room updates
  useEffect(() => {
    const unsubscribe = subscribeReportRoom((newReports) => {
      setReports(newReports);
    });
    return unsubscribe;
  }, []);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setDownloadToast({ message, type });
    setTimeout(() => {
      setDownloadToast(null);
    }, 3000);
  };

  // Compute counts
  const cSimulationCount = reports.filter(r => r.tag === 'C Simulation' || r.reportType === 'cs-simulation').length;
  const cExperienceCount = reports.filter(r => r.tag === 'C Experience' || r.reportType === 'cs-experience').length;

  // Filter reports based on active tag & search
  const filteredReports = reports.filter((rep) => {
    // Tag matching
    if (activeTag === 'C Simulation' && !(rep.tag === 'C Simulation' || rep.reportType === 'cs-simulation')) {
      return false;
    }
    if (activeTag === 'C Experience' && !(rep.tag === 'C Experience' || rep.reportType === 'cs-experience')) {
      return false;
    }

    // Source filter
    if (sourceFilter !== 'ALL' && rep.unitSource !== sourceFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = rep.reportNo?.toLowerCase().includes(q);
      const matchModel = rep.modelName?.toLowerCase().includes(q);
      const matchSerial = rep.serialNo?.toLowerCase().includes(q);
      const matchRequest = rep.requestBy?.toLowerCase().includes(q);
      const matchStation = rep.station?.toLowerCase().includes(q);
      return matchNo || matchModel || matchSerial || matchRequest || matchStation;
    }

    return true;
  });

  const handleDeletePrompt = (report: SavedReport) => {
    setDeleteTarget(report);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    deleteSavedReport(targetId);
    setReports(prev => prev.filter(r => r.id !== targetId));
    setDeleteTarget(null);
  };

  const handleCopyReportNo = (reportNo: string, id: string) => {
    navigator.clipboard.writeText(reportNo);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDirectDocxDownload = async (report: SavedReport) => {
    if (downloadingState) return;
    setDownloadingState({ id: report.id, type: 'docx' });
    showToast(`⚡ Preparing DOCX report for #${report.reportNo}...`, 'info');

    // Allow UI to render spinner before starting file creation
    await new Promise(r => setTimeout(r, 40));

    try {
      const templateType = report.tag === 'C Experience' ? 'reliability' : 'proto';
      const masterTpl = getMasterTemplate(templateType);

      if (masterTpl && masterTpl.base64Data) {
        const docxBlob = generateDocxBlob(masterTpl.base64Data, report.dataValuesMap, report.photos || {});
        const safeModel = (report.modelName || 'Unit').replace(/[\s/\\?%*:|"<>]+/g, '_');
        const safeTag = report.tag.replace(/[\s/\\?%*:|"<>]+/g, '_');
        const safeReportNo = (report.reportNo || 'Report').replace(/[\s/\\?%*:|"<>]+/g, '_');
        downloadFile(docxBlob, `${safeTag}_${safeModel}_${safeReportNo}.docx`);
        showToast(`✅ DOCX Report downloaded successfully!`, 'success');
      } else {
        const content = JSON.stringify(report, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        downloadFile(blob, `${report.reportNo}_spec_report.json`);
        showToast(`✅ Report downloaded!`, 'success');
      }
    } catch (err) {
      console.error('Failed to generate docx:', err);
      showToast(`❌ Error generating report. Please try again.`, 'error');
    } finally {
      setDownloadingState(null);
    }
  };

  const handleDirectZipDownload = async (report: SavedReport) => {
    if (downloadingState) return;
    setDownloadingState({ id: report.id, type: 'zip' });
    showToast(`⚡ Packing ZIP bundle & photos for #${report.reportNo}...`, 'info');

    // Allow UI to render spinner before starting file creation
    await new Promise(r => setTimeout(r, 40));

    try {
      const templateType = report.tag === 'C Experience' ? 'reliability' : 'proto';
      const masterTpl = getMasterTemplate(templateType);

      if (masterTpl && masterTpl.base64Data) {
        const result = await generateReportBundleZip(
          masterTpl.base64Data,
          report.dataValuesMap,
          report.photos || {},
          report.tag === 'C Experience' ? 'Reliability Test Report' : 'Customer Simulation Report'
        );
        downloadFile(result.blob, result.fileName);
        showToast(`✅ ZIP Package (${result.photoCount} photos + DOCX) downloaded!`, 'success');
      } else {
        // Fallback to direct docx
        handleDirectDocxDownload(report);
      }
    } catch (err) {
      console.error('Failed to generate ZIP package:', err);
      showToast(`❌ Error packing ZIP. Please try again.`, 'error');
    } finally {
      setDownloadingState(null);
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4">
      {/* 1. The 2 Main Category Filter Buttons (C Simulation & C Experience) */}
      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* The 2 Primary Tag Toggle Buttons */}
        <div className="flex items-center gap-2 flex-1">
          {/* Button 1: C Simulation */}
          <button
            type="button"
            onClick={() => setActiveTag('C Simulation')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
              activeTag === 'C Simulation'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-950/60 ring-2 ring-cyan-400/30'
                : 'bg-slate-950 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Cpu className={`w-4 h-4 ${activeTag === 'C Simulation' ? 'text-white' : 'text-cyan-400'}`} />
            <span>C Simulation</span>
            <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full ${
              activeTag === 'C Simulation' 
                ? 'bg-white/20 text-white' 
                : 'bg-cyan-950 text-cyan-300 border border-cyan-800/80'
            }`}>
              {cSimulationCount}
            </span>
          </button>

          {/* Button 2: C Experience */}
          <button
            type="button"
            onClick={() => setActiveTag('C Experience')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
              activeTag === 'C Experience'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400/30'
                : 'bg-slate-950 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Activity className={`w-4 h-4 ${activeTag === 'C Experience' ? 'text-white' : 'text-emerald-400'}`} />
            <span>C Experience</span>
            <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full ${
              activeTag === 'C Experience' 
                ? 'bg-white/20 text-white' 
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
            }`}>
              {cExperienceCount}
            </span>
          </button>

          {/* Optional: All Tag View */}
          <button
            type="button"
            onClick={() => setActiveTag('ALL')}
            className={`hidden md:flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTag === 'ALL'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-800/60'
            }`}
          >
            <span>All ({reports.length})</span>
          </button>
        </div>

        {/* View Layout Toggle (Grid / List Table) */}
        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Search and Secondary Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        {/* Search Input */}
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={`Search ${activeTag === 'ALL' ? 'all' : activeTag} reports by Report No, Model Name, Serial, or Requestor...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Source Filter (Proto / PP / All) */}
        <div className="sm:col-span-4 flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Source:</span>
          {(['ALL', 'proto', 'pp'] as const).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setSourceFilter(src)}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all capitalize cursor-pointer ${
                sourceFilter === src
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {src === 'ALL' ? 'All' : src === 'proto' ? 'Proto' : 'PP'}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Reports Display List / Grid */}
      {filteredReports.length === 0 ? (
        /* Empty State */
        <div className="p-10 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
            <FolderArchive className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              No {activeTag === 'ALL' ? '' : activeTag} Reports Found
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              {searchQuery
                ? `No reports matched your search "${searchQuery}". Try changing or clearing search terms.`
                : `No ${activeTag} reports have been generated yet. Reports created in Generate Report will automatically appear here under their respective tags.`}
            </p>
          </div>

          {onNavigateToReportSection && (
            <button
              onClick={() => onNavigateToReportSection(activeTag === 'C Experience' ? 'reliability' : 'proto')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate {activeTag === 'ALL' ? 'a' : activeTag} Report Now</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => {
            const isCSimulation = report.tag === 'C Simulation' || report.reportType === 'cs-simulation';
            const photosCount = Object.keys(report.photos || {}).filter(k => Boolean(report.photos[k])).length;

            return (
              <div
                key={report.id}
                className={`p-4 rounded-2xl bg-slate-900 border transition-all duration-200 flex flex-col justify-between group hover:shadow-xl ${
                  isCSimulation
                    ? 'border-slate-800 hover:border-cyan-500/60 hover:shadow-cyan-950/30'
                    : 'border-slate-800 hover:border-emerald-500/60 hover:shadow-emerald-950/30'
                }`}
              >
                <div>
                  {/* Card Header: Tag & Unit Source & Actions */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    {/* Tag Badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isCSimulation
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {isCSimulation ? <Cpu className="w-3 h-3 text-cyan-400" /> : <Activity className="w-3 h-3 text-emerald-400" />}
                      <span>{report.tag}</span>
                    </span>

                    {/* Source & Date */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase text-[9px]">
                        {report.unitSource.toUpperCase()}
                      </span>
                      <span>{report.generatedDate}</span>
                    </div>
                  </div>

                  {/* Report No & Copy */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-sm font-black text-cyan-300 group-hover:text-cyan-200 transition-colors">
                      #{report.reportNo}
                    </span>
                    <button
                      onClick={() => handleCopyReportNo(report.reportNo, report.id)}
                      className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Copy Report Number"
                    >
                      {copiedId === report.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Model Name */}
                  <h3 className="text-sm font-extrabold text-white line-clamp-1 mb-2">
                    {report.modelName}
                  </h3>

                  {/* Specifications Summary Grid */}
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-[11px] mb-3 font-medium">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500 font-semibold">Serial No:</span>
                      <span className="font-mono font-bold text-white">{report.serialNo}</span>
                    </div>
                    {report.specs.coolingCapacity && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 font-semibold">Capacity:</span>
                        <span className="text-cyan-300 font-semibold truncate max-w-[170px]">{report.specs.coolingCapacity}</span>
                      </div>
                    )}
                    {report.specs.iseer && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 font-semibold">ISEER:</span>
                        <span className="text-emerald-400 font-bold">{report.specs.iseer}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500 font-semibold">Requested By:</span>
                      <span className="text-indigo-300 font-medium">{report.requestBy || 'Indrajit'}</span>
                    </div>
                  </div>

                  {/* Photos and Station Tag */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-3 px-1">
                    <span className="flex items-center gap-1 font-mono">
                      <span>Station:</span>
                      <strong className="text-slate-200">{report.station || 'Station 01'}</strong>
                    </span>
                    {photosCount > 0 && (
                      <span className="text-cyan-400 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-900">
                        {photosCount} photos attached
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewReport(report)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-extrabold text-[11px] border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Preview</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!downloadingState}
                    onClick={() => handleDirectZipDownload(report)}
                    className={`p-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center ${
                      downloadingState?.id === report.id && downloadingState?.type === 'zip'
                        ? 'bg-cyan-700 text-white animate-pulse'
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-500/40'
                    }`}
                    title="Download Complete Package (.ZIP) - DOCX Report + Photos Folder"
                  >
                    {downloadingState?.id === report.id && downloadingState?.type === 'zip' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Package className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!!downloadingState}
                    onClick={() => handleDirectDocxDownload(report)}
                    className={`p-2 rounded-xl transition-all cursor-pointer border active:scale-95 flex items-center justify-center ${
                      downloadingState?.id === report.id && downloadingState?.type === 'docx'
                        ? 'bg-slate-700 text-cyan-300 border-cyan-500/60 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                    }`}
                    title="Download Report (.docx)"
                  >
                    {downloadingState?.id === report.id && downloadingState?.type === 'docx' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePrompt(report)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-900 transition-all cursor-pointer active:scale-95"
                    title="Delete Report"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Tag</th>
                  <th className="p-3.5">Report No</th>
                  <th className="p-3.5">Model Name</th>
                  <th className="p-3.5">Serial No</th>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5">Requested By</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium">
                {filteredReports.map((report) => {
                  const isCSimulation = report.tag === 'C Simulation' || report.reportType === 'cs-simulation';
                  return (
                    <tr key={report.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Tag */}
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isCSimulation
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}>
                          {report.tag}
                        </span>
                      </td>

                      {/* Report No */}
                      <td className="p-3.5 font-mono font-bold text-cyan-300">
                        {report.reportNo}
                      </td>

                      {/* Model Name */}
                      <td className="p-3.5 font-bold text-white">
                        {report.modelName}
                      </td>

                      {/* Serial No */}
                      <td className="p-3.5 font-mono text-slate-300">
                        {report.serialNo}
                      </td>

                      {/* Source */}
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase text-[9px]">
                          {report.unitSource}
                        </span>
                      </td>

                      {/* Requested By */}
                      <td className="p-3.5 text-indigo-300">
                        {report.requestBy || 'Indrajit'}
                      </td>

                      {/* Date */}
                      <td className="p-3.5 font-mono text-slate-400">
                        {report.generatedDate}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewReport(report)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={!!downloadingState}
                            onClick={() => handleDirectZipDownload(report)}
                            className="p-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white transition-all cursor-pointer shadow-sm"
                            title="Download Package (.ZIP) - Report DOCX + Photos Folder"
                          >
                            {downloadingState?.id === report.id && downloadingState?.type === 'zip' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Package className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            disabled={!!downloadingState}
                            onClick={() => handleDirectDocxDownload(report)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Download .docx"
                          >
                            {downloadingState?.id === report.id && downloadingState?.type === 'docx' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeletePrompt(report)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Delete Report Confirmation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to permanently delete report <strong className="text-cyan-300 font-mono">#{deleteTarget.reportNo}</strong> ({deleteTarget.modelName}) from the Report Room?
              </p>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Category Tag:</span>
                <span className="text-white font-bold">{deleteTarget.tag}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Unit Serial:</span>
                <span className="text-slate-200">{deleteTarget.serialNo || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Generated Date:</span>
                <span className="text-slate-200">{deleteTarget.generatedDate}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Report Preview Modal */}
      {previewReport && (
        <ReportPreviewModal
          isOpen={Boolean(previewReport)}
          onClose={() => setPreviewReport(null)}
          masterTemplate={getMasterTemplate(previewReport.tag === 'C Experience' ? 'reliability' : 'proto')}
          reportTitle={previewReport.title || `${previewReport.tag} Report`}
          unitData={{
            ...previewReport.specs,
            ...previewReport.dataValuesMap,
            modelName: previewReport.modelName,
            reportNo: previewReport.reportNo,
            serialNo: previewReport.serialNo,
            station: previewReport.station,
            requestBy: previewReport.requestBy,
            unitSource: previewReport.unitSource,
          }}
          photoUrls={previewReport.photos || {}}
        />
      )}

      {/* Floating Status Notification Toast */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className={`px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md ${
            downloadToast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-900/20'
              : downloadToast.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-900/20'
              : 'bg-slate-900/90 text-cyan-200 border-cyan-500/40 shadow-cyan-900/20'
          }`}>
            {downloadToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : downloadToast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            )}
            <span>{downloadToast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
};
