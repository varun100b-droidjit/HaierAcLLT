import { getProtoUnits } from '../services/protoUnitStore';
import { getFieldUnits } from '../services/fieldUnitStore';
import { getPpUnits } from '../services/ppUnitStore';

export const ALL_STATIONS = Array.from(
  { length: 20 },
  (_, i) => `Station ${String(i + 1).padStart(2, '0')}`
);

/**
 * Returns a Set of station names (e.g., 'Station 01') that are currently in use
 * by active (live or stopped) units across Proto Units, Field Units, and PP Units.
 */
export function getOccupiedStations(): Set<string> {
  const occupied = new Set<string>();

  // Check Proto Units
  try {
    const protoUnits = getProtoUnits();
    protoUnits.forEach(unit => {
      if ((unit.status === 'live' || unit.status === 'stopped') && unit.station) {
        occupied.add(unit.station.trim());
      }
    });
  } catch (e) {
    console.error('Error reading proto units:', e);
  }

  // Check PP Units
  try {
    const ppUnits = getPpUnits();
    ppUnits.forEach(unit => {
      if ((unit.status === 'live' || unit.status === 'stopped') && unit.station) {
        occupied.add(unit.station.trim());
      }
    });
  } catch (e) {
    console.error('Error reading PP units:', e);
  }

  // Check Field Units
  try {
    const fieldUnits = getFieldUnits();
    fieldUnits.forEach(unit => {
      if ((unit.status === 'live' || unit.status === 'stopped') && unit.station) {
        occupied.add(unit.station.trim());
      }
    });
  } catch (e) {
    console.error('Error reading field units:', e);
  }

  return occupied;
}
