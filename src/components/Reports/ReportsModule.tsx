import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Activity, 
  ArrowLeft,
  FolderArchive
} from 'lucide-react';
import { Unit } from '../../types';
import { MasterTemplateSection } from './MasterTemplateSection';
import { ProtoReportGenerator } from './ProtoReportGenerator';
import { getMasterTemplate, getMasterTemplateAsync, MasterTemplate } from '../../services/reportTemplateStore';

export type ExpansionReportType = 
  | 'proto' 
  | 'reliability';

interface ReportsModuleProps {
  initialReportType?: ExpansionReportType | string;
  initialUnitSource?: 'proto' | 'pp';
  initialSerialNo?: string;
  units: Unit[];
  onNavigateToDashboard?: () => void;
  onNavigateToReportRoom?: () => void;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  initialReportType = 'proto',
  initialUnitSource,
  initialSerialNo,
  units,
  onNavigateToDashboard,
  onNavigateToReportRoom
}) => {
  const [activeTab, setActiveTab] = useState<ExpansionReportType>(
    initialReportType === 'reliability' ? 'reliability' : 'proto'
  );

  const [masterTemplate, setMasterTemplate] = useState<MasterTemplate | null>(() => getMasterTemplate(activeTab));

  // Sync master template whenever report category tab changes
  useEffect(() => {
    let isMounted = true;
    setMasterTemplate(getMasterTemplate(activeTab));
    getMasterTemplateAsync(activeTab).then((tpl) => {
      if (isMounted && tpl) {
        setMasterTemplate(tpl);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const reportTabs: { id: ExpansionReportType; label: string; shortLabel: string; icon: any; badge?: string }[] = [
    { id: 'proto', label: 'Customer Simulation Report', shortLabel: 'CS Simulation', icon: Cpu, badge: 'AUTO' },
    { id: 'reliability', label: 'Customer Experience Report', shortLabel: 'CS Experience', icon: Activity, badge: 'AUTO' }
  ];

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4">
      {/* Navigation Bar with Back Button & Report Category Tabs & Report Room shortcut */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full pb-1">
        {onNavigateToDashboard && (
          <button
            onClick={onNavigateToDashboard}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-extrabold text-[11px] sm:text-xs transition-all flex-1 min-w-0 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950/60'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate hidden sm:inline">{tab.label}</span>
                <span className="truncate sm:hidden">{tab.shortLabel}</span>
                {tab.badge && (
                  <span className={`hidden sm:inline-block px-1 py-0.5 text-[8px] sm:text-[9px] font-black rounded uppercase shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {onNavigateToReportRoom && (
          <button
            type="button"
            onClick={onNavigateToReportRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 font-extrabold text-[11px] sm:text-xs border border-slate-800 shrink-0 cursor-pointer transition-all shadow-sm"
            title="Open Report Room Archive"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report Room</span>
          </button>
        )}
      </div>

      {/* 1. Master Report Template Section */}
      <MasterTemplateSection
        reportType={activeTab}
        reportTypeName={reportTabs.find(t => t.id === activeTab)?.label || 'Report'}
        onTemplateChange={(tpl) => setMasterTemplate(tpl)}
      />

      {/* 2. Main Generator Section for Customer Simulation & Customer Experience Reports */}
      <ProtoReportGenerator 
        masterTemplate={masterTemplate} 
        reportType={activeTab}
        reportTitle={reportTabs.find(t => t.id === activeTab)?.label || 'Report'}
        initialUnitSource={initialUnitSource}
        initialSerialNo={initialSerialNo}
        onNavigateToReportRoom={onNavigateToReportRoom}
      />
    </div>
  );
};

