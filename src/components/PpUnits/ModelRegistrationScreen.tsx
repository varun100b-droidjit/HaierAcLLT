import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Tag, 
  GitBranch, 
  Save, 
  Trash2, 
  Search, 
  CheckCircle2, 
  Copy, 
  Check, 
  Box,
  Layers,
  Plus,
  Minus,
  Sparkles
} from 'lucide-react';
import { PpUnit } from '../../types';
import { 
  getPpUnits, 
  subscribePpUnitStore, 
  addPpUnit, 
  deletePpUnit,
  updatePpUnitQuantity,
  isModelListEntry,
  isUnitTestingEntry
} from '../../services/ppUnitStore';
import { IduOduMatchingSection } from './IduOduMatchingSection';

interface ModelRegistrationScreenProps {
  initialUnitType?: 'IDU' | 'ODU' | 'BOTH';
  unitType?: 'IDU' | 'ODU' | 'BOTH';
  onNavigateToTesting?: () => void;
}

export const ModelRegistrationScreen: React.FC<ModelRegistrationScreenProps> = ({
  initialUnitType,
  unitType,
}) => {
  const [selectedType, setSelectedType] = useState<'IDU' | 'ODU' | 'BOTH'>(
    initialUnitType || unitType || 'IDU'
  );

  const [modelName, setModelName] = useState('');
  const [materialCode, setMaterialCode] = useState('');
  const [version, setVersion] = useState('V1.0');
  const [quantity, setQuantity] = useState<number>(1);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [allUnits, setAllUnits] = useState<PpUnit[]>(getPpUnits());

  useEffect(() => {
    const unsubscribe = subscribePpUnitStore(() => {
      setAllUnits(getPpUnits());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const modelListUnits = allUnits.filter(isModelListEntry);

  // Filter units matching selectedType (IDU, ODU, or BOTH)
  const filteredModels = modelListUnits.filter(u => {
    let matchesType = false;
    if (selectedType === 'IDU') {
      matchesType = u.unitType === 'IDU' || Boolean(u.iduSerialNumber && !u.oduSerialNumber);
    } else if (selectedType === 'ODU') {
      matchesType = u.unitType === 'ODU' || Boolean(u.oduSerialNumber && !u.iduSerialNumber);
    } else {
      // Both / All models
      matchesType = true;
    }

    if (!matchesType) return false;

    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    return (
      u.modelName.toLowerCase().includes(term) ||
      (u.materialCode && u.materialCode.toLowerCase().includes(term)) ||
      (u.version && u.version.toLowerCase().includes(term))
    );
  });

  const totalMachines = filteredModels.reduce(
    (sum, m) => sum + (typeof m.quantity === 'number' ? Math.max(1, m.quantity) : 1), 
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) return;

    const formattedMatCode = materialCode.trim() || `MAT-${Math.floor(10000 + Math.random() * 90000)}`;
    const formattedVer = version.trim() || 'V1.0';
    const nameTrimmed = modelName.trim();
    const qtyVal = Math.max(1, Number(quantity) || 1);

    // Check duplicate: match unitType, modelName (case-insensitive) and version (case-insensitive)
    const isDuplicate = modelListUnits.some(
      u => (u.unitType === selectedType || (!u.unitType && selectedType === 'IDU')) &&
           u.modelName.trim().toLowerCase() === nameTrimmed.toLowerCase() &&
           (u.version || 'V1.0').trim().toLowerCase() === formattedVer.toLowerCase()
    );

    if (isDuplicate) {
      setErrorMsg(`Model "${nameTrimmed}" with Version "${formattedVer}" is already added! Duplicate models are not allowed.`);
      setTimeout(() => {
        setErrorMsg('');
      }, 5000);
      return;
    }

    const newUnit = addPpUnit({
      modelName: nameTrimmed,
      unitType: selectedType,
      materialCode: formattedMatCode,
      version: formattedVer,
      quantity: qtyVal,
      station: 'Station 01',
      iduSerialNumber: (selectedType === 'IDU' || selectedType === 'BOTH') ? `IDU-${Math.floor(10000 + Math.random() * 90000)}` : '',
      oduSerialNumber: (selectedType === 'ODU' || selectedType === 'BOTH') ? `ODU-${Math.floor(10000 + Math.random() * 90000)}` : '',
      requestBy: 'Lab Specialist',
      testPurpose: `${selectedType} Model Registration`,
      requiredHour: 100,
      partsInfo: {},
      photos: {},
      status: 'live',
      entrySource: 'model_list',
      isModelOnly: true,
      observations: [{ id: `obs-${Date.now()}`, text: `Model ${nameTrimmed} registered with Version ${formattedVer} (Qty: ${qtyVal}).`, timestamp: new Date().toISOString() }],
    });

    setSavedSuccessMsg(`${selectedType} Model "${newUnit.modelName}" (${formattedVer}) saved successfully with ${qtyVal} machine(s)!`);
    setErrorMsg('');
    setModelName('');
    setMaterialCode('');
    setVersion('V1.0');
    setQuantity(1);

    setTimeout(() => {
      setSavedSuccessMsg('');
    }, 4000);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${selectedType} Model "${name}"?`)) {
      deletePpUnit(id);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQtyChange = (id: string, currentQty: number | undefined, delta: number) => {
    const qty = typeof currentQty === 'number' ? currentQty : 1;
    updatePpUnitQuantity(id, qty + delta);
  };

  const getTestingStatusForModel = (item: PpUnit) => {
    const testingUnits = allUnits.filter(isUnitTestingEntry);
    const normalizeVer = (v?: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^v/, '');
    const itemVer = normalizeVer(item.version);
    const itemNameNorm = (item.modelName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const matchingTest = testingUnits.find(tu => {
      const tuNameNorm = (tu.modelName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const isNameMatch = tuNameNorm === itemNameNorm || tuNameNorm.includes(itemNameNorm) || itemNameNorm.includes(tuNameNorm);
      if (!isNameMatch) return false;

      const tuVer = normalizeVer(tu.version);
      if (tuVer && itemVer) {
        return tuVer === itemVer;
      }
      return true;
    });

    if (!matchingTest) {
      return { 
        status: 'pending', 
        label: 'Testing Pending', 
        badgeClass: 'bg-rose-950/70 text-rose-300 border-rose-800/80',
        cardBorder: 'border-rose-500/30 hover:border-rose-400' 
      };
    }
    if (matchingTest.status === 'live') {
      return { 
        status: 'live', 
        label: `Live (Stn ${matchingTest.station || '01'})`, 
        badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-500/60',
        cardBorder: 'border-amber-500/40 hover:border-amber-400' 
      };
    }
    if (matchingTest.status === 'stopped') {
      return { 
        status: 'stopped', 
        label: 'Testing Stopped', 
        badgeClass: 'bg-orange-950/90 text-orange-300 border-orange-500/60',
        cardBorder: 'border-orange-500/40 hover:border-orange-400' 
      };
    }
    return { 
      status: 'finished', 
      label: 'Testing Finished', 
      badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60',
      cardBorder: 'border-emerald-500/40 hover:border-emerald-400' 
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 3 Action Buttons: IDU, ODU, BOTH */}
      <div className="flex items-center justify-start gap-3 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800">
        <button
          type="button"
          onClick={() => setSelectedType('IDU')}
          className={`px-8 py-3 rounded-xl font-black text-xs transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer ${
            selectedType === 'IDU'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/80 border border-cyan-400/50 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>IDU</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedType('ODU')}
          className={`px-8 py-3 rounded-xl font-black text-xs transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer ${
            selectedType === 'ODU'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/80 border border-blue-400/50 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>ODU</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedType('BOTH')}
          className={`px-8 py-3 rounded-xl font-black text-xs transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer ${
            selectedType === 'BOTH'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/80 border border-emerald-400/50 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>BOTH</span>
        </button>
      </div>

      {/* Success Notification */}
      {savedSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 flex items-center gap-3 shadow-lg animate-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{savedSuccessMsg}</span>
        </div>
      )}

      {/* Error / Duplicate Notification */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 flex items-center gap-3 shadow-lg animate-in slide-in-from-top-2 duration-300">
          <div className="w-2 h-2 rounded-full bg-rose-400 animate-ping shrink-0" />
          <span className="text-xs font-bold">{errorMsg}</span>
        </div>
      )}

      {/* FORM CARDVIEW (Shown only for IDU and ODU) */}
      {selectedType !== 'BOTH' && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  {selectedType} Model Registration Form
                </h2>
                <p className="text-xs text-slate-400">Fill in the model details to register in the lab database</p>
              </div>
            </div>
            <span className="text-xs font-mono font-extrabold text-slate-500 uppercase tracking-widest">
              CARDVIEW
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Model Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Model Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder={selectedType === 'IDU' ? "e.g., HSI19GHD-MAI5NB-I" : "e.g., HSO19-5NB-I"}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-500 font-semibold focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all shadow-inner"
                />
              </div>

              {/* 2. Material Code */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Material Code</span>
                </label>
                <input
                  type="text"
                  value={materialCode}
                  onChange={(e) => setMaterialCode(e.target.value)}
                  placeholder="e.g., MAT-88492"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-cyan-200 font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all shadow-inner"
                />
              </div>

              {/* 3. Version */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Version</span>
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g., V1.0"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-emerald-300 font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
                />
              </div>

              {/* 4. Quantity (Machines) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-blue-400" />
                  <span>Machines Qty *</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-cyan-300 font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* SAVE BUTTON */}
            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-xl shadow-cyan-950/60 hover:shadow-cyan-900/80 transition-all duration-200 flex items-center justify-center gap-2.5 group cursor-pointer"
              >
                <Save className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                <span>Save {selectedType} Model</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* IF BOTH SELECTED: SHOW IDU–ODU COMMON NUMBER MATCHING SECTION */}
      {selectedType === 'BOTH' ? (
        <IduOduMatchingSection units={allUnits} />
      ) : (
        /* SAVED DATA SECTION FOR IDU / ODU */
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-950/80 text-cyan-300">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Saved {selectedType} Models
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-mono font-extrabold rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {filteredModels.length} Models • {totalMachines} Machines
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {selectedType} machines available in laboratory master list
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${selectedType} models...`}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* CARDS GRID */}
          {filteredModels.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                <Cpu className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-300">No {selectedType} Models Saved Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Fill out the Cardview form above and click "Save {selectedType} Model" to add your first record.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModels.map((item) => {
                const testInfo = getTestingStatusForModel(item);
                return (
                  <div 
                    key={item.id}
                    className={`bg-slate-900/90 hover:bg-slate-900 p-5 rounded-2xl border ${testInfo.cardBorder} shadow-xl transition-all duration-200 flex flex-col justify-between group relative overflow-hidden`}
                  >
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                      testInfo.status === 'finished' ? 'bg-emerald-500' :
                      testInfo.status === 'live' ? 'bg-amber-500' :
                      testInfo.status === 'stopped' ? 'bg-orange-500' : 'bg-rose-500'
                    }`} />

                    <div className="space-y-3">
                      {/* Top Bar Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-0.5 text-[10px] font-black rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800">
                            {item.unitType || selectedType}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border flex items-center gap-1 ${testInfo.badgeClass}`}>
                            {testInfo.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
                            {testInfo.status === 'finished' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            {testInfo.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                            {testInfo.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          ID: {item.id.slice(0, 8)}
                        </span>
                      </div>

                    {/* Model Name Title */}
                    <div>
                      <h4 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors font-mono">
                        {item.modelName}
                      </h4>
                    </div>

                    {/* Metadata Chips */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-xs">
                      <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold block">Material Code</span>
                        <span className="font-mono font-bold text-amber-300 truncate block">
                          {item.materialCode || 'MAT-1001'}
                        </span>
                      </div>

                      <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold block">Version</span>
                        <span className="font-mono font-bold text-emerald-300 truncate block">
                          {item.version || 'V1.0'}
                        </span>
                      </div>
                    </div>

                    {/* Machine Quantity Stepper */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Box className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[11px] font-bold text-slate-300">Machines:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                          disabled={(item.quantity || 1) <= 1}
                          className="w-5 h-5 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Decrease machine count"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-black text-xs text-cyan-300 min-w-[24px] text-center bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
                          {item.quantity || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                          className="w-5 h-5 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Increase machine count"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-800/80 text-xs">
                    <span className="text-[10px] font-mono text-slate-500">
                      {item.createdAt || 'Just now'}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Copy details */}
                      <button
                        type="button"
                        onClick={() => handleCopy(item.id, `${item.modelName} | ${item.materialCode || ''} | ${item.version || ''}`)}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy details"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {/* Delete item */}
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.modelName)}
                        className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 hover:text-rose-200 border border-rose-900/60 transition-colors cursor-pointer"
                        title="Delete model"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

    </div>
  );
};

