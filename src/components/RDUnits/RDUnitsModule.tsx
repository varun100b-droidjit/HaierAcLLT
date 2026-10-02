import React, { useState } from 'react';
import { 
  Search, 
  Boxes, 
  CheckCircle2, 
  Radio, 
  Inbox,
  Clock,
  RotateCcw,
  FlaskConical,
  ShieldCheck,
  Building,
  Activity,
  Plus
} from 'lucide-react';
import { Unit } from '../../types';
import { UnitCard } from './UnitCard';
import { UnitDetailsDialog } from './UnitDetailsDialog';
import { RDToELTHandoffDialog } from './RDToELTHandoffDialog';
import { calculateRemainingDays } from '../../services/unitStore';

interface RDUnitsModuleProps {
  units: Unit[];
  onOpenAddUnitModal: () => void;
  onTrackUnit: (unit: Unit) => void;
  onEditUnit: (unit: Unit) => void;
  onDeleteUnit: (unitId: string) => void;
  onAdvanceStage: (unitId: string, performerName: string, remarks: string, nextStageIdx?: number) => Promise<void>;
  onReworkUnit: (unitId: string, performerName: string, remarks: string) => Promise<void>;
}

export type RDTab = 'live' | 'received';

export const RDUnitsModule: React.FC<RDUnitsModuleProps> = ({
  units,
  onOpenAddUnitModal,
  onTrackUnit,
  onEditUnit,
  onDeleteUnit,
  onAdvanceStage,
  onReworkUnit,
}) => {
  // Default tab = Live
  const [activeTab, setActiveTab] = useState<RDTab>('live');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [selectedDetailsUnit, setSelectedDetailsUnit] = useState<Unit | null>(null);
  const [selectedReceivedUnit, setSelectedReceivedUnit] = useState<Unit | null>(null);

  // Compute Dashboard Live Counters
  const validUnits = (units || []).filter((u): u is Unit => Boolean(u && typeof u === 'object'));
  const totalUnits = validUnits.length;
  const transferInProgress = validUnits.filter(u => u.status === 'transferred' || u.status === 'live').length;
  const waitingAtELT = validUnits.filter(u => u.currentStageIndex === 1 || u.currentStageIndex === 5).length;
  const waitingAtRD = validUnits.filter(u => u.currentStageIndex === 2 || u.currentStageIndex === 4).length;
  const insideRDArea = validUnits.filter(u => u.currentStageIndex === 3).length;
  const waitingAtOQC = validUnits.filter(u => u.currentStageIndex === 6 || u.currentStageIndex === 7).length;
  const observationUnits = validUnits.filter(u => u.status === 'rework' || u.notes?.includes('REWORK') || u.timeline?.some(t => t.remarks?.includes('Observation') || t.remarks?.includes('NG'))).length;
  const reworkPending = validUnits.filter(u => u.status === 'rework').length;
  const verifiedUnits = validUnits.filter(u => u.timeline?.some(t => t.remarks?.includes('Verified'))).length;
  const completedUnits = validUnits.filter(u => u.status === 'received' || u.status === 'completed' || (u.currentStageIndex ?? 0) >= 10).length;

  const liveUnitsList = validUnits.filter(u => u.status !== 'received' && u.status !== 'completed' && (u.currentStageIndex ?? 0) < 10);
  const receivedUnitsList = validUnits.filter(u => u.status === 'received' || u.status === 'completed' || (u.currentStageIndex ?? 0) >= 10);

  const currentTabUnits = activeTab === 'live' ? liveUnitsList : receivedUnitsList;

  const filteredUnits = currentTabUnits.filter((u) => {
    return (
      (u.modelName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.currentHolder || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
        
        {/* Section Tabs (Live Units, Received Archive) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'live'
                ? 'bg-gradient-to-r from-cyan-950 to-slate-900 text-cyan-300 border border-cyan-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 text-cyan-400 shrink-0 ${activeTab === 'live' ? 'animate-pulse' : ''}`} />
            <span>Live Units</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'live' ? 'bg-cyan-900/80 text-cyan-200' : 'bg-slate-800 text-slate-400'
            }`}>
              {liveUnitsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('received')}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'received'
                ? 'bg-gradient-to-r from-emerald-950 to-slate-900 text-emerald-300 border border-emerald-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Received</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'received' ? 'bg-emerald-900/80 text-emerald-200' : 'bg-slate-800 text-slate-400'
            }`}>
              {receivedUnitsList.length}
            </span>
          </button>
        </div>

        {/* Search Bar & Transfer Unit Button */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search Model Name, Serial Number, or Person Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <button
            onClick={onOpenAddUnitModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-extrabold text-xs text-slate-900 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-md shadow-cyan-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Transfer Unit</span>
          </button>
        </div>

      </div>

      {/* Units Grid */}
      {filteredUnits.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-slate-900/50 border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-300">
            No Units Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'live' 
              ? 'There are currently no live units matching your filters.'
              : 'No units have completed all workflow stages to arrive in the Received archive yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUnits.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              onTrack={onTrackUnit}
              onDetails={(u) => setSelectedDetailsUnit(u)}
              onReceived={(u) => setSelectedReceivedUnit(u)}
              onEdit={onEditUnit}
              onDelete={onDeleteUnit}
            />
          ))}
        </div>
      )}

      {/* Machine Details Dialog */}
      <UnitDetailsDialog
        unit={selectedDetailsUnit ? (units.find(u => u.id === selectedDetailsUnit.id) || selectedDetailsUnit) : null}
        isOpen={Boolean(selectedDetailsUnit)}
        onClose={() => setSelectedDetailsUnit(null)}
      />

      {/* R&D Person to ELT Person Process Dialog */}
      <RDToELTHandoffDialog
        unit={selectedReceivedUnit}
        isOpen={Boolean(selectedReceivedUnit)}
        onClose={() => setSelectedReceivedUnit(null)}
        onAdvanceStage={onAdvanceStage}
        onReworkUnit={onReworkUnit}
      />
    </div>
  );
};
