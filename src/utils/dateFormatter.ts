export function formatShortDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  
  const trimmed = dateStr.trim();
  if (!trimmed) return 'N/A';

  // If already in clean format like "2026-08-02 18:36" or "2026-08-02"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    let dateObj: Date;
    if (trimmed.includes('T')) {
      dateObj = new Date(trimmed);
    } else {
      dateObj = new Date(trimmed.replace(' ', 'T'));
    }

    if (isNaN(dateObj.getTime())) {
      // Return cleaned string up to seconds/timezone if invalid date
      return trimmed.replace(/T/, ' ').replace(/(\+\d{2}:\d{2}|\.000Z|Z)$/, '');
    }

    const yr = dateObj.getFullYear();
    const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
    const da = String(dateObj.getDate()).padStart(2, '0');
    const hr = String(dateObj.getHours()).padStart(2, '0');
    const mi = String(dateObj.getMinutes()).padStart(2, '0');

    return `${yr}-${mo}-${da} ${hr}:${mi}`;
  } catch {
    return trimmed;
  }
}

/**
 * Extract Year and Month short name (Jan, Feb, etc.) from various date representations
 */
export function extractYearAndMonth(dateStr?: string | null): { year: number | null; monthShort: string | null; monthIndex: number | null } {
  if (!dateStr) return { year: null, monthShort: null, monthIndex: null };
  const trimmed = dateStr.trim();
  if (!trimmed) return { year: null, monthShort: null, monthIndex: null };

  try {
    let d: Date;
    if (trimmed.includes('T')) {
      d = new Date(trimmed);
    } else {
      d = new Date(trimmed.replace(' ', 'T'));
    }

    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const monthIndex = d.getMonth(); // 0-11
      const monthShort = d.toLocaleString('en-US', { month: 'short' });
      return { year, monthShort, monthIndex };
    }
  } catch {
    // ignore
  }

  // Fallback regex matching YYYY-MM
  const match = trimmed.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { year, monthShort: months[monthIndex] || null, monthIndex };
  }

  return { year: null, monthShort: null, monthIndex: null };
}

/**
 * Returns the machine's actual Start Date & Time.
 * "Test Commenced me jo Date rahega wahi Start Date & Time me Data hona chahiye"
 * Sourced from testCommenced, startDateTime, or createdAt.
 */
export function getMachineStartDateTime(unit?: {
  startDateTime?: string;
  createdAt?: string;
  reportDetails?: { testCommenced?: string };
} | null): string {
  if (!unit) return '-';
  
  // 1. Check reportDetails.testCommenced first
  if (unit.reportDetails?.testCommenced && typeof unit.reportDetails.testCommenced === 'string') {
    const val = unit.reportDetails.testCommenced.trim();
    if (val && val !== 'NA' && val !== 'N/A' && val !== '-') {
      return formatShortDateTime(val);
    }
  }

  // 2. Check explicit startDateTime property
  if ((unit as any).startDateTime && typeof (unit as any).startDateTime === 'string') {
    const val = (unit as any).startDateTime.trim();
    if (val && val !== 'NA' && val !== 'N/A' && val !== '-') {
      return formatShortDateTime(val);
    }
  }

  // 3. Fallback to createdAt
  return unit.createdAt ? formatShortDateTime(unit.createdAt) : '-';
}

/**
 * Returns the data for "Test Commenced" strictly derived from the Machine's Start Date & Time.
 * Test Commenced and Start Date & Time always share the exact same data.
 */
export function getTestCommencedDate(unit?: {
  startDateTime?: string;
  createdAt?: string;
  reportDetails?: { testCommenced?: string };
} | null): string {
  return getMachineStartDateTime(unit);
}

/**
 * Checks whether a machine has completed its required 1045 hours (or target duration).
 */
export function isMachine1045Completed(unit?: {
  status?: string;
  doneHour?: number | string;
  requiredHour?: number | string;
} | null): boolean {
  if (!unit) return false;
  if (unit.status === 'finished') return true;
  const numDone = typeof unit.doneHour === 'number' ? unit.doneHour : parseFloat(String(unit.doneHour || 0));
  const numReq = typeof unit.requiredHour === 'number' ? unit.requiredHour : parseFloat(String(unit.requiredHour || 1045));
  const targetHour = numReq >= 1045 ? numReq : 1045;
  return !isNaN(numDone) && numDone >= targetHour;
}

/**
 * Automatically returns the machine's actual End Date & Time.
 * "Abhi 1045 hour Complete nhi hua hai lekin fir bhi End Time Date dikha raha hai.
 * Aur Jab tak Testing Chal rahi hai tab tak End Date & Time aur Test Completed me - rakho
 * aur jis din 1045 Hour Complete hoga us din Update kr dena"
 */
export function getMachineEndDateTime(unit?: {
  status?: string;
  endDateTime?: string;
  completedAt?: string;
  updatedAt?: string;
  createdAt?: string;
  startDateTime?: string;
  requiredHour?: number | string;
  doneHour?: number | string;
  reportDetails?: { testCompleted?: string; testCommenced?: string };
} | null): string {
  if (!unit) return '-';

  // If testing is currently in progress (Live or under 1045 hours done):
  if (unit.status === 'live' || !isMachine1045Completed(unit)) {
    // If unit is stopped, show the stop date & time for stop status
    if (unit.status === 'stopped') {
      const stopVal = unit.endDateTime || unit.updatedAt;
      if (stopVal && typeof stopVal === 'string') {
        const trimmed = stopVal.trim();
        if (trimmed && trimmed !== 'NA' && trimmed !== 'N/A' && trimmed !== 'In Progress' && trimmed !== '-') {
          return formatShortDateTime(trimmed);
        }
      }
    }
    // While testing is running, always show '-'
    return '-';
  }

  // When 1045 hours is completed (finished or doneHour >= 1045):
  // 1. Explicit completed timestamp when machine finished
  if (unit.completedAt && typeof unit.completedAt === 'string') {
    const val = unit.completedAt.trim();
    if (val && val !== 'NA' && val !== 'N/A' && val !== 'In Progress' && val !== '-') {
      return formatShortDateTime(val);
    }
  }

  // 2. Explicit endDateTime property recorded upon completion
  if (unit.endDateTime && typeof unit.endDateTime === 'string') {
    const val = unit.endDateTime.trim();
    if (val && val !== 'NA' && val !== 'N/A' && val !== 'In Progress' && val !== '-') {
      return formatShortDateTime(val);
    }
  }

  // 3. Explicit reportDetails.testCompleted date
  if (unit.reportDetails?.testCompleted && typeof unit.reportDetails.testCompleted === 'string') {
    const val = unit.reportDetails.testCompleted.trim();
    if (val && val !== 'NA' && val !== 'N/A' && val !== 'In Progress' && val !== '-') {
      return formatShortDateTime(val);
    }
  }

  // 4. Calculate date when machine reaches 1045 Hours: Start Date + 1045 Hours
  const startRaw = unit.reportDetails?.testCommenced || (unit as any).startDateTime || unit.createdAt;
  if (startRaw && typeof startRaw === 'string') {
    try {
      let d: Date;
      if (startRaw.includes('T')) {
        d = new Date(startRaw);
      } else {
        d = new Date(startRaw.replace(' ', 'T'));
      }

      if (!isNaN(d.getTime())) {
        const reqHours = Number(unit.requiredHour) || 1045;
        const compDate = new Date(d.getTime() + reqHours * 3600 * 1000);
        return formatShortDateTime(compDate.toISOString());
      }
    } catch {
      // ignore
    }
  }

  if (unit.updatedAt && typeof unit.updatedAt === 'string' && unit.updatedAt.trim() !== '' && unit.updatedAt !== 'NA' && unit.updatedAt !== '-') {
    return formatShortDateTime(unit.updatedAt);
  }

  return '-';
}

/**
 * Returns the data for "Test Completed" strictly derived from the Machine's End Date & Time.
 * "Jab tak Testing Chal rahi hai tab tak End Date & Time aur Test Completed me - rakho
 * aur jis din 1045 Hour Complete hoga us din Update kr dena"
 */
export function getTestCompletedDate(unit?: {
  status?: string;
  endDateTime?: string;
  completedAt?: string;
  updatedAt?: string;
  createdAt?: string;
  startDateTime?: string;
  requiredHour?: number | string;
  doneHour?: number | string;
  reportDetails?: { testCompleted?: string; testCommenced?: string };
} | null): string {
  if (!unit) return '-';

  // While testing is in progress (Live or not completed 1045 hours):
  if (unit.status === 'live' || !isMachine1045Completed(unit)) {
    return '-';
  }

  // When 1045 hours is completed, return the exact End Date & Time
  return getMachineEndDateTime(unit);
}

