import React, { useState, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Trash2, 
  Layers, 
  Check, 
  Download,
  Database
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  ModelRecord, 
  getAllModels, 
  saveOrUpdateModel, 
  bulkUploadModels, 
  deleteModel, 
  subscribeModelMaster 
} from '../../services/modelMasterStore';

export const ModelSheetManagementCard: React.FC = () => {
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Manual Model Entry State
  const [manualModelName, setManualModelName] = useState<string>('');
  const [manualMaterialCode, setManualMaterialCode] = useState<string>('');
  const [isUpdatingManual, setIsUpdatingManual] = useState<boolean>(false);
  const [manualFeedback, setManualFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Excel Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeModelMaster((list) => {
      setModels(list);
    });
    return () => unsub();
  }, []);

  // Filtered models for table
  const filteredModels = models.filter(m => {
    const term = searchTerm.toLowerCase();
    return (
      m.modelName.toLowerCase().includes(term) ||
      m.materialCode.toLowerCase().includes(term)
    );
  });

  // A. UPLOAD MODEL SHEET HANDLER (.xlsx, .xls)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset feedback
    setUploadFeedback(null);
    setIsUploadingFile(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        setUploadFeedback({
          type: 'error',
          message: 'The uploaded Excel file contains no data rows.'
        });
        setIsUploadingFile(false);
        return;
      }

      // Flexible column identification
      // Looks for keys like 'Model Name', 'Model', 'Material Code', 'Code', etc.
      const parsedItems: { modelName: string; materialCode: string }[] = [];

      for (const row of rawRows) {
        let modelName = '';
        let materialCode = '';

        for (const key of Object.keys(row)) {
          const normKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

          // Check for Model Name
          if (!modelName && (
            normKey.includes('modelname') || 
            normKey === 'model' || 
            normKey.includes('machinemodel') ||
            normKey.includes('modelno')
          )) {
            modelName = String(row[key] || '').trim();
          }

          // Check for Material Code
          if (!materialCode && (
            normKey.includes('materialcode') || 
            normKey.includes('matcode') || 
            normKey.includes('prefix') || 
            normKey === 'code' ||
            normKey.includes('material')
          )) {
            materialCode = String(row[key] || '').trim().toUpperCase();
          }
        }

        // Fallback: If 2 columns without matching headers, assume col 0 is Model, col 1 is Material Code or vice versa
        if (!modelName || !materialCode) {
          const values = Object.values(row).map(v => String(v || '').trim()).filter(Boolean);
          if (values.length >= 2) {
            if (!modelName && !materialCode) {
              // Heuristic: Material Code usually looks like alphanumeric (e.g. AADUU2000)
              if (/^[A-Z0-9]{5,15}$/i.test(values[0])) {
                materialCode = values[0].toUpperCase();
                modelName = values[1];
              } else {
                modelName = values[0];
                materialCode = values[1].toUpperCase();
              }
            }
          }
        }

        if (modelName && materialCode) {
          parsedItems.push({ modelName, materialCode });
        }
      }

      if (parsedItems.length === 0) {
        setUploadFeedback({
          type: 'error',
          message: 'Could not detect "Model Name" and "Material Code" columns in the sheet. Please check headers.'
        });
        setIsUploadingFile(false);
        return;
      }

      // Bulk upload to Model Master Store and Firestore
      const res = await bulkUploadModels(parsedItems);
      setUploadFeedback({
        type: 'success',
        message: `Successfully processed ${res.total} models (${res.added} newly added, ${res.updated} updated) into Firebase Model Master.`
      });

    } catch (err: any) {
      console.error(err);
      setUploadFeedback({
        type: 'error',
        message: err.message || 'Failed to read or parse Excel file.'
      });
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // B. MANUAL MODEL ENTRY HANDLER
  const handleManualUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualFeedback(null);

    const name = manualModelName.trim();
    const code = manualMaterialCode.trim().toUpperCase();

    if (!name || !code) {
      setManualFeedback({
        type: 'error',
        message: 'Both Model Name and Material Code are required fields.'
      });
      return;
    }

    setIsUpdatingManual(true);
    try {
      await saveOrUpdateModel(name, code);
      setManualFeedback({
        type: 'success',
        message: `Model "${name}" with Material Code "${code}" successfully saved to Firebase!`
      });
      setManualModelName('');
      setManualMaterialCode('');
    } catch (err: any) {
      setManualFeedback({
        type: 'error',
        message: err.message || 'Failed to save model.'
      });
    } finally {
      setIsUpdatingManual(false);
    }
  };

  // Download Sample Template
  const handleDownloadSampleTemplate = () => {
    const sampleData = [
      { 'Model Name': 'HSO53-3NT-I', 'Material Code': 'AADUU2000' },
      { 'Model Name': 'HSO35-2NT-I', 'Material Code': 'AAEUU2000' },
      { 'Model Name': 'HSO26-1NT-I', 'Material Code': 'AABUU1000' },
      { 'Model Name': 'HSU18-3NT-O', 'Material Code': 'AAFUU3000' },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Model Master');
    XLSX.writeFile(wb, 'LLT_Lab_Sample_Model_Sheet.xlsx');
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
      
      {/* Card Header (Requirement 9: Title "Model Sheet Management") */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950/60">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
              Model Sheet Management
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                Firebase Master
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Upload Excel Model Sheets (.xlsx, .xls) and manage prefix matching for barcode scanner
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadSampleTemplate}
          className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          title="Download Sample Excel Template"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Sample Template</span>
        </button>
      </div>

      {/* =========================================================================
          SECTION A: UPLOAD MODEL SHEET BUTTON
          ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-cyan-400" />
            <span>A. Upload Model Sheet (.xlsx, .xls)</span>
          </h4>
          <span className="text-[11px] text-slate-400 font-mono">
            Auto-parses Model Name & Material Code
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            disabled={isUploadingFile}
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/60 disabled:opacity-50 transition-all cursor-pointer active:scale-95"
          >
            {isUploadingFile ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Uploading & Parsing Sheet...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4 text-cyan-200" />
                <span>Upload Model Sheet</span>
              </>
            )}
          </button>

          <p className="text-xs text-slate-400">
            Upload your master Excel file. Matching Material Code / Model Prefix will be automatically updated in Firebase.
          </p>
        </div>

        {uploadFeedback && (
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
            uploadFeedback.type === 'success' 
              ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200' 
              : 'bg-rose-950/60 border-rose-500/80 text-rose-200'
          }`}>
            {uploadFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{uploadFeedback.message}</span>
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION B: MANUAL MODEL ENTRY (Model Name, Material Code, UPDATE button)
          ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>B. Manual Model Entry</span>
          </h4>
          <span className="text-[11px] text-slate-400 font-mono">
            Individual Model Addition / Update
          </span>
        </div>

        <form onSubmit={handleManualUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Model Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={manualModelName}
                onChange={(e) => setManualModelName(e.target.value)}
                placeholder="e.g. HSO53-3NT-I"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Material Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={manualMaterialCode}
                onChange={(e) => setManualMaterialCode(e.target.value)}
                placeholder="e.g. AADUU2000"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono uppercase text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-slate-400">
              Scanned barcodes will match the first 9 characters against this Material Code.
            </p>

            <button
              type="submit"
              disabled={isUpdatingManual || !manualModelName.trim() || !manualMaterialCode.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95 shrink-0"
            >
              {isUpdatingManual ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>UPDATE</span>
                </>
              )}
            </button>
          </div>

          {manualFeedback && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
              manualFeedback.type === 'success' 
                ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200' 
                : 'bg-rose-950/60 border-rose-500/80 text-rose-200'
            }`}>
              {manualFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{manualFeedback.message}</span>
            </div>
          )}
        </form>
      </div>

      {/* =========================================================================
          SECTION C: CURRENT REGISTERED MODELS DIRECTORY
          ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Registered Model Master Records ({models.length})
            </h4>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search model or code..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800 sticky top-0">
                <th className="py-2.5 px-3.5">#</th>
                <th className="py-2.5 px-3.5">Material Code (Prefix)</th>
                <th className="py-2.5 px-3.5">Model Name</th>
                <th className="py-2.5 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No matching model records found.
                  </td>
                </tr>
              ) : (
                filteredModels.map((m, idx) => (
                  <tr key={m.id || idx} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-2.5 px-3.5 font-mono font-bold text-cyan-400">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {m.materialCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold text-slate-200">
                      {m.modelName}
                    </td>
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      {confirmDeleteId === m.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              deleteModel(m.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(m.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          title="Delete model entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
