import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Code, 
  Database, 
  Server, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../../lib/supabase';

interface CopyChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CopyChangesModal: React.FC<CopyChangesModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'store' | 'server' | 'sql'>('all');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const eltBsrSnippet = `// =========================================================================
// src/services/eltBsrStore.ts (Real-Time Multi-Device Sync & Delete Fix)
// =========================================================================

// 1. Authoritative Tombstones & Prevention of Resurrection
export function markELTDeleted(id: string): void {
  if (!id) return;
  const set = getDeletedELTIds();
  set.add(id);
  try {
    localStorage.setItem('llt_deleted_elt_records_v1', JSON.stringify(Array.from(set)));
  } catch {}
}

export function unmarkELTDeleted(id: string): void {
  if (!id) return;
  const set = getDeletedELTIds();
  if (set.has(id)) {
    set.delete(id);
    try {
      localStorage.setItem('llt_deleted_elt_records_v1', JSON.stringify(Array.from(set)));
    } catch {}
  }
}

// 2. Realtime Global Subscription: Handles Supabase Realtime, Broadcast & Server SSE
subscribeToLabRealtimeEvents((event, payload) => {
  if (event === 'elt_records_change') {
    const deletedId = payload?.deletedId || (payload?.eventType === 'DELETE' ? (payload?.recordId || payload?.row?.id) : null);
    if (deletedId) {
      markELTDeleted(deletedId);
      eltCache = eltCache.filter(r => r.id !== deletedId);
      saveLocalELT(eltCache, false);
      notifyELTListeners(eltCache);
    } else {
      initCloudAndLocalELTBSR();
    }
  } else if (event === 'bsr_records_change') {
    const deletedId = payload?.deletedId || (payload?.eventType === 'DELETE' ? (payload?.recordId || payload?.row?.id) : null);
    if (deletedId) {
      markBSRDeleted(deletedId);
      bsrCache = bsrCache.filter(r => r.id !== deletedId);
      saveLocalBSR(bsrCache, false);
      notifyBSRListeners(bsrCache);
    } else {
      initCloudAndLocalELTBSR();
    }
  }
});

// 3. Robust Delete Operation with Multi-Tier Database Await & Rollback
export async function deleteELTRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
  if (!recordId) return { success: false, error: 'No record ID specified' };
  const backupCache = [...eltCache];

  // A. Tentatively mark as deleted in tombstone set
  markELTDeleted(recordId);

  // B. Remove immediately from local memory & localStorage
  const updated = eltCache.filter(r => r.id !== recordId);
  saveLocalELT(updated, false);
  notifyELTListeners(updated);

  // C. Call and await Supabase PostgreSQL delete
  const sbResult = await deleteELTRecordFromSupabase(recordId);

  // D. Call and await Node.js Server delete
  const serverResult = await deleteELTRecordFromServer(recordId);

  // E. Call and await Firestore delete if configured
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'elt_records', recordId));
    } catch (e: any) {
      console.warn('[ELTStore] Firestore delete error:', e);
    }
  }

  // F. Evaluate authoritative deletion outcome
  const isAuthoritativeSuccess = sbResult.success || serverResult.success;
  if (!isAuthoritativeSuccess) {
    // Rollback if server/database failed
    unmarkELTDeleted(recordId);
    eltCache = backupCache;
    saveLocalELT(backupCache, false);
    notifyELTListeners(backupCache);
    return { success: false, error: serverResult.error || sbResult.error || 'Authoritative database deletion failed' };
  }

  // G. Broadcast real-time DELETE event to all connected devices
  broadcastLabRealtimeEvent('elt_records_change', {
    deletedId: recordId,
    action: 'delete',
    timestamp: Date.now()
  });

  return { success: true };
}

// 4. Atomic ELT -> BSR Transfer
export async function returnMultipleMachinesToBSR(...) {
  // Removes from ELT and adds to BSR in single atomic flow
  // Calls /api/in-out/transfer-to-bsr on Node.js server
  // Broadcasts elt_records_change and bsr_records_change
  // Updates Supabase & Firestore
}`;

  const serverSnippet = `// =========================================================================
// server.ts (Authoritative In-Out Endpoints & Realtime SSE Broadcasting)
// =========================================================================

const eltBackupFile = path.join(dataDir, 'elt_records.json');
const bsrBackupFile = path.join(dataDir, 'bsr_records.json');
const eltDeletedBackupFile = path.join(dataDir, 'elt_deleted_ids.json');
const bsrDeletedBackupFile = path.join(dataDir, 'bsr_deleted_ids.json');

// GET /api/in-out/elt
app.get('/api/in-out/elt', (_req, res) => {
  const records = getUnitsFile(eltBackupFile);
  const deletedIds = getDeletedIdsFile(eltDeletedBackupFile);
  const cleanRecords = records.filter(r => !deletedIds.includes(r.id));
  res.json({ success: true, records: cleanRecords, deletedIds });
});

// POST /api/in-out/elt/sync
app.post('/api/in-out/elt/sync', async (req, res) => {
  // Upsert record, remove from deleted tombstones if new, broadcast SSE event
  // Sync to Supabase PostgreSQL in background
});

// DELETE /api/in-out/elt/:id
app.delete('/api/in-out/elt/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ success: false, error: 'ID is required' });

  // 1. Authoritative server tombstone
  addDeletedIdToFile(eltDeletedBackupFile, id);

  // 2. Remove from authoritative server file
  const list = getUnitsFile(eltBackupFile).filter(r => r.id !== id);
  saveUnitsFile(eltBackupFile, list);

  // 3. Delete from Supabase PostgreSQL
  if (serverSupabase) {
    await serverSupabase.from('elt_records').delete().eq('id', id);
  }

  // 4. Realtime broadcast to all connected devices (PCs, tablets, mobiles)
  broadcastServerEvent('elt_records_change', { action: 'delete', deletedId: id, timestamp: Date.now() });

  return res.json({ success: true, deletedId: id });
});

// POST /api/in-out/transfer-to-bsr (Atomic Transfer)
app.post('/api/in-out/transfer-to-bsr', async (req, res) => {
  const { bsrRecords, deletedEltIds } = req.body;
  // Atomically removes from ELT and adds to BSR
  // Broadcasts SSE events for instant UI update on all connected devices
});`;

  const sqlSnippet = `-- =========================================================================
-- Supabase SQL Schema for In/Out Units (ELT & BSR)
-- Run this in your Supabase SQL Editor:
-- =========================================================================

-- 1. ELT Records Table
CREATE TABLE IF NOT EXISTS public.elt_records (
    id TEXT PRIMARY KEY,
    serial_number TEXT NOT NULL DEFAULT '',
    model_name TEXT NOT NULL DEFAULT '',
    in_date TEXT NOT NULL DEFAULT '',
    in_time TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Sent to ELT',
    operator_name TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_elt_records_serial ON public.elt_records(serial_number);
ALTER TABLE public.elt_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all on elt_records" ON public.elt_records FOR ALL TO anon USING (true) WITH CHECK (true);
ALTER TABLE public.elt_records REPLICA IDENTITY FULL;

-- 2. BSR Records Table
CREATE TABLE IF NOT EXISTS public.bsr_records (
    id TEXT PRIMARY KEY,
    serial_number TEXT NOT NULL DEFAULT '',
    model_name TEXT NOT NULL DEFAULT '',
    in_date TEXT NOT NULL DEFAULT '',
    out_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Returned from BSR',
    operator_name TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bsr_records_serial ON public.bsr_records(serial_number);
ALTER TABLE public.bsr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all on bsr_records" ON public.bsr_records FOR ALL TO anon USING (true) WITH CHECK (true);
ALTER TABLE public.bsr_records REPLICA IDENTITY FULL;

-- 3. Add to Supabase Realtime Publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.elt_records;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.bsr_records;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;`;

  const fullPromptForChatGPT = `# LLT LAB — REAL-TIME SYNCHRONIZATION & IN/OUT UNITS ARCHITECTURE OVERVIEW

## 1. Problem Solved
Previously, when an ELT or BSR record was deleted on a PC, tablets or other mobile devices retained the deleted item due to stale local caches and lack of authoritative tombstone propagation. In addition, ELT-to-BSR machine transfers and scanner barcode additions needed consistent real-time propagation across all devices without requiring manual page refresh.

## 2. Solution Implemented
1. **Authoritative Single Source of Truth**:
   - Primary: Supabase PostgreSQL tables \`elt_records\` & \`bsr_records\`.
   - Secondary / Gateway: Node.js server persistence (\`elt_records.json\`, \`bsr_records.json\`) with server-side tombstone files (\`elt_deleted_ids.json\`, \`bsr_deleted_ids.json\`).
   - Third: Firestore synchronized when configured.

2. **Real-Time Multi-Device Broadcasting**:
   - Three independent real-time channels are combined:
     a) **Supabase Realtime** (\`postgres_changes\` on public schema WAL).
     b) **Supabase Broadcast Channel** (\`broadcast\` event on \`llt_lab_unified_realtime\`).
     c) **Node.js Server SSE Hub** (\`/api/events\` Server-Sent Events).
   - Any ADD, TRANSFER, or DELETE triggers an instant event that propagates to every connected device within milliseconds.

3. **Tombstone Resurrection Prevention**:
   - Persistent tombstone IDs are saved and synchronized across server and clients.
   - When a record is deleted, its ID is recorded so stale localStorage caches cannot re-introduce it.
   - Newly scanned serial numbers automatically unmark tombstone IDs so recycled machines work seamlessly.

4. **Atomic ELT to BSR Transfer**:
   - The endpoint \`/api/in-out/transfer-to-bsr\` handles machine moves atomically: removes from ELT and adds to BSR while broadcasting both events.

---

## 3. CODE MODIFICATIONS

### A. Frontend Store (\`src/services/eltBsrStore.ts\`)
\`\`\`typescript
${eltBsrSnippet}
\`\`\`

### B. Backend API Routes (\`server.ts\`)
\`\`\`typescript
${serverSnippet}
\`\`\`

### C. Database Schema (\`Supabase PostgreSQL\`)
\`\`\`sql
${sqlSnippet}
\`\`\`
`;

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => {
      setCopiedSection(null);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Copy Code & Sync Changes
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                  Ready for ChatGPT
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Easily copy code snippets, SQL schemas, or complete architecture summary for ChatGPT.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Copy Button */}
        <div className="p-3 sm:px-5 bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-slate-950 border-b border-purple-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-purple-200">
            <strong>1-Click Master Copy:</strong> Copies the full summary, eltBsrStore.ts code, server.ts routes, and SQL script in formatted Markdown.
          </div>
          <button
            type="button"
            onClick={() => handleCopy(fullPromptForChatGPT, 'master')}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shrink-0 ${
              copiedSection === 'master'
                ? 'bg-emerald-600 text-white shadow-emerald-950/80'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-950/80 active:scale-95'
            }`}
          >
            {copiedSection === 'master' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Copied All for ChatGPT! (Ctrl+V)</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-purple-200" />
                <span>Copy Everything for ChatGPT</span>
              </>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 gap-2 pt-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Full Summary</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'store'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>eltBsrStore.ts</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('server')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'server'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>server.ts Routes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'sql'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase SQL</span>
          </button>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 font-mono text-xs">
          {activeTab === 'all' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-sans">
                <span className="text-slate-300 font-medium">Complete Formatted Markdown for ChatGPT</span>
                <button
                  type="button"
                  onClick={() => handleCopy(fullPromptForChatGPT, 'all_prompt')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  {copiedSection === 'all_prompt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSection === 'all_prompt' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap select-all font-mono text-[11px] leading-relaxed">
                {fullPromptForChatGPT}
              </pre>
            </div>
          )}

          {activeTab === 'store' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-sans">
                <span className="text-slate-300 font-medium">src/services/eltBsrStore.ts Sync & Delete Logic</span>
                <button
                  type="button"
                  onClick={() => handleCopy(eltBsrSnippet, 'store_code')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  {copiedSection === 'store_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSection === 'store_code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 whitespace-pre-wrap select-all font-mono text-[11px] leading-relaxed">
                {eltBsrSnippet}
              </pre>
            </div>
          )}

          {activeTab === 'server' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-sans">
                <span className="text-slate-300 font-medium">server.ts In/Out Routes & SSE Broadcasting</span>
                <button
                  type="button"
                  onClick={() => handleCopy(serverSnippet, 'server_code')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  {copiedSection === 'server_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSection === 'server_code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 whitespace-pre-wrap select-all font-mono text-[11px] leading-relaxed">
                {serverSnippet}
              </pre>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-sans">
                <span className="text-slate-300 font-medium">Supabase SQL Schema (elt_records, bsr_records & Realtime)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(sqlSnippet, 'sql_code')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  {copiedSection === 'sql_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSection === 'sql_code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 whitespace-pre-wrap select-all font-mono text-[11px] leading-relaxed">
                {sqlSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Tip: You can paste the copied content directly into ChatGPT.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
