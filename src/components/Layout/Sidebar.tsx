import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Boxes, 
  Settings, 
  LogOut, 
  X,
  Layers,
  FlaskConical,
  Cpu,
  Compass,
  Cloud,
  FileSpreadsheet,
  Bot,
  Sparkles,
  ShieldCheck,
  Award,
  FileCheck,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  Box,
  Activity,
  Building2,
  FolderArchive,
  UserCheck,
  Users,
  ArrowLeftRight
} from 'lucide-react';
import { subscribeReportRoom, getSavedReports } from '../../services/reportRoomStore';
import { subscribeAppVersion, getAppVersionState } from '../../services/versionService';
import { subscribeELTRecords, getELTRecords } from '../../services/eltBsrStore';
import { subscribeSmogUnits, getSmogUnits, LeakUnitRecord } from '../Smog/SmogModule';
import { useAuth } from '../../context/AuthContext';
import { AuthRole } from '../../types';
import { SidebarAutoRefreshControl } from './SidebarAutoRefreshControl';

export type TabType = 
  | 'dashboard' 
  | 'proto-units' 
  | 'pp-units'
  | 'pp-models'
  | 'pp-add-idu'
  | 'pp-add-odu'
  | 'rd-units' 
  | 'in-out-units'
  | 'field-units' 
  | 'smog' 
  | 'reports'
  | 'report-room'
  | 'cs-report' 
  | 'ce-report' 
  | 'graph'
  | 'export-data' 
  | 'ai-support' 
  | 'settings'
  | 'user-management';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  liveUnitsCount: number;
  receivedUnitsCount: number;
  onOpenAddPpModal?: (initialType?: 'IDU' | 'ODU' | 'BOTH') => void;
  userRole?: AuthRole;
  selectedSmogShift?: 'all' | 'A' | 'B';
  onSelectSmogShift?: (shift: 'all' | 'A' | 'B') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  liveUnitsCount,
  receivedUnitsCount,
  onOpenAddPpModal,
  userRole = 'admin',
  selectedSmogShift = 'all',
  onSelectSmogShift,
}) => {
  const { logout, user } = useAuth();
  const [isPpDropdownOpen, setIsPpDropdownOpen] = useState(true);
  const [reportRoomCount, setReportRoomCount] = useState<number>(() => getSavedReports().length);
  const [appVersion, setAppVersion] = useState<string>(() => getAppVersionState().currentVersion);
  const [eltCount, setEltCount] = useState<number>(() => getELTRecords().length);
  const [smogUnits, setSmogUnits] = useState<LeakUnitRecord[]>(() => getSmogUnits());

  const effectiveRole = user?.role || userRole;
  const isRandom = effectiveRole === 'random';

  useEffect(() => {
    const unsubRoom = subscribeReportRoom((reports) => {
      setReportRoomCount(reports.length);
    });
    const unsubVer = subscribeAppVersion((st) => {
      setAppVersion(st.currentVersion);
    });
    const unsubELT = subscribeELTRecords((records) => {
      setEltCount(records.length);
    });
    const unsubSmog = subscribeSmogUnits((units) => {
      setSmogUnits(units);
    });
    return () => {
      unsubRoom();
      unsubVer();
      unsubELT();
      unsubSmog();
    };
  }, []);

  const smogCountTotal = smogUnits.length;

  const allMainItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'proto-units' as TabType,
      label: 'Proto Unit',
      icon: Cpu,
      badge: liveUnitsCount > 0 ? liveUnitsCount : null
    },
    {
      id: 'pp-units' as TabType,
      label: 'PP Unit',
      icon: Cpu,
      badge: 'PP'
    },
    {
      id: 'rd-units' as TabType,
      label: 'R&D Units',
      icon: Boxes,
      badge: null
    },
    {
      id: 'in-out-units' as TabType,
      label: 'In/Out Units',
      icon: ArrowLeftRight,
      badge: eltCount > 0 ? `${eltCount}` : null
    },
    {
      id: 'field-units' as TabType,
      label: 'Field Units',
      icon: Compass,
      badge: null
    },
    {
      id: 'smog' as TabType,
      label: 'Smog Section',
      icon: Cloud,
      badge: smogCountTotal > 0 ? `${smogCountTotal}` : null
    },
    {
      id: 'reports' as TabType,
      label: 'Generate Report',
      icon: FileCheck,
      badge: 'DOCX'
    },
    {
      id: 'report-room' as TabType,
      label: 'Report Room',
      icon: FolderArchive,
      badge: reportRoomCount > 0 ? reportRoomCount : null
    }
  ];

  // For random role: strictly restricted to R&D units & Transfer only
  const mainNavItems = isRandom
    ? allMainItems.filter(item => item.id === 'rd-units')
    : allMainItems;

  const utilityNavItems = isRandom
    ? []
    : [
        {
          id: 'export-data' as TabType,
          label: 'Export Data',
          icon: FileSpreadsheet,
          badge: null
        },
        {
          id: 'settings' as TabType,
          label: 'Settings',
          icon: Settings,
          badge: null
        }
      ];

  const adminNavItems = !isRandom ? [
    {
      id: 'user-management' as TabType,
      label: 'User Management',
      icon: Users,
      badge: 'ADMIN'
    }
  ] : [];

  const handleNavClick = (tabId: TabType) => {
    onSelectTab(tabId);
    onCloseMobile();
    if (tabId === 'smog') {
      window.dispatchEvent(new CustomEvent('open-smog-form'));
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out of LLT Lab?")) {
      try {
        await logout();
      } catch {
        window.location.reload();
      }
    }
  };


  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Mobile Header Inside Drawer */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800 md:hidden">
            <div className="flex items-center gap-2 font-bold text-slate-100">
              <FlaskConical className="w-5 h-5 text-cyan-400" />
              <span>LLT Lab Navigation</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Header badge */}
          <div className="p-4 hidden md:block">
            <div className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Workspace
              </span>
              <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-bold bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                <Layers className="w-3 h-3" /> Industrial
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-180px)]">
            {/* Main Modules */}
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === 'reports' && (activeTab === 'cs-report' || activeTab === 'ce-report'));

              if (item.id === 'pp-units') {
                const isPpGroupActive = activeTab === 'pp-units' || activeTab === 'pp-models' || activeTab === 'pp-add-idu' || activeTab === 'pp-add-odu';
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPpDropdownOpen(!isPpDropdownOpen);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                        isPpGroupActive
                          ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white font-semibold shadow-lg shadow-cyan-950/50'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                          isPpGroupActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'
                        }`} />
                        <span>{item.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            isPpGroupActive
                              ? 'bg-white/20 text-white'
                              : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          }`}
                        >
                          {item.badge}
                        </span>
                        {isPpDropdownOpen ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* PP Unit Dropdown Menu Items */}
                    {isPpDropdownOpen && (
                      <div className="ml-4 pl-3 border-l-2 border-cyan-800/60 space-y-1 py-1">
                        {/* 1. Model List */}
                        <button
                          onClick={() => {
                            handleNavClick('pp-models');
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-left ${
                            activeTab === 'pp-models' || activeTab === 'pp-add-idu' || activeTab === 'pp-add-odu'
                              ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-800/80 font-bold'
                              : 'text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80'
                          }`}
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>Model List</span>
                        </button>

                        {/* 2. Unit Testing */}
                        <button
                          onClick={() => {
                            handleNavClick('pp-units');
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-left ${
                            activeTab === 'pp-units'
                              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800/80 font-bold'
                              : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-800/80'
                          }`}
                        >
                          <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Unit Testing</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white font-semibold shadow-lg shadow-cyan-950/50'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'
                    }`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== null && (
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Utilities / Tools */}
            {utilityNavItems.length > 0 && (
              <>
                <div className="pt-3 pb-1">
                  <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span>SYSTEM TOOLS</span>
                  </div>
                </div>

                {utilityNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white font-semibold shadow-lg shadow-cyan-950/50'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'
                        }`} />
                        <span>{item.label}</span>
                      </div>

                      {item.badge !== null && (
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* Admin Management Section */}
            {adminNavItems.length > 0 && (
              <>
                <div className="pt-3 pb-1">
                  <div className="px-3 text-[10px] font-black uppercase tracking-wider text-cyan-400/80 flex items-center justify-between">
                    <span>ADMINISTRATION</span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded">RBAC</span>
                  </div>
                </div>

                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white font-semibold shadow-lg shadow-cyan-950/50'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'
                        }`} />
                        <span>{item.label}</span>
                      </div>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        }`}
                      >
                        ADMIN
                      </span>
                    </button>
                  );
                })}

                {/* Auto-Refresh Control directly below User Management */}
                <SidebarAutoRefreshControl onOpenSettings={() => handleNavClick('settings')} />
              </>
            )}

            {adminNavItems.length === 0 && (
              <SidebarAutoRefreshControl onOpenSettings={() => handleNavClick('settings')} />
            )}
          </nav>
        </div>

        {/* Bottom Section & Logout */}
        <div className="p-3 border-t border-slate-800">
          <div className="p-3 mb-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Live Units Active</span>
              <span className="font-mono text-cyan-400 font-bold">{liveUnitsCount}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (liveUnitsCount / 10) * 100)}%` }} 
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
              <span>Completed / Received</span>
              <span className="font-mono text-emerald-400 font-semibold">{receivedUnitsCount}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>


          {/* Version Footer Tag */}
          <div className="mt-2.5 pt-2 border-t border-slate-900/80 flex items-center justify-between px-1 text-[11px]">
            <button
              type="button"
              onClick={() => onSelectTab('settings')}
              className="text-slate-500 hover:text-cyan-400 font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LLT Lab System</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('settings')}
              className="font-mono text-[10px] font-bold text-cyan-400 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded-full hover:border-cyan-500/50 transition-all cursor-pointer"
            >
              {appVersion}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
