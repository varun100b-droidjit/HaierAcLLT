import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Sparkles, 
  AlertTriangle, 
  Zap, 
  CheckCircle2, 
  User, 
  Clock,
  Layers,
  Download,
  Database,
  Save,
  HelpCircle,
  Loader2,
  Check
} from 'lucide-react';
import { Unit } from '../../types';
import { isUnitOverdue } from '../../services/unitStore';
import { 
  getMeghaAIResponseAsync, 
  speakMegha, 
  startListening, 
  stopListening, 
  subscribeVoiceStatus, 
  VoiceStatus, 
  getVoiceStatus,
  unlockAudio
} from '../../utils/meghaVoice';
import { 
  getMeghaChatHistory, 
  saveMeghaChatMessage, 
  clearMeghaChatHistory, 
  subscribeMeghaChat, 
  downloadMeghaChatTranscript,
  ChatMessage 
} from '../../services/meghaChatStore';
import { VoiceCommandsHelpModal } from './VoiceCommandsHelpModal';

interface AISupportModuleProps {
  units: Unit[];
}

export const AISupportModule: React.FC<AISupportModuleProps> = ({ units }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => getMeghaChatHistory());
  const [inputText, setInputText] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(getVoiceStatus());
  const [isThinking, setIsThinking] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to persistent chat store updates
  useEffect(() => {
    const unsubscribeChat = subscribeMeghaChat((newMessages) => {
      setMessages(newMessages);
    });
    return unsubscribeChat;
  }, []);

  // Subscribe to global voice status updates
  useEffect(() => {
    const unsubscribeVoice = subscribeVoiceStatus((status) => {
      setVoiceStatus(status);
    });
    return unsubscribeVoice;
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceStatus]);

  // Calculate live statistics
  const calculateDaysRemaining = (reqDateStr: string): number => {
    if (!reqDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(reqDateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const overdueCount = units.filter(u => isUnitOverdue(u)).length;

  const reworkCount = units.filter(u => u.status === 'rework').length;
  const liveCount = units.filter(u => u.status !== 'completed' && u.status !== 'received').length;

  // Send message handler using Async Gemini AI & Save to Store
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    // Save user message to persistent storage
    saveMeghaChatMessage('user', query);
    if (!textToSend) setInputText('');
    setIsThinking(true);

    try {
      const responseText = await getMeghaAIResponseAsync(query, units);
      // Save Megha reply to persistent storage
      saveMeghaChatMessage('megha', responseText);

      if (voiceEnabled) {
        speakMegha(responseText);
      }
    } catch (err) {
      console.error('Megha AI error:', err);
    } finally {
      setIsThinking(false);
    }
  };

  // Toggle Speech Recognition
  const handleMicClick = () => {
    if (voiceStatus === 'listening' || voiceStatus === 'processing' || voiceStatus === 'executing') {
      stopListening();
    } else {
      unlockAudio();
      startListening(units);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Kya aap Megha ke saare chat records clear karna chahte hain?')) {
      clearMeghaChatHistory();
    }
  };

  const quickPrompts = [
    { label: '⚡ Quick Response', query: 'Quick Response de' },
    { label: '🔧 Rework Units', query: 'Rework me kitni units hain?' },
    { label: '👤 Holders Info', query: 'Units kiske paas hain?' },
    { label: '📊 Total Summary', query: 'Total units status batao' }
  ];

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-8">
      {/* Full Width AI Chat Section */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col h-[720px] shadow-2xl overflow-hidden">
        {/* Chat Header */}
        <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/40 text-cyan-300">
              <Bot className="w-5 h-5 text-cyan-400" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100">Megha AI Assistant</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Voice & Text Navigation
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Voice Status Indicator Badges */}
            {voiceStatus === 'idle' && (
              <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span>IDLE</span>
              </span>
            )}
            {voiceStatus === 'listening' && (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-pink-950/90 text-pink-300 border border-pink-500/50 flex items-center gap-1.5 animate-pulse">
                <Mic className="w-3.5 h-3.5 text-pink-400 animate-bounce" />
                <span>LISTENING...</span>
              </span>
            )}
            {voiceStatus === 'processing' && (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-950/90 text-amber-300 border border-amber-500/50 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>PROCESSING...</span>
              </span>
            )}
            {voiceStatus === 'executing' && (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5 animate-bounce">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>EXECUTING...</span>
              </span>
            )}
            {voiceStatus === 'speaking' && (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 flex items-center gap-1.5 animate-pulse">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>SPEAKING...</span>
              </span>
            )}

            {/* Voice Commands Help Button */}
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/40 hover:to-blue-600/40 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="View Supported Spoken Voice Commands"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Voice Commands</span>
            </button>

            {/* Voice Output Toggle, Download Transcript & Clear Chat */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs font-medium">
                <span className="text-slate-400 text-[11px]">Voice:</span>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`p-1 rounded-lg transition-colors ${
                    voiceEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-700 text-slate-400'
                  }`}
                  title={voiceEnabled ? 'Voice Output Enabled' : 'Voice Output Muted'}
                >
                  {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={downloadMeghaChatTranscript}
                className="p-1.5 text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/80 rounded-xl transition-colors border border-cyan-800/80 flex items-center gap-1 text-xs font-medium px-2.5"
                title="Download Conversation Transcript (.txt)"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Export</span>
              </button>

              <button
                onClick={handleClearChat}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors border border-slate-800"
                title="Clear Chat History"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Chat Messages List */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-slate-950/40 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  msg.sender === 'user'
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                    : 'bg-gradient-to-br from-indigo-900 to-purple-900 text-cyan-300 border-indigo-500/40'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-1">
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-md'
                      : 'bg-slate-800/90 text-slate-100 rounded-tl-none border border-slate-700/70 shadow-md'
                  }`}
                >
                  {msg.text}
                </div>

                <div className={`flex items-center gap-2 text-[10px] text-slate-500 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'megha' && (
                    <button
                      onClick={() => speakMegha(msg.text)}
                      className="hover:text-cyan-400 transition-colors"
                      title="Re-play Voice"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-3 max-w-[85%] animate-pulse">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-gradient-to-br from-indigo-900 to-purple-900 text-cyan-300 border-indigo-500/40">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl text-xs bg-slate-800/90 text-cyan-300 rounded-tl-none border border-slate-700/70 shadow-md flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Megha soch rahi hai...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompt Chips */}
        <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 px-2 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" /> Quick Prompts:
          </span>
          {quickPrompts.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(chip.query)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-cyan-300 rounded-lg text-xs font-medium border border-slate-700/60 whitespace-nowrap transition-all shadow-sm shrink-0 hover:border-cyan-500/40"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 bg-slate-850 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={handleMicClick}
              className={`p-3 rounded-xl border transition-all duration-200 ${
                voiceStatus === 'listening'
                  ? 'bg-pink-600 text-white border-pink-400 shadow-lg shadow-pink-900/50 animate-bounce'
                  : 'bg-slate-800 text-slate-300 hover:text-cyan-300 hover:bg-slate-750 border-slate-700'
              }`}
              title={voiceStatus === 'listening' ? 'Stop Listening' : 'Click to Speak'}
            >
              {voiceStatus === 'listening' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-cyan-400" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Megha AI about overdue units, holders, rework status..."
              className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl shadow-md transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Voice Commands Help Modal */}
      <VoiceCommandsHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
};
