import React from 'react';
import { 
  X, 
  Mic, 
  Compass, 
  ArrowUpDown, 
  Sliders, 
  Globe, 
  HelpCircle,
  Sparkles,
  Command,
  Check
} from 'lucide-react';
import { VOICE_COMMANDS_CATALOG } from '../../services/voiceCommandManager';

interface VoiceCommandsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceCommandsHelpModal: React.FC<VoiceCommandsHelpModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const navigationCmds = VOICE_COMMANDS_CATALOG.filter(c => c.category === 'Navigation');
  const scrollingCmds = VOICE_COMMANDS_CATALOG.filter(c => c.category === 'Scrolling');
  const systemCmds = VOICE_COMMANDS_CATALOG.filter(c => c.category === 'System');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600/30 to-blue-600/30 border border-cyan-500/40 text-cyan-300">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Voice Command Navigation Guide</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  English & Hindi
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Tap the microphone or press <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 font-mono text-[10px] rounded border border-slate-700">Ctrl + Space</kbd> to speak a command
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar text-xs">
          
          {/* Navigation Category */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Navigation Commands</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {navigationCmds.map(cmd => (
                <div key={cmd.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 hover:border-cyan-500/30 transition-all space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-200">
                    <span className="text-cyan-300">• {cmd.titleEn}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({cmd.titleHi})</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                    {cmd.examples.slice(0, 3).map((ex, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                        <Check className="w-3 h-3 text-cyan-500 shrink-0" />
                        <span>"{ex}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scrolling Category */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
              <ArrowUpDown className="w-4 h-4 text-amber-400" />
              <span>Scrolling Commands</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {scrollingCmds.map(cmd => (
                <div key={cmd.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 hover:border-amber-500/30 transition-all space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-200">
                    <span className="text-amber-300">• {cmd.titleEn}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({cmd.titleHi})</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                    {cmd.examples.slice(0, 3).map((ex, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                        <Check className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>"{ex}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Category */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-400 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>System Commands</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {systemCmds.map(cmd => (
                <div key={cmd.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 hover:border-purple-500/30 transition-all space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-200">
                    <span className="text-purple-300">• {cmd.titleEn}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({cmd.titleHi})</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                    {cmd.examples.slice(0, 3).map((ex, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                        <Check className="w-3 h-3 text-purple-500 shrink-0" />
                        <span>"{ex}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Keyboard Shortcuts Footer Note */}
          <div className="p-3.5 bg-cyan-950/40 border border-cyan-800/60 rounded-2xl flex items-center gap-3 text-cyan-200">
            <Command className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="space-y-0.5 text-[11px]">
              <span className="font-bold">Keyboard Shortcuts:</span> Press <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 font-mono text-[10px] rounded border border-cyan-700">Ctrl + Space</kbd> anywhere on the site to start voice command listening, or press <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 font-mono text-[10px] rounded border border-cyan-700">Escape</kbd> to stop.
            </div>
          </div>

        </div>

        {/* Footer Close Button */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-700"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};
