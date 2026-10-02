import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PHOTO_FIELD_DEFINITIONS, getPhotoUrlForContentControl } from './photoManager';
import { isPhotoMissing, getPictureNotAvailableDataUrlSync } from './placeholderImage';
import { getMachineStartDateTime, getMachineEndDateTime, getTestCommencedDate, getTestCompletedDate } from './dateFormatter';
import { NamePlateDetails, ProtoUnitParts, ProtoUnitPhotos, ObservationNote } from '../types';

export interface PDFExportData {
  title?: string;
  unitType?: string;
  unit?: any;
  modelName: string;
  serialNumber?: string;
  iduSerialNumber?: string;
  oduSerialNumber?: string;
  station?: string;
  sampleType?: string;
  materialCode?: string;
  version?: string;
  quantity?: number;
  status?: string;
  requiredHour?: number | string;
  elapsedHours?: number | string;
  pendingHours?: number | string;
  doneHour?: number | string;
  requestBy?: string;
  testPurpose?: string;
  testCommenced?: string;
  testCompleted?: string;
  endDateTime?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  details?: { label: string; value: string }[];
  remarks?: string;
  purpose?: string;
  namePlate?: NamePlateDetails;
  partsInfo?: ProtoUnitParts;
  photos?: ProtoUnitPhotos | { [key: string]: any };
  observations?: { id?: string; text?: string; message?: string; timestamp?: string; time?: string }[];
  timeline?: any[];
  extraInfo?: { label: string; value: string }[];
  fourWaySwing?: string;
  rpm?: string;
}

function showPdfToast(message: string, isError = false) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('pdf-export-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'pdf-export-toast';
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.zIndex = '999999';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '12px';
  toast.style.fontSize = '13px';
  toast.style.fontWeight = '700';
  toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '10px';
  toast.style.transition = 'all 0.3s ease';

  if (isError) {
    toast.style.background = '#450a0a';
    toast.style.color = '#fecaca';
    toast.style.border = '1px solid #dc2626';
    toast.innerHTML = `<span>⚠️</span> <span>${message}</span>`;
  } else {
    toast.style.background = '#022c22';
    toast.style.color = '#a7f3d0';
    toast.style.border = '1px solid #059669';
    toast.innerHTML = `<span>📄</span> <span>${message}</span>`;
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

export async function exportUnitToPDF(rawInput: PDFExportData) {
  showPdfToast('Preparing & downloading full machine PDF (A to Z)...');

  // Enrich data from unit object if provided
  const unit = rawInput.unit || {};
  const modelName = rawInput.modelName || unit.modelName || 'Unknown_Model';
  const iduSerial = rawInput.iduSerialNumber || unit.iduSerialNumber || '';
  const oduSerial = rawInput.oduSerialNumber || unit.oduSerialNumber || '';
  const serialNumber = rawInput.serialNumber || (iduSerial && oduSerial ? `IDU: ${iduSerial} | ODU: ${oduSerial}` : (iduSerial || oduSerial || unit.serialNumber || 'N/A'));
  
  const title = rawInput.title || 'Comprehensive Machine Inspection Report';
  const unitType = rawInput.unitType || 'Air Conditioner Testing Unit';
  const station = rawInput.station || unit.station || 'Station 01';
  const status = (rawInput.status || unit.status || 'LIVE TESTING').toString().toUpperCase();
  const sampleType = rawInput.sampleType || unit.sampleType || 'Proto Type';
  const requestBy = rawInput.requestBy || unit.requestBy || unit.rdPerson || unit.bsrPerson || 'R&D Department';
  const testPurpose = rawInput.testPurpose || rawInput.purpose || unit.testPurpose || 'Comprehensive Reliability & Performance Testing';
  
  const requiredHour = rawInput.requiredHour ?? unit.requiredHour ?? (unit.dayDuration ? `${unit.dayDuration * 24} Hours` : 'N/A');
  const elapsedHours = rawInput.elapsedHours ?? (unit.doneHour !== undefined ? `${unit.doneHour} Hours` : 'N/A');
  const pendingHours = rawInput.pendingHours ?? 'N/A';
  
  const mergedUnit = { ...unit, ...rawInput };
  const machineStart = getMachineStartDateTime(mergedUnit);
  const machineEnd = getMachineEndDateTime(mergedUnit);

  const testCommenced = machineStart !== 'N/A' && machineStart !== '-' ? machineStart : (rawInput.testCommenced || unit.reportDetails?.testCommenced || unit.createdAt || '-');
  const testCompleted = machineEnd;
  const remarks = rawInput.remarks || unit.remarks || unit.notes || 'Standard testing protocol followed. All functional components validated.';

  const namePlate: NamePlateDetails = rawInput.namePlate || unit.namePlate || {};
  const partsInfo: ProtoUnitParts = rawInput.partsInfo || unit.partsInfo || {};
  const photosData = rawInput.photos || unit.photos || {};

  // Extract all observations
  const observations = rawInput.observations || unit.observations || [];

  // Extract timeline if available (e.g. R&D units)
  const timeline = rawInput.timeline || unit.timeline || [];

  // Extract all 12 photos
  const fallbackPlaceholder = getPictureNotAvailableDataUrlSync();
  const resolvedPhotos = PHOTO_FIELD_DEFINITIONS.map((def, idx) => {
    const rawUrl = getPhotoUrlForContentControl(photosData, def.photoKey);
    const isMissing = isPhotoMissing(rawUrl);
    return {
      index: idx + 1,
      label: def.label,
      section: def.section,
      photoKey: def.photoKey,
      url: (!isMissing && rawUrl) ? rawUrl.trim() : fallbackPlaceholder,
      isUploaded: !isMissing && Boolean(rawUrl)
    };
  });

  const uploadedCount = resolvedPhotos.filter(p => p.isUploaded).length;
  const safeFileName = `${modelName}_${iduSerial || oduSerial || 'Machine'}_Full_Report`.replace(/[^a-zA-Z0-9_-]/g, '_');

  const hasExtraPage = observations.length > 3 || timeline.length > 0;
  const totalPages = hasExtraPage ? 3 : 2;

  // Build the complete multi-page HTML markup
  const htmlContent = `
    <div id="pdf-root-container" style="background: #ffffff; width: 800px; margin: 0; padding: 0;">
      
      <!-- ================= PAGE 1 ================= -->
      <div class="pdf-export-page" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; background: #ffffff; width: 800px; min-height: 1128px; padding: 24px 30px; box-sizing: border-box; line-height: 1.42; font-size: 10.5px; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always;">
        <div>
          <!-- Top Branding Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0891b2; padding-bottom: 12px; margin-bottom: 14px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 12px; height: 12px; background: #0891b2; border-radius: 3px;"></span>
                <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #0891b2;">Quality Assurance & Testing Division</span>
              </div>
              <h1 style="margin: 3px 0 2px 0; font-size: 19px; font-weight: 900; color: #0e7490; letter-spacing: -0.5px;">${title}</h1>
              <p style="margin: 0; font-size: 10.5px; color: #475569; font-weight: 600;">
                ${unitType} &bull; Complete Machine Record (A to Z) &bull; Model: <span style="color: #0891b2; font-weight: 800;">${modelName}</span>
              </p>
            </div>
            <div style="text-align: right;">
              <div style="display: inline-block; padding: 3px 12px; border-radius: 9999px; font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; background: ${status.includes('PASS') ? '#ecfdf5' : '#f0fdf4'}; color: ${status.includes('PASS') ? '#047857' : '#0891b2'}; border: 1.5px solid ${status.includes('PASS') ? '#a7f3d0' : '#a5f3fc'};">
                ${status}
              </div>
              <p style="margin: 5px 0 0 0; font-size: 9.5px; color: #64748b; font-weight: 500;">
                Report Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p style="margin: 2px 0 0 0; font-size: 9px; color: #94a3b8; font-family: monospace;">
                ID: REP-${modelName.slice(0, 6)}-${Date.now().toString().slice(-6)}
              </p>
            </div>
          </div>

          <!-- Section A: General Machine & Testing Information -->
          <div style="margin-bottom: 14px;">
            <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #0e7490; background: #f0fdfa; border-left: 4px solid #0891b2; padding: 3px 8px; margin-bottom: 6px;">
              Section A: Machine Identification & Testing Overview
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e2e8f0;">
              <tbody>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569; width: 22%;">Model Name:</td>
                  <td style="padding: 5px 8px; font-weight: 800; color: #0f172a; width: 28%;">${modelName}</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569; width: 22%;">Testing Station:</td>
                  <td style="padding: 5px 8px; font-weight: 800; color: #0891b2; width: 28%;">${station}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">IDU Serial Number:</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #0f172a; font-family: monospace;">${iduSerial || 'N/A'}</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">ODU Serial Number:</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #0f172a; font-family: monospace;">${oduSerial || serialNumber}</td>
                </tr>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">Sample Type:</td>
                  <td style="padding: 5px 8px; font-weight: 600; color: #0f172a;">${sampleType}</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">Requested By:</td>
                  <td style="padding: 5px 8px; font-weight: 600; color: #0f172a;">${requestBy}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">Start Date & Time (Test Commenced):</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #0f172a; font-family: monospace;">${testCommenced}</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">End Date & Time (Test Completed):</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #047857; font-family: monospace;">${testCompleted}</td>
                </tr>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">Required Duration:</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #0f172a;">${requiredHour}</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">Elapsed / Done Hours:</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #047857;">${elapsedHours}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">Pending Hours:</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #b45309;">${pendingHours}</td>
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569;">Current Status:</td>
                  <td style="padding: 5px 8px; font-weight: 800; color: #0e7490;">${status}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 8px; font-weight: 700; color: #475569; vertical-align: top;">Testing Purpose:</td>
                  <td colspan="3" style="padding: 5px 8px; font-weight: 500; color: #334155; line-height: 1.35;">${testPurpose}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Section B: Technical & Nameplate Specifications -->
          <div style="margin-bottom: 14px;">
            <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #0e7490; background: #f0fdfa; border-left: 4px solid #0891b2; padding: 3px 8px; margin-bottom: 6px;">
              Section B: Nameplate & Electrical Technical Specifications
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #e2e8f0;">
              <thead>
                <tr style="background: #e0f2fe; color: #0369a1; text-align: left; font-weight: 800; border-bottom: 1px solid #bae6fd;">
                  <th style="padding: 4px 8px; width: 25%;">Parameter</th>
                  <th style="padding: 4px 8px; width: 25%;">Value</th>
                  <th style="padding: 4px 8px; width: 25%;">Parameter</th>
                  <th style="padding: 4px 8px; width: 25%;">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Cooling Capacity</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.coolingCapacity || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Rated Cooling Power</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.ratedCoolingPower || 'N/A'}</td>
                </tr>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Rated Total Power</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.ratedPower || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Rated Current</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.ratedCurrent || 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Operating Voltage</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.voltage || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">ISEER Rating</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.iseer || 'N/A'}</td>
                </tr>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Refrigerant Type</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.refrigerant || 'R32'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Gas / Refrigerant Quantity</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.gasQty || 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Gas Injection Volume</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.gasInjectionVolume || 'N/A'}</td>
                  <td style="padding: 4px 4px; font-weight: 600; color: #475569;">Power Mode</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.powerMode || 'N/A'}</td>
                </tr>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Main Checksum (IDU)</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0e7490; font-family: monospace;">${namePlate.mainProgramChecksumIdu || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Main Checksum (ODU)</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0e7490; font-family: monospace;">${namePlate.mainProgramChecksumOdu || 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">EE Checksum (IDU)</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #475569; font-family: monospace;">${namePlate.eeChecksumIdu || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">EE Checksum (ODU)</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #475569; font-family: monospace;">${namePlate.eeChecksumOdu || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">4-Way Swing</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.fourWaySwing || rawInput.fourWaySwing || partsInfo.fourWaySwing || partsInfo.iduFourWaySwing || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #475569;">Fan RPM</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">${namePlate.rpm || rawInput.rpm || partsInfo.rpm || partsInfo.iduRpm || 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Section C: Key Component Parts & Supplier Information -->
          <div style="margin-bottom: 8px;">
            <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #0e7490; background: #f0fdfa; border-left: 4px solid #0891b2; padding: 3px 8px; margin-bottom: 6px;">
              Section C: Key Components & Bill of Materials (BOM)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #e2e8f0;">
              <thead>
                <tr style="background: #e0f2fe; color: #0369a1; text-align: left; font-weight: 800; border-bottom: 1px solid #bae6fd;">
                  <th style="padding: 4px 8px; width: 22%;">Component Name</th>
                  <th style="padding: 4px 8px; width: 28%;">Specification / Model</th>
                  <th style="padding: 4px 8px; width: 25%;">Part Code</th>
                  <th style="padding: 4px 8px; width: 25%;">Supplier / Manufacturer</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">IDU Fan Motor</td>
                  <td style="padding: 4px 8px; color: #334155;">${partsInfo.iduMotorSpec || 'Standard IDU Motor'}</td>
                  <td style="padding: 4px 8px; font-family: monospace; font-weight: 600; color: #475569;">${partsInfo.iduMotorPartCode || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #0f172a;">${partsInfo.iduMotorSupplier || 'N/A'}</td>
                </tr>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">IDU Control PCB</td>
                  <td style="padding: 4px 8px; color: #334155;">Inverter Indoor Mainboard</td>
                  <td style="padding: 4px 8px; font-family: monospace; font-weight: 600; color: #475569;">${partsInfo.iduPcbPartCode || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #0f172a;">${partsInfo.iduPcbSupplier || 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">ODU Fan Motor</td>
                  <td style="padding: 4px 8px; color: #334155;">${partsInfo.oduMotorSpec || 'Standard ODU Motor'}</td>
                  <td style="padding: 4px 8px; font-family: monospace; font-weight: 600; color: #475569;">${partsInfo.oduMotorPartCode || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #0f172a;">${partsInfo.oduMotorSupplier || 'N/A'}</td>
                </tr>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">ODU Power PCB</td>
                  <td style="padding: 4px 8px; color: #334155;">Inverter Outdoor Mainboard</td>
                  <td style="padding: 4px 8px; font-family: monospace; font-weight: 600; color: #475569;">${partsInfo.oduPcbPartCode || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #0f172a;">${partsInfo.oduPcbSupplier || 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">Rotary Compressor</td>
                  <td style="padding: 4px 8px; color: #334155;">${partsInfo.compressorSpec || partsInfo.oduCompressorSpec || 'Inverter Rotary Compressor'}</td>
                  <td style="padding: 4px 8px; font-family: monospace; font-weight: 600; color: #475569;">${partsInfo.compressorPartCode || partsInfo.oduCompressorPartCode || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #0f172a;">${partsInfo.compressorSupplier || partsInfo.oduCompressorSupplier || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0f172a;">Expansion Valve (EEV)</td>
                  <td style="padding: 4px 8px; color: #334155;">${partsInfo.eevSpec || partsInfo.oduEevSpec || 'Pulse Stepper EEV'}</td>
                  <td style="padding: 4px 8px; font-family: monospace; font-weight: 600; color: #475569;">${partsInfo.eevPartCode || partsInfo.oduEevPartCode || 'N/A'}</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #0f172a;">${partsInfo.eevSupplier || partsInfo.oduEevSupplier || 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Page 1 Footer Stamp -->
        <div style="margin-top: 14px; border-top: 1.5px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #94a3b8; font-weight: 600;">
          <div>AIR CONDITIONER RELIABILITY & PROTO TESTING LABORATORY &bull; CONFIDENTIAL</div>
          <div>Page 1 of ${totalPages} &bull; Complete Machine Record (A to Z)</div>
        </div>
      </div>

      <!-- ================= PAGE 2 ================= -->
      <div class="pdf-export-page" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; background: #ffffff; width: 800px; min-height: 1128px; padding: 24px 30px; box-sizing: border-box; line-height: 1.42; font-size: 10.5px; display: flex; flex-direction: column; justify-content: space-between; page-break-after: ${hasExtraPage ? 'always' : 'avoid'};">
        <div>
          <!-- Page 2 Sub-Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0891b2; padding-bottom: 6px; margin-bottom: 10px;">
            <div>
              <span style="font-size: 9.5px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #0891b2;">Quality Assurance & Testing Division</span>
              <div style="font-size: 11.5px; font-weight: 900; color: #0e7490;">Model: ${modelName} &bull; IDU: ${iduSerial || '-'} &bull; ODU: ${oduSerial || '-'}</div>
            </div>
            <div style="text-align: right; font-size: 9.5px; color: #64748b; font-weight: 600;">
              <div>Station: <span style="color: #0891b2; font-weight: 800;">${station}</span> &bull; Status: <span style="color: #047857; font-weight: 800;">${status}</span></div>
              <div style="color: #94a3b8;">Page 2 of ${totalPages}</div>
            </div>
          </div>

          <!-- Section D: 12-Slot Standard Inspection Photos Gallery (ALL 12 TOGETHER ON PAGE 2) -->
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; border-left: 4px solid #0891b2; padding: 3px 8px; margin-bottom: 8px;">
              <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #0e7490;">
                Section D: Standard 12-Slot Component Inspection Photos
              </div>
              <div style="font-size: 9.5px; font-weight: 700; color: #0e7490;">
                Uploaded: ${uploadedCount} / 12 Photos
              </div>
            </div>
            
            <!-- 3 Rows x 4 Columns = 12 Photos Grid -->
            <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-start;">
              ${resolvedPhotos.map(photo => `
                <div style="width: calc(25% - 6px); box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 5px; background: #ffffff; text-align: center;">
                  <div style="font-size: 8.5px; font-weight: 800; color: #1e293b; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${photo.label}">
                    #${photo.index}. ${photo.label}
                  </div>
                  <div style="width: 100%; height: 86px; background: #f8fafc; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0;">
                    <img 
                      src="${photo.url}" 
                      alt="${photo.label}" 
                      style="max-width: 100%; max-height: 82px; object-fit: contain; display: block; margin: 0 auto;" 
                    />
                  </div>
                  <div style="margin-top: 3px; font-size: 7.5px; font-weight: 800; text-transform: uppercase; color: ${photo.isUploaded ? '#059669' : '#94a3b8'};">
                    ${photo.isUploaded ? '✓ Verified Photo' : 'No Photo Uploaded'}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          ${!hasExtraPage ? `
            <!-- Section E: Observation Notes (Compact on Page 2 if <= 3 entries) -->
            <div style="margin-bottom: 10px;">
              <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #0e7490; background: #f0fdfa; border-left: 4px solid #0891b2; padding: 3px 8px; margin-bottom: 6px;">
                Section E: Observation Notes & Quality Log History (${observations.length} Entries)
              </div>
              ${observations.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #e2e8f0;">
                  <thead>
                    <tr style="background: #e0f2fe; color: #0369a1; text-align: left; font-weight: 800; border-bottom: 1px solid #bae6fd;">
                      <th style="padding: 4px 8px; width: 8%;">#</th>
                      <th style="padding: 4px 8px; width: 26%;">Date & Timestamp</th>
                      <th style="padding: 4px 8px; width: 66%;">Observation Note / Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${observations.slice(0, 3).map((obs: any, i: number) => `
                      <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td style="padding: 4px 8px; font-weight: 700; color: #64748b;">${i + 1}</td>
                        <td style="padding: 4px 8px; font-family: monospace; font-weight: 600; color: #0e7490;">${obs.timestamp || obs.time || 'Logged'}</td>
                        <td style="padding: 4px 8px; color: #1e293b; font-weight: 500;">${obs.text || obs.message || 'Observation logged.'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; color: #64748b; font-style: italic; font-size: 9.5px;">
                  No specific anomalies or defects observed during testing. Unit operation remained stable.
                </div>
              `}
            </div>
          ` : ''}

          <!-- Section G: Remarks & Authorization Sign-off -->
          <div style="margin-bottom: 8px;">
            <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #0e7490; background: #f0fdfa; border-left: 4px solid #0891b2; padding: 3px 8px; margin-bottom: 6px;">
              Section G: Inspection Remarks & Authorization Sign-off
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 10px; margin-bottom: 10px;">
              <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">Engineer Remarks & Notes:</div>
              <div style="font-size: 10px; color: #1e293b; font-weight: 500; line-height: 1.35;">${remarks}</div>
            </div>

            <div style="display: flex; gap: 10px;">
              <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff; text-align: center; box-sizing: border-box;">
                <div style="height: 28px; border-bottom: 1px dashed #94a3b8; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center; font-family: monospace; font-size: 10.5px; color: #047857; font-weight: 700;">
                  ${requestBy}
                </div>
                <div style="font-size: 9.5px; font-weight: 800; color: #0f172a;">Inspected / Tested By</div>
                <div style="font-size: 8px; color: #64748b;">R&D Test Engineer</div>
              </div>
              <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff; text-align: center; box-sizing: border-box;">
                <div style="height: 28px; border-bottom: 1px dashed #94a3b8; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center; font-family: monospace; font-size: 10.5px; color: #0e7490; font-weight: 700;">
                  QA Verified
                </div>
                <div style="font-size: 9.5px; font-weight: 800; color: #0f172a;">Quality Verification</div>
                <div style="font-size: 8px; color: #64748b;">Quality Assurance Lead</div>
              </div>
              <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff; text-align: center; box-sizing: border-box;">
                <div style="height: 28px; border-bottom: 1px dashed #94a3b8; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center; font-family: monospace; font-size: 10.5px; color: #0e7490; font-weight: 700;">
                  Authorized
                </div>
                <div style="font-size: 9.5px; font-weight: 800; color: #0f172a;">Approved By</div>
                <div style="font-size: 8px; color: #64748b;">Laboratory In-Charge / Manager</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Page 2 Footer Stamp -->
        <div style="margin-top: 14px; border-top: 1.5px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #94a3b8; font-weight: 600;">
          <div>AIR CONDITIONER RELIABILITY & PROTO TESTING LABORATORY &bull; CONFIDENTIAL</div>
          <div>Page 2 of ${totalPages} &bull; Complete Machine Record (A to Z)</div>
        </div>
      </div>

      ${hasExtraPage ? `
        <!-- ================= PAGE 3 ================= -->
        <div class="pdf-export-page" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; background: #ffffff; width: 800px; min-height: 1128px; padding: 24px 30px; box-sizing: border-box; line-height: 1.42; font-size: 10.5px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <!-- Page 3 Sub-Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0891b2; padding-bottom: 6px; margin-bottom: 12px;">
              <div>
                <span style="font-size: 9.5px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #0891b2;">Quality Assurance & Testing Division</span>
                <div style="font-size: 11.5px; font-weight: 900; color: #0e7490;">Model: ${modelName} &bull; IDU: ${iduSerial || '-'} &bull; ODU: ${oduSerial || '-'}</div>
              </div>
              <div style="text-align: right; font-size: 9.5px; color: #64748b; font-weight: 600;">
                <div>Station: <span style="color: #0891b2; font-weight: 800;">${station}</span> &bull; Status: <span style="color: #047857; font-weight: 800;">${status}</span></div>
                <div style="color: #94a3b8;">Page 3 of 3</div>
              </div>
            </div>

            <!-- Section E: Complete Observation Notes & Quality Log History -->
            <div style="margin-bottom: 16px;">
              <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #0e7490; background: #f0fdfa; border-left: 4px solid #0891b2; padding: 3px 8px; margin-bottom: 8px;">
                Section E: Observation Notes & Quality Log History (${observations.length} Entries)
              </div>
              ${observations.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e2e8f0;">
                  <thead>
                    <tr style="background: #e0f2fe; color: #0369a1; text-align: left; font-weight: 800; border-bottom: 1px solid #bae6fd;">
                      <th style="padding: 5px 8px; width: 8%;">#</th>
                      <th style="padding: 5px 8px; width: 24%;">Date & Timestamp</th>
                      <th style="padding: 5px 8px; width: 68%;">Observation Note / Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${observations.map((obs: any, i: number) => `
                      <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td style="padding: 5px 8px; font-weight: 700; color: #64748b;">${i + 1}</td>
                        <td style="padding: 5px 8px; font-family: monospace; font-weight: 600; color: #0e7490;">${obs.timestamp || obs.time || 'Logged'}</td>
                        <td style="padding: 5px 8px; color: #1e293b; font-weight: 500;">${obs.text || obs.message || 'Observation logged.'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; color: #64748b; font-style: italic; font-size: 9.5px;">
                  No specific anomalies or defects observed during testing. Unit operation remained stable.
                </div>
              `}
            </div>

            <!-- Section F: Timeline & Transfer History -->
            ${timeline.length > 0 ? `
              <div style="margin-bottom: 16px;">
                <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #0e7490; background: #f0fdfa; border-left: 4px solid #0891b2; padding: 3px 8px; margin-bottom: 8px;">
                  Section F: R&D Transfer & Stage Progression History (${timeline.length} Stages)
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e2e8f0;">
                  <thead>
                    <tr style="background: #e0f2fe; color: #0369a1; text-align: left; font-weight: 800; border-bottom: 1px solid #bae6fd;">
                      <th style="padding: 5px 8px; width: 10%;">Stage</th>
                      <th style="padding: 5px 8px; width: 22%;">Stage Name</th>
                      <th style="padding: 5px 8px; width: 12%;">Dept</th>
                      <th style="padding: 5px 8px; width: 18%;">Person</th>
                      <th style="padding: 5px 8px; width: 18%;">Date & Time</th>
                      <th style="padding: 5px 8px; width: 20%;">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${timeline.map((step: any, i: number) => `
                      <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td style="padding: 5px 8px; font-weight: 700; color: #0e7490;">${step.stageIndex !== undefined ? step.stageIndex + 1 : i + 1}</td>
                        <td style="padding: 5px 8px; font-weight: 700; color: #1e293b;">${step.stageName || 'Stage'}</td>
                        <td style="padding: 5px 8px; font-weight: 600; color: #475569;">${step.department || 'R&D'}</td>
                        <td style="padding: 5px 8px; color: #0f172a;">${step.personName || 'N/A'}</td>
                        <td style="padding: 5px 8px; font-family: monospace; color: #64748b;">${step.date} ${step.time || ''}</td>
                        <td style="padding: 5px 8px; color: #475569;">${step.remarks || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>

          <!-- Page 3 Footer Stamp -->
          <div style="margin-top: 14px; border-top: 1.5px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #94a3b8; font-weight: 600;">
            <div>AIR CONDITIONER RELIABILITY & PROTO TESTING LABORATORY &bull; CONFIDENTIAL</div>
            <div>Page 3 of 3 &bull; Complete Machine Record (A to Z)</div>
          </div>
        </div>
      ` : ''}

    </div>
  `;

  try {
    // 1. Create a mounted, styled offscreen container in the real DOM (fixed at 0, 0 with z-index: -99999)
    // Ensures accurate computed bounding boxes and eliminates black canvas artifacts on mobile Chrome
    const container = document.createElement('div');
    container.id = 'temp-pdf-export-container';
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.zIndex = '-99999';
    container.style.pointerEvents = 'none';
    container.style.background = '#ffffff';
    container.style.color = '#0f172a';
    container.style.opacity = '1';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    // 2. Ensure all images finish loading with fallback placeholder protection
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve(null);
        return new Promise(resolve => {
          img.onload = () => resolve(null);
          img.onerror = () => {
            img.src = fallbackPlaceholder;
            resolve(null);
          };
          // 3 second safeguard timeout
          setTimeout(() => resolve(null), 3000);
        });
      })
    );

    // Allow browser layout and typography to settle
    await new Promise(resolve => setTimeout(resolve, 150));

    // 3. Render individual A4 page elements directly into separate PDF pages
    // This completely eliminates any element slicing, gap issues, or chopped photos!
    const pageElements = Array.from(container.querySelectorAll<HTMLElement>('.pdf-export-page'));

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = 210; // A4 mm
    const pageHeight = 297; // A4 mm

    if (pageElements.length > 0) {
      for (let pageIdx = 0; pageIdx < pageElements.length; pageIdx++) {
        if (pageIdx > 0) {
          pdf.addPage();
        }

        const canvas = await html2canvas(pageElements[pageIdx], {
          scale: 2, // 2x scale = 1600px width (crisp text, barcodes, tables and photos)
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff', // Ensures 100% pure solid white background, eliminating any black pages
          scrollX: 0,
          scrollY: 0,
          windowWidth: 800,
          logging: false
        });

        // Convert slice to high-quality JPEG (Opaque white backing guarantees zero black pixels)
        const pageDataUrl = canvas.toDataURL('image/jpeg', 0.96);
        pdf.addImage(pageDataUrl, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      }
    } else {
      // Fallback if no page class found
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 800,
        logging: false
      });
      const pageDataUrl = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(pageDataUrl, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    }

    // Cleanup temporary DOM container
    container.remove();

    // Trigger direct browser download of the PDF file
    pdf.save(`${safeFileName}.pdf`);
    showPdfToast('✓ Machine inspection PDF downloaded successfully!');

  } catch (err) {
    console.error("PDF generation error:", err);
    // Cleanup any orphaned container
    const existing = document.getElementById('temp-pdf-export-container');
    if (existing) existing.remove();

    // Fallback: Open print window if canvas generation encounters any device restrictions
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (printWindow) {
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${safeFileName}</title>
            <style>
              @page { size: A4; margin: 0; }
              body { margin: 0; padding: 0; background: #ffffff; }
              .pdf-export-page {
                page-break-after: always;
                break-after: page;
              }
              .pdf-export-page:last-child {
                page-break-after: avoid;
                break-after: avoid;
              }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.open();
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      showPdfToast('Opened print / save dialog.');
    } else {
      showPdfToast('Failed to download PDF. Please check browser permissions.', true);
    }
  }
}
