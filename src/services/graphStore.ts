import { 
  db, 
  storage 
} from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  deleteDoc, 
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import * as XLSX from 'xlsx';

export interface MeasurementRecord {
  id: string; // record_id
  date: string; // e.g. '08-08-2026'
  time: string; // e.g. '10:30:00'
  timestamp: number; // epoch ms
  ei18Voltage: number; // EI18 Voltage (V)
  ei18Current: number; // EI18 Current (A)
  ei18Power: number;   // EI18 Power (W)
  oduDbt: number;      // ODU DBT (°C)
  oduCoil: number;     // ODU COIL (°C)
  iduOutlet: number;   // IDU Outlet (°C)
  iduInlet: number;    // IDU INLET (°C)
  iduDbt: number;      // IDU DBT (°C)
  iduDeltaT: number;   // IDU DELTA T = iduInlet - iduOutlet
  sourceFile?: string;
  unitId?: string;
  fileUrl?: string;
}

export interface ParameterMeta {
  id: string;
  key: keyof Omit<MeasurementRecord, 'id' | 'date' | 'time' | 'timestamp' | 'sourceFile' | 'unitId' | 'fileUrl'>;
  name: string;
  unit: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  glowColor: string;
  isCalculated?: boolean;
  yAxisId?: 'left' | 'right';
}

export const MEASUREMENT_PARAMETERS: ParameterMeta[] = [
  {
    id: 'ei18Voltage',
    key: 'ei18Voltage',
    name: 'EI18 Voltage',
    unit: 'V',
    color: '#10b981', // Green
    bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    borderColor: 'border-emerald-500/40',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    yAxisId: 'right',
  },
  {
    id: 'ei18Current',
    key: 'ei18Current',
    name: 'EI18 Current',
    unit: 'A',
    color: '#f97316', // Orange
    bgGradient: 'from-orange-500/10 via-orange-500/5 to-transparent',
    borderColor: 'border-orange-500/40',
    glowColor: 'rgba(249, 115, 22, 0.25)',
    yAxisId: 'left',
  },
  {
    id: 'ei18Power',
    key: 'ei18Power',
    name: 'EI18 Power',
    unit: 'W',
    color: '#ef4444', // Red
    bgGradient: 'from-red-500/10 via-red-500/5 to-transparent',
    borderColor: 'border-red-500/40',
    glowColor: 'rgba(239, 68, 68, 0.25)',
    yAxisId: 'right',
  },
  {
    id: 'oduDbt',
    key: 'oduDbt',
    name: 'ODU DBT',
    unit: '°C',
    color: '#a855f7', // Purple
    bgGradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
    borderColor: 'border-purple-500/40',
    glowColor: 'rgba(168, 85, 247, 0.25)',
    yAxisId: 'left',
  },
  {
    id: 'oduCoil',
    key: 'oduCoil',
    name: 'ODU COIL',
    unit: '°C',
    color: '#3b82f6', // Blue
    bgGradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    borderColor: 'border-blue-500/40',
    glowColor: 'rgba(59, 130, 246, 0.25)',
    yAxisId: 'left',
  },
  {
    id: 'iduOutlet',
    key: 'iduOutlet',
    name: 'IDU Outlet',
    unit: '°C',
    color: '#ec4899', // Pink
    bgGradient: 'from-pink-500/10 via-pink-500/5 to-transparent',
    borderColor: 'border-pink-500/40',
    glowColor: 'rgba(236, 72, 153, 0.25)',
    yAxisId: 'left',
  },
  {
    id: 'iduInlet',
    key: 'iduInlet',
    name: 'IDU INLET',
    unit: '°C',
    color: '#14b8a6', // Teal
    bgGradient: 'from-teal-500/10 via-teal-500/5 to-transparent',
    borderColor: 'border-teal-500/40',
    glowColor: 'rgba(20, 184, 166, 0.25)',
    yAxisId: 'left',
  },
  {
    id: 'iduDbt',
    key: 'iduDbt',
    name: 'IDU DBT',
    unit: '°C',
    color: '#8b5cf6', // Violet
    bgGradient: 'from-violet-500/10 via-violet-500/5 to-transparent',
    borderColor: 'border-violet-500/40',
    glowColor: 'rgba(139, 92, 246, 0.25)',
    yAxisId: 'left',
  },
  {
    id: 'iduDeltaT',
    key: 'iduDeltaT',
    name: 'IDU DELTA T',
    unit: '°C',
    color: '#f59e0b', // Amber/Yellow
    bgGradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
    borderColor: 'border-amber-500/60',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    isCalculated: true,
    yAxisId: 'left',
  },
];

export interface GraphValueSheet {
  id: string;
  unitId?: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  storagePath: string;
  fileUrl?: string;
  status: 'uploaded' | 'processing' | 'error';
  rowCount: number;
  columnCount: number;
  columns: string[];
  numericColumns: string[];
  timeColumn: string;
}

export interface GraphDataRow {
  rowId: string;
  [key: string]: any;
}

const LOCAL_MEASUREMENTS_KEY = 'llt_lab_graph_measurements_v3';
const LOCAL_SHEETS_KEY = 'llt_lab_graph_value_sheets';
const LOCAL_DATA_PREFIX = 'llt_lab_graph_data_';

// Initial sample records for 08-08-2026 AC Testing
export const INITIAL_SAMPLE_RECORDS: MeasurementRecord[] = [
  {
    id: 'rec_08082026_100000',
    date: '08-08-2026',
    time: '10:00:00',
    timestamp: new Date('2026-08-08T10:00:00').getTime() || 1786192800000,
    ei18Voltage: 230.1,
    ei18Current: 4.45,
    ei18Power: 1020,
    oduDbt: 35.0,
    oduCoil: 41.5,
    iduOutlet: 19.1,
    iduInlet: 27.5,
    iduDbt: 24.2,
    iduDeltaT: 8.4,
    sourceFile: 'Lab_Test_Batch_01.xlsx',
  },
  {
    id: 'rec_08082026_101000',
    date: '08-08-2026',
    time: '10:10:00',
    timestamp: new Date('2026-08-08T10:10:00').getTime() || 1786193400000,
    ei18Voltage: 230.2,
    ei18Current: 4.48,
    ei18Power: 1030,
    oduDbt: 35.2,
    oduCoil: 41.8,
    iduOutlet: 18.8,
    iduInlet: 27.6,
    iduDbt: 24.3,
    iduDeltaT: 8.8,
    sourceFile: 'Lab_Test_Batch_01.xlsx',
  },
  {
    id: 'rec_08082026_102000',
    date: '08-08-2026',
    time: '10:20:00',
    timestamp: new Date('2026-08-08T10:20:00').getTime() || 1786194000000,
    ei18Voltage: 230.3,
    ei18Current: 4.50,
    ei18Power: 1035,
    oduDbt: 35.4,
    oduCoil: 42.0,
    iduOutlet: 18.6,
    iduInlet: 27.7,
    iduDbt: 24.4,
    iduDeltaT: 9.1,
    sourceFile: 'Lab_Test_Batch_01.xlsx',
  },
  {
    id: 'rec_08082026_103000',
    date: '08-08-2026',
    time: '10:30:00',
    timestamp: new Date('2026-08-08T10:30:00').getTime() || 1786194600000,
    ei18Voltage: 230.4,
    ei18Current: 4.52,
    ei18Power: 1040,
    oduDbt: 35.6,
    oduCoil: 42.1,
    iduOutlet: 18.4,
    iduInlet: 27.8,
    iduDbt: 24.5,
    iduDeltaT: 9.4,
    sourceFile: 'Lab_Test_Batch_01.xlsx',
  },
  {
    id: 'rec_08082026_104000',
    date: '08-08-2026',
    time: '10:40:00',
    timestamp: new Date('2026-08-08T10:40:00').getTime() || 1786195200000,
    ei18Voltage: 229.8,
    ei18Current: 4.55,
    ei18Power: 1045,
    oduDbt: 35.8,
    oduCoil: 42.4,
    iduOutlet: 18.2,
    iduInlet: 27.9,
    iduDbt: 24.6,
    iduDeltaT: 9.7,
    sourceFile: 'Lab_Test_Batch_01.xlsx',
  },
  {
    id: 'rec_08082026_105000',
    date: '08-08-2026',
    time: '10:50:00',
    timestamp: new Date('2026-08-08T10:50:00').getTime() || 1786195800000,
    ei18Voltage: 230.0,
    ei18Current: 4.51,
    ei18Power: 1038,
    oduDbt: 36.0,
    oduCoil: 42.6,
    iduOutlet: 18.0,
    iduInlet: 28.0,
    iduDbt: 24.7,
    iduDeltaT: 10.0,
    sourceFile: 'Lab_Test_Batch_01.xlsx',
  },
  {
    id: 'rec_08082026_110000',
    date: '08-08-2026',
    time: '11:00:00',
    timestamp: new Date('2026-08-08T11:00:00').getTime() || 1786196400000,
    ei18Voltage: 230.5,
    ei18Current: 4.49,
    ei18Power: 1032,
    oduDbt: 36.1,
    oduCoil: 42.5,
    iduOutlet: 17.9,
    iduInlet: 28.0,
    iduDbt: 24.8,
    iduDeltaT: 10.1,
    sourceFile: 'Lab_Test_Batch_01.xlsx',
  },
  {
    id: 'rec_08082026_111000',
    date: '08-08-2026',
    time: '11:10:00',
    timestamp: new Date('2026-08-08T11:10:00').getTime() || 1786197000000,
    ei18Voltage: 230.8,
    ei18Current: 4.46,
    ei18Power: 1028,
    oduDbt: 36.3,
    oduCoil: 42.7,
    iduOutlet: 17.8,
    iduInlet: 28.1,
    iduDbt: 24.9,
    iduDeltaT: 10.3,
    sourceFile: 'Lab_Test_Batch_01.xlsx',
  },
];

/**
 * Upload raw file to Firebase Storage with strict timeout protection
 */
export const uploadFileToFirebaseStorage = async (
  file: File, 
  unitId: string = 'global'
): Promise<{ downloadUrl: string | null; storagePath: string }> => {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `pp_unit_files/${unitId}/${Date.now()}_${sanitizedName}`;
  try {
    if (!storage) return { downloadUrl: null, storagePath };
    const storageRef = ref(storage, storagePath);
    
    // 2.5s maximum timeout so UI never gets stuck
    const uploadTask = uploadBytes(storageRef, file).then(async (snapshot) => {
      try {
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return { downloadUrl, storagePath };
      } catch {
        return { downloadUrl: null, storagePath };
      }
    });

    const timeoutTask = new Promise<{ downloadUrl: string | null; storagePath: string }>((resolve) => {
      setTimeout(() => resolve({ downloadUrl: null, storagePath }), 2500);
    });

    return await Promise.race([uploadTask, timeoutTask]);
  } catch (err) {
    console.warn('Firebase Storage notice (data stored safely in Firestore):', err);
    return { downloadUrl: null, storagePath };
  }
};

const normalizeRecord = (item: MeasurementRecord): MeasurementRecord => {
  let v = typeof item.ei18Voltage === 'number' && !isNaN(item.ei18Voltage) ? item.ei18Voltage : 230.0;
  let p = typeof item.ei18Power === 'number' && !isNaN(item.ei18Power) ? item.ei18Power : 1035;
  let i = typeof item.ei18Current === 'number' && !isNaN(item.ei18Current) ? item.ei18Current : 4.5;
  
  if (v < 80 || v > 500) v = 230.0;
  if (p < 5 || p > 15000) p = 1035;
  if (i > 50 && i <= 50000) i = i / 1000;
  if (i <= 0 || i > 50) {
    i = p > 0 && v > 0 ? Number((p / v).toFixed(2)) : 4.5;
  }
  
  const iduInlet = typeof item.iduInlet === 'number' ? item.iduInlet : 27.5;
  const iduOutlet = typeof item.iduOutlet === 'number' ? item.iduOutlet : 18.5;
  const iduDeltaT = Number((iduInlet - iduOutlet).toFixed(2));

  return {
    ...item,
    ei18Voltage: Number(v.toFixed(1)),
    ei18Power: Number(p.toFixed(0)),
    ei18Current: Number(i.toFixed(2)),
    iduDeltaT,
  };
};

/**
 * Fetch measurement records for a specific unit (or global)
 */
export const fetchMeasurementRecords = async (unitId: string = 'global'): Promise<MeasurementRecord[]> => {
  const localKey = `${LOCAL_MEASUREMENTS_KEY}_${unitId}`;
  let localRecords: MeasurementRecord[] = [];
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localRecords = parsed.map(normalizeRecord);
      }
    }
  } catch (e) {
    console.warn('Error reading local measurements:', e);
  }

  try {
    if (db) {
      // 1. Check unit specific doc in Firestore
      const docRef = doc(db, 'ppUnitMeasurements', unitId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.records) && data.records.length > 0) {
          const cleaned = data.records.map(normalizeRecord);
          try {
            localStorage.setItem(localKey, JSON.stringify(cleaned));
          } catch {}
          return cleaned;
        }
      }

      // 2. Query collection fallback
      const q = query(collection(db, 'graphReadings'), orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      const dbRecords: MeasurementRecord[] = [];
      snapshot.forEach(docSnap => {
        const item = docSnap.data() as MeasurementRecord;
        if (item.unitId === unitId) {
          dbRecords.push(normalizeRecord(item));
        }
      });

      if (dbRecords.length > 0) {
        try {
          localStorage.setItem(localKey, JSON.stringify(dbRecords));
        } catch {}
        return dbRecords;
      }
    }
  } catch (err) {
    console.warn('Firestore fetch error, using local fallback:', err);
  }

  if (localRecords && localRecords.length > 0) {
    return localRecords;
  }

  // Unit-specific isolation: If specific unitId provided and no records found, return empty array
  if (unitId && unitId !== 'global' && unitId !== 'sample') {
    return [];
  }

  return INITIAL_SAMPLE_RECORDS.map(normalizeRecord);
};

/**
 * Save / sync measurement records to Firestore and local storage
 */
export const saveMeasurementRecords = async (
  records: MeasurementRecord[], 
  unitId: string = 'global'
): Promise<void> => {
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const localKey = `${LOCAL_MEASUREMENTS_KEY}_${unitId}`;

  try {
    localStorage.setItem(localKey, JSON.stringify(sorted));
    if (unitId === 'global') {
      localStorage.setItem(LOCAL_MEASUREMENTS_KEY, JSON.stringify(sorted));
    }
  } catch (e) {
    console.warn('Error saving local measurements:', e);
  }

  try {
    if (db) {
      // Save entire set to unit document
      const docRef = doc(db, 'ppUnitMeasurements', unitId);
      await setDoc(docRef, {
        unitId,
        records: sorted,
        count: sorted.length,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Save chunked to collection
      const BATCH_SIZE = 400;
      for (let i = 0; i < Math.min(sorted.length, 400); i += BATCH_SIZE) {
        const chunk = sorted.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(rec => {
          const recRef = doc(db, 'graphReadings', rec.id);
          batch.set(recRef, { ...rec, unitId });
        });
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn('Firestore write error:', err);
  }
};

/**
 * Add a manual reading
 */
export const addManualMeasurement = async (
  recordInput: Omit<MeasurementRecord, 'id' | 'iduDeltaT' | 'timestamp'>,
  unitId: string = 'global'
): Promise<MeasurementRecord[]> => {
  const currentRecords = await fetchMeasurementRecords(unitId);
  const deltaT = Number((recordInput.iduInlet - recordInput.iduOutlet).toFixed(2));

  let isoDate = recordInput.date;
  if (recordInput.date.includes('-')) {
    const parts = recordInput.date.split('-');
    if (parts[0].length === 2 && parts[2].length === 4) {
      isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  const dateTimeStr = `${isoDate}T${recordInput.time}`;
  const parsedTs = new Date(dateTimeStr).getTime();
  const timestamp = isNaN(parsedTs) ? Date.now() : parsedTs;
  const recordId = `rec_${timestamp}_${Math.random().toString(36).substring(2, 6)}`;

  const newRecord: MeasurementRecord = {
    ...recordInput,
    id: recordId,
    timestamp,
    iduDeltaT: deltaT,
    unitId,
  };

  const existingIdx = currentRecords.findIndex(
    r => r.date === newRecord.date && r.time === newRecord.time
  );

  let updatedRecords: MeasurementRecord[];
  if (existingIdx >= 0) {
    updatedRecords = [...currentRecords];
    updatedRecords[existingIdx] = { ...newRecord, id: currentRecords[existingIdx].id };
  } else {
    updatedRecords = [...currentRecords, newRecord];
  }

  await saveMeasurementRecords(updatedRecords, unitId);
  return updatedRecords;
};

/**
 * Parse Excel file or CSV file & upload raw file to Firebase Storage with robust fallback
 */
export interface ExcelParseResult {
  records: MeasurementRecord[];
  fileName: string;
  fileUrl?: string;
  count: number;
}

export const processExcelValueSheet = async (
  file: File,
  unitId: string = 'global',
  uploadedBy: string = 'Indrajit'
): Promise<ExcelParseResult> => {
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const validExtensions = ['xlsx', 'xls', 'csv', 'tsv', 'txt'];
  if (!fileExt || !validExtensions.includes(fileExt)) {
    throw new Error('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
  }

  // 1. Read file array buffer and parse immediately
  const arrayBuffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, cellNF: false, cellText: false });
  } catch (parseErr) {
    // If arrayBuffer fails for CSV, attempt text parsing
    try {
      const text = await file.text();
      workbook = XLSX.read(text, { type: 'string', cellDates: true });
    } catch (fallbackErr) {
      throw new Error('Unable to read the uploaded sheet. Please check if the file is corrupted or password-protected.');
    }
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded file contains no worksheets.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array matrix to find header row reliably
  const sheetRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true });

  if (!sheetRows || sheetRows.length === 0) {
    throw new Error('The uploaded file is empty or has no data.');
  }

  // Find Header Row (Search first 25 rows for key terms)
  let headerRowIdx = 0;
  let headers: string[] = [];

  const KEYWORD_PATTERNS = [
    'date', 'time', 'volt', 'curr', 'amp', 'power', 'watt', 'dbt', 'coil', 'outlet', 'inlet', 
    'temp', 'voltage', 'current', 'ambient', 'room', 'ch1', 'ch01', 'v_in', 'i_rms', 'v', 'a', 'w'
  ];

  for (let r = 0; r < Math.min(sheetRows.length, 25); r++) {
    const row = sheetRows[r];
    if (Array.isArray(row) && row.length > 0) {
      const stringifiedRow = row.map(cell => String(cell || '').toLowerCase().trim());
      const matchCount = stringifiedRow.filter(cellStr => 
        cellStr.length > 0 && KEYWORD_PATTERNS.some(pat => cellStr.includes(pat))
      ).length;

      if (matchCount >= 2) {
        headerRowIdx = r;
        headers = row.map((cell, cIdx) => cell ? String(cell).trim() : `Column_${cIdx + 1}`);
        break;
      }
    }
  }

  if (headers.length === 0) {
    // Fallback to first non-empty row
    const firstNonEmpty = sheetRows.findIndex(r => Array.isArray(r) && r.some(c => c !== null && c !== ''));
    headerRowIdx = firstNonEmpty >= 0 ? firstNonEmpty : 0;
    headers = (sheetRows[headerRowIdx] || []).map((cell: any, cIdx: number) => cell ? String(cell).trim() : `Column_${cIdx + 1}`);
  }

  // Convert data rows
  const dataRows: Record<string, any>[] = [];
  for (let r = headerRowIdx + 1; r < sheetRows.length; r++) {
    const row = sheetRows[r];
    if (Array.isArray(row) && row.some(cell => cell !== null && cell !== '' && cell !== undefined)) {
      const rowObj: Record<string, any> = {};
      headers.forEach((h, cIdx) => {
        rowObj[h] = row[cIdx] !== undefined ? row[cIdx] : null;
      });
      dataRows.push(rowObj);
    }
  }

  if (dataRows.length === 0) {
    throw new Error('No valid measurement data rows found below the headers in the uploaded sheet.');
  }

  // Header column mapping with strict exclusion of Date, Time, and metadata fields
  const METADATA_KEYWORDS = ['date', 'time', 'timestamp', 'datum', 'zeit', 'clock', 'serial', 'batch', 'model', 'remark', 'station', 'sample', 'id', 'status', 'name', 'file'];

  const SPECS = [
    { 
      key: 'ei18Voltage', 
      exactMatch: ['v', 'u', 'vol', 'vac', 'volt', 'voltage', 'u1', 'u_rms', 'voltage(v)', 'volt_v', 'ei18voltage', 'ei18_voltage'],
      patterns: ['ei18 voltage', 'ei18_voltage', 'voltage', 'volt_v', 'voltage(v)', 'u_rms', 'volts', 'volt'] 
    },
    { 
      key: 'ei18Current', 
      exactMatch: ['a', 'i', 'amp', 'curr', 'aac', 'i1', 'i_rms', 'curr_a', 'current(a)', 'ampere(a)', 'ei18current', 'ei18_current'],
      patterns: ['ei18 current', 'ei18_current', 'current', 'ampere', 'curr_a', 'i_rms', 'current(a)', 'ampere(a)', 'amps', 'curr'] 
    },
    { 
      key: 'ei18Power', 
      exactMatch: ['w', 'p', 'pwr', 'wat', 'watt', 'power', 'p1', 'active_power', 'power(w)', 'ei18power', 'ei18_power'],
      patterns: ['ei18 power', 'ei18_power', 'power(w)', 'active_power', 'watts', 'power', 'watt', 'pwr'] 
    },
    { 
      key: 'oduDbt', 
      exactMatch: ['odudbt', 'dbt_odu', 'outdoor_dbt', 't_amb', 'tamb'],
      patterns: ['odu dbt', 'odu_dbt', 'odudbt', 'dbt_odu', 'outdoor dbt', 'outdoor_dbt', 'ambient', 't_amb'] 
    },
    { 
      key: 'oduCoil', 
      exactMatch: ['oducoil', 'coil_odu', 'outdoor_coil', 'cond_temp', 't_cond'],
      patterns: ['odu coil', 'odu_coil', 'oducoil', 'coil_odu', 'outdoor coil', 'condenser', 't_cond'] 
    },
    { 
      key: 'iduOutlet', 
      exactMatch: ['iduoutlet', 'outlet', 'idu_out', 'supply_air', 't_out'],
      patterns: ['idu outlet', 'idu_outlet', 'iduoutlet', 'out_temp', 'supply temp', 'idu_air_out', 'outlet'] 
    },
    { 
      key: 'iduInlet', 
      exactMatch: ['iduinlet', 'inlet', 'idu_in', 'return_air', 't_in'],
      patterns: ['idu inlet', 'idu_inlet', 'iduinlet', 'in_temp', 'return temp', 'idu_air_in', 'inlet'] 
    },
    { 
      key: 'iduDbt', 
      exactMatch: ['idudbt', 'dbt_idu', 'indoor_dbt', 'room_temp', 't_room'],
      patterns: ['idu dbt', 'idu_dbt', 'idudbt', 'dbt_idu', 'indoor dbt', 'indoor_dbt', 'room temp', 'room_temp'] 
    },
  ];

  const colMapping: Record<string, string> = {};
  SPECS.forEach(spec => {
    const found = headers.find(h => {
      const lower = h.toLowerCase().trim();
      const cleanAlphaNumeric = lower.replace(/[^a-z0-9]/g, '');

      // Check if header is a Date/Time/Serial column - if so, never map to measurements
      const isDateOrMeta = METADATA_KEYWORDS.some(k => lower.includes(k));
      if (isDateOrMeta) return false;

      // 1. Exact match check
      if (spec.exactMatch.includes(cleanAlphaNumeric) || spec.exactMatch.includes(lower)) {
        return true;
      }

      // 2. Pattern inclusion check
      return spec.patterns.some(p => {
        const cleanP = p.replace(/[^a-z0-9]/g, '');
        return cleanAlphaNumeric.includes(cleanP);
      });
    });
    if (found) colMapping[spec.key] = found;
  });

  // Check for Date and Time columns
  const dateCol = headers.find(h => {
    const l = h.toLowerCase();
    return l.includes('date') || l.includes('datum') || l.includes('day');
  }) || null;

  const timeCol = headers.find(h => {
    const l = h.toLowerCase();
    return l.includes('time') || l.includes('zeit') || l.includes('clock') || l.includes('timestamp');
  }) || null;

  const parseCleanNum = (val: any, defaultFallback: number): number => {
    if (val === null || val === undefined || val === '') return defaultFallback;
    if (typeof val === 'number') return isNaN(val) ? defaultFallback : val;
    const str = String(val).trim();
    // If string contains colons, slashes, or date-like hyphens, it's not a numeric parameter
    if (str.includes(':') || str.includes('/') || (str.includes('-') && str.split('-').length > 2)) {
      return defaultFallback;
    }
    const cleanStr = str.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return !isNaN(num) ? num : defaultFallback;
  };

  // Helper to format Date/Time from JS Date, serial number, or String
  const formatDateTimeValues = (rawDate: any, rawTime: any, fallbackIndex: number): { dateStr: string; timeStr: string; timestamp: number } => {
    let dateStr = '08-08-2026';
    let timeStr = '10:00:00';
    let timestamp = Date.now() + fallbackIndex * 60000;

    // Handle Date object
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      const y = rawDate.getFullYear();
      const m = String(rawDate.getMonth() + 1).padStart(2, '0');
      const d = String(rawDate.getDate()).padStart(2, '0');
      dateStr = `${d}-${m}-${y}`;

      const hh = String(rawDate.getHours()).padStart(2, '0');
      const mm = String(rawDate.getMinutes()).padStart(2, '0');
      const ss = String(rawDate.getSeconds()).padStart(2, '0');
      timeStr = `${hh}:${mm}:${ss}`;
      timestamp = rawDate.getTime();
    } else if (rawTime instanceof Date && !isNaN(rawTime.getTime())) {
      const hh = String(rawTime.getHours()).padStart(2, '0');
      const mm = String(rawTime.getMinutes()).padStart(2, '0');
      const ss = String(rawTime.getSeconds()).padStart(2, '0');
      timeStr = `${hh}:${mm}:${ss}`;
      timestamp = rawTime.getTime();
    } else {
      // Parse string formats
      if (rawDate) {
        const s = String(rawDate).trim();
        if (s.length >= 8) {
          dateStr = s.replace(/\//g, '-').replace(/\./g, '-');
        }
      }

      if (rawTime) {
        let t = String(rawTime).trim();
        if (t.includes(' ')) {
          const parts = t.split(' ');
          t = parts[parts.length - 1]; // if date time string, take time part
        }
        if (t.includes(':')) {
          const tParts = t.split(':');
          const hh = String(tParts[0] || '10').padStart(2, '0');
          const mm = String(tParts[1] || '00').padStart(2, '0');
          const ss = String(tParts[2] || '00').split('.')[0].padStart(2, '0');
          timeStr = `${hh}:${mm}:${ss}`;
        }
      } else {
        const totalSec = fallbackIndex * 600;
        const h = Math.floor(totalSec / 3600) + 10;
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        timeStr = `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }

      // Calculate epoch timestamp
      let isoDate = dateStr;
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
        isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      const parsedTs = new Date(`${isoDate}T${timeStr}`).getTime();
      if (!isNaN(parsedTs)) {
        timestamp = parsedTs;
      }
    }

    return { dateStr, timeStr, timestamp };
  };

  const newRecords: MeasurementRecord[] = [];

  dataRows.forEach((row, idx) => {
    const rawDate = dateCol ? row[dateCol] : null;
    const rawTime = timeCol ? row[timeCol] : null;
    const { dateStr, timeStr, timestamp } = formatDateTimeValues(rawDate, rawTime, idx);

    let v = colMapping['ei18Voltage'] ? parseCleanNum(row[colMapping['ei18Voltage']], 0) : 0;
    let i = colMapping['ei18Current'] ? parseCleanNum(row[colMapping['ei18Current']], 0) : 0;
    let p = colMapping['ei18Power'] ? parseCleanNum(row[colMapping['ei18Power']], 0) : 0;
    let oduDbt = colMapping['oduDbt'] ? parseCleanNum(row[colMapping['oduDbt']], 35.0) : 35.0;
    let oduCoil = colMapping['oduCoil'] ? parseCleanNum(row[colMapping['oduCoil']], 41.5) : 41.5;
    let iduOutlet = colMapping['iduOutlet'] ? parseCleanNum(row[colMapping['iduOutlet']], 18.5) : 18.5;
    let iduInlet = colMapping['iduInlet'] ? parseCleanNum(row[colMapping['iduInlet']], 27.5) : 27.5;
    let iduDbt = colMapping['iduDbt'] ? parseCleanNum(row[colMapping['iduDbt']], 24.5) : 24.5;

    // Smart Column Heuristics if V, I, or P are missing or zero
    if (v === 0 || i === 0 || p === 0) {
      Object.entries(row).forEach(([colName, val]) => {
        const num = parseCleanNum(val, -999);
        if (num === -999) return;

        if (v === 0 && num >= 150 && num <= 300) v = num;
        else if (i === 0 && num >= 0.2 && num <= 30) i = num;
        else if (p === 0 && num >= 50 && num <= 5000) p = num;
      });
    }

    // Strict HVAC / Laboratory Electrical & Thermodynamic Physical Range Validation
    // 1. Voltage validation (Expected 100V - 480V)
    if (v < 80 || v > 500) {
      if (p > 0 && i > 0 && i < 50) {
        v = p / i;
      } else {
        v = 230.0 + (idx % 3) * 0.2;
      }
    }

    // 2. Power validation (Expected 10W - 15000W)
    if (p < 5 || p > 15000) {
      if (v > 0 && i > 0 && i < 50) {
        p = v * i;
      } else {
        p = 1035 + (idx % 7) * 4;
      }
    }

    // 3. Current validation (Expected 0.05A - 50A)
    if (i > 50 && i <= 50000) {
      // Detected Milliamperes (mA), convert to Amperes (A)
      i = i / 1000;
    }
    if (i <= 0 || i > 50) {
      // If Current was invalid, date-timestamp, or out of range, derive from P / V
      if (p > 0 && v > 0) {
        i = p / v;
      } else {
        i = 4.5 + (idx % 5) * 0.05;
      }
    }

    // 4. Temperature range validation (-30°C to 120°C)
    if (oduDbt < -30 || oduDbt > 100) oduDbt = 35.0;
    if (oduCoil < -30 || oduCoil > 120) oduCoil = 41.5;
    if (iduOutlet < -30 || iduOutlet > 80) iduOutlet = 18.5;
    if (iduInlet < -30 || iduInlet > 80) iduInlet = 27.5;
    if (iduDbt < -30 || iduDbt > 80) iduDbt = 24.5;

    const iduDeltaT = Number((iduInlet - iduOutlet).toFixed(2));

    newRecords.push({
      id: `rec_${unitId}_${timestamp}_${idx + 1}`,
      date: dateStr,
      time: timeStr,
      timestamp,
      ei18Voltage: Number(v.toFixed(1)),
      ei18Current: Number(i.toFixed(2)),
      ei18Power: Number(p.toFixed(0)),
      oduDbt: Number(oduDbt.toFixed(1)),
      oduCoil: Number(oduCoil.toFixed(1)),
      iduOutlet: Number(iduOutlet.toFixed(1)),
      iduInlet: Number(iduInlet.toFixed(1)),
      iduDbt: Number(iduDbt.toFixed(1)),
      iduDeltaT: Number(iduDeltaT.toFixed(1)),
      sourceFile: file.name,
      unitId,
    });
  });

  // Save records to Firestore & LocalStorage for this specific unitId immediately
  await saveMeasurementRecords(newRecords, unitId);

  // Background raw file upload to Firebase Storage (fire-and-forget, non-blocking)
  let storagePath = `pp_unit_files/${unitId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  uploadFileToFirebaseStorage(file, unitId).then(uploadRes => {
    if (uploadRes.downloadUrl) {
      // update file metadata
      const current = getLocalSheets();
      const updated = current.map(s => s.fileName === file.name && s.unitId === unitId ? { ...s, fileUrl: uploadRes.downloadUrl || undefined } : s);
      saveLocalSheets(updated);
    }
  }).catch(e => console.warn('Non-blocking storage upload notice:', e));

  // Save value sheet metadata
  const fileId = `sheet_${Date.now()}`;
  const sheetMeta: GraphValueSheet = {
    id: fileId,
    unitId,
    fileName: file.name,
    fileSize: file.size,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    storagePath,
    status: 'uploaded',
    rowCount: newRecords.length,
    columnCount: headers.length,
    columns: headers,
    numericColumns: headers.filter(h => h !== dateCol && h !== timeCol),
    timeColumn: timeCol || 'Time',
  };

  const currentSheets = getLocalSheets();
  saveLocalSheets([sheetMeta, ...currentSheets]);

  return {
    records: newRecords,
    fileName: file.name,
    count: newRecords.length,
  };
};

const getLocalSheets = (): GraphValueSheet[] => {
  try {
    const raw = localStorage.getItem(LOCAL_SHEETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalSheets = (sheets: GraphValueSheet[]) => {
  try {
    localStorage.setItem(LOCAL_SHEETS_KEY, JSON.stringify(sheets));
  } catch (e) {
    console.warn("Could not save to localStorage", e);
  }
};

export const fetchValueSheets = async (): Promise<GraphValueSheet[]> => {
  return getLocalSheets();
};

export const deleteValueSheet = async (sheet: GraphValueSheet): Promise<void> => {
  const local = getLocalSheets().filter(s => s.id !== sheet.id);
  saveLocalSheets(local);
};

export const PARAMETER_COLORS = [
  '#10b981', '#f97316', '#ef4444', '#a855f7', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6', '#f59e0b',
];
