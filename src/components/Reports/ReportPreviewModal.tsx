import React, { useRef, useState } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Printer, 
  CheckCircle2, 
  Sparkles,
  Layers,
  Cpu,
  Package,
  Image as ImageIcon,
  Clock,
  Search,
  Check,
  Copy,
  Maximize2,
  FileCheck,
  Eye,
  LayoutGrid,
  FileSpreadsheet
} from 'lucide-react';
import { downloadFile, downloadElementAsPdf, generateDocxBlob, generateReportBundleZip } from '../../utils/docxGenerator';
import { MasterTemplate, getMasterTemplate } from '../../services/reportTemplateStore';
import { PICTURE_NOT_AVAILABLE_SVG } from '../../utils/placeholderImage';

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterTemplate: MasterTemplate | null;
  reportTitle: string;
  unitData: Record<string, any>;
  photoUrls: Record<string, string>;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  masterTemplate,
  reportTitle,
  unitData = {},
  photoUrls = {}
}) => {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const printableDocRef = useRef<HTMLDivElement>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'general' | 'dates' | 'nameplate' | 'parts' | 'photos' | 'conclusion'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'form' | 'document'>('form');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<{ label: string; url: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStage, setPdfStage] = useState('');
  const [isPdfComplete, setIsPdfComplete] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  // Safe helper to extract values from unitData with fuzzy fallbacks
  const getVal = (keys: string[], fallback = '—'): string => {
    if (!unitData) return fallback;
    for (const k of keys) {
      if (unitData[k] !== undefined && unitData[k] !== null && String(unitData[k]).trim() !== '' && String(unitData[k]).trim() !== 'undefined') {
        return String(unitData[k]);
      }
    }
    return fallback;
  };

  // Safe helper to extract photo URLs
  const getPhotoUrl = (keys: string[]): string => {
    if (!photoUrls) return '';
    for (const k of keys) {
      if (photoUrls[k] && typeof photoUrls[k] === 'string' && photoUrls[k].trim() !== '' && photoUrls[k] !== 'NA' && photoUrls[k] !== 'undefined') {
        return photoUrls[k];
      }
    }
    return '';
  };

  const indoorUnitPhotoUrl = getPhotoUrl([
    'PHOTO_Indoor_Unit',
    'PHOTO_INDOOR_UNIT',
    'indoorUnitPhoto',
    'indoorPhoto',
    'indoorUnit',
    'iduUnitPhoto',
    'PHOTO_IDU_Unit',
    'photo_indoorUnitPhoto'
  ]);

  // Form Fields Definition
  const formGeneral = [
    { label: 'Model Name', value: getVal(['Model_Name', 'modelName', 'Model', 'model']), keyTag: '{{Model_Name}}', color: 'text-white font-bold' },
    { label: 'Report Number', value: getVal(['Report_No', 'reportNo', 'Report_Number', 'reportNumber']), keyTag: '{{Report_No}}', color: 'text-cyan-300 font-mono font-bold' },
    { label: 'Sample Type', value: getVal(['Sample_Type', 'sampleType', 'Sample Type']), keyTag: '{{Sample_Type}}', color: 'text-cyan-200' },
    { label: 'Testing Station', value: getVal(['Station', 'station', 'Testing_Station']), keyTag: '{{Station}}', color: 'text-white' },
    { label: 'IDU Serial Number', value: getVal(['IDU_Serial_Number', 'iduSerialNumber', 'iduSerialNo', 'iduSerial', 'Serial_No', 'serialNo']), keyTag: '{{IDU_Serial_Number}}', color: 'text-emerald-300 font-mono' },
    { label: 'ODU Serial Number', value: getVal(['ODU_Serial_Number', 'oduSerialNumber', 'oduSerialNo', 'oduSerial']), keyTag: '{{ODU_Serial_Number}}', color: 'text-emerald-300 font-mono' },
    { label: 'Requested By', value: getVal(['Request_By', 'requestBy', 'Requested_By']), keyTag: '{{Request_By}}', color: 'text-white' },
    { label: 'Test Purpose', value: getVal(['Test_Purpose', 'testPurpose', 'purpose']), keyTag: '{{Test_Purpose}}', color: 'text-slate-200' },
    { label: 'Required Hours', value: getVal(['Required_Hour', 'requiredHour', 'Required_Hours', 'requiredHours']), keyTag: '{{Required_Hour}}', color: 'text-amber-300 font-mono' },
    { label: 'Done Hours', value: getVal(['Done_Hour', 'doneHour', 'Done_Hours', 'doneHours']), keyTag: '{{Done_Hour}}', color: 'text-emerald-400 font-mono' },
    { label: 'Material Code', value: getVal(['Material_Code', 'materialCode']), keyTag: '{{Material_Code}}', color: 'text-slate-300 font-mono' },
    { label: 'Version / Revision', value: getVal(['Version', 'version', 'Revision']), keyTag: '{{Version}}', color: 'text-slate-300 font-mono' },
  ];

  const formDates = [
    { label: 'Sample Received Date', value: getVal(['Sample_Received_Date', 'Sample_Received', 'sampleReceivedDate']), keyTag: '{{Sample_Received_Date}}', color: 'text-slate-200 font-mono' },
    { label: 'Test Commenced Date', value: getVal(['Test_Commenced_Date', 'Test_Commenced', 'testCommencedDate']), keyTag: '{{Test_Commenced_Date}}', color: 'text-slate-200 font-mono' },
    { label: 'Test Completed Date', value: getVal(['Test_Completed_Date', 'Test_Completed', 'testCompletedDate']), keyTag: '{{Test_Completed_Date}}', color: 'text-slate-200 font-mono' },
  ];

  const formNameplate = [
    { label: 'Cooling Capacity', value: getVal(['Cooling_Capacity', 'Cooling_capacity', 'coolingCapacity']), keyTag: '{{Cooling_Capacity}}', color: 'text-cyan-300 font-bold' },
    { label: 'Rated Cooling Power', value: getVal(['Rated_Cooling_Power', 'Rated_cooling_power', 'ratedCoolingPower', 'Rated_Power', 'ratedPower', 'Power_mode', 'powerMode']), keyTag: '{{Rated_Cooling_Power}}', color: 'text-amber-300 font-bold' },
    { label: 'Rated Power', value: getVal(['Rated_Power', 'ratedPower']), keyTag: '{{Rated_Power}}', color: 'text-white' },
    { label: 'Rated Current', value: getVal(['Rated_Current', 'ratedCurrent']), keyTag: '{{Rated_Current}}', color: 'text-white' },
    { label: 'Voltage / Supply', value: getVal(['Voltage', 'voltage']), keyTag: '{{Voltage}}', color: 'text-white' },
    { label: 'Refrigerant', value: getVal(['Refrigerant', 'refrigerant']), keyTag: '{{Refrigerant}}', color: 'text-emerald-300 font-mono' },
    { label: 'Gas Quantity', value: getVal(['Gas_Qty', 'gasQty', 'Gas_Quantity']), keyTag: '{{Gas_Qty}}', color: 'text-white' },
    { label: 'ISEER / Rating', value: getVal(['ISEER', 'iseer', 'ISEER_Rating']), keyTag: '{{ISEER}}', color: 'text-emerald-400 font-bold' },
    { label: 'Gas Injection Vol', value: getVal(['Gas_injection_Volume', 'Gas_Injection_Volume', 'gasInjectionVolume']), keyTag: '{{Gas_injection_Volume}}', color: 'text-slate-300 font-mono' },
    { label: 'IDU Main Checksum', value: getVal(['Main_Program_Checksum_IDU', 'mainProgramChecksumIdu']), keyTag: '{{Main_Program_Checksum_IDU}}', color: 'text-cyan-300 font-mono' },
    { label: 'ODU Main Checksum', value: getVal(['Main_Program_Checksum_ODU', 'mainProgramChecksumOdu']), keyTag: '{{Main_Program_Checksum_ODU}}', color: 'text-cyan-300 font-mono' },
    { label: 'IDU EE Checksum', value: getVal(['EE_Checksum_IDU', 'eeChecksumIdu']), keyTag: '{{EE_Checksum_IDU}}', color: 'text-indigo-300 font-mono' },
    { label: 'ODU EE Checksum', value: getVal(['EE_Checksum_ODU', 'eeChecksumOdu']), keyTag: '{{EE_Checksum_ODU}}', color: 'text-indigo-300 font-mono' },
  ];

  const formParts = [
    {
      title: 'IDU Fan Motor',
      accentColor: 'text-cyan-300',
      spec: getVal(['IDU_Motor_Spec', 'iduMotorSpec']),
      partCode: getVal(['IDU_Motor_Part_Code', 'iduMotorPartCode']),
      supplier: getVal(['IDU_Motor_Supplier', 'iduMotorSupplier']),
    },
    {
      title: 'IDU Main PCB',
      accentColor: 'text-cyan-300',
      spec: 'Main Control Micro-Controller Board',
      partCode: getVal(['IDU_PCB_Part_Code', 'iduPcbPartCode']),
      supplier: getVal(['IDU_PCB_Supplier', 'iduPcbSupplier']),
    },
    {
      title: 'ODU Fan Motor',
      accentColor: 'text-indigo-300',
      spec: getVal(['ODU_Motor_Spec', 'oduMotorSpec']),
      partCode: getVal(['ODU_Motor_Part_Code', 'oduMotorPartCode']),
      supplier: getVal(['ODU_Motor_Supplier', 'oduMotorSupplier']),
    },
    {
      title: 'ODU Inverter PCB',
      accentColor: 'text-indigo-300',
      spec: 'Inverter Drive Power Board',
      partCode: getVal(['ODU_PCB_Part_Code', 'oduPcbPartCode']),
      supplier: getVal(['ODU_PCB_Supplier', 'oduPcbSupplier']),
    },
    {
      title: 'Compressor',
      accentColor: 'text-emerald-300',
      spec: getVal(['Compressor_Spec', 'Compressor _Spec', 'compressorSpec']),
      partCode: getVal(['Compressor_Part_Code', 'compressorPartCode']),
      supplier: getVal(['Compressor_Supplier', 'compressorSupplier']),
    },
    {
      title: 'Electronic Expansion Valve (EEV)',
      accentColor: 'text-emerald-300',
      spec: getVal(['EEV_Spec', 'eevSpec']),
      partCode: getVal(['EEV_Part_Code', 'eevPartCode']),
      supplier: getVal(['EEV_Supplier', 'eevSupplier']),
    },
  ];

  const photoCategories = [
    {
      name: 'Packaging & Unboxing',
      icon: '📦',
      photos: [
        { label: 'Indoor Unit', key: 'PHOTO_Indoor_Unit', url: getPhotoUrl(['PHOTO_Indoor_Unit', 'PHOTO_INDOOR_UNIT', 'indoorUnitPhoto', 'indoorPhoto', 'indoorUnit']) },
        { label: 'Product Packing', key: 'PHOTO_Product_Packing', url: getPhotoUrl(['PHOTO_Product_Packing', 'PHOTO_PRODUCT_PACKING', 'productPhoto', 'productPacking']) },
        { label: 'Packing Box', key: 'PHOTO_Packing_Box', url: getPhotoUrl(['PHOTO_Packing_Box', 'PHOTO_PACKING_BOX', 'packingBoxPhoto', 'packingBox']) },
      ]
    },
    {
      name: 'Indoor Unit (IDU) Assembly',
      icon: '🏢',
      photos: [
        { label: 'IDU Motor', key: 'PHOTO_IDU_Motor', url: getPhotoUrl(['PHOTO_IDU_Motor', 'PHOTO_IDU_MOTOR', 'iduMotorPhoto', 'motorPhoto']) },
        { label: 'IDU PCB', key: 'PHOTO_IDU_PCB', url: getPhotoUrl(['PHOTO_IDU_PCB', 'PHOTO_IDU_Pcb', 'iduPcbPhoto']) },
        { label: 'IDU Name Plate', key: 'PHOTO_IDU_Product_Name_Plate', url: getPhotoUrl(['PHOTO_IDU_Product_Name_Plate', 'PHOTO_IDU_PRODUCT_NAME_PLATE', 'PHOTO_IDU_Name_Plate', 'iduNameplatePhoto']) },
        { label: 'Remote', key: 'PHOTO_Remote', url: getPhotoUrl(['PHOTO_Remote', 'PHOTO_REMOTE', 'remotePhoto', 'stickerPhoto']) },
      ]
    },
    {
      name: 'Outdoor Unit (ODU) Assembly',
      icon: '⚙️',
      photos: [
        { label: 'ODU Name Plate', key: 'PHOTO_ODU_Name_Plate', url: getPhotoUrl(['PHOTO_ODU_Name_Plate', 'PHOTO_ODU_NAME_PLATE', 'oduNameplatePhoto']) },
        { label: 'ODU Motor', key: 'PHOTO_ODU_Motor', url: getPhotoUrl(['PHOTO_ODU_Motor', 'PHOTO_ODU_MOTOR', 'oduMotorPhoto']) },
        { label: 'ODU PCB', key: 'PHOTO_ODU_PCB', url: getPhotoUrl(['PHOTO_ODU_PCB', 'PHOTO_ODU_Pcb', 'oduPcbPhoto']) },
      ]
    },
    {
      name: 'Refrigeration & Expansion Circuit',
      icon: '❄️',
      photos: [
        { label: 'Electronic Expansion Valve (EEV)', key: 'PHOTO_Electronic_Expansion_Valve', url: getPhotoUrl(['PHOTO_Electronic_Expansion_Valve', 'PHOTO_ELECTRONIC_EXPANSION_VALVE', 'PHOTO_EEV', 'oduEevPhoto', 'eevPhoto']) },
        { label: 'ODU Compressor', key: 'PHOTO_ODU_Compressor', url: getPhotoUrl(['PHOTO_ODU_Compressor', 'PHOTO_Compressor', 'oduCompressorPhoto', 'compressorPhoto']) },
      ]
    }
  ];

  const totalPhotosAttached = photoCategories.reduce((acc, cat) => acc + cat.photos.filter(p => !!p.url).length, 0);

  const testConclusion = getVal(['Test_Conclusion', 'testConclusion', 'conclusion'], 'Sample unit underwent complete performance and thermal stress testing according to standard protocols. All components and electrical parameters met design specifications without defects.');
  const remarks = getVal(['Remarks', 'remarks'], 'Quality Lab Certified Pass. Verified by Testing Incharge.');

  const modelName = getVal(['Model_Name', 'modelName', 'Model'], 'Proto Unit');
  const reportNo = getVal(['Report_No', 'reportNo'], 'REP-2026-001');

  const getEffectiveTemplate = (): MasterTemplate | null => {
    if (masterTemplate && masterTemplate.base64Data) return masterTemplate;
    const isReliability = reportTitle.toLowerCase().includes('reliability') || reportTitle.toLowerCase().includes('experience');
    return getMasterTemplate(isReliability ? 'reliability' : 'proto');
  };

  const handleDownloadDocx = () => {
    const tpl = getEffectiveTemplate();
    if (!tpl?.base64Data) {
      alert("No master template available.");
      return;
    }

    try {
      const docxBlob = generateDocxBlob(tpl.base64Data, unitData, photoUrls);
      const safeName = modelName.replace(/\s+/g, '_');
      downloadFile(docxBlob, `${reportTitle.replace(/\s+/g, '_')}_${safeName}.docx`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate DOCX report.");
    }
  };

  const handleDownloadZipPackage = async () => {
    const tpl = getEffectiveTemplate();
    if (!tpl?.base64Data) {
      alert("No master template available.");
      return;
    }

    setIsZipping(true);
    try {
      const result = await generateReportBundleZip(
        tpl.base64Data,
        unitData,
        photoUrls,
        reportTitle
      );
      downloadFile(result.blob, result.fileName);
    } catch (err) {
      console.error(err);
      alert("Failed to generate Report ZIP Package.");
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfProgress(12);
    setPdfStage('Preparing...');
    setIsPdfComplete(false);

    try {
      const target = printableDocRef.current;
      if (!target) {
        alert("Unable to find printable report element.");
        return;
      }
      const safeName = modelName.replace(/\s+/g, '_');
      await downloadElementAsPdf(
        target, 
        `${reportTitle.replace(/\s+/g, '_')}_${safeName}.pdf`,
        (progress, stage) => {
          setPdfProgress(progress);
          setPdfStage(stage);
        }
      );

      setPdfProgress(100);
      setPdfStage('Complete');
      setIsPdfComplete(true);

      setTimeout(() => {
        setIsPdfComplete(false);
        setPdfProgress(0);
        setPdfStage('');
      }, 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to export PDF report. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyValue = (val: string, keyId: string) => {
    if (!val || val === '—') return;
    navigator.clipboard.writeText(val);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const q = searchQuery.toLowerCase().trim();
  const matchFilter = (label: string, val: string) => {
    if (!q) return true;
    return label.toLowerCase().includes(q) || val.toLowerCase().includes(q);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div 
        ref={previewContainerRef}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95"
      >
        
        {/* Top Header & Action Bar */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-lg shadow-cyan-900/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                  {reportTitle}
                </h2>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full font-mono font-bold">
                  #{reportNo}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Close Button Only in Header for a clean uncluttered view */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ===================== VIEW MODE: FORM UI (Default) ===================== */}
        {viewMode === 'form' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category Navigation Bar & Search */}
            <div className="p-3 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between gap-3 overflow-x-auto shrink-0">
              <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                {[
                  { id: 'all', label: 'All Sections' },
                  { id: 'general', label: '1. General Info' },
                  { id: 'dates', label: '2. Dates & Schedule' },
                  { id: 'nameplate', label: '3. Nameplate Specs' },
                  { id: 'parts', label: '4. Critical Parts' },
                  { id: 'photos', label: `5. Photographs (${totalPhotosAttached}/11)` },
                  { id: 'conclusion', label: '6. Conclusion' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Quick Search inside preview */}
              <div className="relative w-48 sm:w-56 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter parameters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 bg-slate-950/40">
              
              {/* TOP HERO: Model Name & Indoor Unit Photo Showcase */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 shadow-lg space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800/80 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400">
                      Machine Profile
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-white tracking-wide flex items-center gap-2 mt-0.5">
                      Model: {modelName}
                    </h3>
                  </div>

                  {/* Red Mark Position: Download PDF Button right across from Model Name with in-button animated download progress */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isGeneratingPdf}
                      onClick={handleDownloadPdf}
                      className={`relative overflow-hidden py-2 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 min-w-[155px] transition-all active:scale-[0.98] cursor-pointer shadow-lg ${
                        isPdfComplete 
                          ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-emerald-950/40 ring-1 ring-emerald-400/50'
                          : isGeneratingPdf
                          ? 'bg-slate-900 border border-slate-700 text-white shadow-rose-950/50'
                          : 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-400 text-white shadow-rose-950/40 ring-1 ring-rose-400/40'
                      }`}
                      title="Download complete report as PDF"
                    >
                      {/* Animated Progress Fill Bar inside Button */}
                      {isGeneratingPdf && (
                        <>
                          <div 
                            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 transition-all duration-300 ease-out opacity-90"
                            style={{ width: `${Math.max(8, pdfProgress)}%` }}
                          />
                          {/* Animated Shimmer Stripe Overlay */}
                          <div 
                            className="absolute inset-0 opacity-30 animate-pulse bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:16px_16px]" 
                          />
                        </>
                      )}

                      {/* Button Content */}
                      <div className="relative z-10 flex items-center justify-center gap-2 w-full">
                        {isPdfComplete ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-100 animate-bounce" />
                            <span className="font-extrabold text-white">Downloaded! ✓</span>
                          </>
                        ) : isGeneratingPdf ? (
                          <>
                            <div className="relative flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              <Download className="w-2 h-2 text-white absolute animate-bounce" />
                            </div>
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="font-extrabold text-white text-[11px]">{pdfProgress}%</span>
                              <span className="text-[10px] text-white/90 truncate max-w-[90px]">{pdfStage || 'Downloading...'}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 text-white group-hover:-translate-y-0.5 transition-transform" />
                            <span>Download PDF</span>
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 px-2.5 py-1 rounded-lg">
                    Station: {getVal(['Station', 'station'], 'Station 01')}
                  </span>
                  <span className="text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg">
                    IDU Serial: {getVal(['IDU_Serial_Number', 'iduSerialNumber', 'Serial_No', 'serialNo'], '—')}
                  </span>
                </div>

                {/* Indoor Unit Photo Feature Card */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col items-center space-y-2">
                    <div className="flex items-center justify-between w-full px-1">
                      <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                        Indoor Unit (IDU) Photo
                      </span>
                      {indoorUnitPhotoUrl ? (
                        <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                          Attached
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          No Photo
                        </span>
                      )}
                    </div>

                    <div 
                      onClick={() => indoorUnitPhotoUrl && setSelectedPhotoModal({ label: 'Indoor Unit (IDU)', url: indoorUnitPhotoUrl })}
                      className={`w-full aspect-[16/9] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative ${
                        indoorUnitPhotoUrl ? 'cursor-pointer group hover:border-cyan-500/60 shadow-inner' : ''
                      }`}
                    >
                      {indoorUnitPhotoUrl ? (
                        <>
                          <img 
                            src={indoorUnitPhotoUrl} 
                            alt="Indoor Unit" 
                            className="w-full h-full object-contain p-1.5 transition-transform duration-300 hover:scale-105" 
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[1px]">
                            <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-cyan-300 flex items-center gap-1 text-[11px] font-bold shadow-md">
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>Zoom Indoor Unit</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-slate-500 flex flex-col items-center gap-1.5 p-4 text-center">
                          <ImageIcon className="w-8 h-8 text-slate-700" />
                          <span>Indoor Unit Photo will appear here when uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-7 space-y-3.5 flex flex-col justify-between">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Cooling Capacity</span>
                        <span className="text-xs text-cyan-300 font-extrabold">{getVal(['Cooling_Capacity', 'Cooling_capacity', 'coolingCapacity'])}</span>
                      </div>
                      <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Power Mode</span>
                        <span className="text-xs text-white font-semibold">{getVal(['Power_mode', 'Power_Mode', 'powerMode'])}</span>
                      </div>
                      <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Refrigerant</span>
                        <span className="text-xs text-emerald-300 font-mono font-bold">{getVal(['Refrigerant', 'refrigerant'])}</span>
                      </div>
                      <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Gas Injection</span>
                        <span className="text-xs text-slate-200 font-mono">{getVal(['Gas_injection_Volume', 'Gas_Injection_Volume', 'gasInjectionVolume'])}</span>
                      </div>
                      <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">ISEER Rating</span>
                        <span className="text-xs text-emerald-400 font-bold">{getVal(['ISEER', 'iseer'])}</span>
                      </div>
                      <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Inspection Photos</span>
                        <span className="text-xs text-cyan-400 font-mono font-bold">{totalPhotosAttached} / 11 Attached</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 1: General & Identification Information */}
              {(activeTab === 'all' || activeTab === 'general') && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs sm:text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-cyan-400" />
                      1. General &amp; Identification Information
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono font-bold bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">12 Parameters</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {formGeneral.filter(item => matchFilter(item.label, item.value)).map((item, idx) => (
                      <div key={idx} className="space-y-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 group hover:border-cyan-500/40 transition-all flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">
                            {item.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyValue(item.value, `gen-${idx}`)}
                            className="text-slate-500 hover:text-cyan-300 transition-colors p-0.5 cursor-pointer opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                            title="Copy Value"
                          >
                            {copiedKey === `gen-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between min-h-[38px] gap-1">
                          <span className={`${item.color} text-xs truncate max-w-full font-medium tracking-wide`}>
                            {item.value}
                          </span>
                          <span className="text-[8px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/80 shrink-0">{item.keyTag}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 2: Dates & Schedule */}
              {(activeTab === 'all' || activeTab === 'dates') && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs sm:text-sm font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      2. Testing Dates &amp; Timeline
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono font-bold bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">3 Parameters</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {formDates.filter(item => matchFilter(item.label, item.value)).map((item, idx) => (
                      <div key={idx} className="space-y-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 group hover:border-indigo-500/40 transition-all flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">
                            {item.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyValue(item.value, `date-${idx}`)}
                            className="text-slate-500 hover:text-cyan-300 transition-colors p-0.5 cursor-pointer opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                            title="Copy Value"
                          >
                            {copiedKey === `date-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between min-h-[38px] gap-1">
                          <span className={`${item.color} text-xs truncate max-w-full font-medium tracking-wide`}>
                            {item.value}
                          </span>
                          <span className="text-[8px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/80 shrink-0">{item.keyTag}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 3: Nameplate Specifications & Electrical Parameters */}
              {(activeTab === 'all' || activeTab === 'nameplate') && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-400" />
                      3. Nameplate Specifications &amp; Ratings
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono font-bold bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">14 Parameters</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {formNameplate.filter(item => matchFilter(item.label, item.value)).map((item, idx) => (
                      <div key={idx} className="space-y-1.5 bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 group hover:border-amber-500/40 transition-all flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">
                            {item.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyValue(item.value, `np-${idx}`)}
                            className="text-slate-500 hover:text-cyan-300 transition-colors p-0.5 cursor-pointer opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                            title="Copy Value"
                          >
                            {copiedKey === `np-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between min-h-[38px] gap-1">
                          <span className={`${item.color} text-xs truncate max-w-full font-medium tracking-wide`}>
                            {item.value}
                          </span>
                          <span className="text-[8px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/80 shrink-0">{item.keyTag}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 4: Critical Parts & Components */}
              {(activeTab === 'all' || activeTab === 'parts') && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      4. Critical Parts &amp; Components (Spec, Part Code, Supplier)
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono font-bold bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">6 Sub-Assemblies</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                    {formParts.map((part, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <span className={`text-xs font-black ${part.accentColor} uppercase tracking-wider block`}>
                            {part.title}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 uppercase">Sub-Assy {idx + 1}</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800/80 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0 w-24">Specification:</span>
                            <span className="text-white text-xs font-semibold truncate text-right">{part.spec}</span>
                          </div>

                          <div className="bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800/80 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0 w-24">Part Code:</span>
                            <span className="text-cyan-300 font-mono text-xs font-bold truncate text-right">{part.partCode}</span>
                          </div>

                          <div className="bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800/80 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0 w-24">Supplier:</span>
                            <span className="text-slate-200 text-xs font-medium truncate text-right">{part.supplier}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 5: Sample Photographs Gallery */}
              {(activeTab === 'all' || activeTab === 'photos') && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs sm:text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-cyan-400" />
                      5. Inspection Photographs Gallery
                    </span>
                    <span className="text-[11px] font-bold text-cyan-300 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800">
                      {totalPhotosAttached} Attached of 11 Total
                    </span>
                  </div>

                  <div className="space-y-6">
                    {photoCategories.map((cat, cIdx) => (
                      <div key={cIdx} className="space-y-2.5">
                        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-1.5">
                          <span className="text-sm">{cat.icon}</span>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                            {cat.name}
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                          {cat.photos.map((item, pIdx) => {
                            const hasPhoto = !!item.url;
                            return (
                              <div 
                                key={pIdx}
                                className="bg-slate-950 border border-slate-800/90 p-3 rounded-2xl flex flex-col items-center space-y-2 group hover:border-cyan-500/60 transition-all shadow-sm"
                              >
                                <div className="flex items-center justify-between w-full px-1">
                                  <span className="text-[11px] font-bold text-slate-200 truncate max-w-[140px]">
                                    {item.label}
                                  </span>
                                  {hasPhoto ? (
                                    <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                                      Attached
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                      Empty
                                    </span>
                                  )}
                                </div>

                                <div 
                                  onClick={() => hasPhoto && setSelectedPhotoModal({ label: item.label, url: item.url })}
                                  className={`w-full aspect-[4/3] max-h-[160px] bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative shadow-inner ${
                                    hasPhoto ? 'cursor-pointer group-hover:shadow-lg group-hover:shadow-cyan-950/40' : ''
                                  }`}
                                >
                                  {hasPhoto ? (
                                    <>
                                      <img 
                                        src={item.url} 
                                        alt={item.label} 
                                        className="w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105" 
                                      />
                                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[1px]">
                                        <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-cyan-300 flex items-center gap-1 text-[10px] font-bold shadow-md">
                                          <Maximize2 className="w-3.5 h-3.5" />
                                          <span>Zoom</span>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-[10px] text-slate-500 font-medium text-center p-3 flex flex-col items-center justify-center gap-1.5">
                                      <ImageIcon className="w-6 h-6 text-slate-700" />
                                      <span>No Photo Attached</span>
                                    </div>
                                  )}
                                </div>

                                <span className="text-[9px] font-mono text-slate-500 text-center truncate max-w-full">
                                  {item.key}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 6: Conclusion & Remarks */}
              {(activeTab === 'all' || activeTab === 'conclusion') && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      6. Final Test Conclusion &amp; Quality Remarks
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono font-bold">Certified Pass</span>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Test Conclusion Statement
                      </span>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium italic">
                        "{testConclusion}"
                      </p>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/90 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Remarks / Authorization:</span>
                        <span className="text-emerald-300 font-semibold">{remarks}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block font-mono">Date Verified:</span>
                        <span className="text-slate-300 font-mono font-bold">{new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ===================== VIEW MODE: PRINTABLE A4 SHEET ===================== */}
        <div className={`flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-950/60 ${viewMode === 'document' ? 'block' : 'fixed left-[-9999px] top-0 pointer-events-none opacity-0'}`}>
          <div 
            ref={printableDocRef}
            className="max-w-4xl mx-auto bg-white text-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 space-y-4 font-sans border border-slate-200"
            style={{ minHeight: '1000px' }}
          >
            {/* Document Header */}
            <div className="border-b-4 border-cyan-800 pb-3 flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-wide">
                  {modelName}
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Document Reference: <strong className="text-slate-800 font-mono">{reportNo}</strong>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono text-slate-500 block">Date: {new Date().toLocaleDateString()}</span>
                <span className="text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-300 font-bold px-2.5 py-0.5 rounded uppercase">
                  Technical Specification Report
                </span>
              </div>
            </div>

            {/* TOP FEATURE: Model Name & Indoor Unit Photo Showcase */}
            <div className="bg-slate-50 border-2 border-cyan-700/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-center gap-5">
              <div className="w-full sm:w-2/5 flex flex-col items-center">
                <div className="w-full h-40 bg-white border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center p-2 shadow-inner">
                  {indoorUnitPhotoUrl ? (
                    <img 
                      src={indoorUnitPhotoUrl} 
                      alt="Indoor Unit" 
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain" 
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (!img.src.startsWith('data:image/svg+xml')) {
                          img.src = PICTURE_NOT_AVAILABLE_SVG;
                        }
                      }}
                    />
                  ) : (
                    <div className="text-slate-400 text-xs flex flex-col items-center gap-1.5 text-center">
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                      <span>Indoor Unit (IDU) Photo</span>
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-black text-cyan-900 mt-1.5 uppercase tracking-wider">
                  Indoor Unit (IDU) Sample Photo
                </span>
              </div>

              <div className="w-full sm:w-3/5 space-y-2">
                <div className="border-b border-slate-300 pb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tested Equipment / Model</span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 font-mono">{modelName}</h2>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Testing Station:</span>
                    <strong className="text-slate-800">{getVal(['Station', 'station'], 'Station 01')}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Sample Type:</span>
                    <strong className="text-cyan-900">{getVal(['Sample_Type', 'sampleType'], 'Proto')}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">IDU Serial Number:</span>
                    <strong className="font-mono text-cyan-900 font-bold">{getVal(['IDU_Serial_Number', 'iduSerialNumber', 'Serial_No', 'serialNo'], '—')}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">ODU Serial Number:</span>
                    <strong className="font-mono text-cyan-900 font-bold">{getVal(['ODU_Serial_Number', 'oduSerialNumber'], '—')}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Cooling Capacity:</span>
                    <strong className="text-slate-900 font-mono">{getVal(['Cooling_Capacity', 'Cooling_capacity', 'coolingCapacity'])}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Refrigerant:</span>
                    <strong className="text-slate-900 font-mono">{getVal(['Refrigerant', 'refrigerant'])}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* General Unit Information Table */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-900 bg-cyan-50 px-3 py-1.5 rounded-t-lg border border-cyan-200 border-l-4 border-l-cyan-700">
                1. General Sample Details
              </h3>
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <tbody className="divide-y divide-slate-300">
                  <tr>
                    <td className="w-1/4 px-2.5 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Model Name:</td>
                    <td className="w-1/4 px-2.5 py-1.5 font-bold text-slate-900 border-r border-slate-300">{modelName}</td>
                    <td className="w-1/4 px-2.5 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Sample Type:</td>
                    <td className="w-1/4 px-2.5 py-1.5 font-bold text-cyan-900">{getVal(['Sample_Type', 'sampleType'], 'Proto')}</td>
                  </tr>
                  <tr>
                    <td className="w-1/4 px-2.5 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Report Number:</td>
                    <td className="w-1/4 px-2.5 py-1.5 font-mono font-bold text-slate-900 border-r border-slate-300">{reportNo}</td>
                    <td className="w-1/4 px-2.5 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Requested By:</td>
                    <td className="w-1/4 px-2.5 py-1.5 font-semibold text-slate-900">{getVal(['Request_By', 'requestBy'], 'Indrajit')}</td>
                  </tr>
                  <tr>
                    <td className="w-1/4 px-2.5 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Sample Received:</td>
                    <td className="w-1/4 px-2.5 py-1.5 font-mono text-slate-800 border-r border-slate-300">{getVal(['Sample_Received_Date', 'Sample_Received', 'sampleReceivedDate'], '—')}</td>
                    <td className="w-1/4 px-2.5 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Test Commenced:</td>
                    <td className="w-1/4 px-2.5 py-1.5 font-mono text-slate-800">{getVal(['Test_Commenced_Date', 'Test_Commenced', 'testCommencedDate'], '—')}</td>
                  </tr>
                  <tr>
                    <td className="w-1/4 px-2.5 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Test Completed:</td>
                    <td className="w-1/4 px-2.5 py-1.5 font-mono text-slate-800 border-r border-slate-300">{getVal(['Test_Completed_Date', 'Test_Completed', 'testCompletedDate'], '—')}</td>
                    <td className="w-1/4 px-2.5 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Testing Lead:</td>
                    <td className="w-1/4 px-2.5 py-1.5 font-semibold text-slate-900">{getVal(['Tested_By', 'testedBy'], 'Indrajit Sharma')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Performance Specifications & Checksums */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-900 bg-cyan-50 px-3 py-1.5 rounded-t-lg border border-cyan-200 border-l-4 border-l-cyan-700">
                2. Rating, Electrical &amp; Firmware Checksums
              </h3>
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[11px]">
                    <th className="w-1/4 px-2.5 py-1.5 border-r border-b border-slate-300">Parameter</th>
                    <th className="w-1/4 px-2.5 py-1.5 border-r border-b border-slate-300">Value</th>
                    <th className="w-1/4 px-2.5 py-1.5 border-r border-b border-slate-300">Parameter</th>
                    <th className="w-1/4 px-2.5 py-1.5 border-b border-slate-300">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">Cooling Capacity:</td>
                    <td className="px-2.5 py-1.5 font-mono text-cyan-950 font-extrabold border-r border-slate-300">{getVal(['Cooling_Capacity', 'Cooling_capacity', 'coolingCapacity'])}</td>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">Rated Cooling Power:</td>
                    <td className="px-2.5 py-1.5 text-amber-800 font-mono font-bold">{getVal(['Rated_Cooling_Power', 'Rated_cooling_power', 'ratedCoolingPower', 'Rated_Power', 'ratedPower', 'Power_mode', 'powerMode'])}</td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">Rated Power:</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-900 border-r border-slate-300">{getVal(['Rated_Power', 'ratedPower'])}</td>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">Rated Current:</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-900">{getVal(['Rated_Current', 'ratedCurrent'])}</td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">Voltage / Supply:</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-900 border-r border-slate-300">{getVal(['Voltage', 'voltage'])}</td>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">ISEER Rating:</td>
                    <td className="px-2.5 py-1.5 font-mono text-emerald-800 font-bold">{getVal(['ISEER', 'iseer'])}</td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">Refrigerant:</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-900 font-bold border-r border-slate-300">{getVal(['Refrigerant', 'refrigerant'])}</td>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">Gas Quantity / Injection:</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-900 font-medium">{getVal(['Gas_Qty', 'gasQty', 'Gas_Quantity'])} / {getVal(['Gas_injection_Volume', 'Gas_Injection_Volume', 'gasInjectionVolume'])}</td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">IDU Main Checksum:</td>
                    <td className="px-2.5 py-1.5 font-mono text-cyan-900 font-bold border-r border-slate-300">{getVal(['Main_Program_Checksum_IDU', 'mainProgramChecksumIdu'])}</td>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">ODU Main Checksum:</td>
                    <td className="px-2.5 py-1.5 font-mono text-cyan-900 font-bold">{getVal(['Main_Program_Checksum_ODU', 'mainProgramChecksumOdu'])}</td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">IDU EEPROM Checksum:</td>
                    <td className="px-2.5 py-1.5 font-mono text-indigo-900 font-bold border-r border-slate-300">{getVal(['EE_Checksum_IDU', 'eeChecksumIdu'])}</td>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">ODU EEPROM Checksum:</td>
                    <td className="px-2.5 py-1.5 font-mono text-indigo-900 font-bold">{getVal(['EE_Checksum_ODU', 'eeChecksumOdu'])}</td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-slate-700 bg-slate-50 border-r border-slate-300">Compressor Spec:</td>
                    <td colSpan={3} className="px-2.5 py-1.5 text-slate-900 font-medium">{getVal(['Compressor_Spec', 'Compressor _Spec', 'compressorSpec'])}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Parts & Components Specification Table */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-900 bg-cyan-50 px-3 py-1.5 rounded-t-lg border border-cyan-200 border-l-4 border-l-cyan-700">
                3. Sub-Assembly &amp; Parts Bill of Materials (BOM)
              </h3>
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[11px]">
                    <th className="w-[24%] px-2.5 py-1.5 border-r border-b border-slate-300">Sub-Assembly</th>
                    <th className="w-[36%] px-2.5 py-1.5 border-r border-b border-slate-300">Specification</th>
                    <th className="w-[20%] px-2.5 py-1.5 border-r border-b border-slate-300">Part Code</th>
                    <th className="w-[20%] px-2.5 py-1.5 border-b border-slate-300">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-medium">
                  {formParts.map((p, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                      <td className="px-2.5 py-1.5 font-bold text-slate-900 border-r border-slate-300">{p.title}</td>
                      <td className="px-2.5 py-1.5 text-slate-700 border-r border-slate-300">{p.spec}</td>
                      <td className="px-2.5 py-1.5 font-mono text-cyan-900 font-bold border-r border-slate-300">{p.partCode}</td>
                      <td className="px-2.5 py-1.5 text-slate-800">{p.supplier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Photos Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between bg-cyan-50 px-3 py-1.5 rounded-t-lg border border-cyan-200 border-l-4 border-l-cyan-700">
                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-950">
                  4. Sample Photographs Gallery
                </h3>
                <span className="text-[10px] font-bold text-cyan-800 bg-cyan-100 px-2.5 py-0.5 rounded border border-cyan-300">
                  {totalPhotosAttached} Photos Attached
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-b-lg border border-slate-200">
                {photoCategories.flatMap(c => c.photos).map((item, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-xl flex flex-col items-center space-y-1.5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-800 truncate w-full text-center">{item.label}</span>
                    <div className="w-full h-[130px] bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                      {item.url ? (
                        <img 
                          src={item.url} 
                          alt={item.label} 
                          crossOrigin="anonymous"
                          className="w-full h-full object-contain p-1" 
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            if (!img.src.startsWith('data:image/svg+xml')) {
                              img.src = PICTURE_NOT_AVAILABLE_SVG;
                            }
                          }}
                        />
                      ) : (
                        <span className="text-[9px] font-medium text-slate-400">No Photo</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality Remarks & Test Conclusion */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300 space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  5. Quality Remarks &amp; Observations
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {remarks}
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300 space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  6. Final Test Conclusion
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed italic font-medium">
                  "{testConclusion}"
                </p>
              </div>
            </div>

            {/* Signatures Footer */}
            <div className="pt-5 border-t-2 border-slate-400 flex items-end justify-between text-xs text-slate-700">
              <div className="space-y-1">
                <p><strong>Tested &amp; Compiled By:</strong> Indrajit Sharma (Testing Lead)</p>
                <p><strong>Quality Assurance Lab:</strong> Certified Compliance Pass</p>
                <p className="text-[10px] text-slate-500 font-mono">Verification Hash: OK-COMPLIANT-2026</p>
              </div>

              <div className="text-right">
                <p className="font-mono text-[10px] text-slate-500">Date Generated: {new Date().toLocaleDateString()}</p>
                <div className="mt-5 border-t-2 border-slate-800 pt-1 font-extrabold text-slate-900 inline-block px-8 text-center uppercase tracking-wider">
                  Authorized Signatory Signature
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Full-Screen Photo Lightbox Modal */}
      {selectedPhotoModal && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                {selectedPhotoModal.label}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPhotoModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-black/60 flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img 
                src={selectedPhotoModal.url} 
                alt={selectedPhotoModal.label} 
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
