import { createClient } from '@supabase/supabase-js';
import { ProtoUnit, FieldUnit, Unit, PpUnit } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fcmkbyeffrlncrpdrdbb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjbWtieWVmZnJsbmNycGRyZGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NDM1NTksImV4cCI6MjEwMTIxOTU1OX0._VY6Bv21Teq553X9ENWlw05MeEC8kz1ubZkGqELpIbA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* ==========================================
   GLOBAL REAL-TIME CROSS-DEVICE EVENT HUB
   (Supabase postgres_changes + Broadcast fallback)
   ========================================== */
export type LabRealtimeEventType = 
  | 'shift_change' 
  | 'rd_units_change' 
  | 'pp_units_change' 
  | 'proto_units_change' 
  | 'field_units_change' 
  | 'smog_units_change' 
  | 'reports_change'
  | 'system_update'
  | 'elt_records_change'
  | 'bsr_records_change'
  | 'models_change';

const realtimeListeners = new Set<(event: string, payload: any) => void>();

// Map Supabase table names directly to application realtime event types
const TABLE_EVENT_MAP: Record<string, LabRealtimeEventType> = {
  proto_units: 'proto_units_change',
  pp_units: 'pp_units_change',
  field_units: 'field_units_change',
  rd_units: 'rd_units_change',
  smog_leak_units: 'smog_units_change',
  smog_qty_records: 'smog_units_change',
  report_room_reports: 'reports_change',
  system_settings: 'shift_change',
  model_master: 'models_change',
  elt_records: 'elt_records_change',
  bsr_records: 'bsr_records_change',
};

// Global unified Realtime Channel
const realtimeChannel = supabase.channel('llt_lab_unified_realtime', {
  config: {
    broadcast: { self: false },
  }
});

// 1. Broadcast listener (for lightweight fast pings across active clients)
realtimeChannel.on('broadcast', { event: '*' }, (data: any) => {
  try {
    const eventName = data.event;
    const payload = data.payload || {};
    console.log('[Supabase Realtime Broadcast]', eventName, payload);
    realtimeListeners.forEach(listener => {
      try { listener(eventName, payload); } catch (e) { console.warn(e); }
    });
  } catch (err) {
    console.warn('Realtime broadcast dispatch error:', err);
  }
});

// 2. PostgreSQL Database Level Realtime Listener (postgres_changes)
// Fires automatically whenever ANY device (phone/PC) performs INSERT, UPDATE, or DELETE in the database
realtimeChannel.on(
  'postgres_changes',
  { event: '*', schema: 'public' },
  (payload: any) => {
    try {
      const { table, eventType, new: newRow, old: oldRow } = payload;
      const targetEvent = TABLE_EVENT_MAP[table];
      if (!targetEvent) return;

      console.log(`[Supabase DB WAL Event] Table: ${table} | Type: ${eventType}`, payload);

      const dispatchPayload: any = {
        source: 'postgres_changes',
        table,
        eventType, // 'INSERT' | 'UPDATE' | 'DELETE'
        row: newRow || oldRow,
        recordId: newRow?.id || oldRow?.id,
        timestamp: Date.now()
      };

      if (eventType === 'DELETE') {
        dispatchPayload.deletedId = oldRow?.id;
      }

      realtimeListeners.forEach(listener => {
        try { listener(targetEvent, dispatchPayload); } catch (e) { console.warn(e); }
      });
    } catch (err) {
      console.warn('Realtime postgres_changes dispatch error:', err);
    }
  }
);

// Subscribe channel with auto-retry
realtimeChannel.subscribe((status: string, err?: any) => {
  console.log('[Supabase Realtime Channel Status]:', status, err ? err.message : '');
});

// Auto-reconnect on visibility and online events (essential for mobile devices sleeping / tab switching)
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      try {
        if (realtimeChannel.state !== 'joined' && realtimeChannel.state !== 'joining') {
          realtimeChannel.subscribe();
        }
      } catch (e) {
        console.warn('Realtime reconnect notice:', e);
      }
    }
  });

  window.addEventListener('online', () => {
    try {
      realtimeChannel.subscribe();
    } catch (e) {
      console.warn('Realtime online reconnect notice:', e);
    }
  });
}

export function broadcastLabRealtimeEvent(event: LabRealtimeEventType, payload: any = {}) {
  try {
    realtimeChannel.send({
      type: 'broadcast',
      event,
      payload: { ...payload, clientTimestamp: Date.now() }
    });
  } catch (e) {
    console.warn('Realtime broadcast error:', e);
  }
}

export function subscribeToLabRealtimeEvents(listener: (event: string, payload: any) => void): () => void {
  realtimeListeners.add(listener);
  return () => {
    realtimeListeners.delete(listener);
  };
}

/* ==========================================
   0. SYSTEM SETTINGS & SHIFT SUPABASE SYNC
   ========================================== */

export async function syncShiftToSupabase(shift: string, shiftName: string, operatorName: string = 'Shift Manager') {
  try {
    const payload = {
      id: 'active_shift',
      setting_key: 'active_shift',
      setting_value: shift,
      shift_name: shiftName,
      operator_name: operatorName,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('system_settings').upsert(payload);
    if (error) {
      console.warn('Supabase system_settings upsert note:', error.message);
    }
  } catch (err) {
    console.warn('Supabase shift sync note:', err);
  }
}

export async function fetchShiftFromSupabase(): Promise<{ shift: string; shiftName?: string; updatedAt?: string } | null> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', 'active_shift')
      .maybeSingle();

    if (error || !data) return null;
    return {
      shift: data.setting_value || data.shift || '',
      shiftName: data.shift_name,
      updatedAt: data.updated_at
    };
  } catch (err) {
    return null;
  }
}

export function safeIsoString(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const trimmed = String(dateStr).trim();
    if (!trimmed) return new Date().toISOString();

    const direct = new Date(trimmed);
    if (!isNaN(direct.getTime())) return direct.toISOString();

    const withT = new Date(trimmed.replace(' ', 'T'));
    if (!isNaN(withT.getTime())) return withT.toISOString();

    return new Date().toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

export interface SupabaseSmogLeakRecord {
  id: string;
  smog_person: string;
  shift: string;
  model_name: string;
  serial_numbers: string[];
  passed_serials?: string[];
  suspect_count: number;
  actual_count: number;
  date: string;
  month: string;
  time: string;
  notes?: string;
  created_at?: string;
}

/* ==========================================
   1. SMOG LEAK UNITS SUPABASE SYNC
   ========================================== */

export async function syncLeakUnitToSupabase(record: {
  id: string;
  smogPerson: string;
  shift: string;
  modelName: string;
  serialNumbers: string[];
  passedSerials?: string[];
  suspectCount: number;
  actualCount: number;
  date: string;
  month: string;
  time: string;
  notes?: string;
  createdAt: string;
}) {
  try {
    const payload = {
      id: record.id,
      smog_person: record.smogPerson,
      shift: record.shift,
      model_name: record.modelName,
      serial_numbers: record.serialNumbers,
      passed_serials: record.passedSerials || [],
      suspect_count: record.suspectCount,
      actual_count: record.actualCount,
      date: record.date,
      month: record.month,
      time: record.time,
      notes: record.notes || '',
      created_at: record.createdAt,
    };

    const { error } = await supabase.from('smog_leak_units').upsert(payload);
    if (error) {
      console.warn('Supabase Smog upsert note:', error.message);
    }
  } catch (err) {
    console.warn('Supabase connection error (Smog):', err);
  }
}

export async function deleteLeakUnitFromSupabase(id: string) {
  try {
    await supabase.from('smog_leak_units').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase delete error (Smog):', err);
  }
}

export async function fetchLeakUnitsFromSupabase(): Promise<any[] | null> {
  try {
    const { data, error } = await supabase
      .from('smog_leak_units')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map((item: any) => ({
      id: item.id,
      smogPerson: item.smog_person || item.smogPerson || '',
      shift: item.shift || 'A',
      modelName: item.model_name || item.modelName || '',
      serialNumbers: item.serial_numbers || item.serialNumbers || [],
      passedSerials: item.passed_serials || item.passedSerials || [],
      suspectCount: item.suspect_count || item.suspectCount || 0,
      actualCount: item.actual_count || item.actualCount || 0,
      date: item.date || '',
      month: item.month || '',
      time: item.time || '',
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      notes: item.notes || '',
    }));
  } catch (err) {
    console.warn('Supabase fetch error (Smog):', err);
    return null;
  }
}

/* ==========================================
   2. PROTO UNITS SUPABASE SYNC
   ========================================== */

export async function syncProtoUnitToSupabase(unit: ProtoUnit) {
  try {
    const payload = {
      id: unit.id,
      model_name: unit.modelName || '',
      station: unit.station || '',
      idu_serial_number: unit.iduSerialNumber || '',
      odu_serial_number: unit.oduSerialNumber || '',
      request_by: unit.requestBy || '',
      test_purpose: unit.testPurpose || '',
      required_hour: Number(unit.requiredHour || 0),
      report_details: unit.reportDetails || {},
      name_plate: unit.namePlate || {},
      parts_info: unit.partsInfo || {},
      photos: unit.photos || {},
      remarks: unit.remarks || '',
      observations: unit.observations || [],
      status: unit.status || 'live',
      created_at: safeIsoString(unit.createdAt),
      updated_at: safeIsoString(unit.updatedAt)
    };

    const { error } = await supabase.from('proto_units').upsert(payload);
    if (error) {
      console.warn('Supabase Proto Units note:', error.message);
    } else {
      console.log('Successfully synced Proto Unit to Supabase:', unit.id);
    }
  } catch (err) {
    console.warn('Supabase connection note (Proto Units):', err);
  }
}

export async function deleteProtoUnitFromSupabase(id: string) {
  try {
    await supabase.from('proto_units').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase delete error (Proto Units):', err);
  }
}

const KNOWN_MOCK_IDS = new Set([
  'unit-101', 'unit-102', 'unit-103', 'unit-104', 'unit-105',
  'proto-101', 'proto-102',
  'pp-idu-19', 'pp-odu-19', 'pp-idu-18', 'pp-odu-18', 'pp-idu-24', 'pp-odu-24', 'pp-idu-30', 'pp-odu-36',
  'field-101', 'field-102', 'field-103',
  'rep-cs-101', 'rep-ce-102'
]);

function isMockId(id: string): boolean {
  if (!id) return false;
  return KNOWN_MOCK_IDS.has(id) || id.startsWith('pp-idu-') || id.startsWith('pp-odu-');
}

export async function fetchProtoUnitsFromSupabase(): Promise<ProtoUnit[] | null> {
  try {
    const { data, error } = await supabase
      .from('proto_units')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    const filtered = data.filter((item: any) => !isMockId(item.id));
    if (filtered.length === 0) return null;

    return filtered.map((item: any) => ({
      id: item.id,
      modelName: item.model_name || item.modelName || '',
      station: item.station || 'Station 01',
      iduSerialNumber: item.idu_serial_number || item.iduSerialNumber || '',
      oduSerialNumber: item.odu_serial_number || item.oduSerialNumber || '',
      requestBy: item.request_by || item.requestBy || '',
      testPurpose: item.test_purpose || item.testPurpose || '',
      requiredHour: Number(item.required_hour ?? item.requiredHour ?? 0),
      reportDetails: item.report_details || item.reportDetails || {},
      namePlate: item.name_plate || item.namePlate || {},
      partsInfo: item.parts_info || item.partsInfo || {},
      photos: item.photos || {},
      remarks: item.remarks || '',
      observations: item.observations || [],
      status: item.status || 'live',
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Supabase fetch error (Proto Units):', err);
    return null;
  }
}

/* ==========================================
   3. FIELD UNITS SUPABASE SYNC
   ========================================== */

export async function syncFieldUnitToSupabase(unit: FieldUnit) {
  try {
    const payload = {
      id: unit.id,
      model_name: unit.modelName || '',
      product_type: unit.productType || '',
      idu_serial_number: unit.iduSerialNumber || '',
      odu_serial_number: unit.oduSerialNumber || '',
      serial_number: unit.serialNumber || '',
      request_by: unit.requestBy || '',
      station: unit.station || '',
      start_date_time: unit.startDateTime || '',
      end_date_time: unit.endDateTime || '',
      required_hour: Number(unit.requiredHour || 0),
      status: unit.status || 'live',
      remarks: unit.remarks || '',
      observations: unit.observations || [],
      created_at: safeIsoString(unit.createdAt),
      updated_at: safeIsoString(unit.updatedAt)
    };

    const { error } = await supabase.from('field_units').upsert(payload);
    if (error) {
      console.warn('Supabase Field Units note:', error.message);
    } else {
      console.log('Successfully synced Field Unit to Supabase:', unit.id);
    }
  } catch (err) {
    console.warn('Supabase connection note (Field Units):', err);
  }
}

export async function deleteFieldUnitFromSupabase(id: string) {
  try {
    await supabase.from('field_units').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase delete error (Field Units):', err);
  }
}

export async function fetchFieldUnitsFromSupabase(): Promise<FieldUnit[] | null> {
  try {
    const { data, error } = await supabase
      .from('field_units')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    const filtered = data.filter((item: any) => !isMockId(item.id));
    if (filtered.length === 0) return null;

    return filtered.map((item: any) => ({
      id: item.id,
      modelName: item.model_name || item.modelName || '',
      productType: item.product_type || item.productType || 'BOTH',
      iduSerialNumber: item.idu_serial_number || item.iduSerialNumber || '',
      oduSerialNumber: item.odu_serial_number || item.oduSerialNumber || '',
      serialNumber: item.serial_number || item.serialNumber || '',
      requestBy: item.request_by || item.requestBy || '',
      station: item.station || 'Station 01',
      startDateTime: item.start_date_time || item.startDateTime || '',
      endDateTime: item.end_date_time || item.endDateTime,
      requiredHour: Number(item.required_hour ?? item.requiredHour ?? 0),
      status: item.status || 'live',
      remarks: item.remarks || '',
      observations: item.observations || [],
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Supabase fetch error (Field Units):', err);
    return null;
  }
}

/* ==========================================
   4. R&D UNITS SUPABASE SYNC
   ========================================== */

export async function syncRDUnitToSupabase(unit: Unit) {
  try {
    const payload = {
      id: unit.id,
      model_name: unit.modelName || '',
      serial_number: unit.serialNumber || '',
      required_by: unit.requiredBy || '',
      day_duration: Number(unit.dayDuration || 0),
      transfer_date: unit.transferDate || '',
      bsr_person: unit.bsrPerson || '',
      elt_person: unit.eltPerson || '',
      rd_person: unit.rdPerson || '',
      oqc_person: unit.oqcPerson || '',
      current_holder: unit.currentHolder || '',
      current_stage_index: Number(unit.currentStageIndex || 0),
      status: unit.status || 'transferred',
      timeline: unit.timeline || [],
      priority: unit.priority || 'Normal',
      notes: unit.notes || '',
      observations: unit.observations || [],
      created_at: safeIsoString(unit.createdAt),
      updated_at: safeIsoString(unit.updatedAt)
    };

    const { error } = await supabase.from('rd_units').upsert(payload);
    if (error) {
      console.warn('Supabase R&D Units note:', error.message);
    } else {
      console.log('Successfully synced R&D Unit to Supabase:', unit.id);
    }
  } catch (err) {
    console.warn('Supabase connection note (R&D Units):', err);
  }
}

export async function deleteRDUnitFromSupabase(id: string) {
  try {
    await supabase.from('rd_units').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase delete error (R&D Units):', err);
  }
}

export async function fetchRDUnitsFromSupabase(): Promise<Unit[] | null> {
  try {
    const { data, error } = await supabase
      .from('rd_units')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    const filtered = data.filter((item: any) => !isMockId(item.id));
    if (filtered.length === 0) return null;

    return filtered.map((item: any) => ({
      id: item.id,
      modelName: item.model_name || item.modelName || '',
      serialNumber: item.serial_number || item.serialNumber || '',
      requiredBy: item.required_by || item.requiredBy || '',
      dayDuration: Number(item.day_duration ?? item.dayDuration ?? 7),
      transferDate: item.transfer_date || item.transferDate || '',
      bsrPerson: item.bsr_person || item.bsrPerson || '',
      eltPerson: item.elt_person || item.eltPerson || '',
      rdPerson: item.rd_person || item.rdPerson || '',
      oqcPerson: item.oqc_person || item.oqcPerson || '',
      currentHolder: item.current_holder || item.currentHolder || '',
      currentStageIndex: Number(item.current_stage_index ?? item.currentStageIndex ?? 0),
      status: item.status || 'transferred',
      timeline: item.timeline || [],
      priority: item.priority || 'Normal',
      notes: item.notes || '',
      observations: item.observations || [],
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Supabase fetch error (R&D Units):', err);
    return null;
  }
}

/* ==========================================
   5. PP UNITS SUPABASE SYNC
   ========================================== */

export async function syncPpUnitToSupabase(unit: PpUnit) {
  try {
    const payload = {
      id: unit.id,
      model_name: unit.modelName || '',
      station: unit.station || '',
      idu_serial_number: unit.iduSerialNumber || '',
      odu_serial_number: unit.oduSerialNumber || '',
      request_by: unit.requestBy || '',
      test_purpose: unit.testPurpose || '',
      required_hour: Number(unit.requiredHour || 0),
      report_details: unit.reportDetails || {},
      name_plate: unit.namePlate || {},
      parts_info: unit.partsInfo || {},
      photos: unit.photos || {},
      remarks: unit.remarks || '',
      observations: unit.observations || [],
      status: unit.status || 'live',
      created_at: safeIsoString(unit.createdAt),
      updated_at: safeIsoString(unit.updatedAt)
    };

    const { error } = await supabase.from('pp_units').upsert(payload);
    if (error) {
      console.warn('Supabase PP Units note:', error.message);
    } else {
      console.log('Successfully synced PP Unit to Supabase:', unit.id);
    }
  } catch (err) {
    console.warn('Supabase connection note (PP Units):', err);
  }
}

export async function deletePpUnitFromSupabase(id: string) {
  try {
    await supabase.from('pp_units').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase delete error (PP Units):', err);
  }
}

export async function fetchPpUnitsFromSupabase(): Promise<PpUnit[] | null> {
  try {
    const { data, error } = await supabase
      .from('pp_units')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    const filtered = data.filter((item: any) => !isMockId(item.id));
    if (filtered.length === 0) return null;

    return filtered.map((item: any) => ({
      id: item.id,
      modelName: item.model_name || item.modelName || '',
      station: item.station || 'Station 01',
      iduSerialNumber: item.idu_serial_number || item.iduSerialNumber || '',
      oduSerialNumber: item.odu_serial_number || item.oduSerialNumber || '',
      requestBy: item.request_by || item.requestBy || '',
      testPurpose: item.test_purpose || item.testPurpose || '',
      requiredHour: Number(item.required_hour ?? item.requiredHour ?? 0),
      reportDetails: item.report_details || item.reportDetails || {},
      namePlate: item.name_plate || item.namePlate || {},
      partsInfo: item.parts_info || item.partsInfo || {},
      photos: item.photos || {},
      remarks: item.remarks || '',
      observations: item.observations || [],
      status: item.status || 'live',
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Supabase fetch error (PP Units):', err);
    return null;
  }
}

/* ==========================================
   6. REPORT ROOM SAVED REPORTS SUPABASE SYNC
   ========================================== */

export async function syncReportRoomToSupabase(report: any) {
  try {
    const payload = {
      id: report.id,
      report_type: report.reportType || 'cs-simulation',
      tag: report.tag || 'C Simulation',
      title: report.title || '',
      report_no: report.reportNo || '',
      model_name: report.modelName || '',
      unit_source: report.unitSource || 'proto',
      serial_no: report.serialNo || '',
      station: report.station || '',
      request_by: report.requestBy || '',
      specs: report.specs || {},
      dataValuesMap: report.dataValuesMap || {},
      photos: report.photos || {},
      template_name: report.templateName || '',
      status: report.status || 'Generated',
      remarks: report.remarks || '',
      created_at: safeIsoString(report.createdAt),
      generated_date: report.generatedDate || ''
    };

    const { error } = await supabase.from('report_room_reports').upsert(payload);
    if (error) {
      console.warn('Supabase Report Room note:', error.message);
    } else {
      console.log('Successfully synced Report to Supabase:', report.id);
    }
  } catch (err) {
    console.warn('Supabase connection note (Report Room):', err);
  }
}

export async function deleteReportRoomFromSupabase(id: string) {
  try {
    await supabase.from('report_room_reports').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase delete error (Report Room):', err);
  }
}

export async function fetchReportRoomFromSupabase(): Promise<any[] | null> {
  try {
    const { data, error } = await supabase
      .from('report_room_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    const filtered = data.filter((item: any) => !isMockId(item.id));
    if (filtered.length === 0) return null;

    return filtered.map((item: any) => ({
      id: item.id,
      reportType: item.report_type || 'cs-simulation',
      tag: item.tag || 'C Simulation',
      title: item.title || '',
      reportNo: item.report_no || '',
      modelName: item.model_name || '',
      unitSource: item.unit_source || 'proto',
      serialNo: item.serial_no || '',
      station: item.station || '',
      requestBy: item.request_by || '',
      specs: item.specs || {},
      dataValuesMap: item.data_values_map || {},
      photos: item.photos || {},
      templateName: item.template_name || '',
      status: item.status || 'Generated',
      remarks: item.remarks || '',
      createdAt: item.created_at || new Date().toISOString(),
      generatedDate: item.generated_date || ''
    }));
  } catch (err) {
    console.warn('Supabase fetch error (Report Room):', err);
    return null;
  }
}

/* ==========================================
   7. SUPABASE CONNECTION DIAGNOSTICS & TEST
   ========================================== */

export interface TableTestResult {
  table: string;
  exists: boolean;
  count: number;
  error?: string;
}

export async function testAllSupabaseTables(): Promise<{
  connected: boolean;
  results: Record<string, TableTestResult>;
}> {
  const tables = [
    'proto_units',
    'pp_units',
    'field_units',
    'rd_units',
    'smog_leak_units',
    'report_room_reports'
  ];

  const results: Record<string, TableTestResult> = {};
  let overallSuccess = true;

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        overallSuccess = false;
        results[table] = {
          table,
          exists: false,
          count: 0,
          error: error.message
        };
      } else {
        results[table] = {
          table,
          exists: true,
          count: count ?? 0
        };
      }
    } catch (e: any) {
      overallSuccess = false;
      results[table] = {
        table,
        exists: false,
        count: 0,
        error: e?.message || 'Connection failed'
      };
    }
  }

  return {
    connected: overallSuccess,
    results
  };
}

/* ==========================================
   8. COMPLETE SQL SCHEMA FOR SUPABASE EDITOR
   ========================================== */

export const SUPABASE_SQL_SCHEMA = `-- ==========================================================
-- LLT LABS - COMPLETE NEW SUPABASE DATABASE PREPARATION SQL
-- Compatible with Security Option A and Realtime Multi-Device Sync
-- ==========================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------
-- 2. TABLE: proto_units (Proto Units / Engineering Samples)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proto_units (
    id TEXT PRIMARY KEY,
    model_name TEXT,
    station TEXT,
    idu_serial_number TEXT,
    odu_serial_number TEXT,
    request_by TEXT,
    test_purpose TEXT,
    required_hour NUMERIC DEFAULT 0,
    done_hour NUMERIC DEFAULT 0,
    report_details JSONB DEFAULT '{}'::jsonb,
    name_plate JSONB DEFAULT '{}'::jsonb,
    parts_info JSONB DEFAULT '{}'::jsonb,
    photos JSONB DEFAULT '{}'::jsonb,
    remarks TEXT,
    observations JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'live',
    start_date_time TEXT,
    end_date_time TEXT,
    completed_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 3. TABLE: pp_units (Pre-Production / PP Units)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pp_units (
    id TEXT PRIMARY KEY,
    model_name TEXT,
    station TEXT,
    idu_serial_number TEXT,
    odu_serial_number TEXT,
    request_by TEXT,
    test_purpose TEXT,
    required_hour NUMERIC DEFAULT 0,
    done_hour NUMERIC DEFAULT 0,
    report_details JSONB DEFAULT '{}'::jsonb,
    name_plate JSONB DEFAULT '{}'::jsonb,
    parts_info JSONB DEFAULT '{}'::jsonb,
    photos JSONB DEFAULT '{}'::jsonb,
    remarks TEXT,
    observations JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'live',
    start_date_time TEXT,
    end_date_time TEXT,
    completed_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 4. TABLE: field_units (Field Simulation & Reliability Units)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_units (
    id TEXT PRIMARY KEY,
    model_name TEXT,
    product_type TEXT DEFAULT 'BOTH',
    idu_serial_number TEXT,
    odu_serial_number TEXT,
    serial_number TEXT,
    request_by TEXT,
    station TEXT,
    start_date_time TEXT,
    end_date_time TEXT,
    required_hour NUMERIC DEFAULT 0,
    done_hour NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'live',
    remarks TEXT,
    observations JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 5. TABLE: rd_units (Unit Testing / R&D Transfer Units)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rd_units (
    id TEXT PRIMARY KEY,
    model_name TEXT,
    serial_number TEXT,
    required_by TEXT,
    day_duration NUMERIC DEFAULT 7,
    transfer_date TEXT,
    bsr_person TEXT,
    elt_person TEXT,
    rd_person TEXT,
    oqc_person TEXT,
    current_holder TEXT,
    current_stage_index NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'transferred',
    timeline JSONB DEFAULT '[]'::jsonb,
    priority TEXT DEFAULT 'Normal',
    notes TEXT,
    observations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 6. TABLE: smog_leak_units (Smog / Helium Leak Test Records)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.smog_leak_units (
    id TEXT PRIMARY KEY,
    smog_person TEXT,
    shift TEXT,
    model_name TEXT,
    serial_numbers JSONB DEFAULT '[]'::jsonb,
    passed_serials JSONB DEFAULT '[]'::jsonb,
    suspect_count NUMERIC DEFAULT 0,
    actual_count NUMERIC DEFAULT 0,
    date TEXT,
    month TEXT,
    time TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 7. TABLE: smog_qty_records (Smog Daily Production Qty & Models)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.smog_qty_records (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    shift TEXT NOT NULL,
    smog_qty NUMERIC DEFAULT 0,
    pr_qty NUMERIC DEFAULT 0,
    pending_qty NUMERIC DEFAULT 0,
    models JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 8. TABLE: model_master (Model Master / Material Code Library)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_master (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    material_code TEXT NOT NULL,
    product_category TEXT DEFAULT 'Split AC',
    capacity TEXT,
    star_rating TEXT,
    refrigerant TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 9. TABLE: elt_records (In-Out ELT Records)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elt_records (
    id TEXT PRIMARY KEY,
    serial_number TEXT NOT NULL,
    model_name TEXT,
    in_date TEXT,
    in_time TEXT,
    out_date TEXT,
    out_time TEXT,
    status TEXT DEFAULT 'IN',
    operator_name TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 10. TABLE: bsr_records (In-Out BSR Records)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bsr_records (
    id TEXT PRIMARY KEY,
    serial_number TEXT NOT NULL,
    model_name TEXT,
    in_date TEXT,
    in_time TEXT,
    out_date TEXT,
    out_time TEXT,
    status TEXT DEFAULT 'IN',
    operator_name TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 11. TABLE: report_room_reports (Archived Lab Reports)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_room_reports (
    id TEXT PRIMARY KEY,
    report_type TEXT,
    tag TEXT,
    title TEXT,
    report_no TEXT,
    model_name TEXT,
    unit_source TEXT,
    serial_no TEXT,
    station TEXT,
    request_by TEXT,
    specs JSONB DEFAULT '{}'::jsonb,
    data_values_map JSONB DEFAULT '{}'::jsonb,
    photos JSONB DEFAULT '{}'::jsonb,
    template_name TEXT,
    status TEXT DEFAULT 'Generated',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    generated_date TEXT
);

-- ----------------------------------------------------------
-- 12. TABLE: report_templates (Master DOCX Report Templates)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_templates (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL,
    file_name TEXT,
    file_size NUMERIC DEFAULT 0,
    uploaded_at TEXT,
    base64_data TEXT,
    chunks JSONB DEFAULT '[]'::jsonb,
    is_chunked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 13. TABLE: activity_logs (Audit Trail & Activity History)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    activity_type TEXT,
    shift_name TEXT,
    operator_name TEXT,
    unit_id TEXT,
    timestamp TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 14. TABLE: system_settings (Global Lab Shifts & Config)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT PRIMARY KEY,
    setting_key TEXT,
    setting_value TEXT,
    shift_name TEXT,
    operator_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 15. ROW LEVEL SECURITY (RLS) - SECURITY OPTION A
-- Read-Only for Browser/Anon; Write operations via Server Service-Role
-- ----------------------------------------------------------
ALTER TABLE public.proto_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pp_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rd_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smog_leak_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smog_qty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bsr_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_room_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "Allow anon select proto_units" ON public.proto_units;
DROP POLICY IF EXISTS "Allow anon select pp_units" ON public.pp_units;
DROP POLICY IF EXISTS "Allow anon select field_units" ON public.field_units;
DROP POLICY IF EXISTS "Allow anon select rd_units" ON public.rd_units;
DROP POLICY IF EXISTS "Allow anon select smog_leak_units" ON public.smog_leak_units;
DROP POLICY IF EXISTS "Allow anon select smog_qty_records" ON public.smog_qty_records;
DROP POLICY IF EXISTS "Allow anon select model_master" ON public.model_master;
DROP POLICY IF EXISTS "Allow anon select elt_records" ON public.elt_records;
DROP POLICY IF EXISTS "Allow anon select bsr_records" ON public.bsr_records;
DROP POLICY IF EXISTS "Allow anon select report_room_reports" ON public.report_room_reports;
DROP POLICY IF EXISTS "Allow anon select report_templates" ON public.report_templates;
DROP POLICY IF EXISTS "Allow anon select activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow anon select system_settings" ON public.system_settings;

-- Create Safe Read-Only SELECT policies (Required for Realtime postgres_changes events!)
CREATE POLICY "Allow anon select proto_units" ON public.proto_units FOR SELECT USING (true);
CREATE POLICY "Allow anon select pp_units" ON public.pp_units FOR SELECT USING (true);
CREATE POLICY "Allow anon select field_units" ON public.field_units FOR SELECT USING (true);
CREATE POLICY "Allow anon select rd_units" ON public.rd_units FOR SELECT USING (true);
CREATE POLICY "Allow anon select smog_leak_units" ON public.smog_leak_units FOR SELECT USING (true);
CREATE POLICY "Allow anon select smog_qty_records" ON public.smog_qty_records FOR SELECT USING (true);
CREATE POLICY "Allow anon select model_master" ON public.model_master FOR SELECT USING (true);
CREATE POLICY "Allow anon select elt_records" ON public.elt_records FOR SELECT USING (true);
CREATE POLICY "Allow anon select bsr_records" ON public.bsr_records FOR SELECT USING (true);
CREATE POLICY "Allow anon select report_room_reports" ON public.report_room_reports FOR SELECT USING (true);
CREATE POLICY "Allow anon select report_templates" ON public.report_templates FOR SELECT USING (true);
CREATE POLICY "Allow anon select activity_logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Allow anon select system_settings" ON public.system_settings FOR SELECT USING (true);

-- ----------------------------------------------------------
-- 16. ADD ALL 13 TABLES TO SUPABASE REALTIME PUBLICATION
-- ----------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.proto_units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pp_units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.field_units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rd_units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.smog_leak_units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.smog_qty_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.model_master;
ALTER PUBLICATION supabase_realtime ADD TABLE public.elt_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bsr_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_room_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;

-- ----------------------------------------------------------
-- 17. CREATE PERFORMANCE INDEXES
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_proto_created ON public.proto_units (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pp_created ON public.pp_units (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_created ON public.field_units (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rd_created ON public.rd_units (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smog_created ON public.smog_leak_units (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smog_qty_date ON public.smog_qty_records (date, shift);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.report_room_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_code ON public.model_master (material_code);
CREATE INDEX IF NOT EXISTS idx_elt_serial ON public.elt_records (serial_number);
CREATE INDEX IF NOT EXISTS idx_bsr_serial ON public.bsr_records (serial_number);
`;


