import { getProtoUnits } from './protoUnitStore';
import { getPpUnits } from './ppUnitStore';
import { getFieldUnits } from './fieldUnitStore';
import { getUnits } from './unitStore';

export interface ComponentRecord {
  spec: string;
  partCode: string;
  supplier: string;
  photoUrl?: string;
  sourceModel?: string;
}

export interface PcbRecord {
  partCode: string;
  supplier: string;
  photoUrl?: string;
  sourceModel?: string;
}

// Curated verified seeds matching user's exact laboratory machines and components
const SEED_COMPRESSORS: ComponentRecord[] = [
  {
    spec: 'GMCC-KSN103D42UEZS31',
    partCode: '0010748375',
    supplier: 'GMCC',
    sourceModel: 'HSI19T-S2NB-F'
  },
  {
    spec: 'Twin Rotary Inverter 1.5T',
    partCode: 'CMP-ODU-7721',
    supplier: 'Highly',
    sourceModel: 'HSO53-3NT-I'
  },
  {
    spec: 'Rotary Inverter 1.0T',
    partCode: '0010745591',
    supplier: 'Panasonic',
    sourceModel: 'HSO35-2NT-I'
  },
  {
    spec: 'Inverter Scroll 2.0T',
    partCode: '0010749912',
    supplier: 'Sanyo',
    sourceModel: 'HSO70-4NT-I'
  },
  {
    spec: 'Rotary Inverter 1.5T R32',
    partCode: '0010748820',
    supplier: 'GMCC',
    sourceModel: 'HSU18-3NT-O'
  },
  {
    spec: 'Twin Rotary 18000BTU',
    partCode: '0010747710',
    supplier: 'Rechi',
    sourceModel: 'HSO53-PP-01'
  }
];

const SEED_IDU_MOTORS: ComponentRecord[] = [
  {
    spec: '20W DC Motor',
    partCode: '0011802046NPA',
    supplier: 'lingzhi',
    sourceModel: 'HSI19T-S2NB-F'
  },
  {
    spec: '30W DC Brushless',
    partCode: 'MTR-IDU-2201',
    supplier: 'Nidec',
    sourceModel: 'HSO53-3NT-I'
  },
  {
    spec: '25W DC Motor',
    partCode: '0010401822',
    supplier: 'lingzhi',
    sourceModel: 'HSO35-2NT-I'
  },
  {
    spec: '28W BLDC Motor',
    partCode: '0010401890',
    supplier: 'Welling',
    sourceModel: 'HSO26-1NT-I'
  },
  {
    spec: '35W DC Motor',
    partCode: '0010401920B',
    supplier: 'Wolong',
    sourceModel: 'HSO70-4NT-I'
  },
  {
    spec: '30W BLDC Fan Motor',
    partCode: '0010401765',
    supplier: 'Panasonic',
    sourceModel: 'HSU18-3NT-O'
  }
];

const SEED_ODU_MOTORS: ComponentRecord[] = [
  {
    spec: '25W',
    partCode: '0010401701L',
    supplier: 'Tongdeli',
    sourceModel: 'HSI19T-S2NB-F'
  },
  {
    spec: '60W DC Fan Motor',
    partCode: 'MTR-ODU-3310',
    supplier: 'Nidec',
    sourceModel: 'HSO53-3NT-I'
  },
  {
    spec: '45W BLDC Motor',
    partCode: '0010401880T',
    supplier: 'Tongdeli',
    sourceModel: 'HSO35-2NT-I'
  },
  {
    spec: '50W DC Motor',
    partCode: '0010401950',
    supplier: 'Welling',
    sourceModel: 'HSO70-4NT-I'
  },
  {
    spec: '40W DC Fan Motor',
    partCode: '0010401650L',
    supplier: 'Tongdeli',
    sourceModel: 'HSU18-3NT-O'
  }
];

const SEED_IDU_PCBS: PcbRecord[] = [
  {
    partCode: '0011802046NPA',
    supplier: 'lingzhi',
    sourceModel: 'HSI19T-S2NB-F'
  },
  {
    partCode: '0011801843BGAG',
    supplier: 'lingzhi',
    sourceModel: 'HSO53-3NT-I'
  },
  {
    partCode: 'PCB-IDU-8841',
    supplier: 'Sanken Electric',
    sourceModel: 'HSO35-2NT-I'
  },
  {
    partCode: '0011801990A',
    supplier: 'Haier Control',
    sourceModel: 'HSO70-4NT-I'
  },
  {
    partCode: '0011802210F',
    supplier: 'Sanxing',
    sourceModel: 'HSU18-3NT-O'
  }
];

const SEED_ODU_PCBS: PcbRecord[] = [
  {
    partCode: '0011801843BGAG',
    supplier: 'lingzhi',
    sourceModel: 'HSI19T-S2NB-F'
  },
  {
    partCode: 'PCB-ODU-9902',
    supplier: 'Delta',
    sourceModel: 'HSO53-3NT-I'
  },
  {
    partCode: '0011802110D',
    supplier: 'lingzhi',
    sourceModel: 'HSO35-2NT-I'
  },
  {
    partCode: '0011802050E',
    supplier: 'Haier Control',
    sourceModel: 'HSO70-4NT-I'
  }
];

const SEED_EEVS: ComponentRecord[] = [
  {
    spec: '500 Pulse Electronic Expansion Valve',
    partCode: 'EEV-ODU-1022',
    supplier: 'Sanhua',
    sourceModel: 'HSI19T-S2NB-F'
  },
  {
    spec: '480 Pulse EEV',
    partCode: '0010501820',
    supplier: 'DunAn',
    sourceModel: 'HSO53-3NT-I'
  },
  {
    spec: '500 Pulse EEV R32',
    partCode: '0010501930S',
    supplier: 'Sanhua',
    sourceModel: 'HSO35-2NT-I'
  },
  {
    spec: 'Electronic Expansion Valve 1.5T',
    partCode: 'EEV-SANHUA-32',
    supplier: 'Sanhua',
    sourceModel: 'HSU18-3NT-O'
  },
  {
    spec: 'Electronic Expansion Valve 2.0T',
    partCode: 'EEV-DUNAN-48',
    supplier: 'DunAn',
    sourceModel: 'HSO70-4NT-I'
  }
];

/**
 * Scans all machines currently or previously tested / registered across:
 * - Proto Units
 * - PP Units
 * - Field Units
 * - Lab Units
 * and aggregates them with verified hardware seeds.
 */
export function getAllComponentCatalog() {
  const compressors: ComponentRecord[] = [...SEED_COMPRESSORS];
  const iduMotors: ComponentRecord[] = [...SEED_IDU_MOTORS];
  const oduMotors: ComponentRecord[] = [...SEED_ODU_MOTORS];
  const iduPcbs: PcbRecord[] = [...SEED_IDU_PCBS];
  const oduPcbs: PcbRecord[] = [...SEED_ODU_PCBS];
  const eevs: ComponentRecord[] = [...SEED_EEVS];

  // Helper to extract photo URL safely
  const extractPhoto = (photos: any, ...keys: string[]): string | undefined => {
    if (!photos || typeof photos !== 'object') return undefined;
    for (const k of keys) {
      if (typeof photos[k] === 'string' && photos[k].trim() !== '') {
        return photos[k].trim();
      }
    }
    return undefined;
  };

  // Process all testing machines
  const allUnits: any[] = [];
  try { allUnits.push(...getProtoUnits()); } catch {}
  try { allUnits.push(...getPpUnits()); } catch {}
  try { allUnits.push(...getFieldUnits()); } catch {}
  try { allUnits.push(...getUnits()); } catch {}

  allUnits.forEach((u) => {
    if (!u) return;
    const parts = u.partsInfo || {};
    const photos = u.photos || {};
    const model = u.modelName || '';

    // Compressor
    const cSpec = parts.compressorSpec || parts.oduCompressorSpec || '';
    const cPart = parts.compressorPartCode || parts.oduCompressorPartCode || '';
    const cSupp = parts.compressorSupplier || parts.oduCompressorSupplier || '';
    const cPhoto = extractPhoto(photos, 'oduCompressorPhoto', 'PHOTO_ODU_Compressor', 'PHOTO_Compressor', 'compressorPhoto');
    if (cSpec || cPart || cSupp) {
      compressors.unshift({
        spec: cSpec,
        partCode: cPart,
        supplier: cSupp,
        photoUrl: cPhoto,
        sourceModel: model
      });
    }

    // IDU Motor
    const imSpec = parts.iduMotorSpec || '';
    const imPart = parts.iduMotorPartCode || '';
    const imSupp = parts.iduMotorSupplier || '';
    const imPhoto = extractPhoto(photos, 'iduMotorPhoto', 'PHOTO_IDU_Motor', 'indoorMotorPhoto');
    if (imSpec || imPart || imSupp) {
      iduMotors.unshift({
        spec: imSpec,
        partCode: imPart,
        supplier: imSupp,
        photoUrl: imPhoto,
        sourceModel: model
      });
    }

    // ODU Motor
    const omSpec = parts.oduMotorSpec || '';
    const omPart = parts.oduMotorPartCode || '';
    const omSupp = parts.oduMotorSupplier || '';
    const omPhoto = extractPhoto(photos, 'oduMotorPhoto', 'PHOTO_ODU_Motor', 'outdoorMotorPhoto');
    if (omSpec || omPart || omSupp) {
      oduMotors.unshift({
        spec: omSpec,
        partCode: omPart,
        supplier: omSupp,
        photoUrl: omPhoto,
        sourceModel: model
      });
    }

    // IDU PCB
    const ipPart = parts.iduPcbPartCode || '';
    const ipSupp = parts.iduPcbSupplier || '';
    const ipPhoto = extractPhoto(photos, 'iduPcbPhoto', 'PHOTO_IDU_PCB');
    if (ipPart || ipSupp) {
      iduPcbs.unshift({
        partCode: ipPart,
        supplier: ipSupp,
        photoUrl: ipPhoto,
        sourceModel: model
      });
    }

    // ODU PCB
    const opPart = parts.oduPcbPartCode || '';
    const opSupp = parts.oduPcbSupplier || '';
    const opPhoto = extractPhoto(photos, 'oduPcbPhoto', 'PHOTO_ODU_PCB');
    if (opPart || opSupp) {
      oduPcbs.unshift({
        partCode: opPart,
        supplier: opSupp,
        photoUrl: opPhoto,
        sourceModel: model
      });
    }

    // EEV
    const eSpec = parts.eevSpec || parts.oduEevSpec || '';
    const ePart = parts.eevPartCode || parts.oduEevPartCode || '';
    const eSupp = parts.eevSupplier || parts.oduEevSupplier || '';
    const ePhoto = extractPhoto(photos, 'oduEevPhoto', 'PHOTO_Electronic_Expansion_Valve', 'PHOTO_EEV', 'eevPhoto');
    if (eSpec || ePart || eSupp) {
      eevs.unshift({
        spec: eSpec,
        partCode: ePart,
        supplier: eSupp,
        photoUrl: ePhoto,
        sourceModel: model
      });
    }
  });

  return {
    compressors,
    iduMotors,
    oduMotors,
    iduPcbs,
    oduPcbs,
    eevs
  };
}

// Helpers for clean unique dropdown suggestion values
export function getUniqueValues(list: string[]): string[] {
  const clean = list
    .map(s => (s || '').trim())
    .filter(s => s.length > 0 && s !== 'NA' && s !== 'N/A' && s !== '-');
  return Array.from(new Set(clean));
}

/**
 * Match a compressor from query (spec, partCode, or supplier)
 */
export function findCompressorMatch(query: { spec?: string; partCode?: string; supplier?: string }): ComponentRecord | null {
  const { compressors } = getAllComponentCatalog();
  const qSpec = (query.spec || '').trim().toLowerCase();
  const qPart = (query.partCode || '').trim().toLowerCase();
  const qSupp = (query.supplier || '').trim().toLowerCase();

  if (!qSpec && !qPart && !qSupp) return null;

  // 1. Exact match on spec
  if (qSpec) {
    const match = compressors.find(c => (c.spec || '').trim().toLowerCase() === qSpec && (c.partCode || c.supplier));
    if (match) return match;
  }

  // 2. Exact match on partCode
  if (qPart) {
    const match = compressors.find(c => (c.partCode || '').trim().toLowerCase() === qPart && (c.spec || c.supplier));
    if (match) return match;
  }

  // 3. Exact match on supplier
  if (qSupp) {
    const match = compressors.find(c => (c.supplier || '').trim().toLowerCase() === qSupp && (c.spec || c.partCode));
    if (match) return match;
  }

  // 4. Fuzzy / partial match on spec
  if (qSpec && qSpec.length >= 3) {
    const match = compressors.find(c => (c.spec || '').toLowerCase().includes(qSpec));
    if (match) return match;
  }

  // 5. Fuzzy / partial match on partCode
  if (qPart && qPart.length >= 4) {
    const match = compressors.find(c => (c.partCode || '').toLowerCase().includes(qPart));
    if (match) return match;
  }

  return null;
}

/**
 * Match an IDU Motor from query (supplier, spec, or partCode)
 */
export function findIduMotorMatch(query: { spec?: string; partCode?: string; supplier?: string }): ComponentRecord | null {
  const { iduMotors } = getAllComponentCatalog();
  const qSpec = (query.spec || '').trim().toLowerCase();
  const qPart = (query.partCode || '').trim().toLowerCase();
  const qSupp = (query.supplier || '').trim().toLowerCase();

  if (!qSpec && !qPart && !qSupp) return null;

  // 1. Exact match on supplier (High priority as requested: "IDU Moter ka Supplier Name fill kru to automatically Eska Part Code, Spec Aa jaye")
  if (qSupp) {
    const match = iduMotors.find(m => (m.supplier || '').trim().toLowerCase() === qSupp && (m.partCode || m.spec));
    if (match) return match;
  }

  // 2. Exact match on spec
  if (qSpec) {
    const match = iduMotors.find(m => (m.spec || '').trim().toLowerCase() === qSpec && (m.partCode || m.supplier));
    if (match) return match;
  }

  // 3. Exact match on partCode
  if (qPart) {
    const match = iduMotors.find(m => (m.partCode || '').trim().toLowerCase() === qPart && (m.spec || m.supplier));
    if (match) return match;
  }

  // Partial match
  if (qSupp && qSupp.length >= 2) {
    const match = iduMotors.find(m => (m.supplier || '').toLowerCase().includes(qSupp));
    if (match) return match;
  }

  if (qPart && qPart.length >= 4) {
    const match = iduMotors.find(m => (m.partCode || '').toLowerCase().includes(qPart));
    if (match) return match;
  }

  return null;
}

/**
 * Match an ODU Motor from query (spec, partCode, or supplier)
 */
export function findOduMotorMatch(query: { spec?: string; partCode?: string; supplier?: string }): ComponentRecord | null {
  const { oduMotors } = getAllComponentCatalog();
  const qSpec = (query.spec || '').trim().toLowerCase();
  const qPart = (query.partCode || '').trim().toLowerCase();
  const qSupp = (query.supplier || '').trim().toLowerCase();

  if (!qSpec && !qPart && !qSupp) return null;

  // 1. Exact match on spec (e.g. 25W)
  if (qSpec) {
    const match = oduMotors.find(m => (m.spec || '').trim().toLowerCase() === qSpec && (m.partCode || m.supplier));
    if (match) return match;
  }

  // 2. Exact match on partCode (e.g. 0010401701L)
  if (qPart) {
    const match = oduMotors.find(m => (m.partCode || '').trim().toLowerCase() === qPart && (m.spec || m.supplier));
    if (match) return match;
  }

  // 3. Exact match on supplier (e.g. Tongdeli)
  if (qSupp) {
    const match = oduMotors.find(m => (m.supplier || '').trim().toLowerCase() === qSupp && (m.spec || m.partCode));
    if (match) return match;
  }

  // Partial
  if (qPart && qPart.length >= 4) {
    const match = oduMotors.find(m => (m.partCode || '').toLowerCase().includes(qPart));
    if (match) return match;
  }

  if (qSupp && qSupp.length >= 2) {
    const match = oduMotors.find(m => (m.supplier || '').toLowerCase().includes(qSupp));
    if (match) return match;
  }

  return null;
}

/**
 * Match an IDU PCB from query (partCode or supplier)
 */
export function findIduPcbMatch(query: { partCode?: string; supplier?: string }): PcbRecord | null {
  const { iduPcbs } = getAllComponentCatalog();
  const qPart = (query.partCode || '').trim().toLowerCase();
  const qSupp = (query.supplier || '').trim().toLowerCase();

  if (!qPart && !qSupp) return null;

  if (qPart) {
    const match = iduPcbs.find(p => (p.partCode || '').trim().toLowerCase() === qPart && p.supplier);
    if (match) return match;
  }

  if (qSupp) {
    const match = iduPcbs.find(p => (p.supplier || '').trim().toLowerCase() === qSupp && p.partCode);
    if (match) return match;
  }

  return null;
}

/**
 * Match an ODU PCB from query (partCode or supplier)
 */
export function findOduPcbMatch(query: { partCode?: string; supplier?: string }): PcbRecord | null {
  const { oduPcbs } = getAllComponentCatalog();
  const qPart = (query.partCode || '').trim().toLowerCase();
  const qSupp = (query.supplier || '').trim().toLowerCase();

  if (!qPart && !qSupp) return null;

  if (qPart) {
    const match = oduPcbs.find(p => (p.partCode || '').trim().toLowerCase() === qPart && p.supplier);
    if (match) return match;
  }

  if (qSupp) {
    const match = oduPcbs.find(p => (p.supplier || '').trim().toLowerCase() === qSupp && p.partCode);
    if (match) return match;
  }

  return null;
}

/**
 * Match an EEV from query (spec, partCode, or supplier)
 */
export function findEevMatch(query: { spec?: string; partCode?: string; supplier?: string }): ComponentRecord | null {
  const { eevs } = getAllComponentCatalog();
  const qSpec = (query.spec || '').trim().toLowerCase();
  const qPart = (query.partCode || '').trim().toLowerCase();
  const qSupp = (query.supplier || '').trim().toLowerCase();

  if (!qSpec && !qPart && !qSupp) return null;

  if (qSpec) {
    const match = eevs.find(e => (e.spec || '').trim().toLowerCase() === qSpec && (e.partCode || e.supplier));
    if (match) return match;
  }

  if (qPart) {
    const match = eevs.find(e => (e.partCode || '').trim().toLowerCase() === qPart && (e.spec || e.supplier));
    if (match) return match;
  }

  if (qSupp) {
    const match = eevs.find(e => (e.supplier || '').trim().toLowerCase() === qSupp && (e.spec || e.partCode));
    if (match) return match;
  }

  return null;
}
