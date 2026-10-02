import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Cpu, 
  Database, 
  FileCheck, 
  Image, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Download, 
  Printer, 
  Sparkles,
  Zap,
  PlusCircle,
  FileSpreadsheet,
  Layers,
  Upload,
  ArrowUpRight,
  FolderArchive,
  Lock,
  FileText,
  Clock,
  Award,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Package,
  FolderDown,
  Folder,
  Loader2,
  Share2,
  Trash2
} from 'lucide-react';
import { ProtoUnit, PpUnit, ProtoUnitParts, ProtoUnitPhotos } from '../../types';
import { getProtoUnits, updateProtoUnit } from '../../services/protoUnitStore';
import { getPpUnits, updatePpUnit } from '../../services/ppUnitStore';
import { MasterTemplate, getMasterTemplate } from '../../services/reportTemplateStore';
import { PhotoUploadSection } from '../Common/PhotoUploadSection';
import { compressImageFile } from '../../services/photoSettingsStore';
import { 
  fetchUnitPhotosFromServer, 
  subscribeToUnitPhotos, 
  uploadSinglePhotoToServer 
} from '../../services/cloudPhotoService';
import { 
  saveReportToRoom, 
  updateSavedReport,
  getSavedReports, 
  findSavedReportForUnit, 
  findSavedReportByModelName,
  deleteSavedReport,
  subscribeReportRoom, 
  ReportTagType, 
  ReportCategoryKey, 
  SavedReport 
} from '../../services/reportRoomStore';
import { MissingDataAlert } from './MissingDataAlert';
import { ReportPreviewModal } from './ReportPreviewModal';
import { 
  downloadFile, 
  shareOrDownloadFile,
  downloadElementAsPdf, 
  generateDocxBlob, 
  generateDocxBlobAsync,
  generateReportBundleZip,
  extractPlaceholdersFromDocx, 
  DocxGenerationResult 
} from '../../utils/docxGenerator';
import { buildNormalizedPhotos } from '../../utils/photoManager';
import { 
  getMachineEndDateTime, 
  getMachineStartDateTime, 
  getTestCompletedDate, 
  getTestCommencedDate 
} from '../../utils/dateFormatter';

interface ProtoReportGeneratorProps {
  masterTemplate: MasterTemplate | null;
  reportType?: string;
  reportTitle?: string;
  initialUnitSource?: 'proto' | 'pp';
  initialSerialNo?: string;
  onNavigateToReportRoom?: () => void;
}

export const ProtoReportGenerator: React.FC<ProtoReportGeneratorProps> = ({ 
  masterTemplate,
  reportType = 'proto',
  reportTitle = 'Customer Simulation Report',
  initialUnitSource,
  initialSerialNo,
  onNavigateToReportRoom
}) => {
  const [unitSource, setUnitSource] = useState<'proto' | 'pp'>(initialUnitSource || 'proto');
  const [unitsList, setUnitsList] = useState<(ProtoUnit | PpUnit)[]>(() => 
    (initialUnitSource === 'pp' ? getPpUnits() : getProtoUnits())
  );
  const [selectedSerialNo, setSelectedSerialNo] = useState<string>(initialSerialNo || '');
  const [selectedUnit, setSelectedUnit] = useState<ProtoUnit | PpUnit | null>(null);
  const [savedReportsList, setSavedReportsList] = useState<SavedReport[]>(() => getSavedReports());

  // Subscribe to real-time report room updates
  useEffect(() => {
    const unsub = subscribeReportRoom((reports) => {
      setSavedReportsList(reports);
    });
    return unsub;
  }, []);

  // Subscribe to real-time cloud server photo uploads (e.g. from Mobile while Report Generator is open on Desktop)
  useEffect(() => {
    if (!selectedUnit?.id) return;
    const unsub = subscribeToUnitPhotos(selectedUnit.id, (realtimePhotos) => {
      if (realtimePhotos && Object.keys(realtimePhotos).length > 0) {
        setPhotos(prev => {
          const merged = { ...prev, ...realtimePhotos };
          return buildNormalizedPhotos(merged).photos;
        });
      }
    });
    return () => {
      try { unsub(); } catch {}
    };
  }, [selectedUnit?.id]);

  // Auto-filled specification state from Database
  const [formData, setFormData] = useState<{
    // General & Identification
    modelName: string;
    sampleType: string;
    reportNo: string;
    station: string;
    requestBy: string;
    testPurpose: string;
    iduSerialNumber: string;
    oduSerialNumber: string;
    requiredHour: string;
    doneHour: string;
    status: string;
    materialCode: string;
    version: string;

    // Dates
    sampleReceivedDate: string;
    testCommencedDate: string;
    testCompletedDate: string;

    // Nameplate & Electrical
    coolingCapacity: string;
    ratedCoolingPower: string;
    ratedPower: string;
    ratedCurrent: string;
    voltage: string;
    refrigerant: string;
    gasQty: string;
    iseer: string;
    powerMode: string;
    gasInjectionVolume: string;
    mainProgramChecksumIdu: string;
    mainProgramChecksumOdu: string;
    eeChecksumIdu: string;
    eeChecksumOdu: string;

    // IDU Parts
    iduMotorSpec: string;
    iduMotorPartCode: string;
    iduMotorSupplier: string;
    iduPcbPartCode: string;
    iduPcbSupplier: string;

    // ODU Parts
    oduMotorSpec: string;
    oduMotorPartCode: string;
    oduMotorSupplier: string;
    oduPcbPartCode: string;
    oduPcbSupplier: string;

    // Compressor & EEV
    compressorSpec: string;
    compressorPartCode: string;
    compressorSupplier: string;
    eevSpec: string;
    eevPartCode: string;
    eevSupplier: string;

    // Conclusions & Remarks
    testConclusion: string;
    remarks: string;
  }>({
    modelName: '',
    sampleType: '',
    reportNo: '',
    station: '',
    requestBy: '',
    testPurpose: '',
    iduSerialNumber: '',
    oduSerialNumber: '',
    requiredHour: '',
    doneHour: '',
    status: '',
    materialCode: '',
    version: '',

    sampleReceivedDate: '',
    testCommencedDate: '',
    testCompletedDate: '',

    coolingCapacity: '',
    ratedCoolingPower: '',
    ratedPower: '',
    ratedCurrent: '',
    voltage: '',
    refrigerant: '',
    gasQty: '',
    iseer: '',
    powerMode: '',
    gasInjectionVolume: '',
    mainProgramChecksumIdu: '',
    mainProgramChecksumOdu: '',
    eeChecksumIdu: '',
    eeChecksumOdu: '',

    iduMotorSpec: '',
    iduMotorPartCode: '',
    iduMotorSupplier: '',
    iduPcbPartCode: '',
    iduPcbSupplier: '',

    oduMotorSpec: '',
    oduMotorPartCode: '',
    oduMotorSupplier: '',
    oduPcbPartCode: '',
    oduPcbSupplier: '',

    compressorSpec: '',
    compressorPartCode: '',
    compressorSupplier: '',
    eevSpec: '',
    eevPartCode: '',
    eevSupplier: '',

    testConclusion: '',
    remarks: ''
  });

  // Active filter category for specifications preview/edit
  const [specsActiveTab, setSpecsActiveTab] = useState<'all' | 'general' | 'dates' | 'nameplate' | 'parts' | 'conclusion'>('all');
  const [specsSearchQuery, setSpecsSearchQuery] = useState<string>('');
  const [isSpecsOpen, setIsSpecsOpen] = useState<boolean>(false);
  const [isPhotosOpen, setIsPhotosOpen] = useState<boolean>(false);

  // Photo URLs map
  const [photos, setPhotos] = useState<Record<string, string>>({
    indoorUnitPhoto: '',
    productPhoto: '',
    packingBoxPhoto: '',
    iduNameplatePhoto: '',
    oduNameplatePhoto: '',
    iduPcbPhoto: '',
    oduPcbPhoto: '',
    motorPhoto: '',
    compressorPhoto: '',
    stickerPhoto: ''
  });

  // Preview Modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [allowRegenerate, setAllowRegenerate] = useState(false);
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('');

  // Circular Percentage Progress state
  const [generationProgress, setGenerationProgress] = useState<{
    percent: number;
    stage: string;
    isComplete: boolean;
  } | null>(null);

  // Available distinct models
  const availableModels = useMemo(() => {
    const models = unitsList.map(u => (u.modelName || '').trim()).filter(Boolean);
    return Array.from(new Set(models));
  }, [unitsList]);

  // Filtered unit list if model filter active
  const filteredUnitsList = useMemo(() => {
    if (!selectedModelFilter) return unitsList;
    return unitsList.filter(u => (u.modelName || '').trim().toLowerCase() === selectedModelFilter.trim().toLowerCase());
  }, [unitsList, selectedModelFilter]);

  // Load unit list and sync preselected unit if passed
  useEffect(() => {
    const currentSource = initialUnitSource || unitSource;
    const list = currentSource === 'pp' ? getPpUnits() : getProtoUnits();
    setUnitSource(currentSource);
    setUnitsList(list);

    if (list.length > 0) {
      let targetUnit = list[0];
      if (initialSerialNo) {
        const found = list.find(u => 
          u.iduSerialNumber === initialSerialNo || 
          u.oduSerialNumber === initialSerialNo || 
          u.id === initialSerialNo ||
          u.modelName === initialSerialNo
        );
        if (found) targetUnit = found;
      }
      const serial = targetUnit.iduSerialNumber || targetUnit.oduSerialNumber || targetUnit.id;
      setSelectedSerialNo(serial);
      if (targetUnit.modelName) {
        setSelectedModelFilter(targetUnit.modelName.trim());
      }
      populateUnitData(targetUnit, currentSource);
    } else {
      setSelectedSerialNo('');
      setSelectedUnit(null);
      setSelectedModelFilter('');
    }
  }, [initialUnitSource, initialSerialNo]);

  // Handler when switching between Proto Unit and PP Unit source
  const handleSwitchUnitSource = (source: 'proto' | 'pp') => {
    setAllowRegenerate(false);
    setUnitSource(source);
    const list = source === 'pp' ? getPpUnits() : getProtoUnits();
    setUnitsList(list);
    if (list.length > 0) {
      const first = list[0];
      const firstSerial = first.iduSerialNumber || first.oduSerialNumber || first.id;
      setSelectedSerialNo(firstSerial);
      if (first.modelName) {
        setSelectedModelFilter(first.modelName.trim());
      }
      populateUnitData(first, source);
    } else {
      setSelectedSerialNo('');
      setSelectedUnit(null);
      setSelectedModelFilter('');
    }
  };

  // Handler when a specific unit is selected by unique ID
  const handleSelectUnitById = (unitId: string) => {
    setAllowRegenerate(false);
    const found = unitsList.find(u => u.id === unitId);
    if (found) {
      setSelectedUnit(found);
      const serial = found.iduSerialNumber || found.oduSerialNumber || found.id;
      setSelectedSerialNo(serial);
      if (found.modelName) {
        setSelectedModelFilter(found.modelName.trim());
      }
      populateUnitData(found, unitSource);
    }
  };

  // Handler when model is selected from the Model dropdown
  const handleSelectModel = (modelName: string) => {
    setSelectedModelFilter(modelName);
    setAllowRegenerate(false);
    if (!modelName) {
      if (unitsList.length > 0) {
        handleSelectUnitById(unitsList[0].id);
      }
      return;
    }
    const matchingUnit = unitsList.find(u => (u.modelName || '').trim().toLowerCase() === modelName.trim().toLowerCase());
    if (matchingUnit) {
      setSelectedUnit(matchingUnit);
      const serial = matchingUnit.iduSerialNumber || matchingUnit.oduSerialNumber || matchingUnit.id;
      setSelectedSerialNo(serial);
      populateUnitData(matchingUnit, unitSource);
    }
  };

  // Handler when Sr.No or search text is entered
  const handleSelectSerial = (serialOrText: string) => {
    setAllowRegenerate(false);
    setSelectedSerialNo(serialOrText);
    const trimmed = serialOrText.trim().toLowerCase();
    if (!trimmed) return;

    const found = unitsList.find(u => 
      u.id.toLowerCase() === trimmed ||
      (u.iduSerialNumber && u.iduSerialNumber.toLowerCase() === trimmed) || 
      (u.oduSerialNumber && u.oduSerialNumber.toLowerCase() === trimmed) || 
      (u.modelName && u.modelName.toLowerCase() === trimmed) ||
      (u.iduSerialNumber && u.iduSerialNumber.toLowerCase().includes(trimmed)) ||
      (u.modelName && u.modelName.toLowerCase().includes(trimmed))
    );

    if (found) {
      setSelectedUnit(found);
      if (found.modelName) {
        setSelectedModelFilter(found.modelName.trim());
      }
      populateUnitData(found, unitSource);
    }
  };

  // Populate data automatically from ProtoUnit or PpUnit object
  const populateUnitData = (unit: ProtoUnit | PpUnit, source: 'proto' | 'pp' = unitSource) => {
    setSelectedUnit(unit);
    const parts = unit.partsInfo || {};
    const nameplate = unit.namePlate || {};
    const report = unit.reportDetails || {};

    const prefix = source === 'pp' ? 'REP-PP' : 'REP-PRT';

    setFormData({
      modelName: unit.modelName || 'NA',
      sampleType: unit.sampleType || report.sampleType || (source === 'pp' ? 'PP Trial' : 'Proto Sample'),
      reportNo: report.reportNo || `${prefix}-${unit.iduSerialNumber || unit.oduSerialNumber || '001'}`,
      station: unit.station || 'Station 01',
      requestBy: unit.requestBy || 'NA',
      testPurpose: unit.testPurpose || 'NA',
      iduSerialNumber: unit.iduSerialNumber || 'NA',
      oduSerialNumber: unit.oduSerialNumber || 'NA',
      requiredHour: String(unit.requiredHour || 72),
      doneHour: String(unit.doneHour || 0),
      status: unit.status || 'live',
      materialCode: (unit as any).materialCode || 'NA',
      version: (unit as any).version || 'NA',

      sampleReceivedDate: getTestCommencedDate(unit),
      testCommencedDate: getTestCommencedDate(unit),
      testCompletedDate: getTestCompletedDate(unit),

      coolingCapacity: nameplate.coolingCapacity || '5200 W (1.5 Ton)',
      ratedCoolingPower: nameplate.ratedCoolingPower || nameplate.ratedPower || '1450 W',
      ratedPower: nameplate.ratedPower || '1450 W',
      ratedCurrent: nameplate.ratedCurrent || '6.5 A',
      voltage: nameplate.voltage || '230V / 50Hz / 1Ph',
      refrigerant: nameplate.refrigerant || 'R32',
      gasQty: nameplate.gasQty || '850 g',
      iseer: nameplate.iseer || '5.20',
      powerMode: nameplate.powerMode || (unit as any).powerMode || (parts as any).powerMode || 'Inverter Dual AC',
      gasInjectionVolume: nameplate.gasInjectionVolume || (unit as any).gasInjectionVolume || (parts as any).gasInjectionVolume || 'NA',
      mainProgramChecksumIdu: nameplate.mainProgramChecksumIdu || 'NA',
      mainProgramChecksumOdu: nameplate.mainProgramChecksumOdu || 'NA',
      eeChecksumIdu: nameplate.eeChecksumIdu || 'NA',
      eeChecksumOdu: nameplate.eeChecksumOdu || 'NA',

      iduMotorSpec: parts.iduMotorSpec || 'BLDC Motor 230V 50Hz',
      iduMotorPartCode: parts.iduMotorPartCode || 'MTR-IDU-2201',
      iduMotorSupplier: parts.iduMotorSupplier || 'Nidec Japan',
      iduPcbPartCode: parts.iduPcbPartCode || 'PCB-IDU-8841',
      iduPcbSupplier: parts.iduPcbSupplier || 'Sanken Electric',

      oduMotorSpec: parts.oduMotorSpec || 'Axial Fan Motor 40W',
      oduMotorPartCode: parts.oduMotorPartCode || 'MTR-ODU-3310',
      oduMotorSupplier: parts.oduMotorSupplier || 'Nidec Japan',
      oduPcbPartCode: parts.oduPcbPartCode || 'PCB-ODU-9902',
      oduPcbSupplier: parts.oduPcbSupplier || 'Delta Electronics',

      compressorSpec: parts.compressorSpec || parts.oduCompressorSpec || (unit as any).compressorSpec || 'Twin Rotary Compressor',
      compressorPartCode: parts.compressorPartCode || parts.oduCompressorPartCode || 'CMP-ODU-7721',
      compressorSupplier: parts.compressorSupplier || parts.oduCompressorSupplier || 'Highly Panasonic',

      eevSpec: parts.eevSpec || 'Stepper Expansion Valve 12V',
      eevPartCode: parts.eevPartCode || parts.oduEevPartCode || 'EEV-ODU-1022',
      eevSupplier: parts.eevSupplier || parts.oduEevSupplier || 'Sanjia EEV',

      testConclusion: unit.remarks || (source === 'pp' ? 'PP unit successfully cleared performance & reliability endurance run without defects.' : 'Proto unit successfully cleared full thermal performance & vibration testing under continuous run.'),
      remarks: unit.remarks || 'No issues observed during inspection.'
    });

    const existingPhotos = unit.photos || {};
    const normalized = buildNormalizedPhotos(existingPhotos);
    setPhotos(normalized.photos);

    if (unit?.id) {
      fetchUnitPhotosFromServer(unit.id).then(serverPhotos => {
        if (serverPhotos && Object.keys(serverPhotos).length > 0) {
          setPhotos(prev => {
            const merged = { ...prev, ...serverPhotos };
            return buildNormalizedPhotos(merged).photos;
          });
        }
      }).catch(() => {});
    }
  };

  // Allow inline upload of photos & persist with unit
  const handlePhotoUpload = async (key: string, file: File) => {
    try {
      const result = await compressImageFile(file);
      const url = result.dataUrl;
      if (!url) return;
      
      // Directly upload to server photo collection so all devices see it immediately
      if (selectedUnit) {
        uploadSinglePhotoToServer(
          selectedUnit.id, 
          unitSource === 'pp' ? 'pp' : 'proto', 
          key, 
          url
        ).catch(() => {});
      }

      setPhotos(prev => {
        const rawUpdated = { ...prev, [key]: url };
        const norm = buildNormalizedPhotos(rawUpdated);
        if (selectedUnit) {
          if (unitSource === 'pp') {
            updatePpUnit(selectedUnit.id, { photos: norm.photos });
          } else {
            updateProtoUnit(selectedUnit.id, { photos: norm.photos });
          }
        }
        return norm.photos;
      });
    } catch (err) {
      console.error('Error compressing photo in Report Generator:', err);
    }
  };

  // Validation calculations
  const missingFields: string[] = [];
  if (!formData.coolingCapacity) missingFields.push('Cooling Capacity');
  if (!formData.compressorPartCode) missingFields.push('Compressor Part Code');
  if (!formData.iduPcbPartCode) missingFields.push('IDU PCB Part Code');
  if (!formData.oduPcbPartCode) missingFields.push('ODU PCB Part Code');

  const missingPhotos: string[] = [];
  if (!photos.productPhoto) missingPhotos.push('Product');
  if (!photos.iduNameplatePhoto) missingPhotos.push('IDU Nameplate');
  if (!photos.oduNameplatePhoto) missingPhotos.push('ODU Nameplate');
  if (!photos.iduPcbPhoto) missingPhotos.push('IDU PCB');
  if (!photos.oduPcbPhoto) missingPhotos.push('ODU PCB');

  // Form is ready if a unit or model name or serial number is selected/provided
  const isFormValid = !!(selectedUnit || formData.modelName || formData.iduSerialNumber || formData.oduSerialNumber);

  // Extract detected placeholders from uploaded Master Template
  const detectedPlaceholders = useMemo(() => {
    const tpl = masterTemplate || getMasterTemplate(reportType);
    if (!tpl?.base64Data) {
      return { textPlaceholders: [], photoPlaceholders: [], allFound: [] };
    }
    return extractPlaceholdersFromDocx(tpl.base64Data);
  }, [masterTemplate?.base64Data, reportType]);

  // Prepare placeholders map for docx & preview
  const dataValuesMap: Record<string, string> = {
    Model_Name: formData.modelName,
    "Model Name": formData.modelName,
    modelName: formData.modelName,
    Sample_Type: formData.sampleType,
    "Sample Type": formData.sampleType,
    "Report No": formData.reportNo,
    Report_No: formData.reportNo,
    reportNo: formData.reportNo,
    IDU_Serial_No: formData.iduSerialNumber,
    ODU_Serial_No: formData.oduSerialNumber,
    IDU_Serial_Number: formData.iduSerialNumber,
    ODU_Serial_Number: formData.oduSerialNumber,
    iduSerialNumber: formData.iduSerialNumber,
    oduSerialNumber: formData.oduSerialNumber,
    Serial_No: formData.iduSerialNumber || formData.oduSerialNumber,
    Sample_Code_IDU: formData.iduSerialNumber,
    Sample_CodeI_ODU: formData.oduSerialNumber,
    Sample_Code_ODU: formData.oduSerialNumber,
    Sample_Code_I_ODU: formData.oduSerialNumber,
    Sample_Code_idu: formData.iduSerialNumber,
    Sample_Code_odu: formData.oduSerialNumber,
    Sample_CodeIDU: formData.iduSerialNumber,
    Sample_CodeODU: formData.oduSerialNumber,
    Station: formData.station,
    Request_By: formData.requestBy,
    Test_Purpose: formData.testPurpose,
    Required_Hours: formData.requiredHour,
    Done_Hours: formData.doneHour,
    Unit_Status: formData.status,
    Material_Code: formData.materialCode,
    Version: formData.version,

    Sample_Received: formData.sampleReceivedDate,
    "Sample Received": formData.sampleReceivedDate,
    sampleReceived: formData.sampleReceivedDate,
    Test_Commenced: formData.testCommencedDate,
    "Test Commenced": formData.testCommencedDate,
    testCommenced: formData.testCommencedDate,
    Start_Date_Time: formData.testCommencedDate,
    "Start Date & Time": formData.testCommencedDate,

    Test_Completed: formData.testCompletedDate,
    "Test Completed": formData.testCompletedDate,
    testCompleted: formData.testCompletedDate,
    Test_Completed_Date: formData.testCompletedDate,
    "Test Completed Date": formData.testCompletedDate,
    End_Date_Time: formData.testCompletedDate,
    "End Date & Time": formData.testCompletedDate,
    endDateTime: formData.testCompletedDate,
    End_Date: formData.testCompletedDate,
    "End Date": formData.testCompletedDate,

    Cooling_capacity: formData.coolingCapacity,
    Cooling_Capacity: formData.coolingCapacity,
    Rated_Cooling_Power: formData.ratedCoolingPower || formData.ratedPower,
    Rated_cooling_power: formData.ratedCoolingPower || formData.ratedPower,
    "Rated Cooling Power": formData.ratedCoolingPower || formData.ratedPower,
    "Rated cooling power": formData.ratedCoolingPower || formData.ratedPower,
    ratedCoolingPower: formData.ratedCoolingPower || formData.ratedPower,
    rated_cooling_power: formData.ratedCoolingPower || formData.ratedPower,
    RatedCoolingPower: formData.ratedCoolingPower || formData.ratedPower,
    Rated_Power: formData.ratedPower,
    Rated_Current: formData.ratedCurrent,
    Voltage: formData.voltage,

    // Power Mode aliases
    Power_mode: formData.powerMode,
    Power_Mode: formData.powerMode,
    power_mode: formData.powerMode,
    powerMode: formData.powerMode,
    "Power Mode": formData.powerMode,
    PowerMode: formData.powerMode,

    Refrigerant: formData.refrigerant,
    Gas_Qty: formData.gasQty,
    ISEER: formData.iseer,

    // Gas Injection Volume aliases
    Gas_injection_Volume: formData.gasInjectionVolume,
    Gas_Injection_Volume: formData.gasInjectionVolume,
    gas_injection_volume: formData.gasInjectionVolume,
    gasInjectionVolume: formData.gasInjectionVolume,
    "Gas Injection Volume": formData.gasInjectionVolume,
    Gas_Injection: formData.gasInjectionVolume,
    GasInjectionVolume: formData.gasInjectionVolume,

    Main_Program_Checksum_IDU: formData.mainProgramChecksumIdu,
    Main_Program_Checksum_ODU: formData.mainProgramChecksumOdu,
    EE_Checksum_IDU: formData.eeChecksumIdu,
    EE_Checksum_ODU: formData.eeChecksumOdu,

    IDU_Motor_Spec: formData.iduMotorSpec,
    IDU_Motor_Part_Code: formData.iduMotorPartCode,
    IDU_Motor_Supplier: formData.iduMotorSupplier,
    IDU_PCB_Part_Code: formData.iduPcbPartCode,
    IDU_PCB_Supplier: formData.iduPcbSupplier,

    ODU_Motor_Spec: formData.oduMotorSpec,
    ODU_Motor_Part_Code: formData.oduMotorPartCode,
    ODU_Motor_Supplier: formData.oduMotorSupplier,
    ODU_PCB_Part_Code: formData.oduPcbPartCode,
    ODU_PCB_Supplier: formData.oduPcbSupplier,

    // Compressor Spec aliases (including spaced underscore {{Compressor _Spec}})
    "Compressor _Spec": formData.compressorSpec,
    Compressor_Spec: formData.compressorSpec,
    Compressor_spec: formData.compressorSpec,
    compressor_spec: formData.compressorSpec,
    "Compressor Spec": formData.compressorSpec,
    compressorSpec: formData.compressorSpec,
    Compressor: formData.compressorSpec,
    Compressor_Specification: formData.compressorSpec,
    Compressor_Part_Code: formData.compressorPartCode,
    Compressor_Supplier: formData.compressorSupplier,

    EEV_Spec: formData.eevSpec,
    EEV_Part_Code: formData.eevPartCode,
    EEV_Supplier: formData.eevSupplier,

    Test_Conclusion: formData.testConclusion,
    Remarks: formData.remarks
  };

  // Target Tag & Category Key
  const targetTag: ReportTagType = (reportType === 'reliability' || reportType === 'ce-report') ? 'C Experience' : 'C Simulation';
  const targetCategoryKey: ReportCategoryKey = targetTag === 'C Experience' ? 'cs-experience' : 'cs-simulation';

  // Check if a report for this model already exists in the Report Room under the target tag
  const existingReportInRoom = useMemo(() => {
    const currentModel = (formData.modelName || selectedUnit?.modelName || '').trim();
    // 1. Strict model check: As per requirement, if report for this model is in Report Room, cannot regenerate
    if (currentModel && currentModel !== 'NA' && currentModel !== '') {
      const byModel = findSavedReportByModelName(currentModel, targetTag);
      if (byModel) return byModel;
    }
    // 2. Also check by unit / serial
    if (!selectedSerialNo && !selectedUnit) return null;
    return findSavedReportForUnit({
      id: selectedUnit?.id,
      serialNo: selectedSerialNo,
      iduSerialNumber: (selectedUnit as any)?.iduSerialNumber,
      oduSerialNumber: (selectedUnit as any)?.oduSerialNumber,
      modelName: currentModel
    }, targetTag);
  }, [selectedSerialNo, selectedUnit, formData.modelName, targetTag, savedReportsList]);

  // Saved to Report Room feedback banner state
  const [savedBanner, setSavedBanner] = useState<{ show: boolean; reportNo: string; tag: ReportTagType } | null>(null);

  // Store completed download files for direct user download buttons
  const [completedDownloads, setCompletedDownloads] = useState<{
    docxBlob?: Blob;
    docxName?: string;
  } | null>(null);

  const saveCurrentReportToRoom = () => {
    const reportDataPayload = {
      reportType: targetCategoryKey,
      tag: targetTag,
      title: `${targetTag} Report - ${formData.modelName || 'Unit'}`,
      reportNo: formData.reportNo || `REP-${targetTag === 'C Experience' ? 'CE' : 'CS'}-${Date.now()}`,
      modelName: formData.modelName || 'Unit',
      unitSource: unitSource,
      serialNo: selectedSerialNo || selectedUnit?.iduSerialNumber || selectedUnit?.oduSerialNumber || 'N/A',
      station: selectedUnit?.station || 'Station 01',
      requestBy: selectedUnit?.requestBy || 'Indrajit',
      generatedDate: new Date().toISOString().split('T')[0],
      specs: {
        coolingCapacity: formData.coolingCapacity,
        ratedCoolingPower: formData.ratedCoolingPower,
        ratedPower: formData.ratedPower,
        ratedCurrent: formData.ratedCurrent,
        voltage: formData.voltage,
        powerMode: formData.powerMode,
        refrigerant: formData.refrigerant,
        iseer: formData.iseer,
        iduMotorSpec: formData.iduMotorSpec,
        iduMotorPartCode: formData.iduMotorPartCode,
        iduMotorSupplier: formData.iduMotorSupplier,
        iduPcbPartCode: formData.iduPcbPartCode,
        iduPcbSupplier: formData.iduPcbSupplier,
        oduMotorSpec: formData.oduMotorSpec,
        oduMotorPartCode: formData.oduMotorPartCode,
        oduMotorSupplier: formData.oduMotorSupplier,
        oduPcbPartCode: formData.oduPcbPartCode,
        oduPcbSupplier: formData.oduPcbSupplier,
        compressorSpec: formData.compressorSpec,
        compressorPartCode: formData.compressorPartCode,
        compressorSupplier: formData.compressorSupplier,
        eevSpec: formData.eevSpec,
        eevPartCode: formData.eevPartCode,
        eevSupplier: formData.eevSupplier,
        sampleReceivedDate: formData.sampleReceivedDate,
        testCommencedDate: formData.testCommencedDate,
        testCompletedDate: formData.testCompletedDate,
        testConclusion: formData.testConclusion
      },
      dataValuesMap,
      photos,
      templateName: masterTemplate?.fileName || `${targetTag} Template`,
      status: 'Generated' as const,
      remarks: formData.testConclusion || 'Generated via LLT Lab System'
    };

    if (existingReportInRoom) {
      const updated = updateSavedReport(existingReportInRoom.id, reportDataPayload);
      setSavedBanner({
        show: true,
        reportNo: existingReportInRoom.reportNo,
        tag: targetTag
      });
      return updated || existingReportInRoom;
    }

    const saved = saveReportToRoom(reportDataPayload);

    setSavedBanner({
      show: true,
      reportNo: saved.reportNo,
      tag: targetTag
    });

    return saved;
  };

  const handleGenerateDocxDownload = async () => {
    if (existingReportInRoom) {
      alert(`⚠️ Model "${existingReportInRoom.modelName}" ka report pehle se Report Room me maujood hai (Report #${existingReportInRoom.reportNo}).\n\nNiyam anusar jab tak Report Room me is Model ka report hai, dubara report generate nahi kiya ja sakta. Agar naya report generate karna chahte hain to pehle Report Room se purana report delete karein.`);
      return;
    }

    const tpl = masterTemplate || getMasterTemplate(reportType);
    if (!tpl?.base64Data) {
      alert("Master Report Template is not available. Please upload a template or reload.");
      return;
    }

    // Auto-save to Report Room under respective tag
    saveCurrentReportToRoom();

    const docxBlob = await generateDocxBlobAsync(tpl.base64Data, dataValuesMap, photos);
    const safeName = (formData.modelName || 'Unit').replace(/[\s/\\?%*:|"<>]+/g, '_');
    const safeTitle = reportTitle.replace(/[\s/\\?%*:|"<>]+/g, '_');
    const safeReportNo = (formData.reportNo || 'Draft').replace(/[\s/\\?%*:|"<>]+/g, '_');
    const fileName = `${safeTitle}_${safeName}_${safeReportNo}.docx`;
    
    downloadFile(docxBlob, fileName);
    setCompletedDownloads({
      docxBlob,
      docxName: fileName
    });
  };

  const handleDeleteExistingReportFromRoom = () => {
    if (!existingReportInRoom) return;
    const confirmed = window.confirm(
      `Kya aap Model "${existingReportInRoom.modelName}" ka Report #${existingReportInRoom.reportNo} Report Room se delete karna chahte hain?\n\nDelete karne ke baad aap is model ka naya report generate kar sakenge.`
    );
    if (confirmed) {
      deleteSavedReport(existingReportInRoom.id);
    }
  };

  const handleGenerateReportAndNavigate = async () => {
    if (existingReportInRoom) {
      alert(`⚠️ Model "${existingReportInRoom.modelName}" ka report pehle se Report Room me maujood hai (Report #${existingReportInRoom.reportNo} under ${existingReportInRoom.tag}).\n\nNiyam: Jab tak Report Room me is Model ka report maujood hai, dubara naya report generate nahi kiya ja sakta.\n\nAgar aapko naya report generate karna hai to pehle Report Room me jakar is model ka purana report delete karein.`);
      return;
    }

    const tpl = masterTemplate || getMasterTemplate(reportType);
    if (!tpl?.base64Data) {
      alert("Master Report Template is not available. Please upload a template or reload.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress({ percent: 20, stage: 'Reading unit parameters & photos...', isComplete: false });
    await new Promise(r => setTimeout(r, 60));

    try {
      // Step 1: Mapping & Preparing Data
      setGenerationProgress({ percent: 45, stage: 'Mapping placeholders to Master Template...', isComplete: false });
      await new Promise(r => setTimeout(r, 60));
      
      // Step 2: Auto-save or update in Report Room
      saveCurrentReportToRoom();
      setGenerationProgress({ percent: 70, stage: 'Archiving report to Report Room...', isComplete: false });
      await new Promise(r => setTimeout(r, 60));

      // Step 3: Fast non-blocking generation of DOCX
      setGenerationProgress({ percent: 90, stage: 'Embedding photos & compiling DOCX report...', isComplete: false });
      await new Promise(r => setTimeout(r, 40));
      
      const safeName = (formData.modelName || 'Unit').replace(/[\s/\\?%*:|"<>]+/g, '_');
      const safeTitle = reportTitle.replace(/[\s/\\?%*:|"<>]+/g, '_');
      const safeReportNo = (formData.reportNo || 'Draft').replace(/[\s/\\?%*:|"<>]+/g, '_');
      const docxFileName = `${safeTitle}_${safeName}_${safeReportNo}.docx`;

      // Generate DOCX blob asynchronously without blocking main thread
      const docxBlob = await generateDocxBlobAsync(tpl.base64Data, dataValuesMap, photos);

      // Step 4: Finalize & Trigger Downloads
      setGenerationProgress({ percent: 100, stage: 'Report generated & saved to Report Room successfully!', isComplete: true });
      
      setCompletedDownloads({
        docxBlob,
        docxName: docxFileName
      });

      // Immediate browser download trigger
      downloadFile(docxBlob, docxFileName);

    } catch (err) {
      console.error("Failed to generate Report:", err);
      // Fallback: direct docx download
      setGenerationProgress({ percent: 90, stage: 'Compiling direct DOCX export...', isComplete: false });
      await handleGenerateDocxDownload();
      setGenerationProgress({ percent: 100, stage: 'DOCX report generated successfully!', isComplete: true });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-950 text-cyan-400 border border-cyan-800">
            {unitSource === 'pp' ? <Layers className="w-6 h-6" /> : <Cpu className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-wide">
              Generate {reportTitle}
            </h2>
            {/* Unit Source Selector Buttons */}
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleSwitchUnitSource('proto')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  unitSource === 'proto'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400 ring-2 ring-blue-500/30'
                    : 'bg-slate-800/90 text-slate-400 hover:text-white border border-slate-700/80 hover:bg-slate-700'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Proto Unit</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchUnitSource('pp')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  unitSource === 'pp'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400 ring-2 ring-cyan-500/30'
                    : 'bg-slate-800/90 text-slate-400 hover:text-white border border-slate-700/80 hover:bg-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>PP Unit</span>
              </button>
            </div>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono font-bold self-start sm:self-center">
          {unitSource === 'pp' ? 'PP UNIT ENGINE' : 'PROTO UNIT ENGINE'}
        </span>
      </div>

      {/* 1. Dedicated Model & Unit Selector Section */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
            <Search className="w-4 h-4 text-cyan-400" />
            <span>{unitSource === 'pp' ? 'PP Model & Unit Selector' : 'Proto Model & Unit Selector'}</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
              {unitsList.length} Units ({availableModels.length} Models)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* A. Dedicated Model Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Select Model ({availableModels.length})
            </label>
            <select
              value={selectedModelFilter}
              onChange={(e) => handleSelectModel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="">-- All Models ({availableModels.length}) --</option>
              {availableModels.map((model) => {
                const rep = findSavedReportByModelName(model, targetTag);
                return (
                  <option key={model} value={model}>
                    {model} {rep ? `[🔒 Generated in Room: #${rep.reportNo}]` : `[✅ Ready to Generate]`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* B. Specific Unit / Sr.No Dropdown (Keyed by unique unit.id) */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Select Unit / Sr.No
            </label>
            <select
              value={selectedUnit?.id || ''}
              onChange={(e) => handleSelectUnitById(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            >
              {filteredUnitsList.length === 0 ? (
                <option value="">No {unitSource === 'pp' ? 'PP' : 'Proto'} Units found</option>
              ) : (
                filteredUnitsList.map((unit) => {
                  const serial = unit.iduSerialNumber || unit.oduSerialNumber || unit.id;
                  const unitTypeTag = (unit as any).unitType ? ` [${(unit as any).unitType}]` : '';
                  const repInRoom = findSavedReportByModelName(unit.modelName, targetTag) || findSavedReportForUnit({
                    id: unit.id,
                    serialNo: serial,
                    iduSerialNumber: unit.iduSerialNumber,
                    oduSerialNumber: unit.oduSerialNumber,
                    modelName: unit.modelName
                  }, targetTag);

                  const statusLabel = repInRoom 
                    ? ` [🔒 REPORT IN ROOM: #${repInRoom.reportNo} - BLOCKED]` 
                    : ' [✅ READY TO GENERATE]';

                  return (
                    <option key={unit.id} value={unit.id}>
                      {unit.modelName} — Sr: {serial}{unitTypeTag} ({unit.station || 'Station 01'}){statusLabel}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* C. Quick Search Input */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Search by Model / Sr.No
            </label>
            <input
              type="text"
              placeholder={unitSource === 'pp' ? "Search Model / PP Sr.No..." : "Search Model / Proto Sr.No..."}
              value={selectedSerialNo}
              onChange={(e) => handleSelectSerial(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Existing Report Room Banner (Duplicate Report Prevention & Quick Actions) */}
      {existingReportInRoom && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-950 border-2 border-amber-500/60 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-800/40 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-white">
                    Report Already Generated — Duplicate Report Blocked
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                    Report #{existingReportInRoom.reportNo}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    Tag: {existingReportInRoom.tag}
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 mt-0.5">
                  Model <strong>{existingReportInRoom.modelName}</strong> ka report pehle se <strong>Report Room</strong> me saved hai. Niyam: Jab tak Report Room me is Model ka report hai, dubara report generate nahi hoga.
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
              {onNavigateToReportRoom && (
                <button
                  type="button"
                  onClick={onNavigateToReportRoom}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Open in Report Room</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>View Report</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteExistingReportFromRoom}
                className="px-3.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/60 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
                title="Report Room se purana report delete karein taaki naya report generate ho sake"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete to Re-generate</span>
              </button>
            </div>
          </div>

          {/* Detailed Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap font-mono text-[11px]">
                <span>Archived Model: <strong className="text-white">{existingReportInRoom.modelName}</strong></span>
                <span>•</span>
                <span>Sr.No: <strong className="text-cyan-300">{existingReportInRoom.serialNo}</strong></span>
                <span>•</span>
                <span>Generated Date: <strong className="text-slate-300">{existingReportInRoom.generatedDate}</strong></span>
              </div>
              <p className="text-[11px] text-slate-400">
                Note: Jin model ka report generate nahi hua hai, unka report generate hoga. Is model ka report dubara generate karne ke liye pehle Report Room se delete karein.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Validation & Live Mapping Status (Requirement 10) */}
      <MissingDataAlert
        missingFields={missingFields}
        missingPhotos={missingPhotos}
        isTemplateMissing={!masterTemplate}
        isUnitMissing={!selectedUnit}
        detectedTextPlaceholders={detectedPlaceholders.textPlaceholders}
        detectedPhotoPlaceholders={detectedPlaceholders.photoPlaceholders}
        dataValuesMap={dataValuesMap}
        photosMap={photos}
      />

      {/* 3. Automatic Fetched Fields Preview & Full Editor (Dropdown / Undrop Accordion) */}
      <div className="rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl overflow-hidden transition-all duration-300">
        {/* Accordion Header / Toggle Bar */}
        <div 
          onClick={() => setIsSpecsOpen(!isSpecsOpen)}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 cursor-pointer select-none bg-slate-900/40 hover:bg-slate-900/80 transition-colors border-b border-slate-800/80"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white">
                  Fetched Specifications (Auto-Mapped Database Values)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  45 Parameters
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSpecsOpen 
                  ? 'Sabhi form text values yaha live show ho rahe hain. Report generate karne se pehle koi bhi change yahi se kiya ja sakta hai.'
                  : `Model: ${formData.modelName || 'NA'} | Station: ${formData.station || 'NA'} | IDU: ${formData.iduSerialNumber || 'NA'}`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
            {isSpecsOpen && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search parameter..."
                  value={specsSearchQuery}
                  onChange={(e) => setSpecsSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 w-36 sm:w-48"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsSpecsOpen(!isSpecsOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isSpecsOpen
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-900/30'
              }`}
            >
              {isSpecsOpen ? (
                <>
                  <ChevronUp className="w-4 h-4 text-cyan-400" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Edit Specifications</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dropdown Content Area */}
        {isSpecsOpen && (
          <div className="p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-200">
            {/* Category Navigation Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {[
                { id: 'all', label: 'All Values (45)' },
                { id: 'general', label: 'General & IDs' },
                { id: 'dates', label: 'Dates & Timeline' },
                { id: 'nameplate', label: 'Nameplate & Ratings' },
                { id: 'parts', label: 'Parts & Components' },
                { id: 'conclusion', label: 'Remarks & Conclusion' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSpecsActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    specsActiveTab === tab.id
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form Fields Grid by Groups */}
            <div className="space-y-4 pt-1">
          {/* SECTION A: General & Identification */}
          {(specsActiveTab === 'all' || specsActiveTab === 'general') && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  1. Machine Identification & General Info
                </span>
                <span className="text-[10px] text-slate-500 font-mono">11 Parameters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Model Name</span>
                  <input
                    type="text"
                    value={formData.modelName}
                    onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Report Number</span>
                  <input
                    type="text"
                    value={formData.reportNo}
                    onChange={(e) => setFormData({ ...formData, reportNo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-cyan-300 font-mono font-bold text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Sample Type</span>
                  <input
                    type="text"
                    value={formData.sampleType}
                    onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                    placeholder="e.g. Proto / PP / Pilot"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-cyan-200 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Testing Station</span>
                  <input
                    type="text"
                    value={formData.station}
                    onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">IDU Serial Number</span>
                  <input
                    type="text"
                    value={formData.iduSerialNumber}
                    onChange={(e) => setFormData({ ...formData, iduSerialNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">ODU Serial Number</span>
                  <input
                    type="text"
                    value={formData.oduSerialNumber}
                    onChange={(e) => setFormData({ ...formData, oduSerialNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Requested By</span>
                  <input
                    type="text"
                    value={formData.requestBy}
                    onChange={(e) => setFormData({ ...formData, requestBy: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Test Purpose</span>
                  <input
                    type="text"
                    value={formData.testPurpose}
                    onChange={(e) => setFormData({ ...formData, testPurpose: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Required Hours</span>
                  <input
                    type="text"
                    value={formData.requiredHour}
                    onChange={(e) => setFormData({ ...formData, requiredHour: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Done Hours</span>
                  <input
                    type="text"
                    value={formData.doneHour}
                    onChange={(e) => setFormData({ ...formData, doneHour: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-400 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Material Code</span>
                  <input
                    type="text"
                    value={formData.materialCode}
                    onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Version / Revision</span>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION B: Dates & Schedule */}
          {(specsActiveTab === 'all' || specsActiveTab === 'dates') && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  2. Testing Dates & Timeline
                </span>
                <span className="text-[10px] text-slate-500 font-mono">3 Parameters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Sample Received Date</span>
                  <input
                    type="text"
                    value={formData.sampleReceivedDate}
                    onChange={(e) => setFormData({ ...formData, sampleReceivedDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Test Commenced Date</span>
                  <input
                    type="text"
                    value={formData.testCommencedDate}
                    onChange={(e) => setFormData({ ...formData, testCommencedDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Test Completed Date</span>
                  <input
                    type="text"
                    value={formData.testCompletedDate}
                    onChange={(e) => setFormData({ ...formData, testCompletedDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION C: Nameplate Specifications & Electrical Parameters */}
          {(specsActiveTab === 'all' || specsActiveTab === 'nameplate') && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  3. Nameplate Specifications & Ratings
                </span>
                <span className="text-[10px] text-slate-500 font-mono">14 Parameters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Cooling Capacity</span>
                  <input
                    type="text"
                    value={formData.coolingCapacity}
                    onChange={(e) => setFormData({ ...formData, coolingCapacity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-cyan-300 font-bold text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Rated Cooling Power</span>
                    <span className="text-[9px] font-mono text-cyan-400">{"{{Rated_Cooling_Power}}"}</span>
                  </div>
                  <input
                    type="text"
                    value={formData.ratedCoolingPower}
                    onChange={(e) => setFormData({ ...formData, ratedCoolingPower: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300 font-bold text-xs focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. 1450 W"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Rated Power</span>
                  <input
                    type="text"
                    value={formData.ratedPower}
                    onChange={(e) => setFormData({ ...formData, ratedPower: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Rated Current</span>
                  <input
                    type="text"
                    value={formData.ratedCurrent}
                    onChange={(e) => setFormData({ ...formData, ratedCurrent: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Voltage / Supply</span>
                  <input
                    type="text"
                    value={formData.voltage}
                    onChange={(e) => setFormData({ ...formData, voltage: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Refrigerant</span>
                  <input
                    type="text"
                    value={formData.refrigerant}
                    onChange={(e) => setFormData({ ...formData, refrigerant: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Gas Quantity</span>
                  <input
                    type="text"
                    value={formData.gasQty}
                    onChange={(e) => setFormData({ ...formData, gasQty: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">ISEER / Rating</span>
                  <input
                    type="text"
                    value={formData.iseer}
                    onChange={(e) => setFormData({ ...formData, iseer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-400 font-bold text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Gas Injection Vol</span>
                    <span className="text-[9px] font-mono text-cyan-400">{"{{Gas_injection_Volume}}"}</span>
                  </div>
                  <input
                    type="text"
                    value={formData.gasInjectionVolume}
                    onChange={(e) => setFormData({ ...formData, gasInjectionVolume: e.target.value })}
                    placeholder="e.g. 850g"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">IDU Main Checksum</span>
                  <input
                    type="text"
                    value={formData.mainProgramChecksumIdu}
                    onChange={(e) => setFormData({ ...formData, mainProgramChecksumIdu: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">ODU Main Checksum</span>
                  <input
                    type="text"
                    value={formData.mainProgramChecksumOdu}
                    onChange={(e) => setFormData({ ...formData, mainProgramChecksumOdu: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">IDU EE Checksum</span>
                  <input
                    type="text"
                    value={formData.eeChecksumIdu}
                    onChange={(e) => setFormData({ ...formData, eeChecksumIdu: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-indigo-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">ODU EE Checksum</span>
                  <input
                    type="text"
                    value={formData.eeChecksumOdu}
                    onChange={(e) => setFormData({ ...formData, eeChecksumOdu: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-indigo-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION D: Parts & Components Detailed Specifications */}
          {(specsActiveTab === 'all' || specsActiveTab === 'parts') && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  4. Critical Parts & Components (Spec, Part Code, Supplier)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">16 Parameters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {/* IDU Motor */}
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-cyan-300 uppercase block">IDU Fan Motor</span>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Specification:</span>
                      <input
                        type="text"
                        value={formData.iduMotorSpec}
                        onChange={(e) => setFormData({ ...formData, iduMotorSpec: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Part Code:</span>
                      <input
                        type="text"
                        value={formData.iduMotorPartCode}
                        onChange={(e) => setFormData({ ...formData, iduMotorPartCode: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Supplier:</span>
                      <input
                        type="text"
                        value={formData.iduMotorSupplier}
                        onChange={(e) => setFormData({ ...formData, iduMotorSupplier: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* IDU PCB */}
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-cyan-300 uppercase block">IDU Main PCB</span>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Part Code:</span>
                      <input
                        type="text"
                        value={formData.iduPcbPartCode}
                        onChange={(e) => setFormData({ ...formData, iduPcbPartCode: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Supplier:</span>
                      <input
                        type="text"
                        value={formData.iduPcbSupplier}
                        onChange={(e) => setFormData({ ...formData, iduPcbSupplier: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* ODU Motor */}
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase block">ODU Fan Motor</span>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Specification:</span>
                      <input
                        type="text"
                        value={formData.oduMotorSpec}
                        onChange={(e) => setFormData({ ...formData, oduMotorSpec: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Part Code:</span>
                      <input
                        type="text"
                        value={formData.oduMotorPartCode}
                        onChange={(e) => setFormData({ ...formData, oduMotorPartCode: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Supplier:</span>
                      <input
                        type="text"
                        value={formData.oduMotorSupplier}
                        onChange={(e) => setFormData({ ...formData, oduMotorSupplier: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* ODU PCB */}
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase block">ODU Inverter PCB</span>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Part Code:</span>
                      <input
                        type="text"
                        value={formData.oduPcbPartCode}
                        onChange={(e) => setFormData({ ...formData, oduPcbPartCode: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Supplier:</span>
                      <input
                        type="text"
                        value={formData.oduPcbSupplier}
                        onChange={(e) => setFormData({ ...formData, oduPcbSupplier: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Compressor */}
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-300 uppercase block">Compressor</span>
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-400 uppercase">Specification:</span>
                        <span className="text-[9px] font-mono text-cyan-400">{"{{Compressor_Spec}}"}</span>
                      </div>
                      <input
                        type="text"
                        value={formData.compressorSpec}
                        onChange={(e) => setFormData({ ...formData, compressorSpec: e.target.value })}
                        placeholder="e.g. Twin Rotary Compressor"
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Part Code:</span>
                      <input
                        type="text"
                        value={formData.compressorPartCode}
                        onChange={(e) => setFormData({ ...formData, compressorPartCode: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-cyan-300 font-bold text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Supplier:</span>
                      <input
                        type="text"
                        value={formData.compressorSupplier}
                        onChange={(e) => setFormData({ ...formData, compressorSupplier: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* EEV */}
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-300 uppercase block">Electronic Expansion Valve (EEV)</span>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Specification:</span>
                      <input
                        type="text"
                        value={formData.eevSpec}
                        onChange={(e) => setFormData({ ...formData, eevSpec: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Part Code:</span>
                      <input
                        type="text"
                        value={formData.eevPartCode}
                        onChange={(e) => setFormData({ ...formData, eevPartCode: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase">Supplier:</span>
                      <input
                        type="text"
                        value={formData.eevSupplier}
                        onChange={(e) => setFormData({ ...formData, eevSupplier: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION E: Conclusions & Remarks */}
          {(specsActiveTab === 'all' || specsActiveTab === 'conclusion') && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  5. Conclusions, Remarks & Observation Notes
                </span>
                <span className="text-[10px] text-slate-500 font-mono">2 Parameters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Official Test Conclusion</span>
                  <textarea
                    rows={3}
                    value={formData.testConclusion}
                    onChange={(e) => setFormData({ ...formData, testConclusion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-300 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">General Lab Remarks / Notes</span>
                  <textarea
                    rows={3}
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Photo Upload Section (11 Standard Fields) */}
      <PhotoUploadSection
        photos={photos}
        unitId={selectedUnit?.id}
        onChange={(updated) => {
          setPhotos(updated as ProtoUnitPhotos);
          if (selectedUnit) {
            if (unitSource === 'pp') {
              updatePpUnit(selectedUnit.id, { photos: updated as any });
            } else {
              updateProtoUnit(selectedUnit.id, { photos: updated as any });
            }
          }
        }}
        title="Report Inspection Photos"
      />

      {/* 5. Action Buttons, Alerts & Download Options */}
      {savedBanner?.show && !existingReportInRoom && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-950 border border-emerald-500/60 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-extrabold text-white">
                  Report Saved to Report Room!
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Tag: {savedBanner.tag}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Report <strong className="font-mono text-cyan-300">#{savedBanner.reportNo}</strong> has been archived under <span className="font-bold text-emerald-400">{savedBanner.tag}</span> in the Report Room.
              </p>
            </div>
          </div>

          {onNavigateToReportRoom && (
            <button
              type="button"
              onClick={onNavigateToReportRoom}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
            >
              <span>Open Report Room</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Bottom Action Controls */}
      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-4 pt-4">
        <div className="text-xs text-slate-400">
          Status:{' '}
          {existingReportInRoom ? (
            <span className="text-cyan-400 font-bold inline-flex items-center gap-1.5">
              <FolderArchive className="w-3.5 h-3.5 text-cyan-400" />
              Archived in Report Room (Report #{existingReportInRoom.reportNo})
            </span>
          ) : (
            <strong className={isFormValid ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {isFormValid ? 'Ready to Generate & Download DOCX (Auto-Mapped to Template)' : 'Please select a unit to generate report'}
            </strong>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs sm:text-sm border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>Preview</span>
          </button>

          {/* Primary Generate Report Button or Locked State when already in Report Room */}
          {existingReportInRoom ? (
            <div className="flex items-center gap-2">
              {onNavigateToReportRoom && (
                <button
                  type="button"
                  onClick={onNavigateToReportRoom}
                  className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
                >
                  <FolderArchive className="w-4 h-4 text-cyan-400" />
                  <span>Open Report Room</span>
                </button>
              )}
              <button
                type="button"
                disabled={true}
                className="flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold text-xs sm:text-sm bg-slate-900 text-amber-300 border-2 border-amber-600/60 cursor-not-allowed opacity-90 flex items-center justify-center gap-2.5 shadow-lg shadow-amber-950/30"
                title="Is Model ka report pehle se Report Room me maujood hai. Dubara generate karne ke liye pehle Report Room se purana report delete karein."
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Report Generated (#{existingReportInRoom.reportNo})</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!isFormValid || isGenerating}
              onClick={handleGenerateReportAndNavigate}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-95 ${
                isFormValid && !isGenerating
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-950/80 ring-2 ring-cyan-400/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating DOCX Report...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span>Generate Report (DOCX)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Circular Percentage Progress Overlay */}
      {generationProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 p-6 sm:p-8 flex flex-col items-center text-center space-y-5">
            {/* SVG Circular Progress Bar */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {/* Background Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  className="text-slate-800"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                {/* Progress Ring with Glow */}
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  className="text-cyan-400 transition-all duration-300 ease-out drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - generationProgress.percent / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>

              {/* Center Metric */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {generationProgress.isComplete ? (
                  <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-in zoom-in-50 duration-200">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                ) : (
                  <>
                    <span className="text-3xl font-black text-white font-mono tracking-tight">
                      {generationProgress.percent}%
                    </span>
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mt-0.5">
                      Processing
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Stage Title & Description */}
            <div className="space-y-1.5 w-full">
              <h3 className="text-base font-bold text-white">
                {generationProgress.isComplete ? '✨ Report Generated!' : '⚡ Generating DOCX Report...'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed min-h-[36px] flex items-center justify-center px-2">
                {generationProgress.stage}
              </p>
            </div>

            {/* Micro Linear Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${generationProgress.percent}%` }}
              />
            </div>

            {generationProgress.isComplete ? (
              <div className="w-full space-y-2.5 pt-1 animate-in fade-in-50 duration-300">
                {completedDownloads?.docxBlob && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        downloadFile(completedDownloads.docxBlob!, completedDownloads.docxName || 'Test_Report.docx');
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer active:scale-95 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download DOCX Report</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await shareOrDownloadFile(completedDownloads.docxBlob!, completedDownloads.docxName || 'Test_Report.docx', reportTitle);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                        title="Share or Save to Mobile Files"
                      >
                        <Share2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Share / Save</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGenerationProgress(null);
                          setIsPreviewOpen(true);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                        title="Preview Report & Download PDF"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Preview / PDF</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {onNavigateToReportRoom && (
                    <button
                      type="button"
                      onClick={() => {
                        setGenerationProgress(null);
                        onNavigateToReportRoom();
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                      <FolderArchive className="w-3.5 h-3.5 text-cyan-400" />
                      <span>View in Report Room</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setGenerationProgress(null)}
                    className="px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Archiving to Report Room &amp; downloading DOCX...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Report Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        masterTemplate={masterTemplate}
        reportTitle={reportTitle}
        unitData={dataValuesMap}
        photoUrls={photos}
      />
    </div>
  );
};
