/**
 * LLT Lab Application Version & Update Management Service
 * Tracks system release version, build numbers, and changelog history with persistence.
 */

export interface VersionLog {
  id: string;
  version: string;
  buildNumber: number;
  releaseDate: string;
  title: string;
  description: string;
  type: 'major' | 'minor' | 'patch' | 'hotfix';
}

export interface AppVersionState {
  currentVersion: string;
  buildNumber: number;
  lastUpdated: string;
  channel: 'Stable' | 'Beta' | 'Production';
  history: VersionLog[];
}

const STORAGE_KEY = 'llt_lab_app_version_state_v1';

const DEFAULT_VERSION_STATE: AppVersionState = {
  currentVersion: 'v4.2.5',
  buildNumber: 1042,
  lastUpdated: new Date().toISOString(),
  channel: 'Production',
  history: [
    {
      id: 'v4.2.5',
      version: 'v4.2.5',
      buildNumber: 1042,
      releaseDate: '2026-08-22 15:30',
      title: 'Ultra-Fast DOCX Generation & Live Percentage Bar',
      description: 'Optimized Word template compiling, removed heavy ZIP overhead, added real-time circular percentage progress bar and instant direct DOCX download.',
      type: 'patch'
    },
    {
      id: 'v4.2.0',
      version: 'v4.2.0',
      buildNumber: 1038,
      releaseDate: '2026-08-20 11:45',
      title: 'Master Template Placeholder & Photo Table Mapping',
      description: 'Added support for automated photo insertion (Compressor, Motor, Nameplates) and comprehensive 40+ parameter placeholder mapping.',
      type: 'minor'
    },
    {
      id: 'v4.1.0',
      version: 'v4.1.0',
      buildNumber: 1025,
      releaseDate: '2026-08-15 09:15',
      title: 'Supabase PostgreSQL Cloud Tables & Sync Manager',
      description: 'Integrated Supabase cloud database with tables for Proto, PP, Field, R&D, Smog units and Report Room.',
      type: 'minor'
    },
    {
      id: 'v4.0.0',
      version: 'v4.0.0',
      buildNumber: 1000,
      releaseDate: '2026-08-01 12:00',
      title: 'Report Room Archive & Template Manager 2.0',
      description: 'Introduced central Report Room with tagging, multi-status filters, and custom Word template manager.',
      type: 'major'
    }
  ]
};

let listeners: Array<(state: AppVersionState) => void> = [];

export function getAppVersionState(): AppVersionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveAppVersionState(DEFAULT_VERSION_STATE);
      return DEFAULT_VERSION_STATE;
    }
    const parsed = JSON.parse(raw) as AppVersionState;
    if (!parsed.currentVersion || !Array.isArray(parsed.history)) {
      return DEFAULT_VERSION_STATE;
    }
    return parsed;
  } catch {
    return DEFAULT_VERSION_STATE;
  }
}

function saveAppVersionState(state: AppVersionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notifyListeners(state);
  } catch (err) {
    console.error('Failed to save version state:', err);
  }
}

function notifyListeners(state: AppVersionState): void {
  listeners.forEach(fn => {
    try {
      fn(state);
    } catch (e) {
      console.error('Version listener error:', e);
    }
  });
}

export function subscribeAppVersion(callback: (state: AppVersionState) => void): () => void {
  listeners.push(callback);
  callback(getAppVersionState());
  return () => {
    listeners = listeners.filter(fn => fn !== callback);
  };
}

/**
 * Increment Version number
 * patch: 4.2.5 -> 4.2.6
 * minor: 4.2.5 -> 4.3.0
 * major: 4.2.5 -> 5.0.0
 */
export function bumpAppVersion(
  type: 'patch' | 'minor' | 'major' | 'hotfix',
  title?: string,
  description?: string
): AppVersionState {
  const current = getAppVersionState();
  const rawVer = current.currentVersion.replace(/^v/, '');
  const parts = rawVer.split('.').map(n => parseInt(n, 10) || 0);

  let [major = 4, minor = 2, patch = 0] = parts;

  if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  const newVersionStr = `v${major}.${minor}.${patch}`;
  const newBuild = current.buildNumber + 1;
  const nowStr = new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(',', '');

  const newLog: VersionLog = {
    id: `${newVersionStr}-${Date.now()}`,
    version: newVersionStr,
    buildNumber: newBuild,
    releaseDate: nowStr,
    title: title || `Release Update ${newVersionStr}`,
    description: description || `System update applied with stability and performance enhancements.`,
    type
  };

  const nextState: AppVersionState = {
    currentVersion: newVersionStr,
    buildNumber: newBuild,
    lastUpdated: new Date().toISOString(),
    channel: current.channel,
    history: [newLog, ...current.history]
  };

  saveAppVersionState(nextState);
  return nextState;
}

/**
 * Set custom version tag and update notes
 */
export function setCustomVersion(
  versionStr: string,
  title: string,
  description: string,
  type: 'major' | 'minor' | 'patch' | 'hotfix' = 'patch'
): AppVersionState {
  const current = getAppVersionState();
  const formattedVer = versionStr.startsWith('v') ? versionStr : `v${versionStr}`;
  const newBuild = current.buildNumber + 1;

  const nowStr = new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(',', '');

  const newLog: VersionLog = {
    id: `${formattedVer}-${Date.now()}`,
    version: formattedVer,
    buildNumber: newBuild,
    releaseDate: nowStr,
    title: title || `Release ${formattedVer}`,
    description: description || 'Custom version release deployment.',
    type
  };

  const nextState: AppVersionState = {
    currentVersion: formattedVer,
    buildNumber: newBuild,
    lastUpdated: new Date().toISOString(),
    channel: current.channel,
    history: [newLog, ...current.history]
  };

  saveAppVersionState(nextState);
  return nextState;
}

/**
 * Reset back to default
 */
export function resetAppVersionState(): AppVersionState {
  saveAppVersionState(DEFAULT_VERSION_STATE);
  return DEFAULT_VERSION_STATE;
}
