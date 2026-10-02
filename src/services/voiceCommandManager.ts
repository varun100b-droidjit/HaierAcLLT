/**
 * Voice Command Manager for LLT LAB AI Assistant
 * 
 * Provides intelligent, safe matching for Hindi/Hinglish and English spoken commands.
 * Strictly enforces a whitelist of safe predefined UI actions (Navigation, Scrolling, System).
 */

export type VoiceActionType = 'navigate' | 'scroll' | 'browser';

export type VoiceStatusType = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'EXECUTING';

export interface CommandDefinition {
  id: string;
  category: 'Navigation' | 'Scrolling' | 'System';
  titleEn: string;
  titleHi: string;
  examples: string[];
  actionType: VoiceActionType;
  target?: string;
  responseEn: string;
  responseHi: string;
}

export interface MatchResult {
  matched: boolean;
  command?: CommandDefinition;
  actionType?: VoiceActionType;
  target?: string;
  responseEn: string;
  responseHi: string;
  isHindi: boolean;
}

// Whitelisted command catalog
export const VOICE_COMMANDS_CATALOG: CommandDefinition[] = [
  // --- NAVIGATION ---
  {
    id: 'nav_dashboard',
    category: 'Navigation',
    titleEn: 'Open Dashboard',
    titleHi: 'Dashboard kholo',
    examples: ['Open Dashboard', 'Dashboard kholo', 'Go to Dashboard', 'Dashboard open karo', 'Home screen kholo'],
    actionType: 'navigate',
    target: 'dashboard',
    responseEn: 'Going to Dashboard.',
    responseHi: 'Dashboard khol raha hoon.'
  },
  {
    id: 'nav_proto',
    category: 'Navigation',
    titleEn: 'Open Proto Unit',
    titleHi: 'Proto Unit kholo',
    examples: ['Open Proto Screen', 'Open Proto Unit', 'Proto screen kholo', 'Proto kholo', 'Proto Unit kholo', 'Go to Proto Unit', 'Open Proto'],
    actionType: 'navigate',
    target: 'proto-units',
    responseEn: 'Opening Proto Unit.',
    responseHi: 'Proto Unit khol raha hoon.'
  },
  {
    id: 'nav_rd',
    category: 'Navigation',
    titleEn: 'Open R&D Units',
    titleHi: 'R&D Units kholo',
    examples: ['Open R&D Units', 'R&D Units kholo', 'Open R&D', 'R&D kholo', 'R&D screen kholo', 'Go to R&D'],
    actionType: 'navigate',
    target: 'rd-units',
    responseEn: 'Opening R&D Units.',
    responseHi: 'R&D Units khol raha hoon.'
  },
  {
    id: 'nav_field',
    category: 'Navigation',
    titleEn: 'Open Field Units',
    titleHi: 'Field Units kholo',
    examples: ['Open Field Units', 'Field Units kholo', 'Field screen kholo', 'Open Field', 'Field kholo'],
    actionType: 'navigate',
    target: 'field-units',
    responseEn: 'Opening Field Units.',
    responseHi: 'Field Units khol raha hoon.'
  },
  {
    id: 'nav_reports',
    category: 'Navigation',
    titleEn: 'Open Report Section',
    titleHi: 'Report section kholo',
    examples: ['Open Report Section', 'Report section kholo', 'Open Reports', 'Reports kholo', 'CS Report kholo', 'CE Report kholo'],
    actionType: 'navigate',
    target: 'reports',
    responseEn: 'Opening Report Section.',
    responseHi: 'Report section khol raha hoon.'
  },
  {
    id: 'nav_smog',
    category: 'Navigation',
    titleEn: 'Open Smog Section',
    titleHi: 'Smog section kholo',
    examples: ['Open Smog', 'Smog section kholo', 'Smog kholo', 'Open Smog Test'],
    actionType: 'navigate',
    target: 'smog',
    responseEn: 'Opening Smog Section.',
    responseHi: 'Smog section khol raha hoon.'
  },
  {
    id: 'nav_export',
    category: 'Navigation',
    titleEn: 'Open Export Data',
    titleHi: 'Export Data kholo',
    examples: ['Open Export Data', 'Export data kholo', 'Export section kholo'],
    actionType: 'navigate',
    target: 'export-data',
    responseEn: 'Opening Export Data.',
    responseHi: 'Export Data section khol raha hoon.'
  },
  {
    id: 'nav_ai_support',
    category: 'Navigation',
    titleEn: 'Open AI Assistant',
    titleHi: 'AI Assistant kholo',
    examples: ['Open AI Support', 'AI Support kholo', 'Open AI Assistant', 'Megha AI kholo'],
    actionType: 'navigate',
    target: 'ai-support',
    responseEn: 'Opening AI Assistant.',
    responseHi: 'AI Assistant khol raha hoon.'
  },
  {
    id: 'nav_settings',
    category: 'Navigation',
    titleEn: 'Open Settings',
    titleHi: 'Settings kholo',
    examples: ['Open Settings', 'Settings kholo', 'Settings screen kholo', 'Setting open karo'],
    actionType: 'navigate',
    target: 'settings',
    responseEn: 'Opening Settings.',
    responseHi: 'Settings khol raha hoon.'
  },
  {
    id: 'nav_live_units',
    category: 'Navigation',
    titleEn: 'Open Live Units',
    titleHi: 'Live Units kholo',
    examples: ['Open Live Units', 'Live Units kholo', 'Live testing screen kholo'],
    actionType: 'navigate',
    target: 'rd-units',
    responseEn: 'Opening Live Units.',
    responseHi: 'Live Units khol raha hoon.'
  },
  {
    id: 'nav_finished_units',
    category: 'Navigation',
    titleEn: 'Open Finished Units',
    titleHi: 'Finished Units kholo',
    examples: ['Open Finished Units', 'Finished Units kholo', 'Open Received Units', 'Received Units kholo'],
    actionType: 'navigate',
    target: 'rd-units',
    responseEn: 'Opening Finished Units.',
    responseHi: 'Finished Units khol raha hoon.'
  },

  // --- SCROLLING ---
  {
    id: 'scroll_up',
    category: 'Scrolling',
    titleEn: 'Scroll Up',
    titleHi: 'Upar scroll karo',
    examples: ['Scroll up', 'Upar scroll karo', 'Scroll upar', 'Upar scroll', 'Page up'],
    actionType: 'scroll',
    target: 'up',
    responseEn: 'Scrolling up.',
    responseHi: 'Upar scroll kar raha hoon.'
  },
  {
    id: 'scroll_down',
    category: 'Scrolling',
    titleEn: 'Scroll Down',
    titleHi: 'Neeche scroll karo',
    examples: ['Scroll down', 'Neeche scroll karo', 'Scroll neeche', 'Neeche scroll', 'Page down'],
    actionType: 'scroll',
    target: 'down',
    responseEn: 'Scrolling down.',
    responseHi: 'Neeche scroll kar raha hoon.'
  },
  {
    id: 'scroll_top',
    category: 'Scrolling',
    titleEn: 'Scroll to Top',
    titleHi: 'Page ke top par jao',
    examples: ['Scroll to top', 'Page ke top par jao', 'Top par jao', 'Top scroll karo', 'Scroll top'],
    actionType: 'scroll',
    target: 'top',
    responseEn: 'Scrolling to top.',
    responseHi: 'Page ke top par ja raha hoon.'
  },
  {
    id: 'scroll_bottom',
    category: 'Scrolling',
    titleEn: 'Scroll to Bottom',
    titleHi: 'Page ke bottom par jao',
    examples: ['Scroll to bottom', 'Page ke bottom par jao', 'Bottom par jao', 'Bottom scroll karo', 'Scroll bottom'],
    actionType: 'scroll',
    target: 'bottom',
    responseEn: 'Scrolling to bottom.',
    responseHi: 'Page ke bottom par ja raha hoon.'
  },

  // --- SYSTEM ---
  {
    id: 'sys_back',
    category: 'System',
    titleEn: 'Go Back',
    titleHi: 'Wapas jao',
    examples: ['Go back', 'Back', 'Previous page', 'Wapas jao', 'Peeche jao', 'Back jao'],
    actionType: 'browser',
    target: 'back',
    responseEn: 'Going back.',
    responseHi: 'Peeche wapas ja raha hoon.'
  }
];

/**
 * Normalizes voice query string for robust fuzzy/regex pattern matching.
 */
function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,?!:;]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Checks if query is in Hindi / Hinglish.
 */
function isHindiText(text: string): boolean {
  const hindiWords = ['kholo', 'karo', 'jao', 'khol', 'par', 'ke', 'ka', 'hoon', 'hai', 'raha', 'wapas', 'peeche', 'upar', 'neeche', 'batao', 'suno'];
  const normalized = normalizeQuery(text);
  return hindiWords.some(w => normalized.includes(w));
}

/**
 * Matches user voice query against predefined whitelisted commands.
 * Returns match result or fallback unrecognized error if no command matches.
 */
export function matchVoiceCommand(query: string): MatchResult {
  const norm = normalizeQuery(query);
  const isHindi = isHindiText(query);

  if (!norm) {
    return {
      matched: false,
      responseEn: "I didn't understand that command. Please try again.",
      responseHi: "Mujhe ye command samajh nahi aaya. Kripya dubara try karein.",
      isHindi
    };
  }

  // 1. Check direct pattern match with command catalog
  for (const cmd of VOICE_COMMANDS_CATALOG) {
    for (const example of cmd.examples) {
      const normEx = normalizeQuery(example);
      if (norm === normEx || norm.includes(normEx) || normEx.includes(norm)) {
        return {
          matched: true,
          command: cmd,
          actionType: cmd.actionType,
          target: cmd.target,
          responseEn: cmd.responseEn,
          responseHi: cmd.responseHi,
          isHindi
        };
      }
    }
  }

  // 2. Keyword fallback matching
  // Proto
  if (norm.includes('proto')) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'nav_proto')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // R&D
  if (norm.includes('r&d') || norm.includes('rd') || norm.includes('r and d') || norm.includes('research')) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'nav_rd')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Dashboard
  if (norm.includes('dashboard') || norm.includes('home')) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'nav_dashboard')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Reports
  if (norm.includes('report') || norm.includes('reports')) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'nav_reports')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Field
  if (norm.includes('field')) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'nav_field')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Settings
  if (norm.includes('setting') || norm.includes('settings')) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'nav_settings')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Scroll Top
  if (norm.includes('top') && (norm.includes('scroll') || norm.includes('jao') || norm.includes('page'))) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'scroll_top')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Scroll Bottom
  if (norm.includes('bottom') && (norm.includes('scroll') || norm.includes('jao') || norm.includes('page'))) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'scroll_bottom')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Scroll Up
  if ((norm.includes('up') || norm.includes('upar')) && (norm.includes('scroll') || norm.includes('jao'))) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'scroll_up')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Scroll Down
  if ((norm.includes('down') || norm.includes('neeche')) && (norm.includes('scroll') || norm.includes('jao'))) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'scroll_down')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Go Back
  if (norm.includes('back') || norm.includes('wapas') || norm.includes('peeche')) {
    const cmd = VOICE_COMMANDS_CATALOG.find(c => c.id === 'sys_back')!;
    return {
      matched: true,
      command: cmd,
      actionType: cmd.actionType,
      target: cmd.target,
      responseEn: cmd.responseEn,
      responseHi: cmd.responseHi,
      isHindi
    };
  }

  // Fallback unrecognized command response
  return {
    matched: false,
    responseEn: "I didn't understand that command. Please try again.",
    responseHi: "Mujhe ye command samajh nahi aaya. Kripya dubara try karein.",
    isHindi
  };
}

/**
 * Safely executes a matched whitelisted action.
 */
export function executeWhitelistedAction(
  match: MatchResult,
  navigateHandler?: (tab: string) => void
): void {
  if (!match.matched || !match.actionType) return;

  if (match.actionType === 'navigate' && match.target && navigateHandler) {
    navigateHandler(match.target);
  } else if (match.actionType === 'scroll') {
    if (match.target === 'up') {
      window.scrollBy({ top: -600, behavior: 'smooth' });
    } else if (match.target === 'down') {
      window.scrollBy({ top: 600, behavior: 'smooth' });
    } else if (match.target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (match.target === 'bottom') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  } else if (match.actionType === 'browser' && match.target === 'back') {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else if (navigateHandler) {
      navigateHandler('dashboard');
    }
  }
}
