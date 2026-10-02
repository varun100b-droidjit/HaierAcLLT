import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Activity, 
  SlidersHorizontal, 
  Check, 
  Eye, 
  EyeOff, 
  Upload, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Calendar,
  Sparkles,
  BarChart2,
  RefreshCw,
  FileSpreadsheet,
  Zap,
  Thermometer,
  Gauge,
  Cpu,
  Flame
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ReferenceLine
} from 'recharts';
import { PpUnit } from '../../types';
import { 
  MeasurementRecord, 
  MEASUREMENT_PARAMETERS, 
  fetchMeasurementRecords, 
  processExcelValueSheet 
} from '../../services/graphStore';

interface PpUnitGraphModalProps {
  unit: PpUnit | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PpUnitGraphModal: React.FC<PpUnitGraphModalProps> = ({
  unit,
  isOpen,
  onClose,
}) => {
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [chartType, setChartType] = useState<'area' | 'line' | 'step' | 'bar'>('area');
  const [selectedParams, setSelectedParams] = useState<string[]>(
    MEASUREMENT_PARAMETERS.map(p => p.id)
  );
  const [isParamMenuOpen, setIsParamMenuOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, unit]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMeasurementRecords(unit?.id || 'global');
      setRecords(data);
    } catch (err) {
      console.error('Failed to load measurement records for PP Unit:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !unit) return null;

  const toggleParameter = (paramId: string) => {
    setSelectedParams(prev => 
      prev.includes(paramId) ? prev.filter(p => p !== paramId) : [...prev, paramId]
    );
  };

  const handleSelectAll = () => {
    setSelectedParams(MEASUREMENT_PARAMETERS.map(p => p.id));
  };

  const handleDeselectAll = () => {
    setSelectedParams([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !unit) return;

    e.target.value = '';
    setIsUploading(true);
    setUploadMessage('Reading & Processing Value Sheet data...');

    try {
      const result = await processExcelValueSheet(file, unit.id, unit.requestBy || 'PP Operator');
      setRecords(result.records);
      setUploadMessage(`✓ Value Sheet Uploaded & Plotted Successfully (${result.count} data points synced)`);
      setTimeout(() => setUploadMessage(null), 6000);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setUploadMessage(`Error: ${err.message || 'Failed to process file'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    useEffect(() => {
      if (active && payload && payload.length > 0 && payload[0]?.payload) {
        const item = payload[0].payload;
        const idx = records.findIndex(r => r.id === item.id || (r.time === item.time && r.date === item.date));
        if (idx >= 0) {
          setHoveredIndex(idx);
        }
      }
    }, [active, payload]);

    if (!active || !payload || !payload.length) return null;
    const row: MeasurementRecord = payload[0]?.payload;
    if (!row) return null;

    return (
      <div className="p-3 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl text-xs space-y-2 max-w-xs">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{row.time}</span>
          </div>
          <span className="text-slate-400 font-mono text-[10px]">{row.date}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
          {MEASUREMENT_PARAMETERS.map(param => {
            const val = row[param.key as keyof MeasurementRecord];
            const isSelected = selectedParams.includes(param.id);

            return (
              <div 
                key={param.id} 
                className={`flex items-center justify-between gap-1.5 p-1 rounded ${
                  param.id === 'iduDeltaT' ? 'col-span-2 bg-amber-500/10 border border-amber-500/30' : ''
                }`}
              >
                <div className="flex items-center gap-1 truncate">
                  <span 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: param.color }} 
                  />
                  <span className={`truncate text-[10px] ${isSelected ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>
                    {param.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-white text-[10px]">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv,.tsv"
        className="hidden"
      />

      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-cyan-950/60 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white">{unit.modelName} — Performance Graph</h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  📍 {unit.station || 'Station 01'}
                </span>
                {records.length > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/50 shadow-sm">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Uploaded</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                IDU: <span className="text-cyan-300 font-mono font-bold">{unit.iduSerialNumber || 'N/A'}</span> | 
                ODU: <span className="text-cyan-300 font-mono font-bold ml-1">{unit.oduSerialNumber || 'N/A'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Top Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            {/* Chart Type Toggles */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-900 p-1 border border-slate-800 rounded-xl text-xs gap-0.5">
                <button
                  onClick={() => setChartType('area')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    chartType === 'area' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Gradient Area Chart"
                >
                  Area
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    chartType === 'line' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Spline Line Chart"
                >
                  Line
                </button>
                <button
                  onClick={() => setChartType('step')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    chartType === 'step' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Stepped Line Chart"
                >
                  Step
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    chartType === 'bar' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Bar Columns Chart"
                >
                  Bar
                </button>
              </div>

              {/* Parameter Expand Button */}
              <button
                type="button"
                onClick={() => setIsParamMenuOpen(!isParamMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Parameters ({selectedParams.length}/{MEASUREMENT_PARAMETERS.length})</span>
                {isParamMenuOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Right Action: Upload Value Sheet Status Indicator */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 ${
                  records.length > 0 
                    ? 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/50' 
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white'
                }`}
              >
                {isUploading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : records.length > 0 ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{records.length > 0 ? '✓ Value Sheet Uploaded (Re-upload)' : 'Upload Value Sheet'}</span>
              </button>
            </div>
          </div>

          {/* Upload Message Toast */}
          {uploadMessage && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-between">
              <span>{uploadMessage}</span>
              <button onClick={() => setUploadMessage(null)} className="text-emerald-400 hover:text-white font-bold ml-2">Dismiss</button>
            </div>
          )}

          {/* Collapsible Parameter Selection Menu */}
          {isParamMenuOpen && (
            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Select Graph Parameters</span>
                <div className="flex items-center gap-2">
                  <button onClick={handleSelectAll} className="text-[10px] text-cyan-400 hover:underline font-bold">Select All</button>
                  <span className="text-slate-600">|</span>
                  <button onClick={handleDeselectAll} className="text-[10px] text-slate-400 hover:underline font-bold">Deselect All</button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {MEASUREMENT_PARAMETERS.map(param => {
                  const isChecked = selectedParams.includes(param.id);
                  return (
                    <button
                      key={param.id}
                      type="button"
                      onClick={() => toggleParameter(param.id)}
                      className={`flex items-center justify-between p-2 rounded-xl border text-[11px] font-bold transition-all text-left cursor-pointer ${
                        isChecked ? 'bg-slate-900 border-cyan-500/80 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: param.color }} />
                        <span className="truncate">{param.name}</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400">{param.unit}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Parameter Values Cards Grid with embedded Time Card */}
          {records.length > 0 && (() => {
            const activeRecord = (hoveredIndex !== null && records[hoveredIndex]) 
              ? records[hoveredIndex] 
              : records[records.length - 1];

            const isScrubbing = hoveredIndex !== null;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2">
                {/* 1. TIME & DATE CARD */}
                <div className={`p-2.5 bg-slate-950/90 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/50 shadow-amber-950/50' : 'border-cyan-500/40'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider block">Time & Date</span>
                    {isScrubbing ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" title="Cursor Line Moving" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    )}
                  </div>
                  <div className="mt-1">
                    <span className="text-sm font-extrabold text-cyan-300 font-mono block leading-tight truncate">
                      {activeRecord?.time || '—'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono block mt-0.5 truncate">
                      {activeRecord?.date || '—'}
                    </span>
                  </div>
                </div>

                {/* 2. CURRENT CARD */}
                <div className={`p-2.5 bg-slate-950/90 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-emerald-400 bg-emerald-950/20' : 'border-emerald-500/30'
                }`}>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Current</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-extrabold text-emerald-400 font-mono">{activeRecord?.ei18Current ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">A</span>
                  </div>
                </div>

                {/* 3. POWER CARD */}
                <div className={`p-2.5 bg-slate-950/90 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-red-400 bg-red-950/20' : 'border-red-500/30'
                }`}>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Power</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-extrabold text-red-400 font-mono">{activeRecord?.ei18Power ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">W</span>
                  </div>
                </div>

                {/* 4. VOLTAGE CARD */}
                <div className={`p-2.5 bg-slate-950/90 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-cyan-400 bg-cyan-950/20' : 'border-cyan-500/30'
                }`}>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Voltage</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-extrabold text-cyan-300 font-mono">{activeRecord?.ei18Voltage ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">V</span>
                  </div>
                </div>

                {/* 5. IDU DELTA T CARD */}
                <div className={`p-2.5 bg-amber-950/40 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-amber-400 bg-amber-900/30' : 'border-amber-500/50'
                }`}>
                  <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider block">IDU Delta T</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-extrabold text-amber-400 font-mono">{activeRecord?.iduDeltaT ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">°C</span>
                  </div>
                </div>

                {/* 6. ODU DBT CARD */}
                <div className={`p-2.5 bg-slate-950/90 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-purple-400 bg-purple-950/20' : 'border-purple-500/30'
                }`}>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">ODU DBT</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-extrabold text-purple-400 font-mono">{activeRecord?.oduDbt ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">°C</span>
                  </div>
                </div>

                {/* 7. ODU COIL CARD */}
                <div className={`p-2.5 bg-slate-950/90 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-blue-400 bg-blue-950/20' : 'border-blue-500/30'
                }`}>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">ODU Coil</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-extrabold text-blue-400 font-mono">{activeRecord?.oduCoil ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">°C</span>
                  </div>
                </div>

                {/* 8. IDU OUTLET CARD */}
                <div className={`p-2.5 bg-slate-950/90 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-teal-400 bg-teal-950/20' : 'border-teal-500/30'
                }`}>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">IDU Outlet</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-extrabold text-teal-400 font-mono">{activeRecord?.iduOutlet ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">°C</span>
                  </div>
                </div>

                {/* 9. IDU INLET CARD */}
                <div className={`p-2.5 bg-slate-950/90 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-indigo-400 bg-indigo-950/20' : 'border-indigo-500/30'
                }`}>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">IDU Inlet</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-extrabold text-indigo-400 font-mono">{activeRecord?.iduInlet ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">°C</span>
                  </div>
                </div>

                {/* 10. IDU DBT CARD */}
                <div className={`p-2.5 bg-slate-950/90 border rounded-xl shadow-sm transition-all flex flex-col justify-between ${
                  isScrubbing ? 'border-pink-400 bg-pink-950/20' : 'border-pink-500/30'
                }`}>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">IDU DBT</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-extrabold text-pink-400 font-mono">{activeRecord?.iduDbt ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">°C</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Interactive Recharts Chart Area */}
          <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2">
            <div className="h-[380px] w-full">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Loading PP Unit Graph Data...</span>
                </div>
              ) : records.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                  <FileSpreadsheet className="w-8 h-8 text-slate-600" />
                  <span>No measurement records uploaded for this unit yet.</span>
                  <button onClick={() => fileInputRef.current?.click()} className="text-cyan-400 underline font-bold mt-1">Upload Value Sheet</button>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart 
                      data={records} 
                      margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                      onMouseMove={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex >= 0) {
                          setHoveredIndex(e.activeTooltipIndex);
                        } else if (e && e.activePayload && e.activePayload.length > 0 && e.activePayload[0]?.payload) {
                          const item = e.activePayload[0].payload;
                          const idx = records.findIndex(r => r.id === item.id || (r.time === item.time && r.date === item.date));
                          if (idx >= 0) setHoveredIndex(idx);
                        }
                      }}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <defs>
                        {MEASUREMENT_PARAMETERS.map(param => (
                          <linearGradient key={param.id} id={`grad_${param.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={param.color} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={param.color} stopOpacity={0.0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis 
                        yAxisId="left" 
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 10 }} 
                        domain={['auto', 'auto']} 
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 10 }} 
                        domain={['auto', 'auto']} 
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                      {/* Active Cursor Reference Line */}
                      {hoveredIndex !== null && records[hoveredIndex]?.time && (
                        <ReferenceLine
                          yAxisId="left"
                          x={records[hoveredIndex].time}
                          stroke="#38bdf8"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          label={{ value: `▶ ${records[hoveredIndex].time}`, fill: '#38bdf8', fontSize: 10, position: 'top', fontWeight: 'bold' }}
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
                          fill={`url(#grad_${param.id})`}
                          strokeWidth={2}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: '#ffffff', fill: param.color }}
                        />
                      ))}
                    </AreaChart>
                  ) : chartType === 'bar' ? (
                    <BarChart 
                      data={records} 
                      margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                      onMouseMove={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex >= 0) {
                          setHoveredIndex(e.activeTooltipIndex);
                        } else if (e && e.activePayload && e.activePayload.length > 0 && e.activePayload[0]?.payload) {
                          const item = e.activePayload[0].payload;
                          const idx = records.findIndex(r => r.id === item.id || (r.time === item.time && r.date === item.date));
                          if (idx >= 0) setHoveredIndex(idx);
                        }
                      }}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                      {hoveredIndex !== null && records[hoveredIndex]?.time && (
                        <ReferenceLine yAxisId="left" x={records[hoveredIndex].time} stroke="#38bdf8" strokeWidth={2} />
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
                    </BarChart>
                  ) : (
                    <LineChart 
                      data={records} 
                      margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                      onMouseMove={(e: any) => {
                        if (e && typeof e.activeTooltipIndex === 'number' && e.activeTooltipIndex >= 0) {
                          setHoveredIndex(e.activeTooltipIndex);
                        } else if (e && e.activePayload && e.activePayload.length > 0 && e.activePayload[0]?.payload) {
                          const item = e.activePayload[0].payload;
                          const idx = records.findIndex(r => r.id === item.id || (r.time === item.time && r.date === item.date));
                          if (idx >= 0) setHoveredIndex(idx);
                        }
                      }}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis 
                        yAxisId="left" 
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 10 }} 
                        domain={['auto', 'auto']} 
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 10 }} 
                        domain={['auto', 'auto']} 
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                      {/* Active Cursor Reference Line */}
                      {hoveredIndex !== null && records[hoveredIndex]?.time && (
                        <ReferenceLine
                          yAxisId="left"
                          x={records[hoveredIndex].time}
                          stroke="#38bdf8"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          label={{ value: `▶ ${records[hoveredIndex].time}`, fill: '#38bdf8', fontSize: 10, position: 'top', fontWeight: 'bold' }}
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
                          strokeWidth={2}
                          dot={chartType === 'step' ? false : { r: 2.5, fill: param.color }}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: '#ffffff', fill: param.color }}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Records Count: <strong className="text-cyan-300 font-bold">{records.length}</strong>
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close Graph
          </button>
        </div>

      </div>
    </div>
  );
};
