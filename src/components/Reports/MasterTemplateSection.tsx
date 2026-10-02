import React, { useState, useEffect } from 'react';
import { 
  FileUp, 
  CheckCircle2, 
  Trash2, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  HardDrive,
  Loader2,
  Cloud,
  Database
} from 'lucide-react';
import { 
  MasterTemplate, 
  getCustomMasterTemplate, 
  getCustomMasterTemplateAsync,
  saveMasterTemplateAsync, 
  deleteMasterTemplateAsync,
  subscribeToMasterTemplates 
} from '../../services/reportTemplateStore';
import { arrayBufferToBase64 } from '../../utils/docxGenerator';

interface MasterTemplateSectionProps {
  reportType: string;
  reportTypeName?: string;
  onTemplateChange: (template: MasterTemplate | null) => void;
}

export const MasterTemplateSection: React.FC<MasterTemplateSectionProps> = ({
  reportType,
  reportTypeName = 'Customer Simulation Report',
  onTemplateChange
}) => {
  const [template, setTemplate] = useState<MasterTemplate | null>(() => getCustomMasterTemplate(reportType));
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Subscribe to realtime updates across Firebase & cache
  useEffect(() => {
    let isMounted = true;
    const initialSync = getCustomMasterTemplate(reportType);
    setTemplate(initialSync);
    onTemplateChange(initialSync);

    getCustomMasterTemplateAsync(reportType).then((fetched) => {
      if (isMounted) {
        setTemplate(fetched);
        onTemplateChange(fetched);
      }
    });

    const unsubscribe = subscribeToMasterTemplates((templates) => {
      if (isMounted) {
        const cur = templates[reportType];
        if (cur && cur.uploadedAt !== 'Built-in Master Format' && !cur.id?.startsWith('default-tpl-')) {
          setTemplate(cur);
          onTemplateChange(cur);
        } else {
          setTemplate(null);
          onTemplateChange(null);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [reportType]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setUploadError('Invalid file type. Only ".docx" files are accepted as Master Report Templates.');
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) {
          setUploadError('Failed to read file contents.');
          setIsUploading(false);
          return;
        }

        const base64 = arrayBufferToBase64(buffer);
        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newTemplate: MasterTemplate = {
          id: `tpl-${Date.now()}`,
          reportType,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: formattedDate,
          base64Data: base64,
          isFirebaseSynced: true
        };

        await saveMasterTemplateAsync(newTemplate);
        setTemplate(newTemplate);
        onTemplateChange(newTemplate);
      } catch (err) {
        console.error(err);
        setUploadError('Error processing DOCX template. Please try another file.');
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      setUploadError('Failed to read document file.');
      setIsUploading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleConfirmDelete = async () => {
    setIsUploading(true);
    try {
      await deleteMasterTemplateAsync(reportType);
      setTemplate(null);
      onTemplateChange(null);
    } catch (err) {
      console.error('Delete template error:', err);
    } finally {
      setIsUploading(false);
      setIsDeleteModalOpen(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-lg space-y-2.5">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/60">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
              <span>Master Report Template (.docx)</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 border border-amber-600/40 text-amber-300">
                <Database className="w-3 h-3 text-amber-400" />
                Firebase Synced
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 leading-tight">
              Official template for {reportTypeName} (stored in Firebase Firestore)
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] font-mono font-bold uppercase">
          {reportType} Template
        </span>
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* State A: Template Not Uploaded */}
      {!template ? (
        <div className="p-3 sm:p-4 rounded-lg border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-slate-950/60 transition-all flex flex-col sm:flex-row items-center justify-between gap-3 group">
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-800/80 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileUp className="w-4 h-4" />
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-200">No Custom Template Uploaded</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Upload to save to Firebase Firestore with placeholders like <code className="text-cyan-300 bg-slate-800 px-1 py-0.2 rounded font-mono text-[10px]">{"{{Model_Name}}"}</code>
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs shadow-md shadow-cyan-950 cursor-pointer transition-all active:scale-95 shrink-0">
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
            <span>Upload Template (.docx)</span>
            <input
              type="file"
              accept=".docx"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        /* State B: Template Uploaded Successfully */
        <div className="p-2.5 sm:p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-900/80 border border-emerald-700/80 text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                  Template Active
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded">
                  <Cloud className="w-2.5 h-2.5 text-cyan-400" />
                  Firebase Cloud Saved
                </span>
              </div>
              <p className="text-xs font-bold text-white font-mono truncate">
                {template.fileName}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-cyan-400" />
                  {template.uploadedAt}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <HardDrive className="w-3 h-3 text-slate-500" />
                  {formatFileSize(template.fileSize)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete File</span>
          </button>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-950 border border-rose-800">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Delete Master Template?</h3>
                <p className="text-xs text-slate-400">Action will remove file from Firebase Cloud & local storage</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              «Are you sure you want to delete the Master Report Template from Firebase?»
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-950 transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
