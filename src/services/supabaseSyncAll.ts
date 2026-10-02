import { getProtoUnits } from './protoUnitStore';
import { getPpUnits } from './ppUnitStore';
import { getFieldUnits } from './fieldUnitStore';
import { getUnits } from './unitStore';
import { getSavedReports } from './reportRoomStore';
import {
  syncProtoUnitToSupabase,
  syncPpUnitToSupabase,
  syncFieldUnitToSupabase,
  syncRDUnitToSupabase,
  syncReportRoomToSupabase,
  syncLeakUnitToSupabase,
  testAllSupabaseTables
} from '../lib/supabase';
import { idbGetAll } from '../lib/indexedDbStorage';

export interface SyncAllSummary {
  protoCount: number;
  ppCount: number;
  fieldCount: number;
  rdCount: number;
  smogCount: number;
  reportsCount: number;
  totalSynced: number;
  errors: string[];
  timestamp: string;
}

export async function syncAllLocalDataToSupabase(
  onProgress?: (msg: string) => void
): Promise<SyncAllSummary> {
  const summary: SyncAllSummary = {
    protoCount: 0,
    ppCount: 0,
    fieldCount: 0,
    rdCount: 0,
    smogCount: 0,
    reportsCount: 0,
    totalSynced: 0,
    errors: [],
    timestamp: new Date().toLocaleString()
  };

  try {
    // 1. Check table connectivity first
    onProgress?.('Verifying Supabase database tables...');
    const tableHealth = await testAllSupabaseTables();
    
    // 2. Proto Units
    onProgress?.('Syncing Proto Units...');
    const protoUnits = getProtoUnits();
    for (const unit of protoUnits) {
      try {
        await syncProtoUnitToSupabase(unit);
        summary.protoCount++;
      } catch (e: any) {
        summary.errors.push(`Proto Unit [${unit.modelName}]: ${e?.message || 'Error'}`);
      }
    }

    // 3. PP Units
    onProgress?.('Syncing PP Units...');
    const ppUnits = getPpUnits();
    for (const unit of ppUnits) {
      try {
        await syncPpUnitToSupabase(unit);
        summary.ppCount++;
      } catch (e: any) {
        summary.errors.push(`PP Unit [${unit.modelName}]: ${e?.message || 'Error'}`);
      }
    }

    // 4. Field Units
    onProgress?.('Syncing Field Units...');
    const fieldUnits = getFieldUnits();
    for (const unit of fieldUnits) {
      try {
        await syncFieldUnitToSupabase(unit);
        summary.fieldCount++;
      } catch (e: any) {
        summary.errors.push(`Field Unit [${unit.modelName}]: ${e?.message || 'Error'}`);
      }
    }

    // 5. R&D Units
    onProgress?.('Syncing R&D Units...');
    const rdUnits = getUnits();
    for (const unit of rdUnits) {
      try {
        await syncRDUnitToSupabase(unit);
        summary.rdCount++;
      } catch (e: any) {
        summary.errors.push(`R&D Unit [${unit.modelName}]: ${e?.message || 'Error'}`);
      }
    }

    // 6. Smog Leak Units
    onProgress?.('Syncing Smog Leak Test Records...');
    try {
      const smogRecords = (await idbGetAll<any>('smog_leak_records')) || [];
      const localSmog = localStorage.getItem('llt_smog_leak_units_v1');
      const parsedSmog = localSmog ? JSON.parse(localSmog) : [];
      const combinedSmog = [...smogRecords, ...parsedSmog];
      const uniqueSmog = Array.from(new Map(combinedSmog.map(s => [s.id, s])).values());

      for (const smog of uniqueSmog) {
        try {
          await syncLeakUnitToSupabase(smog);
          summary.smogCount++;
        } catch (e: any) {
          summary.errors.push(`Smog Record [${smog.id}]: ${e?.message || 'Error'}`);
        }
      }
    } catch (err: any) {
      summary.errors.push(`Smog scan: ${err?.message}`);
    }

    // 7. Report Room Reports
    onProgress?.('Syncing Report Room Reports...');
    const reports = getSavedReports();
    for (const rep of reports) {
      try {
        await syncReportRoomToSupabase(rep);
        summary.reportsCount++;
      } catch (e: any) {
        summary.errors.push(`Report [#${rep.reportNo}]: ${e?.message || 'Error'}`);
      }
    }

    summary.totalSynced =
      summary.protoCount +
      summary.ppCount +
      summary.fieldCount +
      summary.rdCount +
      summary.smogCount +
      summary.reportsCount;

    onProgress?.(`Sync complete! ${summary.totalSynced} items saved.`);
  } catch (globalErr: any) {
    summary.errors.push(`Global sync failure: ${globalErr?.message || 'Unknown error'}`);
  }

  return summary;
}
