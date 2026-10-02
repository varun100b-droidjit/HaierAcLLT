import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  Bell, 
  Bot,
  Sparkles,
  Mic,
  Volume2,
  Play,
  Pause,
  Sun, 
  Moon, 
  User, 
  ChevronDown, 
  Menu, 
  Check, 
  X,
  ShieldCheck,
  AlertTriangle,
  Info,
  Clock,
  Smartphone,
  Square,
  Power,
  MicOff,
  Zap,
  ScanBarcode
} from 'lucide-react';
import { LabNotification, UserProfile } from '../../types';
import { markNotificationAsRead, clearNotifications } from '../../services/unitStore';
import { subscribeVoiceStatus, VoiceStatus } from '../../utils/meghaVoice';
import { requestMobileNotificationPermission, sendMobilePushNotification, getMobileNotificationPermissionState } from '../../utils/mobileNotification';
import { LabShiftSelector } from '../Common/LabShiftSelector';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react';

interface TopAppBarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isMeghaVoiceActive?: boolean;
  onToggleMeghaVoice?: () => void;
  notifications: LabNotification[];
  currentUser: UserProfile;
  onChangeUserRole: (role: UserProfile['role']) => void;
  onToggleSidebarMobile: () => void;
  onOpenSupabaseModal?: () => void;
  onOpenBarcodeScanner?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  theme,
  onToggleTheme,
  isMeghaVoiceActive = true,
  onToggleMeghaVoice,
  notifications,
  currentUser,
  onChangeUserRole,
  onToggleSidebarMobile,
  onOpenSupabaseModal,
  onOpenBarcodeScanner,
}) => {
  const { user: authAccount, logout, isAdmin } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');

  const displayName = authAccount?.name || currentUser.name;
  const displayUserId = authAccount?.userId || 'ADMIN01';
  const displayRole = authAccount ? (authAccount.role === 'admin' ? 'Admin' : 'Random') : currentUser.role;


  useEffect(() => {
    const unsubscribe = subscribeVoiceStatus((status) => {
      setVoiceStatus(status);
    });
    return unsubscribe;
  }, []);

  const [notifPermission, setNotifPermission] = useState<string>(getMobileNotificationPermissionState());

  useEffect(() => {
    setNotifPermission(getMobileNotificationPermissionState());
  }, [showNotifications]);

  const handleEnableMobileNotifs = async () => {
    const granted = await requestMobileNotificationPermission();
    setNotifPermission(getMobileNotificationPermissionState());
    
    // Always trigger push alert (Web Audio beep + Mobile Vibration + Floating Screen Toast + Log)
    sendMobilePushNotification(
      '📱 Mobile Overdue Alerts Activated!', 
      'Overdue testing units par aapko sound, vibration, aur mobile screen alerts milenge.', 
      'mobile-test-alert',
      'success'
    );

    // Optional Speech voice confirmation
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('Mobile overdue notifications active');
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore speech error
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const rolesList: UserProfile['role'][] = [
    'Lab Manager',
    'BSR Specialist',
    'ELT Engineer',
    'R&D Lead',
    'OQC Inspector'
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-slate-100 transition-colors">
      {/* Left side: Mobile Menu + Branding */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebarMobile}
          className="p-2 -ml-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg md:hidden transition-colors"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-900/40">
            <FlaskConical className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white font-mono">
                LLT LAB
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-cyan-300 bg-cyan-950/80 border border-cyan-800/80 rounded-full">
                M3 R&D
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden xs:block">
              Industrial Unit Lifecycle & Stage Tracker
            </p>
          </div>
        </div>
      </div>

      {/* Right side: Controls & Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Quick Shift Selector */}
        <LabShiftSelector compact={true} className="hidden xl:flex" />

        {/* Megha AI Voice Symbol - Hidden as requested */}
        <div className="hidden relative items-center justify-center shrink-0">
          {/* Pulsing Aura Rings when Listening */}
          {voiceStatus === 'listening' && (
            <>
              <span className="absolute inset-0 rounded-full bg-pink-500/30 border border-pink-400/60 animate-pulse-ring-1 pointer-events-none"></span>
              <span className="absolute inset-0 rounded-full bg-pink-500/20 border border-pink-400/40 animate-pulse-ring-2 pointer-events-none"></span>
            </>
          )}

          <button
            onClick={onToggleMeghaVoice}
            type="button"
            className={`relative w-11 h-11 rounded-full border transition-all duration-300 cursor-pointer flex flex-col items-center justify-center shadow-md active:scale-95 group ${
              voiceStatus === 'listening'
                ? 'bg-pink-950/90 border-pink-500 ring-2 ring-pink-500/60 shadow-pink-950/90 shadow-lg'
                : voiceStatus === 'speaking'
                ? 'bg-cyan-950/90 border-cyan-500/80 ring-2 ring-cyan-500/40 shadow-cyan-950/80'
                : isMeghaVoiceActive
                ? 'bg-slate-900/95 border-emerald-500/60 hover:border-emerald-400 shadow-emerald-950/60 ring-1 ring-emerald-500/30'
                : 'bg-slate-950/95 border-red-500/60 hover:border-red-400 shadow-red-950/60 ring-1 ring-red-500/30'
            }`}
            title={
              voiceStatus === 'listening'
                ? 'Megha Sun Rahi Hai... Click to Pause'
                : voiceStatus === 'speaking'
                ? 'Megha Bol Rahi Hai... Click to Pause'
                : isMeghaVoiceActive
                ? 'Megha AI Voice PLAYING (Active) - Click to Pause'
                : 'Megha AI Voice PAUSED - Click to Play'
            }
          >
            {/* SVG Circular Progress Ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 44 44">
              {/* Background Track Circle */}
              <circle
                cx="22"
                cy="22"
                r="18"
                className="stroke-slate-800/80"
                strokeWidth="2.8"
                fill="transparent"
              />
              {/* Foreground Quota Circle (88%) */}
              <circle
                cx="22"
                cy="22"
                r="18"
                strokeWidth="2.8"
                strokeDasharray="113.1"
                strokeDashoffset={113.1 * (1 - 0.88)}
                strokeLinecap="round"
                fill="transparent"
                className={`transition-all duration-500 ${
                  voiceStatus === 'listening'
                    ? 'stroke-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,1)]'
                    : voiceStatus === 'speaking'
                    ? 'stroke-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]'
                    : isMeghaVoiceActive
                    ? 'stroke-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]'
                    : 'stroke-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.9)]'
                }`}
              />
            </svg>

            {/* Inner Content Centered - Play / Pause / Speaking / Listening */}
            <div className="relative z-10 flex flex-col items-center justify-center leading-none">
              {voiceStatus === 'listening' ? (
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <Mic className="w-3.5 h-3.5 text-pink-300 animate-pulse drop-shadow-[0_0_6px_rgba(244,114,182,0.9)]" />
                  {/* Equalizer Wave Bar Animation */}
                  <div className="flex items-end justify-center gap-[2px] h-3 mt-0.5">
                    <span className="w-[2px] bg-pink-400 rounded-full animate-wave-bar-1 shadow-[0_0_4px_rgba(244,114,182,0.8)]"></span>
                    <span className="w-[2px] bg-pink-300 rounded-full animate-wave-bar-2 shadow-[0_0_4px_rgba(244,114,182,0.8)]"></span>
                    <span className="w-[2px] bg-pink-200 rounded-full animate-wave-bar-3 shadow-[0_0_4px_rgba(244,114,182,0.8)]"></span>
                  </div>
                </div>
              ) : voiceStatus === 'speaking' ? (
                <div className="flex flex-col items-center gap-0.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                  {/* Speaking Equalizer Sound Wave Bars */}
                  <span className="flex items-center gap-0.5">
                    <span className="w-0.5 h-1 bg-cyan-400 rounded-full animate-ping"></span>
                    <span className="w-0.5 h-2.5 bg-cyan-300 rounded-full animate-ping delay-100"></span>
                    <span className="w-0.5 h-1.5 bg-cyan-400 rounded-full animate-ping delay-200"></span>
                  </span>
                </div>
              ) : isMeghaVoiceActive ? (
                <Play className="w-4 h-4 text-emerald-400 fill-emerald-400/80 group-hover:scale-110 transition-transform" />
              ) : (
                <Pause className="w-4 h-4 text-red-400 fill-red-400/80 group-hover:scale-110 transition-transform" />
              )}
            </div>

            {/* Top Right Status Dot */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span
                className={`relative inline-flex rounded-full h-3 w-3 border-2 border-slate-900 ${
                  voiceStatus === 'listening'
                    ? 'bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,1)] animate-ping'
                    : voiceStatus === 'speaking'
                    ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,1)] animate-pulse'
                    : isMeghaVoiceActive
                    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,1)]'
                    : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,1)] animate-pulse'
                }`}
              ></span>
            </span>
          </button>
        </div>

        {/* 1. HEADER ME BARCODE SCANNER FEATURE (Notification Bell ke LEFT SIDE) */}
        {onOpenBarcodeScanner && (
          <button
            type="button"
            onClick={onOpenBarcodeScanner}
            className="relative p-2.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-800/80 rounded-xl transition-all duration-200 cursor-pointer group"
            title="Barcode / QR Scanner (ELT & BSR)"
            aria-label="Barcode / QR Scanner"
          >
            <ScanBarcode className="w-5 h-5 group-hover:scale-110 transition-transform text-cyan-400" />
            <span className="sr-only">Barcode Scanner</span>
          </button>
        )}

        {/* Notifications Button & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all duration-200"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-slate-100">Lab Alerts</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium text-cyan-300 bg-cyan-950/80 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Push Notification Banner */}
              <div className="px-3.5 py-2.5 bg-gradient-to-r from-cyan-950/90 via-slate-900 to-indigo-950/80 border-b border-cyan-500/30 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-cyan-900/60 text-cyan-300 shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-200 block text-[11px] truncate">Mobile Push Notifications</span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {notifPermission === 'granted' ? '✅ Overdue alerts active' : 'Receive Overdue alerts on Phone'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEnableMobileNotifs}
                  className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-[10px] shadow-sm transition-all active:scale-95 shrink-0 cursor-pointer"
                >
                  {notifPermission === 'granted' ? 'Test Alert' : 'Enable Mobile'}
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No lab notifications at this time.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationAsRead(n.id)}
                      className={`p-3.5 transition-colors cursor-pointer hover:bg-slate-800/40 ${
                        !n.read ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {n.type === 'alert' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        ) : n.type === 'warning' ? (
                          <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {n.timestamp}
                          </p>
                        </div>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-2 text-center bg-slate-900 border-t border-slate-800">
                  <button
                    onClick={() => clearNotifications()}
                    className="text-xs text-slate-400 hover:text-cyan-400 font-medium transition-colors"
                  >
                    Clear All Notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 pl-2.5 pr-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left pr-1">
              {displayName && displayName !== 'Lab Administrator' ? (
                <div className="text-xs font-semibold text-slate-100 leading-none">
                  {displayName}
                </div>
              ) : null}
              <div className="text-[10px] text-cyan-400 mt-0.5 leading-none flex items-center gap-1 font-mono">
                {displayUserId && displayUserId !== 'ADMIN01' && (
                  <>
                    <span>{displayUserId}</span>
                    <span>&bull;</span>
                  </>
                )}
                <span className="capitalize">{displayRole}</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2.5 border-b border-slate-800 mb-1 bg-slate-950/60 rounded-xl">
                <div className="flex items-center justify-between">
                  {displayName && displayName !== 'Lab Administrator' ? (
                    <p className="text-xs font-bold text-slate-100">{displayName}</p>
                  ) : (
                    <p className="text-xs font-bold text-slate-100">Account</p>
                  )}
                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full border ${
                    displayRole.toLowerCase() === 'admin'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {displayRole}
                  </span>
                </div>
                {displayUserId && displayUserId !== 'ADMIN01' && (
                  <p className="text-[11px] text-cyan-400 font-mono mt-0.5">User ID: <strong>{displayUserId}</strong></p>
                )}
                <div className="inline-flex items-center gap-1 px-2 py-0.5 mt-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Auth: Firebase RBAC
                </div>
              </div>

              {/* Real Logout Button */}
              <button
                onClick={async () => {
                  setShowUserMenu(false);
                  if (window.confirm("Are you sure you want to sign out of LLT Lab?")) {
                    await logout();
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer mt-1"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Sign Out Account</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
