import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Calendar, 
  Search, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  AlertCircle, 
  Trash2, 
  Activity, 
  Gauge, 
  SlidersHorizontal, 
  Layers, 
  Table as TableIcon, 
  RefreshCw,
  Info,
  CheckSquare,
  Square,
  ArrowRight,
  Database,
  Save,
  BarChart2,
  BarChart3,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
  Thermometer,
  Flame,
  Split,
  TrendingUp
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine, 
  Brush 
} from 'recharts';
import { 
  MeasurementRecord, 
  MEASUREMENT_PARAMETERS, 
  ParameterMeta, 
  fetchMeasurementRecords, 
  processExcelValueSheet, 
  addManualMeasurement, 
  saveMeasurementRecords,
  INITIAL_SAMPLE_RECORDS
} from '../../services/graphStore';
import { getPpUnits } from '../../services/ppUnitStore';
import { getProtoUnits } from '../../services/protoUnitStore';
import { UserProfile, PpUnit, ProtoUnit } from '../../types';

interface GraphModuleProps {
  currentUser?: UserProfile;
}

export const GraphModule: React.FC<GraphModuleProps> = ({ currentUser }) => {
  // Unit Selection State (Multi-unit data isolation in Firebase)
  const [ppUnits, setPpUnits] = useState<PpUnit[]>(() => getPpUnits());
  const [protoUnits, setProtoUnits] = useState<ProtoUnit[]>(() => getProtoUnits());
  const [selectedUnitId, setSelectedUnitId] = useState<string>('global');

  // Main dataset state
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Selected timestamp index state
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Parameter selection state (all 9 selected by default)
  const [selectedParams, setSelectedParams] = useState<string[]>(
    MEASUREMENT_PARAMETERS.map(p => p.id)
  );
  const [isParamMenuOpen, setIsParamMenuOpen] = useState<boolean>(true);

  // Manual Entry Form state
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const [manualDate, setManualDate] = useState<string>('08-08-2026');
  const [manualTime, setManualTime] = useState<string>('10:30:00');
  const [manualInputs, setManualInputs] = useState<{
    ei18Voltage: string;
    ei18Current: string;
    ei18Power: string;
    oduDbt: string;
    oduCoil: string;
    iduOutlet: string;
    iduInlet: string;
    iduDbt: string;
  }>({
    ei18Voltage: '230.4',
    ei18Current: '4.52',
    ei18Power: '1040',
    oduDbt: '35.6',
    oduCoil: '42.1',
    iduOutlet: '18.4',
    iduInlet: '27.8',
    iduDbt: '24.5',
  });

  // Navigation: Go To Time input
  const [goToTimeInput, setGoToTimeInput] = useState<string>('10:30:00');

  // Chart Controls state
  type ChartMode = 'area' | 'line' | 'step' | 'bar' | 'composed' | 'multipanel';
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [chartType, setChartType] = useState<ChartMode>('area');

  // Parameter Preset Handlers
  const handleApplyPreset = (preset: 'all' | 'electrical' | 'thermal' | 'cooling') => {
    if (preset === 'all') {
      setSelectedParams(MEASUREMENT_PARAMETERS.map(p => p.id));
    } else if (preset === 'electrical') {
      setSelectedParams(['ei18Voltage', 'ei18Current', 'ei18Power']);
    } else if (preset === 'thermal') {
      setSelectedParams(['oduDbt', 'oduCoil', 'iduInlet', 'iduOutlet', 'iduDbt']);
    } else if (preset === 'cooling') {
      setSelectedParams(['iduDeltaT', 'ei18Power', 'iduInlet', 'iduOutlet']);
    }
  };

  // Graph Selection Lines (2 Lines: Start & End)
  const [startLineTime, setStartLineTime] = useState<string>('10:00:00');
  const [endLineTime, setEndLineTime] = useState<string>('11:00:00');

  // Report Time Range State
  const [reportStartTime, setReportStartTime] = useState<string>('10:00:00');
  const [reportEndTime, setReportEndTime] = useState<string>('11:00:00');

  // DOM Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Load records on mount & when selectedUnitId changes
  useEffect(() => {
    setPpUnits(getPpUnits());
    setProtoUnits(getProtoUnits());
    loadData(selectedUnitId);
  }, [selectedUnitId]);

  const loadData = async (unitId: string = selectedUnitId) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchMeasurementRecords(unitId);
      setRecords(data);
      if (data.length > 0) {
        // Find index of 10:30:00 or select latest
        const sampleIdx = data.findIndex(r => r.time === '10:30:00');
        setSelectedIndex(sampleIdx >= 0 ? sampleIdx : data.length - 1);

        // Set initial selection lines and report times based on data
        const firstTime = data[0].time;
        const lastTime = data[data.length - 1].time;
        setStartLineTime(firstTime);
        setEndLineTime(lastTime);
        setReportStartTime(firstTime);
        setReportEndTime(lastTime);
      } else {
        setSelectedIndex(0);
      }
    } catch (err) {
      console.error('Failed to load measurement records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Selected Unit Meta Display
  const currentUnitLabel = useMemo(() => {
    if (selectedUnitId === 'global') return 'All Laboratory Machines (Global Dataset)';
    const pp = ppUnits.find(u => u.id === selectedUnitId);
    if (pp) return `PP Unit: ${pp.modelName} [${pp.iduSerialNumber || pp.oduSerialNumber || pp.id}] (${pp.station || 'Station 01'})`;
    const proto = protoUnits.find(u => u.id === selectedUnitId);
    if (proto) return `Proto Unit: ${proto.modelName} [${proto.iduSerialNumber || proto.oduSerialNumber || proto.id}] (${proto.station || 'Station 01'})`;
    return `Testing Unit: ${selectedUnitId}`;
  }, [selectedUnitId, ppUnits, protoUnits]);

  // Currently selected record
  const selectedRecord = useMemo(() => {
    if (records.length === 0) return null;
    const idx = Math.min(Math.max(0, selectedIndex), records.length - 1);
    return records[idx] || null;
  }, [records, selectedIndex]);

  // Keep Go To Time input synced with selected record
  useEffect(() => {
    if (selectedRecord) {
      setGoToTimeInput(selectedRecord.time);
    }
  }, [selectedRecord]);

  // Handle Save Report Start & End Time
  const handleSaveReportTime = () => {
    try {
      localStorage.setItem('llt_lab_report_times', JSON.stringify({
        startTime: reportStartTime,
        endTime: reportEndTime,
      }));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
    setUploadMessage(`✓ Report Start Time (${reportStartTime}) & End Time (${reportEndTime}) Saved!`);
    setTimeout(() => setUploadMessage(null), 4000);
  };

  // Handle Report Graph Button (Sets 2 Selection Lines on Graph)
  const handleApplyReportGraph = () => {
    setStartLineTime(reportStartTime);
    setEndLineTime(reportEndTime);
    setUploadMessage(`✓ Selection Lines set on Graph: ${reportStartTime} ➔ ${reportEndTime}`);
    setTimeout(() => setUploadMessage(null), 4000);
  };

  // Calculate Average Values for all parameters between startLineTime and endLineTime
  const rangeAverages = useMemo(() => {
    if (records.length === 0) return {};

    let idxStart = records.findIndex(r => r.time.trim() === startLineTime.trim());
    let idxEnd = records.findIndex(r => r.time.trim() === endLineTime.trim());

    if (idxStart < 0) idxStart = 0;
    if (idxEnd < 0) idxEnd = records.length - 1;

    const minIdx = Math.min(idxStart, idxEnd);
    const maxIdx = Math.max(idxStart, idxEnd);

    const sliced = records.slice(minIdx, maxIdx + 1);
    if (sliced.length === 0) return {};

    const avgs: Record<string, number> = {};
    MEASUREMENT_PARAMETERS.forEach(p => {
      const sum = sliced.reduce((acc, r) => {
        const val = Number(r[p.key as keyof MeasurementRecord]);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      avgs[p.id] = Number((sum / sliced.length).toFixed(2));
    });

    return avgs;
  }, [records, startLineTime, endLineTime]);

  // Handle Excel / CSV Upload to Firebase Firestore
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = ''; // reset file input
    setIsUploading(true);
    setErrorMessage(null);
    setUploadMessage(`Parsing & Syncing Value Sheet for ${currentUnitLabel}...`);

    try {
      const result = await processExcelValueSheet(
        file, 
        selectedUnitId, 
        currentUser?.name || 'Lab Specialist'
      );
      setRecords(result.records);
      setUploadedFileName(result.fileName);
      setUploadMessage(`✓ Value Sheet Uploaded & Saved to Firebase Firestore for ${currentUnitLabel} (${result.count} records imported)`);
      
      // Select the last imported record
      if (result.records.length > 0) {
        setSelectedIndex(result.records.length - 1);
        setStartLineTime(result.records[0].time);
        setEndLineTime(result.records[result.records.length - 1].time);
      }
    } catch (err: any) {
      console.error('Upload Error:', err);
      setErrorMessage(err.message || 'Error processing Value Sheet. Please verify file format.');
      setUploadMessage(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Manual Reading Submit
  const handleAddManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const voltage = parseFloat(manualInputs.ei18Voltage);
    const current = parseFloat(manualInputs.ei18Current);
    const power = parseFloat(manualInputs.ei18Power);
    const oduDbt = parseFloat(manualInputs.oduDbt);
    const oduCoil = parseFloat(manualInputs.oduCoil);
    const iduOutlet = parseFloat(manualInputs.iduOutlet);
    const iduInlet = parseFloat(manualInputs.iduInlet);
    const iduDbt = parseFloat(manualInputs.iduDbt);

    if (
      isNaN(voltage) || isNaN(current) || isNaN(power) ||
      isNaN(oduDbt) || isNaN(oduCoil) || isNaN(iduOutlet) ||
      isNaN(iduInlet) || isNaN(iduDbt)
    ) {
      setErrorMessage('Please enter valid numeric values for all 8 measurement parameters.');
      return;
    }

    try {
      const updated = await addManualMeasurement({
        date: manualDate.trim() || '08-08-2026',
        time: manualTime.trim() || '10:30:00',
        ei18Voltage: voltage,
        ei18Current: current,
        ei18Power: power,
        oduDbt,
        oduCoil,
        iduOutlet,
        iduInlet,
        iduDbt,
        sourceFile: 'Manual Entry',
      }, selectedUnitId);

      setRecords(updated);
      setShowManualForm(false);
      setUploadMessage(`✓ Manual Reading Added & Synced to Firebase for ${currentUnitLabel}!`);

      // Find index of newly added reading
      const addedIdx = updated.findIndex(r => r.date === manualDate && r.time === manualTime);
      setSelectedIndex(addedIdx >= 0 ? addedIdx : updated.length - 1);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save manual reading.');
    }
  };

  // Toggle single parameter
  const toggleParameter = (paramId: string) => {
    setSelectedParams(prev => 
      prev.includes(paramId) ? prev.filter(p => p !== paramId) : [...prev, paramId]
    );
  };

  // Select All / Deselect All parameters
  const handleSelectAllParams = () => {
    setSelectedParams(MEASUREMENT_PARAMETERS.map(p => p.id));
  };

  const handleDeselectAllParams = () => {
    setSelectedParams([]);
  };

  // Previous / Next Navigation
  const handlePrevious = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex < records.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  // Go To Time Navigation
  const handleGoToTime = () => {
    if (!goToTimeInput.trim() || records.length === 0) return;

    const queryTime = goToTimeInput.trim().toLowerCase();

    // 1. Try exact time match
    let foundIdx = records.findIndex(r => r.time.toLowerCase() === queryTime);

    // 2. Try partial match (e.g. "10:30" matches "10:30:00")
    if (foundIdx < 0) {
      foundIdx = records.findIndex(r => r.time.toLowerCase().startsWith(queryTime));
    }

    // 3. Find closest time numerically if no string match
    if (foundIdx < 0) {
      const parseTimeToSec = (t: string) => {
        const parts = t.split(':').map(p => parseInt(p, 10) || 0);
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      };

      const targetSec = parseTimeToSec(queryTime);
      let minDiff = Infinity;
      let closestIdx = 0;

      records.forEach((r, idx) => {
        const sec = parseTimeToSec(r.time);
        const diff = Math.abs(sec - targetSec);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      foundIdx = closestIdx;
    }

    if (foundIdx >= 0) {
      setSelectedIndex(foundIdx);
      setUploadMessage(`Switched to closest reading: ${records[foundIdx].time}`);
    }
  };

  // Load default sample laboratory records
  const handleLoadSampleData = async () => {
    await saveMeasurementRecords(INITIAL_SAMPLE_RECORDS);
    setRecords(INITIAL_SAMPLE_RECORDS);
    setSelectedIndex(3); // 10:30:00 sample
    setUploadMessage('✓ Sample Laboratory AC Testing Data Loaded');
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const row: MeasurementRecord = payload[0]?.payload;
    if (!row) return null;

    return (
      <div className="p-4 bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl text-xs space-y-2 max-w-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{row.time}</span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">{row.date}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
          {MEASUREMENT_PARAMETERS.map(param => {
            const val = row[param.key as keyof MeasurementRecord];
            const isSelected = selectedParams.includes(param.id);

            return (
              <div 
                key={param.id} 
                className={`flex items-center justify-between gap-2 p-1 rounded-md ${
                  param.id === 'iduDeltaT' ? 'col-span-2 bg-amber-500/10 border border-amber-500/30' : ''
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: param.color }} 
                  />
                  <span className={`truncate text-[11px] ${isSelected ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>
                    {param.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-white text-[11px]">
                  {val !== undefined && val !== null ? val : '—'} {param.unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hidden File Upload Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv,.tsv"
        className="hidden"
      />

      {/* 1. TOP SECTION HEADER & UPLOAD / MANUAL ENTRY CONTROLS */}
      <div className="relative overflow-hidden p-6 md:p-8 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-500" />
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-950/50">
                <Activity className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    Graph Section
                  </h1>
                  <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AC Testing Dashboard
                  </span>
                </div>
                <p className="text-xs md:text-sm text-slate-400 font-medium">
                  Laboratory measurement monitoring, multi-parameter time-series graph analysis, and auto-calculated IDU Delta T.
                </p>
              </div>
            </div>

            {/* Currently Active Machine Badge */}
            <div className="flex items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400">Active Machine:</span>
                <span className="text-cyan-300 font-bold">{currentUnitLabel}</span>
                <span className="ml-1.5 px-2 py-0.2 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                  {records.length} Points in Firebase
                </span>
              </div>
            </div>
          </div>

          {/* Action Controls: Machine Selector & Upload Value Sheet */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Testing Machine / Unit Dropdown Selector */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/90 rounded-2xl px-3 py-1.5 shadow-md">
              <label htmlFor="graph-unit-select" className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-cyan-400" /> Unit:
              </label>
              <select
                id="graph-unit-select"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-cyan-500 transition-all cursor-pointer min-w-[200px]"
              >
                <option value="global">🌐 All Units / Global Lab Data</option>
                <optgroup label="PP Testing Units">
                  {ppUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      PP: {unit.modelName} ({unit.station || 'Station 01'}) - {unit.iduSerialNumber || unit.oduSerialNumber || unit.id}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Proto Testing Units">
                  {protoUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      Proto: {unit.modelName} ({unit.station || 'Station 01'}) - {unit.iduSerialNumber || unit.oduSerialNumber || unit.id}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Upload Value Sheet Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-sm font-bold shadow-xl shadow-cyan-950/60 hover:shadow-cyan-900/80 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {isUploading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Upload className="w-4 h-4 text-white" />
              )}
              <span>Upload Value Sheet</span>
            </button>
          </div>
        </div>

        {/* Upload Status / File Name Display */}
        {(uploadMessage || uploadedFileName) && (
          <div className="mt-4 p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-between gap-3 text-emerald-300 text-xs font-semibold shadow-lg">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{uploadMessage || `File Uploaded: ${uploadedFileName}`}</span>
            </div>
            <button
              onClick={() => { setUploadMessage(null); setUploadedFileName(null); }}
              className="text-emerald-400 hover:text-white font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Message Toast */}
        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-2xl flex items-center justify-between gap-3 text-rose-200 text-xs font-semibold shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* MANUAL DATE & TIME ENTRY FORM (Collapsible / Expandable) */}
        {showManualForm && (
          <form onSubmit={handleAddManualSubmit} className="mt-6 pt-6 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                Manual Date & Time Reading Entry
              </h3>
              <span className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                * IDU DELTA T is calculated automatically (IDU INLET − IDU Outlet)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Date (DD-MM-YYYY)</label>
                <input
                  type="text"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  placeholder="DD-MM-YYYY"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {/* Time Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Time (HH:MM:SS)</label>
                <input
                  type="text"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  placeholder="HH:MM:SS"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {/* EI18 Voltage */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">EI18 Voltage (V)</label>
                <input
                  type="number"
                  step="0.1"
                  value={manualInputs.ei18Voltage}
                  onChange={(e) => setManualInputs({ ...manualInputs, ei18Voltage: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* EI18 Current */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">EI18 Current (A)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualInputs.ei18Current}
                  onChange={(e) => setManualInputs({ ...manualInputs, ei18Current: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              {/* EI18 Power */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-red-400 uppercase tracking-wider">EI18 Power (W)</label>
                <input
                  type="number"
                  step="1"
                  value={manualInputs.ei18Power}
                  onChange={(e) => setManualInputs({ ...manualInputs, ei18Power: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              {/* ODU DBT */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">ODU DBT (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={manualInputs.oduDbt}
                  onChange={(e) => setManualInputs({ ...manualInputs, oduDbt: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* ODU COIL */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">ODU COIL (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={manualInputs.oduCoil}
                  onChange={(e) => setManualInputs({ ...manualInputs, oduCoil: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* IDU Outlet */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-pink-400 uppercase tracking-wider">IDU Outlet (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={manualInputs.iduOutlet}
                  onChange={(e) => setManualInputs({ ...manualInputs, iduOutlet: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-pink-500"
                  required
                />
              </div>

              {/* IDU INLET */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">IDU INLET (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={manualInputs.iduInlet}
                  onChange={(e) => setManualInputs({ ...manualInputs, iduInlet: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              {/* IDU DBT */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-violet-400 uppercase tracking-wider">IDU DBT (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={manualInputs.iduDbt}
                  onChange={(e) => setManualInputs({ ...manualInputs, iduDbt: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-violet-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-950 border border-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-md shadow-cyan-950"
              >
                Add Reading
              </button>
            </div>
          </form>
        )}
      </div>

      {/* EMPTY STATE IF NO DATA AVAILABLE */}
      {records.length === 0 && !isLoading ? (
        <div className="p-12 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl text-center space-y-6 backdrop-blur-xl">
          <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-950/50">
            <Gauge className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-white">No Measurement Data Available</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Please upload a Value Sheet (.xlsx) to display the laboratory dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-950"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Value Sheet</span>
            </button>

            <button
              onClick={handleLoadSampleData}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold shadow-md"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Load Default Sample Data</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. MEASUREMENT CARDS (SMALLER CARDVIEW SIZE + RANGE AVERAGE VALUE DISPLAY) */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {MEASUREMENT_PARAMETERS.map((param) => {
                const rawVal = selectedRecord ? selectedRecord[param.key as keyof MeasurementRecord] : null;
                const formattedVal = rawVal !== null && rawVal !== undefined ? rawVal : '—';
                const avgVal = rangeAverages[param.id] !== undefined ? rangeAverages[param.id] : '—';

                return (
                  <div
                    key={param.id}
                    className={`relative p-3.5 bg-slate-900/90 border rounded-2xl shadow-lg transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between aspect-square group backdrop-blur-xl ${param.borderColor}`}
                    style={{
                      boxShadow: `0 8px 24px -8px ${param.glowColor}`,
                    }}
                  >
                    {/* Background Subtle Gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${param.bgGradient} rounded-2xl pointer-events-none`} />

                    {/* Top Row: Parameter Name & Unit */}
                    <div className="relative z-10 flex items-start justify-between gap-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300 truncate" title={param.name}>
                        {param.name}
                      </span>
                      <span 
                        className="px-1.5 py-0.5 text-[9px] font-mono font-black rounded-md border text-white shrink-0"
                        style={{ backgroundColor: `${param.color}20`, borderColor: `${param.color}50`, color: param.color }}
                      >
                        {param.unit}
                      </span>
                    </div>

                    {/* Middle Row: Values (Range Average) */}
                    <div className="relative z-10 my-1 space-y-1">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span 
                            className="text-2xl md:text-3xl font-black font-mono tracking-tight"
                            style={{ color: param.color }}
                          >
                            {formattedVal}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{param.unit}</span>
                        </div>
                      </div>

                      {/* Average Value badge */}
                      <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                        <span className="font-extrabold text-cyan-400 text-[9px] uppercase tracking-wider">
                          Avg:
                        </span>
                        <span className="font-mono font-black text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {avgVal} {param.unit}
                        </span>
                      </div>

                      {/* Formula label for Delta T */}
                      {param.isCalculated && (
                        <span className="inline-block text-[8px] font-bold text-amber-300/90 tracking-wide uppercase">
                          INLET − OUTLET
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Date & Time */}
                    <div className="relative z-10 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 text-slate-500" />
                        {selectedRecord?.date || '08-08-2026'}
                      </span>
                      <span className="flex items-center gap-1 font-bold text-slate-300">
                        <Clock className="w-2.5 h-2.5 text-slate-500" />
                        {selectedRecord?.time || '10:30:00'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. PARAMETER SELECTION FOR GRAPH */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl space-y-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div 
                onClick={() => setIsParamMenuOpen(!isParamMenuOpen)}
                className="flex items-center gap-2.5 cursor-pointer select-none group"
              >
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 group-hover:scale-105 transition-all">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    Parameter Selection (Plot on Graph)
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold">
                      {selectedParams.length}/{MEASUREMENT_PARAMETERS.length} Active
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Click menu button to expand or collapse parameters list
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* Presets */}
                <div className="flex items-center bg-slate-950 p-1 border border-slate-800 rounded-xl text-[11px] mr-1">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('all')}
                    className="px-2.5 py-1 text-cyan-300 hover:text-white font-bold rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                    title="Select All 9 Parameters"
                  >
                    All (9)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('electrical')}
                    className="flex items-center gap-1 px-2.5 py-1 text-emerald-400 hover:text-white font-bold rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                    title="Select Electrical Parameters (V, A, W)"
                  >
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>⚡ Elec</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('thermal')}
                    className="flex items-center gap-1 px-2.5 py-1 text-blue-400 hover:text-white font-bold rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                    title="Select All Temperature Sensors"
                  >
                    <Thermometer className="w-3 h-3 text-blue-400" />
                    <span>🌡️ Temp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('cooling')}
                    className="flex items-center gap-1 px-2.5 py-1 text-amber-400 hover:text-white font-bold rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                    title="Select Cooling Performance & Delta T"
                  >
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>❄️ ΔT Perf</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSelectAllParams}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-cyan-400 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all active:scale-95 shadow-sm cursor-pointer"
                  title="Select All Graph Parameters"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Select All</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeselectAllParams}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all active:scale-95 shadow-sm cursor-pointer"
                  title="Deselect All Graph Parameters"
                >
                  <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Deselect All</span>
                </button>

                {/* Dropdown Menu Expand / Collapse Button */}
                <button
                  type="button"
                  onClick={() => setIsParamMenuOpen(!isParamMenuOpen)}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/50 text-cyan-300 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                  title={isParamMenuOpen ? 'Click to Collapse Parameter Menu' : 'Click to Expand Parameter Menu'}
                >
                  <span>{isParamMenuOpen ? 'Collapse Menu' : 'Expand Menu'}</span>
                  {isParamMenuOpen ? (
                    <ChevronUp className="w-4 h-4 text-cyan-400 animate-bounce" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-cyan-400 animate-bounce" />
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Parameter Grid */}
            {isParamMenuOpen && (
              <div className="pt-2 border-t border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {MEASUREMENT_PARAMETERS.map(param => {
                    const isChecked = selectedParams.includes(param.id);
                    return (
                      <button
                        key={param.id}
                        type="button"
                        onClick={() => toggleParameter(param.id)}
                        className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all text-left shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                          isChecked
                            ? 'bg-slate-900/95 shadow-lg'
                            : 'bg-slate-950/70 opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          borderColor: isChecked ? `${param.color}90` : `${param.color}30`,
                          boxShadow: isChecked ? `0 6px 20px -6px ${param.color}40` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Colored Checkbox / Dot Indicator */}
                          <div 
                            className={`w-4 h-4 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                              isChecked ? 'border-transparent text-slate-950 font-black' : 'bg-slate-950'
                            }`}
                            style={{ 
                              backgroundColor: isChecked ? param.color : 'transparent',
                              borderColor: isChecked ? param.color : `${param.color}80`
                            }}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          {/* Parameter Name with Color Accent */}
                          <span 
                            className="truncate font-extrabold"
                            style={{ color: isChecked ? param.color : '#94a3b8' }}
                          >
                            {param.name}
                          </span>
                        </div>

                        {/* Parameter Unit Badge */}
                        <span 
                          className="px-1.5 py-0.5 text-[9px] font-mono font-black rounded-md border shrink-0 ml-1"
                          style={{
                            backgroundColor: `${param.color}20`,
                            borderColor: `${param.color}50`,
                            color: param.color
                          }}
                        >
                          {param.unit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 5. INTERACTIVE GRAPH */}
          <div 
            ref={graphContainerRef} 
            className={`p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-4 backdrop-blur-xl relative ${
              isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-slate-950 p-8 overflow-y-auto' : ''
            }`}
          >
            {/* Graph Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Interactive Measurement Time-Series Graph
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold uppercase">
                      Mode: {chartType}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Switch graph style, zoom, or use multi-panel mode to inspect Electrical & Thermal parameters separately
                  </p>
                </div>
              </div>

              {/* Chart Controls & Graph Type Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Graph Type Selector Pills */}
                <div className="flex items-center bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs gap-0.5">
                  <button
                    onClick={() => setChartType('area')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      chartType === 'area' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Smooth Gradient Area Chart"
                  >
                    Area
                  </button>
                  <button
                    onClick={() => setChartType('line')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      chartType === 'line' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Precision Spline Multi-Line Chart"
                  >
                    Line
                  </button>
                  <button
                    onClick={() => setChartType('step')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      chartType === 'step' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Industrial Discrete Step-Line Chart"
                  >
                    Step
                  </button>
                  <button
                    onClick={() => setChartType('bar')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      chartType === 'bar' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Grouped Column Interval Chart"
                  >
                    Bar
                  </button>
                  <button
                    onClick={() => setChartType('composed')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      chartType === 'composed' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Mixed Composed (Area + Line + Bar) Chart"
                  >
                    Composed
                  </button>
                  <button
                    onClick={() => setChartType('multipanel')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      chartType === 'multipanel' ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md' : 'text-cyan-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title="3-Panel Synchronized Split Graphs (Electrical + Thermal + Delta T)"
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>Multi-Panel</span>
                  </button>
                </div>

                {/* Zoom & Screen Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsFullscreen(prev => !prev)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Recharts Component Container */}
            {selectedParams.length === 0 ? (
              <div className="h-[420px] flex flex-col items-center justify-center gap-2 text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800/80 p-6 text-center">
                <AlertCircle className="w-10 h-10 text-amber-400 mb-1 animate-pulse" />
                <span className="text-base font-bold text-slate-200">No Parameters Selected</span>
                <p className="text-xs text-slate-400 max-w-md">
                  Please check at least one measurement parameter from the presets or parameter list above to render the graph.
                </p>
              </div>
            ) : chartType === 'multipanel' ? (
              /* MULTI-PANEL SYNCHRONIZED 3-TIER SPLIT VIEW */
              <div className="space-y-4 pt-1">
                {/* 1. Electrical Subgraph Panel */}
                <div className="p-4 bg-slate-950/80 border border-slate-800/90 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      Panel 1: Electrical Power, Voltage & Current (W, V, A)
                    </span>
                    {selectedRecord && (
                      <span className="text-[11px] font-mono text-slate-300">
                        V: <span className="text-emerald-400 font-bold">{selectedRecord.ei18Voltage}V</span> | 
                        I: <span className="text-teal-400 font-bold ml-1">{selectedRecord.ei18Current}A</span> | 
                        P: <span className="text-cyan-400 font-bold ml-1">{selectedRecord.ei18Power}W</span>
                      </span>
                    )}
                  </div>
                  <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={records}
                        syncId="syncedHvacGraph"
                        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                        onMouseMove={(e: any) => {
                          if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex !== selectedIndex) {
                            setSelectedIndex(e.activeTooltipIndex);
                          }
                        }}
                      >
                        <defs>
                          <linearGradient id="grad_elec_power" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                        <XAxis dataKey="time" hide={true} />
                        <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} unit="A" domain={['auto', 'auto']} />
                        <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip content={<CustomTooltip />} />
                        {selectedRecord?.time && (
                          <ReferenceLine yAxisId="left" x={selectedRecord.time} stroke="#38bdf8" strokeWidth={2} />
                        )}
                        <Area yAxisId="right" type="monotone" dataKey="ei18Power" name="EI18 Power (W)" stroke="#38bdf8" fill="url(#grad_elec_power)" strokeWidth={2} />
                        <Line yAxisId="right" type="monotone" dataKey="ei18Voltage" name="EI18 Voltage (V)" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="ei18Current" name="EI18 Current (A)" stroke="#14b8a6" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Thermodynamic Temperature Profile Subgraph Panel */}
                <div className="p-4 bg-slate-950/80 border border-slate-800/90 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-blue-400" />
                      Panel 2: Thermodynamic Temperature Profile (°C)
                    </span>
                    {selectedRecord && (
                      <span className="text-[11px] font-mono text-slate-300">
                        Inlet: <span className="text-amber-400 font-bold">{selectedRecord.iduInlet}°C</span> | 
                        Outlet: <span className="text-cyan-400 font-bold ml-1">{selectedRecord.iduOutlet}°C</span> | 
                        ODU Coil: <span className="text-rose-400 font-bold ml-1">{selectedRecord.oduCoil}°C</span>
                      </span>
                    )}
                  </div>
                  <div className="w-full h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={records}
                        syncId="syncedHvacGraph"
                        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                        onMouseMove={(e: any) => {
                          if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex !== selectedIndex) {
                            setSelectedIndex(e.activeTooltipIndex);
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                        <XAxis dataKey="time" hide={true} />
                        <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} unit="°C" domain={['auto', 'auto']} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                        {selectedRecord?.time && (
                          <ReferenceLine yAxisId="left" x={selectedRecord.time} stroke="#38bdf8" strokeWidth={2} />
                        )}
                        <Line yAxisId="left" type="monotone" dataKey="oduDbt" name="ODU DBT (°C)" stroke="#f43f5e" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="oduCoil" name="ODU Coil (°C)" stroke="#fb7185" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="iduInlet" name="IDU Inlet (°C)" stroke="#fbbf24" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="iduOutlet" name="IDU Outlet (°C)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="iduDbt" name="IDU DBT (°C)" stroke="#a855f7" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. IDU Cooling Performance Delta T Subgraph Panel */}
                <div className="p-4 bg-slate-950/80 border border-slate-800/90 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      Panel 3: IDU Cooling Performance Delta T (Inlet − Outlet)
                    </span>
                    {selectedRecord && (
                      <span className="text-[11px] font-mono text-slate-300">
                        ΔT: <span className="text-amber-300 font-bold text-sm">{selectedRecord.iduDeltaT.toFixed(2)}°C</span>
                      </span>
                    )}
                  </div>
                  <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={records}
                        syncId="syncedHvacGraph"
                        margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                        onMouseMove={(e: any) => {
                          if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex !== selectedIndex) {
                            setSelectedIndex(e.activeTooltipIndex);
                          }
                        }}
                      >
                        <defs>
                          <linearGradient id="grad_deltat" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                        <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                        <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} unit="°C" domain={['auto', 'auto']} />
                        <Tooltip content={<CustomTooltip />} />
                        {selectedRecord?.time && (
                          <ReferenceLine yAxisId="left" x={selectedRecord.time} stroke="#38bdf8" strokeWidth={2} />
                        )}
                        <Area yAxisId="left" type="monotone" dataKey="iduDeltaT" name="IDU Delta T (°C)" stroke="#f59e0b" fill="url(#grad_deltat)" strokeWidth={2.5} />
                        {records.length > 20 && (
                          <Brush dataKey="time" height={24} stroke="#06b6d4" fill="#020617" tickFormatter={() => ''} />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              /* STANDARD SINGLE-CONTAINER GRAPH MODES (Area, Line, Step, Bar, Composed) */
              <div className="w-full h-[450px] transition-all" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart
                      data={records}
                      margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                      onMouseMove={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex !== selectedIndex) {
                          setSelectedIndex(e.activeTooltipIndex);
                        }
                      }}
                      onClick={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number') {
                          setSelectedIndex(e.activeTooltipIndex);
                        }
                      }}
                    >
                      <defs>
                        {MEASUREMENT_PARAMETERS.map(param => (
                          <linearGradient key={param.id} id={`grad_${param.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={param.color} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={param.color} stopOpacity={0.0} />
                          </linearGradient>
                        ))}
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

                      <XAxis 
                        dataKey="time" 
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 11 }} 
                        dy={10} 
                        tickLine={{ stroke: '#334155' }}
                      />

                      <YAxis 
                        yAxisId="left"
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 11 }} 
                        dx={-5}
                        tickLine={{ stroke: '#334155' }}
                        domain={['auto', 'auto']}
                      />

                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 11 }} 
                        dx={5}
                        tickLine={{ stroke: '#334155' }}
                        domain={['auto', 'auto']}
                      />

                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', fontWeight: 600 }} />

                      {/* Active Cursor Line */}
                      {selectedRecord?.time && (
                        <ReferenceLine
                          yAxisId="left"
                          x={selectedRecord.time}
                          stroke="#38bdf8"
                          strokeWidth={2}
                          label={{ value: `▶ ${selectedRecord.time}`, fill: '#38bdf8', fontSize: 10, position: 'top', fontWeight: 'bold' }}
                        />
                      )}

                      {/* Selection Lines */}
                      {startLineTime && (
                        <ReferenceLine
                          yAxisId="left"
                          x={startLineTime}
                          stroke="#06b6d4"
                          strokeWidth={2.5}
                          strokeDasharray="4 4"
                          label={{ value: `Start: ${startLineTime}`, fill: '#06b6d4', fontSize: 10, position: 'top', fontWeight: 'bold' }}
                        />
                      )}

                      {endLineTime && (
                        <ReferenceLine
                          yAxisId="left"
                          x={endLineTime}
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          strokeDasharray="4 4"
                          label={{ value: `End: ${endLineTime}`, fill: '#f59e0b', fontSize: 10, position: 'top', fontWeight: 'bold' }}
                        />
                      )}

                      {MEASUREMENT_PARAMETERS.filter(p => selectedParams.includes(p.id)).map(param => (
                        <Area
                          key={param.id}
                          yAxisId={param.yAxisId || 'left'}
                          type="monotone"
                          dataKey={param.key}
                          name={param.name}
                          stroke={param.color}
                          fillOpacity={1}
                          fill={`url(#grad_${param.id})`}
                          strokeWidth={2.5}
                          activeDot={{ r: 7, strokeWidth: 2, stroke: '#ffffff', fill: param.color }}
                          isAnimationActive={false}
                        />
                      ))}

                      {records.length > 20 && (
                        <Brush dataKey="time" height={28} stroke="#06b6d4" fill="#020617" tickFormatter={() => ''} />
                      )}
                    </AreaChart>
                  ) : chartType === 'bar' ? (
                    <BarChart
                      data={records}
                      margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                      onMouseMove={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex !== selectedIndex) {
                          setSelectedIndex(e.activeTooltipIndex);
                        }
                      }}
                      onClick={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number') {
                          setSelectedIndex(e.activeTooltipIndex);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                      <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} dx={5} domain={['auto', 'auto']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', fontWeight: 600 }} />

                      {selectedRecord?.time && (
                        <ReferenceLine yAxisId="left" x={selectedRecord.time} stroke="#38bdf8" strokeWidth={2} />
                      )}

                      {MEASUREMENT_PARAMETERS.filter(p => selectedParams.includes(p.id)).map(param => (
                        <Bar
                          key={param.id}
                          yAxisId={param.yAxisId || 'left'}
                          dataKey={param.key}
                          name={param.name}
                          fill={param.color}
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                      ))}

                      {records.length > 20 && (
                        <Brush dataKey="time" height={28} stroke="#06b6d4" fill="#020617" tickFormatter={() => ''} />
                      )}
                    </BarChart>
                  ) : chartType === 'composed' ? (
                    <ComposedChart
                      data={records}
                      margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                      onMouseMove={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex !== selectedIndex) {
                          setSelectedIndex(e.activeTooltipIndex);
                        }
                      }}
                      onClick={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number') {
                          setSelectedIndex(e.activeTooltipIndex);
                        }
                      }}
                    >
                      <defs>
                        <linearGradient id="grad_comp_power" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                      <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} dx={5} domain={['auto', 'auto']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', fontWeight: 600 }} />

                      {selectedRecord?.time && (
                        <ReferenceLine yAxisId="left" x={selectedRecord.time} stroke="#38bdf8" strokeWidth={2} />
                      )}

                      {/* EI18 Power as Area */}
                      {selectedParams.includes('ei18Power') && (
                        <Area yAxisId="right" type="monotone" dataKey="ei18Power" name="EI18 Power (W)" stroke="#38bdf8" fill="url(#grad_comp_power)" strokeWidth={2} />
                      )}

                      {/* Delta T as Bar */}
                      {selectedParams.includes('iduDeltaT') && (
                        <Bar yAxisId="left" dataKey="iduDeltaT" name="IDU Delta T (°C)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={12} />
                      )}

                      {/* Temperatures & Others as Lines */}
                      {MEASUREMENT_PARAMETERS.filter(p => selectedParams.includes(p.id) && p.id !== 'ei18Power' && p.id !== 'iduDeltaT').map(param => (
                        <Line
                          key={param.id}
                          yAxisId={param.yAxisId || 'left'}
                          type="monotone"
                          dataKey={param.key}
                          name={param.name}
                          stroke={param.color}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: param.color }}
                          activeDot={{ r: 7, strokeWidth: 2, stroke: '#ffffff', fill: param.color }}
                        />
                      ))}

                      {records.length > 20 && (
                        <Brush dataKey="time" height={28} stroke="#06b6d4" fill="#020617" tickFormatter={() => ''} />
                      )}
                    </ComposedChart>
                  ) : (
                    /* Line Chart (Smooth or Step) */
                    <LineChart
                      data={records}
                      margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                      onMouseMove={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex !== selectedIndex) {
                          setSelectedIndex(e.activeTooltipIndex);
                        }
                      }}
                      onClick={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number') {
                          setSelectedIndex(e.activeTooltipIndex);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                      <YAxis 
                        yAxisId="left"
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 11 }} 
                        domain={['auto', 'auto']}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 11 }} 
                        dx={5}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', fontWeight: 600 }} />

                      {/* Active Cursor Line for dynamic parameter updates */}
                      {selectedRecord?.time && (
                        <ReferenceLine
                          yAxisId="left"
                          x={selectedRecord.time}
                          stroke="#38bdf8"
                          strokeWidth={2}
                          label={{ value: `▶ ${selectedRecord.time}`, fill: '#38bdf8', fontSize: 10, position: 'top', fontWeight: 'bold' }}
                        />
                      )}

                      {/* Vertical Selection Lines for Report Window */}
                      {startLineTime && (
                        <ReferenceLine
                          yAxisId="left"
                          x={startLineTime}
                          stroke="#06b6d4"
                          strokeWidth={2.5}
                          strokeDasharray="4 4"
                          label={{ value: `Start: ${startLineTime}`, fill: '#06b6d4', fontSize: 10, position: 'top', fontWeight: 'bold' }}
                        />
                      )}

                      {endLineTime && (
                        <ReferenceLine
                          yAxisId="left"
                          x={endLineTime}
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          strokeDasharray="4 4"
                          label={{ value: `End: ${endLineTime}`, fill: '#f59e0b', fontSize: 10, position: 'top', fontWeight: 'bold' }}
                        />
                      )}

                      {MEASUREMENT_PARAMETERS.filter(p => selectedParams.includes(p.id)).map(param => (
                        <Line
                          key={param.id}
                          yAxisId={param.yAxisId || 'left'}
                          type={chartType === 'step' ? 'stepAfter' : 'monotone'}
                          dataKey={param.key}
                          name={param.name}
                          stroke={param.color}
                          strokeWidth={2.5}
                          dot={chartType === 'step' ? false : { r: 3, fill: param.color }}
                          activeDot={{ r: 7, strokeWidth: 2, stroke: '#ffffff', fill: param.color }}
                          isAnimationActive={false}
                        />
                      ))}

                      {records.length > 20 && (
                        <Brush dataKey="time" height={28} stroke="#06b6d4" fill="#020617" tickFormatter={() => ''} />
                      )}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 7. DATA HISTORY TABLE */}
          <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-4 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Data History Table</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Click any row to jump to that timestamp reading
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/90 text-slate-400 border-b border-slate-800 font-mono text-[11px] uppercase tracking-wider">
                    <th className="p-3">Date</th>
                    <th className="p-3">Time</th>
                    <th className="p-3 text-emerald-400">EI18 Voltage</th>
                    <th className="p-3 text-orange-400">EI18 Current</th>
                    <th className="p-3 text-red-400">EI18 Power</th>
                    <th className="p-3 text-purple-400">ODU DBT</th>
                    <th className="p-3 text-blue-400">ODU COIL</th>
                    <th className="p-3 text-pink-400">IDU Outlet</th>
                    <th className="p-3 text-teal-400">IDU INLET</th>
                    <th className="p-3 text-violet-400">IDU DBT</th>
                    <th className="p-3 text-amber-400 font-black">IDU DELTA T</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {records.map((rec, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <tr
                        key={rec.id}
                        onClick={() => setSelectedIndex(idx)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-cyan-500/15 text-white font-bold border-l-4 border-l-cyan-400'
                            : 'hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <td className="p-3 whitespace-nowrap">{rec.date}</td>
                        <td className="p-3 whitespace-nowrap text-cyan-300 font-bold">{rec.time}</td>
                        <td className="p-3 whitespace-nowrap">{rec.ei18Voltage} V</td>
                        <td className="p-3 whitespace-nowrap">{rec.ei18Current} A</td>
                        <td className="p-3 whitespace-nowrap">{rec.ei18Power} W</td>
                        <td className="p-3 whitespace-nowrap">{rec.oduDbt} °C</td>
                        <td className="p-3 whitespace-nowrap">{rec.oduCoil} °C</td>
                        <td className="p-3 whitespace-nowrap">{rec.iduOutlet} °C</td>
                        <td className="p-3 whitespace-nowrap">{rec.iduInlet} °C</td>
                        <td className="p-3 whitespace-nowrap">{rec.iduDbt} °C</td>
                        <td className="p-3 whitespace-nowrap font-black text-amber-400 bg-amber-500/5">
                          {rec.iduDeltaT} °C
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
