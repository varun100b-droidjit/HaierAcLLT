import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cpu, 
  RefreshCw, 
  Upload, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Settings, 
  Clock, 
  User, 
  Tag, 
  Save,
  ImageIcon,
  Box,
  Zap,
  Sliders,
  Calendar
} from 'lucide-react';
import { PpUnit, ProtoUnitParts, ProtoUnitPhotos, ReportDetails, NamePlateDetails } from '../../types';
import { addPpUnit, updatePpUnit, generatePp5DigitSerial, getPpUnits, isModelListEntry } from '../../services/ppUnitStore';
import { ALL_STATIONS, getOccupiedStations } from '../../utils/stationManager';
import { PhotoUploadSection } from '../Common/PhotoUploadSection';
import { compressImageFile } from '../../services/photoSettingsStore';
import { PHOTO_FIELD_DEFINITIONS } from '../../utils/photoManager';
import { PICTURE_NOT_AVAILABLE_IMAGE } from '../../utils/placeholderImage';

interface AddPpUnitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (status?: 'live' | 'stopped' | 'finished') => void;
  initialUnitType?: 'IDU' | 'ODU' | 'BOTH';
  initialUnit?: PpUnit | null;
}

export const AddPpUnitDialog: React.FC<AddPpUnitDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialUnitType = 'BOTH',
  initialUnit,
}) => {
  // Basic Information
  const [modelName, setModelName] = useState('');
  const [sampleType, setSampleType] = useState('');
  const [unitType, setUnitType] = useState<'IDU' | 'ODU' | 'BOTH'>(initialUnitType);
  const [materialCode, setMaterialCode] = useState('');
  const [version, setVersion] = useState('V1.0');
  const [station, setStation] = useState('');
  const [iduSerialNumber, setIduSerialNumber] = useState('');
  const [oduSerialNumber, setOduSerialNumber] = useState('');
  const [requestBy, setRequestBy] = useState('');
  const [testPurpose, setTestPurpose] = useState('');
  const [requiredHour, setRequiredHour] = useState<string>('72');
  const [doneHour, setDoneHour] = useState<string>('0');

  // Report Details
  const [reportNo, setReportNo] = useState('');
  const [sampleReceived, setSampleReceived] = useState('');
  const [testCommenced, setTestCommenced] = useState('');
  const [testCompleted, setTestCompleted] = useState('');

  // Name Plate Details
  const [coolingCapacity, setCoolingCapacity] = useState('');
  const [ratedPower, setRatedPower] = useState('');
  const [ratedCurrent, setRatedCurrent] = useState('');
  const [voltage, setVoltage] = useState('');
  const [iseer, setIseer] = useState('');
  const [gasQty, setGasQty] = useState('');
  const [mainProgramChecksumIdu, setMainProgramChecksumIdu] = useState('');
  const [mainProgramChecksumOdu, setMainProgramChecksumOdu] = useState('');
  const [gasInjectionVolume, setGasInjectionVolume] = useState('');
  const [powerMode, setPowerMode] = useState('');
  const [eeChecksumIdu, setEeChecksumIdu] = useState('');
  const [eeChecksumOdu, setEeChecksumOdu] = useState('');
  const [refrigerant, setRefrigerant] = useState('');
  const [fourWaySwing, setFourWaySwing] = useState('');
  const [rpm, setRpm] = useState('');

  // IDU Details
  const [iduMotorSpec, setIduMotorSpec] = useState('');
  const [iduMotorPartCode, setIduMotorPartCode] = useState('');
  const [iduMotorSupplier, setIduMotorSupplier] = useState('');
  const [iduPcbPartCode, setIduPcbPartCode] = useState('');
  const [iduPcbSupplier, setIduPcbSupplier] = useState('');

  // ODU Details
  const [oduMotorSpec, setOduMotorSpec] = useState('');
  const [oduMotorPartCode, setOduMotorPartCode] = useState('');
  const [oduMotorSupplier, setOduMotorSupplier] = useState('');
  const [oduPcbPartCode, setOduPcbPartCode] = useState('');
  const [oduPcbSupplier, setOduPcbSupplier] = useState('');

  // Compressor Details
  const [compressorSpec, setCompressorSpec] = useState('');
  const [compressorPartCode, setCompressorPartCode] = useState('');
  const [compressorSupplier, setCompressorSupplier] = useState('');

  // EEV Details
  const [eevSpec, setEevSpec] = useState('');
  const [eevPartCode, setEevPartCode] = useState('');
  const [eevSupplier, setEevSupplier] = useState('');

  // Parts Picture Upload
  const [photos, setPhotos] = useState<ProtoUnitPhotos>({
    indoorUnitPhoto: '',
    productPhoto: '',
    packingBoxPhoto: '',
    iduNameplatePhoto: '',
    oduNameplatePhoto: '',
    iduPcbPhoto: '',
    iduMotorPhoto: '',
    oduPcbPhoto: '',
    oduMotorPhoto: '',
    oduCompressorPhoto: '',
    oduEevPhoto: '',
    stickerPhoto: '',
  });

  const [remarks, setRemarks] = useState('');

  // Error validation states
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [liveOccupiedStations, setLiveOccupiedStations] = useState<Set<string>>(new Set());

  // Image Modal preview
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [registeredModels, setRegisteredModels] = useState<PpUnit[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Find occupied stations in live section
      const ppUnits = getPpUnits();
      setRegisteredModels(ppUnits.filter(isModelListEntry));
      const liveOccupied = new Set<string>();
      ppUnits.forEach(u => {
        if (u.status === 'live' && u.station) {
          liveOccupied.add(u.station);
        }
      });
      setLiveOccupiedStations(liveOccupied);

      if (initialUnit) {
        setModelName(initialUnit.modelName || '');
        setSampleType(initialUnit.sampleType || '');
        setUnitType(initialUnit.unitType || initialUnitType || 'BOTH');
        setMaterialCode(initialUnit.materialCode || '');
        setVersion(initialUnit.version || 'V1.0');
        setStation(initialUnit.station || ALL_STATIONS[0]);
        setIduSerialNumber(initialUnit.iduSerialNumber || '');
        setOduSerialNumber(initialUnit.oduSerialNumber || '');
        setRequestBy(initialUnit.requestBy || '');
        setTestPurpose(initialUnit.testPurpose || '');
        setRequiredHour(String(initialUnit.requiredHour ?? 72));
        setDoneHour(String(initialUnit.doneHour ?? 0));

        setReportNo(initialUnit.reportDetails?.reportNo || '');
        setSampleReceived(initialUnit.reportDetails?.sampleReceived || '');
        setTestCommenced(initialUnit.reportDetails?.testCommenced || '');
        setTestCompleted(initialUnit.reportDetails?.testCompleted || '');

        setCoolingCapacity(initialUnit.namePlate?.coolingCapacity || '');
        setRatedPower(initialUnit.namePlate?.ratedPower || '');
        setRatedCurrent(initialUnit.namePlate?.ratedCurrent || '');
        setVoltage(initialUnit.namePlate?.voltage || '');
        setIseer(initialUnit.namePlate?.iseer || '');
        setGasQty(initialUnit.namePlate?.gasQty || '');
        setGasInjectionVolume(initialUnit.namePlate?.gasInjectionVolume || '');
        setPowerMode(initialUnit.namePlate?.powerMode || '');
        setRefrigerant(initialUnit.namePlate?.refrigerant || '');
        setMainProgramChecksumIdu(initialUnit.namePlate?.mainProgramChecksumIdu || '');
        setMainProgramChecksumOdu(initialUnit.namePlate?.mainProgramChecksumOdu || '');
        setEeChecksumIdu(initialUnit.namePlate?.eeChecksumIdu || '');
        setEeChecksumOdu(initialUnit.namePlate?.eeChecksumOdu || '');

        setIduMotorSpec(initialUnit.partsInfo?.iduMotorSpec || '');
        setIduMotorPartCode(initialUnit.partsInfo?.iduMotorPartCode || '');
        setIduMotorSupplier(initialUnit.partsInfo?.iduMotorSupplier || '');
        setIduPcbPartCode(initialUnit.partsInfo?.iduPcbPartCode || '');
        setIduPcbSupplier(initialUnit.partsInfo?.iduPcbSupplier || '');

        setOduMotorSpec(initialUnit.partsInfo?.oduMotorSpec || '');
        setOduMotorPartCode(initialUnit.partsInfo?.oduMotorPartCode || '');
        setOduMotorSupplier(initialUnit.partsInfo?.oduMotorSupplier || '');
        setOduPcbPartCode(initialUnit.partsInfo?.oduPcbPartCode || '');
        setOduPcbSupplier(initialUnit.partsInfo?.oduPcbSupplier || '');

        setCompressorSpec(initialUnit.partsInfo?.compressorSpec || '');
        setCompressorPartCode(initialUnit.partsInfo?.compressorPartCode || '');
        setCompressorSupplier(initialUnit.partsInfo?.compressorSupplier || '');

        setEevSpec(initialUnit.partsInfo?.eevSpec || '');
        setEevPartCode(initialUnit.partsInfo?.eevPartCode || '');
        setEevSupplier(initialUnit.partsInfo?.eevSupplier || '');

        setFourWaySwing(initialUnit.fourWaySwing || '');
        setRpm(initialUnit.rpm || '');

        setPhotos(initialUnit.photos || {
          indoorUnitPhoto: '',
          productPhoto: '',
          packingBoxPhoto: '',
          iduNameplatePhoto: '',
          oduNameplatePhoto: '',
          iduPcbPhoto: '',
          iduMotorPhoto: '',
          oduPcbPhoto: '',
          oduMotorPhoto: '',
          oduCompressorPhoto: '',
          oduEevPhoto: '',
          stickerPhoto: '',
        });

        setRemarks(initialUnit.remarks || '');
        setErrors({});
      } else {
        // Auto generate initial 5-digit serials
        setIduSerialNumber(generatePp5DigitSerial());
        setOduSerialNumber(generatePp5DigitSerial());
        
        // Auto select first available station
        const availableStation = ALL_STATIONS.find(s => !liveOccupied.has(s));
        if (availableStation) {
          setStation(availableStation);
        } else {
          setStation(ALL_STATIONS[0]);
        }

        // Auto-set Dates
        const today = new Date().toISOString().split('T')[0];
        setSampleReceived(today);
        setTestCommenced(today);

        setDoneHour('0');
        const hours = 72;
        const compDate = new Date(Date.now() + hours * 3600 * 1000);
        setTestCompleted(compDate.toISOString().split('T')[0]);
        setRequiredHour('72');
        setFourWaySwing('');
        setRpm('');
        setUnitType(initialUnitType);
        setErrors({});
      }
    }
  }, [isOpen, initialUnit, initialUnitType]);

  const handleRequiredHourChange = (val: string) => {
    setRequiredHour(val);
    const startStr = sampleReceived || testCommenced;
    if (startStr) {
      const d = new Date(startStr);
      if (!isNaN(d.getTime())) {
        const req = Number(val) || 0;
        const done = Number(doneHour) || 0;
        const pending = Math.max(0, req - done);
        const compDate = new Date(d.getTime() + pending * 3600 * 1000);
        setTestCompleted(compDate.toISOString().split('T')[0]);
      }
    }
  };

  const handleDoneHourChange = (val: string) => {
    setDoneHour(val);
    const startStr = sampleReceived || testCommenced;
    if (startStr) {
      const d = new Date(startStr);
      if (!isNaN(d.getTime())) {
        const req = Number(requiredHour) || 72;
        const done = Number(val) || 0;
        const pending = Math.max(0, req - done);
        const compDate = new Date(d.getTime() + pending * 3600 * 1000);
        setTestCompleted(compDate.toISOString().split('T')[0]);
      }
    }
  };

  const handleSampleReceivedChange = (val: string) => {
    setSampleReceived(val);
    if (!testCommenced) {
      setTestCommenced(val);
    }
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const req = Number(requiredHour) || 72;
        const done = Number(doneHour) || 0;
        const pending = Math.max(0, req - done);
        const compDate = new Date(d.getTime() + pending * 3600 * 1000);
        setTestCompleted(compDate.toISOString().split('T')[0]);
      }
    }
  };

  if (!isOpen) return null;

  const handleRegenerateIduSerial = () => {
    setIduSerialNumber(generatePp5DigitSerial());
  };

  const handleRegenerateOduSerial = () => {
    setOduSerialNumber(generatePp5DigitSerial());
  };

  const handleFileUpload = async (key: keyof ProtoUnitPhotos, file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    try {
      const result = await compressImageFile(file);
      if (result.dataUrl) {
        setPhotos(prev => ({ ...prev, [key]: result.dataUrl }));
      }
    } catch (err) {
      console.error('Error compressing image in PP dialog:', err);
    }
  };

  const handleRemovePhoto = (key: keyof ProtoUnitPhotos) => {
    setPhotos(prev => ({ ...prev, [key]: '' }));
  };

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!station) {
      errs.station = 'Testing Station selection is required';
    } else if (liveOccupiedStations.has(station)) {
      errs.station = 'Selected Station is currently occupied in Live section';
    }
    if (requiredHour && (isNaN(Number(requiredHour)) || Number(requiredHour) <= 0)) {
      errs.requiredHour = 'Valid Required Hour is required (e.g., 24, 72)';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveUnit = (targetStatus: 'live' | 'stopped') => {
    if (!validate()) {
      return;
    }

    const val = (v?: string | null): string => {
      if (!v) return 'NA';
      const trimmed = v.trim();
      return trimmed === '' ? 'NA' : trimmed;
    };

    const reportDetails: ReportDetails = {
      reportNo: val(reportNo),
      sampleType: val(sampleType),
      sampleReceived: val(sampleReceived),
      testCommenced: val(testCommenced),
      testCompleted: val(testCompleted),
    };

    const namePlate: NamePlateDetails = {
      coolingCapacity: val(coolingCapacity),
      ratedPower: val(ratedPower),
      ratedCurrent: val(ratedCurrent),
      voltage: val(voltage),
      iseer: val(iseer),
      gasQty: val(gasQty),
      mainProgramChecksumIdu: val(mainProgramChecksumIdu),
      mainProgramChecksumOdu: val(mainProgramChecksumOdu),
      gasInjectionVolume: val(gasInjectionVolume),
      powerMode: val(powerMode),
      eeChecksumIdu: val(eeChecksumIdu),
      eeChecksumOdu: val(eeChecksumOdu),
      refrigerant: val(refrigerant),
      fourWaySwing: val(fourWaySwing),
      rpm: val(rpm),
    };

    const partsInfo: ProtoUnitParts = {
      iduMotorSpec: val(iduMotorSpec),
      iduMotorPartCode: val(iduMotorPartCode),
      iduMotorSupplier: val(iduMotorSupplier),
      iduPcbPartCode: val(iduPcbPartCode),
      iduPcbSupplier: val(iduPcbSupplier),
      iduRpm: val(rpm),
      iduFourWaySwing: val(fourWaySwing),
      fourWaySwing: val(fourWaySwing),
      rpm: val(rpm),

      oduMotorSpec: val(oduMotorSpec),
      oduMotorPartCode: val(oduMotorPartCode),
      oduMotorSupplier: val(oduMotorSupplier),
      oduPcbPartCode: val(oduPcbPartCode),
      oduPcbSupplier: val(oduPcbSupplier),

      compressorSpec: val(compressorSpec),
      compressorPartCode: val(compressorPartCode),
      compressorSupplier: val(compressorSupplier),
      oduCompressorSupplier: val(compressorSupplier),
      oduCompressorPartCode: val(compressorPartCode),

      eevSpec: val(eevSpec),
      eevPartCode: val(eevPartCode),
      eevSupplier: val(eevSupplier),
      oduEevSupplier: val(eevSupplier),
      oduEevPartCode: val(eevPartCode),
    };

    // Automatically apply Picture Not Available placeholder for any unuploaded photos
    const completePhotos: ProtoUnitPhotos = { ...photos };
    PHOTO_FIELD_DEFINITIONS.forEach(def => {
      const existing = (completePhotos as any)[def.photoKey] || (completePhotos as any)[def.id];
      if (!existing || existing === 'NA' || String(existing).trim() === '') {
        (completePhotos as any)[def.photoKey] = PICTURE_NOT_AVAILABLE_IMAGE;
        (completePhotos as any)[def.id] = PICTURE_NOT_AVAILABLE_IMAGE;
      }
    });

    if (initialUnit) {
      updatePpUnit(initialUnit.id, {
        modelName: val(modelName),
        sampleType: val(sampleType),
        unitType,
        materialCode: val(materialCode) === 'NA' ? `MAT-${Math.floor(1000 + Math.random() * 9000)}` : val(materialCode),
        version: val(version) === 'NA' ? 'V1.0' : val(version),
        station: station || ALL_STATIONS[0],
        iduSerialNumber: val(iduSerialNumber),
        oduSerialNumber: val(oduSerialNumber),
        requestBy: val(requestBy),
        testPurpose: val(testPurpose),
        requiredHour: Number(requiredHour) || 72,
        doneHour: Number(doneHour) || 0,
        reportDetails,
        namePlate,
        partsInfo,
        photos: completePhotos,
        fourWaySwing: val(fourWaySwing),
        rpm: val(rpm),
        remarks: val(remarks),
        status: targetStatus,
        entrySource: 'unit_testing',
        isModelOnly: false,
      });
    } else {
      addPpUnit({
        modelName: val(modelName),
        sampleType: val(sampleType),
        unitType,
        materialCode: val(materialCode) === 'NA' ? `MAT-${Math.floor(1000 + Math.random() * 9000)}` : val(materialCode),
        version: val(version) === 'NA' ? 'V1.0' : val(version),
        station: station || ALL_STATIONS[0],
        iduSerialNumber: val(iduSerialNumber),
        oduSerialNumber: val(oduSerialNumber),
        requestBy: val(requestBy),
        testPurpose: val(testPurpose),
        requiredHour: Number(requiredHour) || 72,
        doneHour: Number(doneHour) || 0,
        reportDetails,
        namePlate,
        partsInfo,
        photos: completePhotos,
        fourWaySwing: val(fourWaySwing),
        rpm: val(rpm),
        remarks: val(remarks),
        status: targetStatus,
        entrySource: 'unit_testing',
        isModelOnly: false,
      });
    }

    onSuccess(targetStatus);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveUnit('live');
  };

  const photoUploadFields: { key: keyof ProtoUnitPhotos; label: string }[] = [
    { key: 'indoorUnitPhoto', label: '1. Indoor Unit' },
    { key: 'productPhoto', label: '2. Product Photo' },
    { key: 'packingBoxPhoto', label: '3. Packing Box' },
    { key: 'iduNameplatePhoto', label: '4. IDU Nameplate' },
    { key: 'oduNameplatePhoto', label: '5. ODU Nameplate' },
    { key: 'iduPcbPhoto', label: '6. IDU PCB' },
    { key: 'iduMotorPhoto', label: '7. IDU Motor' },
    { key: 'oduPcbPhoto', label: '8. ODU PCB' },
    { key: 'oduMotorPhoto', label: '9. ODU Motor' },
    { key: 'oduCompressorPhoto', label: '10. ODU Compressor' },
    { key: 'oduEevPhoto', label: '11. ODU EEV' },
    { key: 'stickerPhoto', label: '12. Extra Sticker' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header (Pinned Top) */}
        <div className="flex-none flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {initialUnit ? 'Edit PP Unit (Draft)' : 'New PP Unit Testing Entry'}
              </h2>
              <p className="text-xs text-slate-400">
                {initialUnit ? 'Update pre-production unit technical parameters, component specifications & photos' : 'Enter pre-production unit technical parameters, component specifications & photos'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
            {/* SECTION 1: Basic Information */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">Basic Information</h3>
                </div>

                {/* Unit Type Selection Pills */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUnitType('IDU')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      unitType === 'IDU'
                        ? 'bg-cyan-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    IDU
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitType('ODU')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      unitType === 'ODU'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    ODU
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitType('BOTH')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      unitType === 'BOTH'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    BOTH
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Station Selection (01 to 20) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Testing Station (01 to 20) <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-slate-900 border ${
                      errors.station ? 'border-rose-500' : 'border-slate-700'
                    } rounded-xl text-xs font-semibold text-cyan-300 focus:outline-none focus:border-cyan-500 transition-colors`}
                  >
                    <option value="" disabled>Select Station...</option>
                    {ALL_STATIONS.map((st) => {
                      const isOccupied = liveOccupiedStations.has(st);
                      return (
                        <option 
                          key={st} 
                          value={st} 
                          disabled={isOccupied}
                          className={isOccupied ? 'text-slate-500 bg-slate-950 font-normal' : 'text-slate-100 bg-slate-900 font-semibold'}
                        >
                          {st} {isOccupied ? '🔴 (Occupied in Live)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {errors.station ? (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.station}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      * Stations occupied in Live section are unselectable.
                    </p>
                  )}
                </div>

                {/* Model Name */}
                <div className="lg:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Model Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HSI19T-S2NB-F"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-slate-900 border ${
                      errors.modelName ? 'border-rose-500' : 'border-slate-700'
                    } rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                  />
                  {errors.modelName && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.modelName}
                    </p>
                  )}
                </div>

                {/* Sample Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sample Type
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PP / Pilot Run / Batch Trial"
                    value={sampleType}
                    onChange={(e) => setSampleType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                {/* Material Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Material Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MAT-90214"
                    value={materialCode}
                    onChange={(e) => setMaterialCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-cyan-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                {/* Version */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. V1.0"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-emerald-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Request By */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Request By (Person) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mohit Sharma"
                    value={requestBy}
                    onChange={(e) => setRequestBy(e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-slate-900 border ${
                      errors.requestBy ? 'border-rose-500' : 'border-slate-700'
                    } rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                  />
                  {errors.requestBy && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.requestBy}
                    </p>
                  )}
                </div>

                {/* Required Hour & Done Hour (Side-by-Side) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Required Hour */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 truncate">
                      Required Hour (Hours) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 72"
                        value={requiredHour}
                        onChange={(e) => handleRequiredHourChange(e.target.value)}
                        className={`w-full px-3.5 py-2.5 bg-slate-900 border ${
                          errors.requiredHour ? 'border-rose-500' : 'border-slate-700'
                        } rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors pr-10`}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">hrs</span>
                    </div>
                    {/* Preset hour chips */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {['24', '48', '72', '120', '240', '500'].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleRequiredHourChange(h)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                            requiredHour === h 
                              ? 'bg-cyan-600 text-white font-bold' 
                              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                    {errors.requiredHour && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {errors.requiredHour}
                      </p>
                    )}
                  </div>

                  {/* Done Hour */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300 truncate">
                        Done Hour (Hours)
                      </label>
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/60">
                        Pending: {Math.max(0, (Number(requiredHour) || 0) - (Number(doneHour) || 0))} hrs
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={Number(requiredHour) || 9999}
                        placeholder="0"
                        value={doneHour}
                        onChange={(e) => handleDoneHourChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors pr-10"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">hrs</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                      <span>Default: 0</span>
                      <span className="text-cyan-400 font-semibold">
                        Pending: {Math.max(0, (Number(requiredHour) || 0) - (Number(doneHour) || 0))} hrs
                      </span>
                    </p>
                  </div>
                </div>

                {/* IDU Serial Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    IDU Serial Number (5-Digit) <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="5-digit number"
                      value={iduSerialNumber}
                      onChange={(e) => setIduSerialNumber(e.target.value)}
                      className={`w-full px-3.5 py-2.5 bg-slate-900 border ${
                        errors.iduSerialNumber ? 'border-rose-500' : 'border-slate-700'
                      } rounded-xl text-xs font-mono font-bold text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={handleRegenerateIduSerial}
                      title="Generate Random 5-Digit Number"
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-cyan-400 shrink-0 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  {errors.iduSerialNumber && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.iduSerialNumber}
                    </p>
                  )}
                </div>

                {/* ODU Serial Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ODU Serial Number (5-Digit) <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="5-digit number"
                      value={oduSerialNumber}
                      onChange={(e) => setOduSerialNumber(e.target.value)}
                      className={`w-full px-3.5 py-2.5 bg-slate-900 border ${
                        errors.oduSerialNumber ? 'border-rose-500' : 'border-slate-700'
                      } rounded-xl text-xs font-mono font-bold text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={handleRegenerateOduSerial}
                      title="Generate Random 5-Digit Number"
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-cyan-400 shrink-0 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  {errors.oduSerialNumber && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.oduSerialNumber}
                    </p>
                  )}
                </div>

                {/* Test Purpose */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Test Purpose <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PP Batch Quality & Acoustic Validation"
                    value={testPurpose}
                    onChange={(e) => setTestPurpose(e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-slate-900 border ${
                      errors.testPurpose ? 'border-rose-500' : 'border-slate-700'
                    } rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                  />
                  {errors.testPurpose && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.testPurpose}
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* SECTION 2: Report Details */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">Report Details</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Report No.</label>
                  <input
                    type="text"
                    placeholder="e.g. PP-REP-2026-001"
                    value={reportNo}
                    onChange={(e) => setReportNo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Sample Received Date</label>
                  <input
                    type="date"
                    value={sampleReceived}
                    onChange={(e) => handleSampleReceivedChange(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Test Commenced Date</label>
                  <input
                    type="date"
                    value={testCommenced}
                    onChange={(e) => setTestCommenced(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Test Completed Date</label>
                  <input
                    type="date"
                    value={testCompleted}
                    onChange={(e) => setTestCompleted(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: Name Plate Details */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">Name Plate & Technical Details</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cooling Capacity</label>
                  <input
                    type="text"
                    placeholder="e.g. 5200 W"
                    value={coolingCapacity}
                    onChange={(e) => setCoolingCapacity(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Rated Power</label>
                  <input
                    type="text"
                    placeholder="e.g. 1450 W"
                    value={ratedPower}
                    onChange={(e) => setRatedPower(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Rated Current</label>
                  <input
                    type="text"
                    placeholder="e.g. 6.5 A"
                    value={ratedCurrent}
                    onChange={(e) => setRatedCurrent(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Voltage</label>
                  <input
                    type="text"
                    placeholder="e.g. 230 V / 50 Hz"
                    value={voltage}
                    onChange={(e) => setVoltage(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">ISEER</label>
                  <input
                    type="text"
                    placeholder="e.g. 5.2"
                    value={iseer}
                    onChange={(e) => setIseer(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Gas Qty / Volume</label>
                  <input
                    type="text"
                    placeholder="e.g. 850 g"
                    value={gasQty}
                    onChange={(e) => setGasQty(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Refrigerant</label>
                  <input
                    type="text"
                    placeholder="e.g. R32 / R410A"
                    value={refrigerant}
                    onChange={(e) => setRefrigerant(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Power Mode</label>
                  <input
                    type="text"
                    placeholder="e.g. 1Ph/230V/50Hz"
                    value={powerMode}
                    onChange={(e) => setPowerMode(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Main Program Checksum (IDU)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0xA4F2"
                    value={mainProgramChecksumIdu}
                    onChange={(e) => setMainProgramChecksumIdu(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Main Program Checksum (ODU)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0xB8C1"
                    value={mainProgramChecksumOdu}
                    onChange={(e) => setMainProgramChecksumOdu(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">EE Checksum (IDU)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0x120E"
                    value={eeChecksumIdu}
                    onChange={(e) => setEeChecksumIdu(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">EE Checksum (ODU)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0x334B"
                    value={eeChecksumOdu}
                    onChange={(e) => setEeChecksumOdu(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* 4 Way Swing Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">4 Way Swing</label>
                  <select
                    value={fourWaySwing}
                    onChange={(e) => setFourWaySwing(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">Select (Yes / No)</option>
                    <option value="Yes" className="bg-slate-900 text-emerald-400">Yes</option>
                    <option value="No" className="bg-slate-900 text-rose-400">No</option>
                  </select>
                </div>

                {/* RPM */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">RPM (Fan / Motor RPM)</label>
                  <input
                    type="text"
                    placeholder="e.g. 1250 RPM / 850 - 1350 RPM"
                    value={rpm}
                    onChange={(e) => setRpm(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: Component & Parts Details */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Box className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Components & Suppliers Information</h3>
              </div>

              {/* IDU Specs */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">IDU Specifications</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">IDU Motor Spec</label>
                    <input
                      type="text"
                      placeholder="e.g. 20W Brushless DC"
                      value={iduMotorSpec}
                      onChange={(e) => setIduMotorSpec(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">IDU Motor Part Code</label>
                    <input
                      type="text"
                      placeholder="e.g. MTR-IDU-201"
                      value={iduMotorPartCode}
                      onChange={(e) => setIduMotorPartCode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">IDU Motor Supplier</label>
                    <input
                      type="text"
                      placeholder="e.g. Nidec / Welling"
                      value={iduMotorSupplier}
                      onChange={(e) => setIduMotorSupplier(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">IDU PCB Part Code</label>
                    <input
                      type="text"
                      placeholder="e.g. PCB-IDU-102"
                      value={iduPcbPartCode}
                      onChange={(e) => setIduPcbPartCode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">IDU PCB Supplier</label>
                    <input
                      type="text"
                      placeholder="e.g. Delta Electronics"
                      value={iduPcbSupplier}
                      onChange={(e) => setIduPcbSupplier(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* ODU Specs */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">ODU Specifications</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">ODU Motor Spec</label>
                    <input
                      type="text"
                      placeholder="e.g. 45W BLDC"
                      value={oduMotorSpec}
                      onChange={(e) => setOduMotorSpec(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">ODU Motor Part Code</label>
                    <input
                      type="text"
                      placeholder="e.g. MTR-ODU-401"
                      value={oduMotorPartCode}
                      onChange={(e) => setOduMotorPartCode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">ODU Motor Supplier</label>
                    <input
                      type="text"
                      placeholder="e.g. Welling"
                      value={oduMotorSupplier}
                      onChange={(e) => setOduMotorSupplier(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">ODU PCB Part Code</label>
                    <input
                      type="text"
                      placeholder="e.g. PCB-ODU-301"
                      value={oduPcbPartCode}
                      onChange={(e) => setOduPcbPartCode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">ODU PCB Supplier</label>
                    <input
                      type="text"
                      placeholder="e.g. Sanken"
                      value={oduPcbSupplier}
                      onChange={(e) => setOduPcbSupplier(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Compressor & EEV Specs */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Compressor & EEV Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Compressor Spec</label>
                    <input
                      type="text"
                      placeholder="e.g. Twin Rotary Inverter"
                      value={compressorSpec}
                      onChange={(e) => setCompressorSpec(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Compressor Part Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CMP-ODU-882"
                      value={compressorPartCode}
                      onChange={(e) => setCompressorPartCode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Compressor Supplier</label>
                    <input
                      type="text"
                      placeholder="e.g. Highly / GMCC"
                      value={compressorSupplier}
                      onChange={(e) => setCompressorSupplier(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">EEV Spec</label>
                    <input
                      type="text"
                      placeholder="e.g. Pulse Stepper EEV"
                      value={eevSpec}
                      onChange={(e) => setEevSpec(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">EEV Part Code</label>
                    <input
                      type="text"
                      placeholder="e.g. EEV-ODU-101"
                      value={eevPartCode}
                      onChange={(e) => setEevPartCode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">EEV Supplier</label>
                    <input
                      type="text"
                      placeholder="e.g. DunAn / Sanhua"
                      value={eevSupplier}
                      onChange={(e) => setEevSupplier(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: Photo Upload Section (11 Standard Fields) */}
            <PhotoUploadSection
              photos={photos}
              onChange={(updated) => setPhotos(updated as ProtoUnitPhotos)}
              unitId={initialUnit?.id}
              title="PP Unit Photo Uploads"
            />

            {/* SECTION 6: Remarks */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">Remarks & Additional Notes</h3>
              </div>

              <div>
                <textarea
                  rows={3}
                  placeholder="Enter any special testing notes, pre-conditions or comments..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>
            </div>

          </div>

          {/* Form Actions Footer (Pinned Bottom) */}
          <div className="flex-none flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => saveUnit('stopped')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-950/80 border border-amber-800/80 hover:bg-amber-900 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4 text-amber-400" />
                <span>Save Draft</span>
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-900 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-md shadow-cyan-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{initialUnit ? 'Update & Start Live' : 'Save & Start Live'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="relative max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">{previewImage.title}</h4>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center rounded-xl bg-slate-950 p-2">
              <img src={previewImage.url} alt={previewImage.title} className="max-h-[65vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
