import React, { useState, useEffect, useRef } from 'react';
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
  Image as ImageIcon,
  ClipboardList,
  Award,
  Box,
  Zap,
  Sliders,
  Sparkles
} from 'lucide-react';
import { ProtoUnit, ProtoUnitParts, ProtoUnitPhotos, ReportDetails, NamePlateDetails } from '../../types';
import { addProtoUnit, updateProtoUnit, generate5DigitSerial, getProtoUnits } from '../../services/protoUnitStore';
import { getMachineEndDateTime, getMachineStartDateTime } from '../../utils/dateFormatter';
import { ALL_STATIONS, getOccupiedStations } from '../../utils/stationManager';
import { PhotoUploadSection } from '../Common/PhotoUploadSection';
import { compressImageFile } from '../../services/photoSettingsStore';
import { PHOTO_FIELD_DEFINITIONS } from '../../utils/photoManager';
import { PICTURE_NOT_AVAILABLE_IMAGE } from '../../utils/placeholderImage';
import {
  getAllComponentCatalog,
  getUniqueValues,
  findCompressorMatch,
  findIduMotorMatch,
  findOduMotorMatch,
  findIduPcbMatch,
  findOduPcbMatch,
  findEevMatch
} from '../../services/componentCatalogService';

interface AddProtoUnitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (status?: 'live' | 'stopped' | 'finished') => void;
  initialUnit?: ProtoUnit | null;
}

export const AddProtoUnitDialog: React.FC<AddProtoUnitDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialUnit,
}) => {
  // Basic Information
  const [modelName, setModelName] = useState('');
  const [sampleType, setSampleType] = useState('Proto Type');
  const [station, setStation] = useState('');
  const [iduSerialNumber, setIduSerialNumber] = useState('');
  const [oduSerialNumber, setOduSerialNumber] = useState('');
  const [requestBy, setRequestBy] = useState('');
  const [testPurpose, setTestPurpose] = useState('Product Reliability Testing 1045 Hour');
  const [requiredHour, setRequiredHour] = useState<string>('1045');
  const [doneHour, setDoneHour] = useState<string>('0');

  // Report Details
  const [reportNo, setReportNo] = useState('');
  const [sampleReceived, setSampleReceived] = useState('');
  const [testCommenced, setTestCommenced] = useState('');
  const [testCompleted, setTestCompleted] = useState('');

  // Name Plate Details
  const [coolingCapacity, setCoolingCapacity] = useState('');
  const [ratedCoolingPower, setRatedCoolingPower] = useState('');
  const [mainProgramChecksumIdu, setMainProgramChecksumIdu] = useState('');
  const [mainProgramChecksumOdu, setMainProgramChecksumOdu] = useState('');
  const [gasInjectionVolume, setGasInjectionVolume] = useState('');
  const [powerMode, setPowerMode] = useState('');
  const [eeChecksumIdu, setEeChecksumIdu] = useState('');
  const [eeChecksumOdu, setEeChecksumOdu] = useState('');
  const [refrigerant, setRefrigerant] = useState('R32');
  const [iseer, setIseer] = useState('');

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

  // Additional Information
  const [remarks, setRemarks] = useState('');

  // Form errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Preview full size image modal state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Live Auto-fill banner indicator
  const [autoFillNotice, setAutoFillNotice] = useState<{ component: string; text: string } | null>(null);

  // Catalog loaded from all testing machines and database
  const [catalog, setCatalog] = useState(() => getAllComponentCatalog());

  // Compute live occupied stations across Proto & Field units
  const liveOccupiedStations = getOccupiedStations();

  // Refresh catalog when modal opens
  useEffect(() => {
    if (isOpen) {
      setCatalog(getAllComponentCatalog());
    }
  }, [isOpen]);

  const uniqueOptions = React.useMemo(() => {
    return {
      compSpecs: getUniqueValues(catalog.compressors.map(c => c.spec)),
      compParts: getUniqueValues(catalog.compressors.map(c => c.partCode)),
      compSuppliers: getUniqueValues(catalog.compressors.map(c => c.supplier)),

      iduMotorSpecs: getUniqueValues(catalog.iduMotors.map(m => m.spec)),
      iduMotorParts: getUniqueValues(catalog.iduMotors.map(m => m.partCode)),
      iduMotorSuppliers: getUniqueValues(catalog.iduMotors.map(m => m.supplier)),

      oduMotorSpecs: getUniqueValues(catalog.oduMotors.map(m => m.spec)),
      oduMotorParts: getUniqueValues(catalog.oduMotors.map(m => m.partCode)),
      oduMotorSuppliers: getUniqueValues(catalog.oduMotors.map(m => m.supplier)),

      iduPcbParts: getUniqueValues(catalog.iduPcbs.map(p => p.partCode)),
      iduPcbSuppliers: getUniqueValues(catalog.iduPcbs.map(p => p.supplier)),

      oduPcbParts: getUniqueValues(catalog.oduPcbs.map(p => p.partCode)),
      oduPcbSuppliers: getUniqueValues(catalog.oduPcbs.map(p => p.supplier)),

      eevSpecs: getUniqueValues(catalog.eevs.map(e => e.spec)),
      eevParts: getUniqueValues(catalog.eevs.map(e => e.partCode)),
      eevSuppliers: getUniqueValues(catalog.eevs.map(e => e.supplier)),
    };
  }, [catalog]);

  const triggerNotice = (component: string, text: string) => {
    setAutoFillNotice({ component, text });
    setTimeout(() => {
      setAutoFillNotice(prev => (prev?.component === component ? null : prev));
    }, 4000);
  };

  // Auto generate 5 digit serials, set default station, or load initialUnit when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialUnit) {
        setModelName(initialUnit.modelName || '');
        setSampleType(initialUnit.sampleType || 'Proto Type');
        setStation(initialUnit.station || ALL_STATIONS[0]);
        setIduSerialNumber(initialUnit.iduSerialNumber || '');
        setOduSerialNumber(initialUnit.oduSerialNumber || '');
        setRequestBy(initialUnit.requestBy || '');
        setTestPurpose(initialUnit.testPurpose || 'Product Reliability Testing 1045 Hour');
        setRequiredHour(String(initialUnit.requiredHour ?? 1045));
        setDoneHour(String(initialUnit.doneHour ?? 0));

        setReportNo(initialUnit.reportDetails?.reportNo || '');
        const machineStart = getMachineStartDateTime(initialUnit);
        const machineEnd = getMachineEndDateTime(initialUnit);
        const isCompletedOrPassed = initialUnit.status === 'finished' || (Number(initialUnit.doneHour) >= 1045);
        setSampleReceived(initialUnit.reportDetails?.sampleReceived || machineStart);
        setTestCommenced(initialUnit.reportDetails?.testCommenced || machineStart);
        setTestCompleted(isCompletedOrPassed ? (initialUnit.reportDetails?.testCompleted || (machineEnd !== '-' ? machineEnd : '')) : '-');

        setCoolingCapacity(initialUnit.namePlate?.coolingCapacity || '');
        setRatedCoolingPower(initialUnit.namePlate?.ratedCoolingPower || '');
        setMainProgramChecksumIdu(initialUnit.namePlate?.mainProgramChecksumIdu || '');
        setMainProgramChecksumOdu(initialUnit.namePlate?.mainProgramChecksumOdu || '');
        setGasInjectionVolume(initialUnit.namePlate?.gasInjectionVolume || '');
        setPowerMode(initialUnit.namePlate?.powerMode || '');
        setEeChecksumIdu(initialUnit.namePlate?.eeChecksumIdu || '');
        setEeChecksumOdu(initialUnit.namePlate?.eeChecksumOdu || '');
        setRefrigerant(initialUnit.namePlate?.refrigerant || 'R32');
        setIseer(initialUnit.namePlate?.iseer || '');

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
        setModelName('');
        setSampleType('Proto Type');
        setIduSerialNumber(generate5DigitSerial());
        setOduSerialNumber(generate5DigitSerial());
        setRequestBy('');
        setTestPurpose('Product Reliability Testing 1045 Hour');
        setRequiredHour('1045');
        setDoneHour('0');
        setRefrigerant('R32');
        setErrors({});
        
        const occupied = getOccupiedStations();
        const firstAvailable = ALL_STATIONS.find(s => !occupied.has(s)) || ALL_STATIONS[0];
        setStation(firstAvailable);

        // Auto-detect Start Date for Sample Received & Test Commenced (Same Date)
        const todayStr = new Date().toISOString().split('T')[0];
        setSampleReceived(todayStr);
        setTestCommenced(todayStr);

        // While testing is in progress, Test Completed stays '-' until 1045 hours is reached
        setTestCompleted('-');

        // Reset parts & photos
        setIduMotorSpec('');
        setIduMotorPartCode('');
        setIduMotorSupplier('');
        setIduPcbPartCode('');
        setIduPcbSupplier('');
        setOduMotorSpec('');
        setOduMotorPartCode('');
        setOduMotorSupplier('');
        setOduPcbPartCode('');
        setOduPcbSupplier('');
        setCompressorSpec('');
        setCompressorPartCode('');
        setCompressorSupplier('');
        setEevSpec('');
        setEevPartCode('');
        setEevSupplier('');
        setPhotos({
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
      }
    }
  }, [isOpen, initialUnit]);

  // --- COMPONENT AUTO-FILL HANDLERS (From Machine Testing Data & Seeds) ---

  // Compressor auto-fill
  const handleCompressorSpecChange = (val: string) => {
    setCompressorSpec(val);
    const match = findCompressorMatch({ spec: val });
    if (match) {
      if (match.partCode) setCompressorPartCode(match.partCode);
      if (match.supplier) setCompressorSupplier(match.supplier);
      if (match.photoUrl && !photos.oduCompressorPhoto) {
        setPhotos(p => ({ ...p, oduCompressorPhoto: match.photoUrl! }));
      }
      triggerNotice('Compressor', `Auto-filled Part Code (${match.partCode}), Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  const handleCompressorPartCodeChange = (val: string) => {
    setCompressorPartCode(val);
    const match = findCompressorMatch({ partCode: val });
    if (match) {
      if (match.spec) setCompressorSpec(match.spec);
      if (match.supplier) setCompressorSupplier(match.supplier);
      if (match.photoUrl && !photos.oduCompressorPhoto) {
        setPhotos(p => ({ ...p, oduCompressorPhoto: match.photoUrl! }));
      }
      triggerNotice('Compressor', `Auto-filled Spec (${match.spec}), Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  const handleCompressorSupplierChange = (val: string) => {
    setCompressorSupplier(val);
    const match = findCompressorMatch({ supplier: val });
    if (match && (!compressorSpec || !compressorPartCode)) {
      if (!compressorSpec && match.spec) setCompressorSpec(match.spec);
      if (!compressorPartCode && match.partCode) setCompressorPartCode(match.partCode);
      if (match.photoUrl && !photos.oduCompressorPhoto) {
        setPhotos(p => ({ ...p, oduCompressorPhoto: match.photoUrl! }));
      }
      triggerNotice('Compressor', `Auto-filled Spec (${match.spec}), Part Code (${match.partCode}) & Photo from testing machines`);
    }
  };

  // IDU Motor auto-fill (user: "like IDU Moter ka Supplier Name fill kru to automatically Eska Part Code, Spec Aa jaye")
  const handleIduMotorSupplierChange = (val: string) => {
    setIduMotorSupplier(val);
    const match = findIduMotorMatch({ supplier: val });
    if (match) {
      if (match.partCode) setIduMotorPartCode(match.partCode);
      if (match.spec) setIduMotorSpec(match.spec);
      if (match.photoUrl && !photos.iduMotorPhoto) {
        setPhotos(p => ({ ...p, iduMotorPhoto: match.photoUrl! }));
      }
      triggerNotice('IDU Motor', `Auto-filled Part Code (${match.partCode}), Spec (${match.spec}) & Photo from testing machines`);
    }
  };

  const handleIduMotorSpecChange = (val: string) => {
    setIduMotorSpec(val);
    const match = findIduMotorMatch({ spec: val });
    if (match) {
      if (match.partCode) setIduMotorPartCode(match.partCode);
      if (match.supplier) setIduMotorSupplier(match.supplier);
      if (match.photoUrl && !photos.iduMotorPhoto) {
        setPhotos(p => ({ ...p, iduMotorPhoto: match.photoUrl! }));
      }
      triggerNotice('IDU Motor', `Auto-filled Part Code (${match.partCode}), Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  const handleIduMotorPartCodeChange = (val: string) => {
    setIduMotorPartCode(val);
    const match = findIduMotorMatch({ partCode: val });
    if (match) {
      if (match.spec) setIduMotorSpec(match.spec);
      if (match.supplier) setIduMotorSupplier(match.supplier);
      if (match.photoUrl && !photos.iduMotorPhoto) {
        setPhotos(p => ({ ...p, iduMotorPhoto: match.photoUrl! }));
      }
      triggerNotice('IDU Motor', `Auto-filled Spec (${match.spec}), Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  // ODU Motor auto-fill (user: "ODU Moter ye data fill krne ke liye kaha se loge jo machine Preview me Testing per laga hai waha se check kr ke loge. Aur Enka photo bhi")
  const handleOduMotorSpecChange = (val: string) => {
    setOduMotorSpec(val);
    const match = findOduMotorMatch({ spec: val });
    if (match) {
      if (match.partCode) setOduMotorPartCode(match.partCode);
      if (match.supplier) setOduMotorSupplier(match.supplier);
      if (match.photoUrl && !photos.oduMotorPhoto) {
        setPhotos(p => ({ ...p, oduMotorPhoto: match.photoUrl! }));
      }
      triggerNotice('ODU Motor', `Auto-filled Part Code (${match.partCode}), Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  const handleOduMotorPartCodeChange = (val: string) => {
    setOduMotorPartCode(val);
    const match = findOduMotorMatch({ partCode: val });
    if (match) {
      if (match.spec) setOduMotorSpec(match.spec);
      if (match.supplier) setOduMotorSupplier(match.supplier);
      if (match.photoUrl && !photos.oduMotorPhoto) {
        setPhotos(p => ({ ...p, oduMotorPhoto: match.photoUrl! }));
      }
      triggerNotice('ODU Motor', `Auto-filled Spec (${match.spec}), Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  const handleOduMotorSupplierChange = (val: string) => {
    setOduMotorSupplier(val);
    const match = findOduMotorMatch({ supplier: val });
    if (match && (!oduMotorSpec || !oduMotorPartCode)) {
      if (!oduMotorSpec && match.spec) setOduMotorSpec(match.spec);
      if (!oduMotorPartCode && match.partCode) setOduMotorPartCode(match.partCode);
      if (match.photoUrl && !photos.oduMotorPhoto) {
        setPhotos(p => ({ ...p, oduMotorPhoto: match.photoUrl! }));
      }
      triggerNotice('ODU Motor', `Auto-filled Spec (${match.spec}), Part Code (${match.partCode}) & Photo from testing machines`);
    }
  };

  // IDU PCB auto-fill
  const handleIduPcbPartCodeChange = (val: string) => {
    setIduPcbPartCode(val);
    const match = findIduPcbMatch({ partCode: val });
    if (match) {
      if (match.supplier) setIduPcbSupplier(match.supplier);
      if (match.photoUrl && !photos.iduPcbPhoto) {
        setPhotos(p => ({ ...p, iduPcbPhoto: match.photoUrl! }));
      }
      triggerNotice('IDU PCB', `Auto-filled Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  const handleIduPcbSupplierChange = (val: string) => {
    setIduPcbSupplier(val);
    const match = findIduPcbMatch({ supplier: val });
    if (match && !iduPcbPartCode) {
      if (match.partCode) setIduPcbPartCode(match.partCode);
      if (match.photoUrl && !photos.iduPcbPhoto) {
        setPhotos(p => ({ ...p, iduPcbPhoto: match.photoUrl! }));
      }
      triggerNotice('IDU PCB', `Auto-filled Part Code (${match.partCode}) & Photo from testing machines`);
    }
  };

  // ODU PCB auto-fill
  const handleOduPcbPartCodeChange = (val: string) => {
    setOduPcbPartCode(val);
    const match = findOduPcbMatch({ partCode: val });
    if (match) {
      if (match.supplier) setOduPcbSupplier(match.supplier);
      if (match.photoUrl && !photos.oduPcbPhoto) {
        setPhotos(p => ({ ...p, oduPcbPhoto: match.photoUrl! }));
      }
      triggerNotice('ODU PCB', `Auto-filled Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  const handleOduPcbSupplierChange = (val: string) => {
    setOduPcbSupplier(val);
    const match = findOduPcbMatch({ supplier: val });
    if (match && !oduPcbPartCode) {
      if (match.partCode) setOduPcbPartCode(match.partCode);
      if (match.photoUrl && !photos.oduPcbPhoto) {
        setPhotos(p => ({ ...p, oduPcbPhoto: match.photoUrl! }));
      }
      triggerNotice('ODU PCB', `Auto-filled Part Code (${match.partCode}) & Photo from testing machines`);
    }
  };

  // EEV auto-fill
  const handleEevSpecChange = (val: string) => {
    setEevSpec(val);
    const match = findEevMatch({ spec: val });
    if (match) {
      if (match.partCode) setEevPartCode(match.partCode);
      if (match.supplier) setEevSupplier(match.supplier);
      if (match.photoUrl && !photos.oduEevPhoto) {
        setPhotos(p => ({ ...p, oduEevPhoto: match.photoUrl! }));
      }
      triggerNotice('EEV', `Auto-filled Part Code (${match.partCode}), Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  const handleEevPartCodeChange = (val: string) => {
    setEevPartCode(val);
    const match = findEevMatch({ partCode: val });
    if (match) {
      if (match.spec) setEevSpec(match.spec);
      if (match.supplier) setEevSupplier(match.supplier);
      if (match.photoUrl && !photos.oduEevPhoto) {
        setPhotos(p => ({ ...p, oduEevPhoto: match.photoUrl! }));
      }
      triggerNotice('EEV', `Auto-filled Spec (${match.spec}), Supplier (${match.supplier}) & Photo from testing machines`);
    }
  };

  const handleEevSupplierChange = (val: string) => {
    setEevSupplier(val);
    const match = findEevMatch({ supplier: val });
    if (match && (!eevSpec || !eevPartCode)) {
      if (!eevSpec && match.spec) setEevSpec(match.spec);
      if (!eevPartCode && match.partCode) setEevPartCode(match.partCode);
      if (match.photoUrl && !photos.oduEevPhoto) {
        setPhotos(p => ({ ...p, oduEevPhoto: match.photoUrl! }));
      }
      triggerNotice('EEV', `Auto-filled Spec (${match.spec}), Part Code (${match.partCode}) & Photo from testing machines`);
    }
  };

  const handleSampleReceivedChange = (dateVal: string) => {
    setSampleReceived(dateVal);
    setTestCommenced(dateVal); // Same start date in both
    const done = Number(doneHour) || 0;
    if (done >= 1045 && dateVal) {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        const req = Number(requiredHour) || 1045;
        const compDate = new Date(d.getTime() + req * 3600 * 1000);
        setTestCompleted(compDate.toISOString().split('T')[0]);
      }
    } else {
      setTestCompleted('-');
    }
  };

  const handleTestCommencedChange = (dateVal: string) => {
    setTestCommenced(dateVal);
    setSampleReceived(dateVal); // Same start date in both
    const done = Number(doneHour) || 0;
    if (done >= 1045 && dateVal) {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        const req = Number(requiredHour) || 1045;
        const compDate = new Date(d.getTime() + req * 3600 * 1000);
        setTestCompleted(compDate.toISOString().split('T')[0]);
      }
    } else {
      setTestCompleted('-');
    }
  };

  const handleRequiredHourChange = (val: string) => {
    setRequiredHour(val);
    const done = Number(doneHour) || 0;
    const req = Number(val) || 1045;
    if (done >= 1045 || (req > 0 && done >= req && req >= 1045)) {
      const startStr = sampleReceived || testCommenced;
      if (startStr) {
        const d = new Date(startStr);
        if (!isNaN(d.getTime())) {
          const compDate = new Date(d.getTime() + req * 3600 * 1000);
          setTestCompleted(compDate.toISOString().split('T')[0]);
        }
      }
    } else {
      setTestCompleted('-');
    }
  };

  const handleDoneHourChange = (val: string) => {
    setDoneHour(val);
    const done = Number(val) || 0;
    const req = Number(requiredHour) || 1045;
    if (done >= 1045 || (req > 0 && done >= req && req >= 1045)) {
      const startStr = sampleReceived || testCommenced;
      if (startStr) {
        const d = new Date(startStr);
        if (!isNaN(d.getTime())) {
          const compDate = new Date(d.getTime() + req * 3600 * 1000);
          setTestCompleted(compDate.toISOString().split('T')[0]);
        }
      }
    } else {
      setTestCompleted('-');
    }
  };

  if (!isOpen) return null;

  const handleRegenerateIduSerial = () => {
    setIduSerialNumber(generate5DigitSerial());
  };

  const handleRegenerateOduSerial = () => {
    setOduSerialNumber(generate5DigitSerial());
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
      console.error('Error compressing image in Proto dialog:', err);
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
      ratedCoolingPower: val(ratedCoolingPower),
      mainProgramChecksumIdu: val(mainProgramChecksumIdu),
      mainProgramChecksumOdu: val(mainProgramChecksumOdu),
      gasInjectionVolume: val(gasInjectionVolume),
      powerMode: val(powerMode),
      eeChecksumIdu: val(eeChecksumIdu),
      eeChecksumOdu: val(eeChecksumOdu),
      refrigerant: val(refrigerant),
      iseer: val(iseer),
    };

    const partsInfo: ProtoUnitParts = {
      iduMotorSpec: val(iduMotorSpec),
      iduMotorPartCode: val(iduMotorPartCode),
      iduMotorSupplier: val(iduMotorSupplier),
      iduPcbPartCode: val(iduPcbPartCode),
      iduPcbSupplier: val(iduPcbSupplier),

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

    const numericDone = Number(doneHour) || 0;
    const numericReq = Number(requiredHour) || 1045;
    const effectiveStatus: 'live' | 'stopped' | 'finished' = (numericDone >= 1045 || (numericReq > 0 && numericDone >= numericReq && numericReq >= 1045))
      ? 'finished'
      : targetStatus;

    const isDoneOrFinished = effectiveStatus === 'finished' || numericDone >= 1045;
    const finalEndDateTime = isDoneOrFinished 
      ? (val(testCompleted) !== 'NA' && val(testCompleted) !== '-' ? val(testCompleted) : new Date().toISOString())
      : (effectiveStatus === 'stopped' ? (val(testCompleted) !== 'NA' && val(testCompleted) !== '-' ? val(testCompleted) : new Date().toISOString()) : '');
    const finalTestCompleted = isDoneOrFinished
      ? (val(testCompleted) !== 'NA' && val(testCompleted) !== '-' ? val(testCompleted) : new Date().toISOString().split('T')[0])
      : '-';

    const finalReportDetails: ReportDetails = {
      ...reportDetails,
      testCompleted: finalTestCompleted,
    };

    if (initialUnit) {
      updateProtoUnit(initialUnit.id, {
        modelName: val(modelName),
        sampleType: val(sampleType),
        station: station || ALL_STATIONS[0],
        iduSerialNumber: val(iduSerialNumber),
        oduSerialNumber: val(oduSerialNumber),
        requestBy: val(requestBy),
        testPurpose: val(testPurpose),
        requiredHour: numericReq,
        doneHour: numericDone,
        reportDetails: finalReportDetails,
        namePlate,
        partsInfo,
        photos: completePhotos,
        remarks: val(remarks),
        status: effectiveStatus,
        endDateTime: finalEndDateTime,
      });
    } else {
      addProtoUnit({
        modelName: val(modelName),
        sampleType: val(sampleType),
        station: station || ALL_STATIONS[0],
        iduSerialNumber: val(iduSerialNumber),
        oduSerialNumber: val(oduSerialNumber),
        requestBy: val(requestBy),
        testPurpose: val(testPurpose),
        requiredHour: numericReq,
        doneHour: numericDone,
        reportDetails: finalReportDetails,
        namePlate,
        partsInfo,
        photos: completePhotos,
        remarks: val(remarks),
        status: effectiveStatus,
        endDateTime: finalEndDateTime,
      });
    }

    // Reset Form
    setModelName('');
    setSampleType('');
    setStation('');
    setRequestBy('');
    setTestPurpose('');
    setRequiredHour('72');
    setDoneHour('0');

    setReportNo('');
    setSampleReceived('');
    setTestCommenced('');
    setTestCompleted('');

    setCoolingCapacity('');
    setMainProgramChecksumIdu('');
    setMainProgramChecksumOdu('');
    setGasInjectionVolume('');
    setPowerMode('');
    setEeChecksumIdu('');
    setEeChecksumOdu('');
    setRefrigerant('');
    setIseer('');

    setIduMotorSpec('');
    setIduMotorPartCode('');
    setIduMotorSupplier('');
    setIduPcbPartCode('');
    setIduPcbSupplier('');

    setOduMotorSpec('');
    setOduMotorPartCode('');
    setOduMotorSupplier('');
    setOduPcbPartCode('');
    setOduPcbSupplier('');

    setCompressorSpec('');
    setCompressorPartCode('');
    setCompressorSupplier('');

    setEevSpec('');
    setEevPartCode('');
    setEevSupplier('');

    setPhotos({
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
    setRemarks('');

    onSuccess(targetStatus);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveUnit('live');
  };

  const photoUploadFields: { key: keyof ProtoUnitPhotos; label: string }[] = [
    { key: 'indoorUnitPhoto', label: 'Indoor Unit' },
    { key: 'productPhoto', label: 'Product Photo' },
    { key: 'packingBoxPhoto', label: 'Packing Box' },
    { key: 'iduNameplatePhoto', label: 'IDU Nameplate' },
    { key: 'oduNameplatePhoto', label: 'ODU Nameplate' },
    { key: 'iduPcbPhoto', label: 'IDU PCB' },
    { key: 'iduMotorPhoto', label: 'IDU Motor' },
    { key: 'oduPcbPhoto', label: 'ODU PCB' },
    { key: 'oduMotorPhoto', label: 'ODU Motor' },
    { key: 'oduCompressorPhoto', label: 'ODU Compressor' },
    { key: 'oduEevPhoto', label: 'ODU EEV' },
    { key: 'stickerPhoto', label: 'Extra Sticker / Remote' },
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
                {initialUnit ? 'Edit Proto Unit (Draft)' : 'New Proto Unit Entry'}
              </h2>
              <p className="text-xs text-slate-400">
                {initialUnit ? 'Update proto unit technical parameters, component info & photos' : 'Enter proto unit technical parameters, component info & photos'}
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

            {/* Auto-fill feedback alert notification */}
            {autoFillNotice && (
              <div className="bg-cyan-950/90 border border-cyan-500/50 rounded-xl p-3 flex items-center justify-between shadow-lg shadow-cyan-950/40 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2.5 text-xs text-cyan-200">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <span>
                    <strong className="text-cyan-300 font-bold">{autoFillNotice.component}:</strong> {autoFillNotice.text}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoFillNotice(null)}
                  className="text-cyan-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          
          {/* SECTION 1: Basic Information */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Tag className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">Basic Information</h3>
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
                  placeholder="e.g. Proto / Engineering / Pilot"
                  value={sampleType}
                  onChange={(e) => setSampleType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
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
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
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
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Test Purpose <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Performance & Acoustic Stress Validation"
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
              <ClipboardList className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">Report Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Report No</label>
                <input
                  type="text"
                  placeholder="e.g. LLT-REP-2026-089"
                  value={reportNo}
                  onChange={(e) => setReportNo(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Sample Received</label>
                <input
                  type="date"
                  value={sampleReceived}
                  onChange={(e) => handleSampleReceivedChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Test Commenced</label>
                <input
                  type="date"
                  value={testCommenced}
                  onChange={(e) => handleTestCommencedChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Test Completed <span className="text-[10px] text-cyan-400 font-normal">(Auto-synced with End Date & Time)</span>
                </label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD HH:MM"
                  value={testCompleted}
                  onChange={(e) => setTestCompleted(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Name Plate */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Award className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">Name Plate</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Cooling Capacity</label>
                <input
                  type="text"
                  placeholder="e.g. 5200 W"
                  value={coolingCapacity}
                  onChange={(e) => setCoolingCapacity(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Rated Cooling Power</label>
                  <span className="text-[9px] font-mono text-cyan-400">{"{{Rated_Cooling_Power}}"}</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 1450 W"
                  value={ratedCoolingPower}
                  onChange={(e) => setRatedCoolingPower(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Main Program Checksum IDU</label>
                <input
                  type="text"
                  placeholder="e.g. 0xA4F2"
                  value={mainProgramChecksumIdu}
                  onChange={(e) => setMainProgramChecksumIdu(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Main Program Checksum ODU</label>
                <input
                  type="text"
                  placeholder="e.g. 0xB8E1"
                  value={mainProgramChecksumOdu}
                  onChange={(e) => setMainProgramChecksumOdu(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Gas Injection Volume</label>
                <input
                  type="text"
                  placeholder="e.g. 850g"
                  value={gasInjectionVolume}
                  onChange={(e) => setGasInjectionVolume(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">EE Checksum IDU</label>
                <input
                  type="text"
                  placeholder="e.g. 0x1102"
                  value={eeChecksumIdu}
                  onChange={(e) => setEeChecksumIdu(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">EE Checksum ODU</label>
                <input
                  type="text"
                  placeholder="e.g. 0x9920"
                  value={eeChecksumOdu}
                  onChange={(e) => setEeChecksumOdu(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Refrigerant</label>
                <input
                  type="text"
                  placeholder="e.g. R32 / R410A"
                  value={refrigerant}
                  onChange={(e) => setRefrigerant(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ISEER</label>
                <input
                  type="text"
                  placeholder="e.g. 5.15"
                  value={iseer}
                  onChange={(e) => setIseer(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: IDU Details */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">IDU Details</h3>
              </div>
              <span className="text-[10px] font-medium text-purple-300 flex items-center gap-1 bg-purple-950/70 px-2.5 py-0.5 rounded-full border border-purple-800/60">
                <Sparkles className="w-3 h-3 text-purple-400" /> Auto-fill from testing machines
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">IDU Motor Spec</label>
                <input
                  type="text"
                  placeholder="e.g. 30W DC Brushless"
                  value={iduMotorSpec}
                  list="proto-idu-motor-spec-list"
                  onChange={(e) => handleIduMotorSpecChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">IDU Motor Part Code</label>
                <input
                  type="text"
                  placeholder="e.g. MTR-IDU-2201"
                  value={iduMotorPartCode}
                  list="proto-idu-motor-part-list"
                  onChange={(e) => handleIduMotorPartCodeChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  IDU Motor Supplier <span className="text-purple-400 text-[10px]">(Type to Auto-Fill)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nidec"
                  value={iduMotorSupplier}
                  list="proto-idu-motor-supplier-list"
                  onChange={(e) => handleIduMotorSupplierChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-purple-800/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">IDU PCB Part Code</label>
                <input
                  type="text"
                  placeholder="e.g. PCB-IDU-8841"
                  value={iduPcbPartCode}
                  list="proto-idu-pcb-part-list"
                  onChange={(e) => handleIduPcbPartCodeChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">IDU PCB Supplier</label>
                <input
                  type="text"
                  placeholder="e.g. Sanken Electric"
                  value={iduPcbSupplier}
                  list="proto-idu-pcb-supplier-list"
                  onChange={(e) => handleIduPcbSupplierChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Linked Photo Preview for IDU Motor / PCB */}
              {(photos.iduMotorPhoto || photos.iduPcbPhoto) && (
                <div className="flex items-center gap-3 p-2 bg-purple-950/30 border border-purple-900/50 rounded-xl">
                  {photos.iduMotorPhoto && (
                    <div 
                      onClick={() => setPreviewImage({ url: photos.iduMotorPhoto, title: 'IDU Motor Photo' })}
                      className="flex items-center gap-1.5 cursor-pointer group hover:opacity-90"
                    >
                      <img src={photos.iduMotorPhoto} alt="IDU Motor" className="w-9 h-9 object-cover rounded-lg border border-purple-500/40" />
                      <div className="text-[10px]">
                        <span className="text-purple-300 font-semibold block">IDU Motor</span>
                        <span className="text-slate-400 group-hover:text-cyan-300">Preview ↗</span>
                      </div>
                    </div>
                  )}
                  {photos.iduPcbPhoto && (
                    <div 
                      onClick={() => setPreviewImage({ url: photos.iduPcbPhoto, title: 'IDU PCB Photo' })}
                      className="flex items-center gap-1.5 cursor-pointer group hover:opacity-90"
                    >
                      <img src={photos.iduPcbPhoto} alt="IDU PCB" className="w-9 h-9 object-cover rounded-lg border border-purple-500/40" />
                      <div className="text-[10px]">
                        <span className="text-purple-300 font-semibold block">IDU PCB</span>
                        <span className="text-slate-400 group-hover:text-cyan-300">Preview ↗</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 5: ODU Details */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider">ODU Details</h3>
              </div>
              <span className="text-[10px] font-medium text-blue-300 flex items-center gap-1 bg-blue-950/70 px-2.5 py-0.5 rounded-full border border-blue-800/60">
                <Sparkles className="w-3 h-3 text-blue-400" /> Auto-fill from testing machines
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ODU Motor Spec</label>
                <input
                  type="text"
                  placeholder="e.g. 60W DC Fan Motor"
                  value={oduMotorSpec}
                  list="proto-odu-motor-spec-list"
                  onChange={(e) => handleOduMotorSpecChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ODU Motor Part Code</label>
                <input
                  type="text"
                  placeholder="e.g. MTR-ODU-3310"
                  value={oduMotorPartCode}
                  list="proto-odu-motor-part-list"
                  onChange={(e) => handleOduMotorPartCodeChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ODU Motor Supplier</label>
                <input
                  type="text"
                  placeholder="e.g. Nidec"
                  value={oduMotorSupplier}
                  list="proto-odu-motor-supplier-list"
                  onChange={(e) => handleOduMotorSupplierChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ODU PCB Part Code</label>
                <input
                  type="text"
                  placeholder="e.g. PCB-ODU-9902"
                  value={oduPcbPartCode}
                  list="proto-odu-pcb-part-list"
                  onChange={(e) => handleOduPcbPartCodeChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ODU PCB Supplier</label>
                <input
                  type="text"
                  placeholder="e.g. Delta"
                  value={oduPcbSupplier}
                  list="proto-odu-pcb-supplier-list"
                  onChange={(e) => handleOduPcbSupplierChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Linked Photo Preview for ODU Motor / PCB */}
              {(photos.oduMotorPhoto || photos.oduPcbPhoto) && (
                <div className="flex items-center gap-3 p-2 bg-blue-950/30 border border-blue-900/50 rounded-xl">
                  {photos.oduMotorPhoto && (
                    <div 
                      onClick={() => setPreviewImage({ url: photos.oduMotorPhoto, title: 'ODU Motor Photo' })}
                      className="flex items-center gap-1.5 cursor-pointer group hover:opacity-90"
                    >
                      <img src={photos.oduMotorPhoto} alt="ODU Motor" className="w-9 h-9 object-cover rounded-lg border border-blue-500/40" />
                      <div className="text-[10px]">
                        <span className="text-blue-300 font-semibold block">ODU Motor</span>
                        <span className="text-slate-400 group-hover:text-cyan-300">Preview ↗</span>
                      </div>
                    </div>
                  )}
                  {photos.oduPcbPhoto && (
                    <div 
                      onClick={() => setPreviewImage({ url: photos.oduPcbPhoto, title: 'ODU PCB Photo' })}
                      className="flex items-center gap-1.5 cursor-pointer group hover:opacity-90"
                    >
                      <img src={photos.oduPcbPhoto} alt="ODU PCB" className="w-9 h-9 object-cover rounded-lg border border-blue-500/40" />
                      <div className="text-[10px]">
                        <span className="text-blue-300 font-semibold block">ODU PCB</span>
                        <span className="text-slate-400 group-hover:text-cyan-300">Preview ↗</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 6: Compressor Details */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">Compressor Details</h3>
              </div>
              <span className="text-[10px] font-medium text-amber-300 flex items-center gap-1 bg-amber-950/70 px-2.5 py-0.5 rounded-full border border-amber-800/60">
                <Sparkles className="w-3 h-3 text-amber-400" /> Auto-fill from testing machines
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Compressor Spec <span className="text-amber-400 text-[10px]">(Fill to Auto-Fill Part & Supplier)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Twin Rotary Inverter 1.5T"
                  value={compressorSpec}
                  list="proto-compressor-spec-list"
                  onChange={(e) => handleCompressorSpecChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-amber-800/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Compressor Part Code</label>
                <input
                  type="text"
                  placeholder="e.g. CMP-ODU-7721"
                  value={compressorPartCode}
                  list="proto-compressor-part-list"
                  onChange={(e) => handleCompressorPartCodeChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Compressor Supplier</label>
                <input
                  type="text"
                  placeholder="e.g. Panasonic / Highly"
                  value={compressorSupplier}
                  list="proto-compressor-supplier-list"
                  onChange={(e) => handleCompressorSupplierChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Linked Photo Preview for Compressor */}
              {photos.oduCompressorPhoto && (
                <div className="flex items-center gap-3 p-2 bg-amber-950/30 border border-amber-900/50 rounded-xl sm:col-span-2 lg:col-span-3">
                  <div 
                    onClick={() => setPreviewImage({ url: photos.oduCompressorPhoto, title: 'ODU Compressor Photo' })}
                    className="flex items-center gap-2 cursor-pointer group hover:opacity-90"
                  >
                    <img src={photos.oduCompressorPhoto} alt="ODU Compressor" className="w-10 h-10 object-cover rounded-lg border border-amber-500/40" />
                    <div className="text-xs">
                      <span className="text-amber-300 font-semibold block">ODU Compressor Photo Linked from Machine Testing</span>
                      <span className="text-slate-400 group-hover:text-cyan-300 text-[11px]">Click to view full preview ↗</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 7: EEV Details */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wider">EEV Details</h3>
              </div>
              <span className="text-[10px] font-medium text-rose-300 flex items-center gap-1 bg-rose-950/70 px-2.5 py-0.5 rounded-full border border-rose-800/60">
                <Sparkles className="w-3 h-3 text-rose-400" /> Auto-fill from testing machines
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">EEV Spec</label>
                <input
                  type="text"
                  placeholder="e.g. 500 Pulse Electronic Expansion Valve"
                  value={eevSpec}
                  list="proto-eev-spec-list"
                  onChange={(e) => handleEevSpecChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">EEV Part Code</label>
                <input
                  type="text"
                  placeholder="e.g. EEV-ODU-1022"
                  value={eevPartCode}
                  list="proto-eev-part-list"
                  onChange={(e) => handleEevPartCodeChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">EEV Supplier</label>
                <input
                  type="text"
                  placeholder="e.g. Sanhua / DunAn"
                  value={eevSupplier}
                  list="proto-eev-supplier-list"
                  onChange={(e) => handleEevSupplierChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              {/* Linked Photo Preview for EEV */}
              {photos.oduEevPhoto && (
                <div className="flex items-center gap-3 p-2 bg-rose-950/30 border border-rose-900/50 rounded-xl sm:col-span-3">
                  <div 
                    onClick={() => setPreviewImage({ url: photos.oduEevPhoto, title: 'ODU EEV Photo' })}
                    className="flex items-center gap-2 cursor-pointer group hover:opacity-90"
                  >
                    <img src={photos.oduEevPhoto} alt="ODU EEV" className="w-10 h-10 object-cover rounded-lg border border-rose-500/40" />
                    <div className="text-xs">
                      <span className="text-rose-300 font-semibold block">ODU EEV Photo Linked from Machine Testing</span>
                      <span className="text-slate-400 group-hover:text-cyan-300 text-[11px]">Click to view full preview ↗</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: Photo Upload Section (11 Standard Fields) */}
          <PhotoUploadSection
            photos={photos}
            onChange={(updated) => setPhotos(updated as ProtoUnitPhotos)}
            unitId={initialUnit?.id}
            title="Proto Unit Photo Uploads"
          />

          {/* SECTION 5: Additional Information */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">Additional Information</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Remarks</label>
              <textarea
                rows={3}
                placeholder="Enter any special notes, testing observations or comments..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>
          </div>
          </div>

          {/* Submit Action Buttons (Pinned Bottom) */}
          <div className="flex-none px-6 py-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveUnit('stopped')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold text-amber-300 bg-amber-950/80 border border-amber-800/80 hover:bg-amber-900 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>Save Draft</span>
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-900 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-lg shadow-cyan-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{initialUnit ? 'Update & Start Live' : 'Submit Proto Unit'}</span>
            </button>
          </div>

          {/* HTML5 Datalists for Auto-fill & Component suggestions from preview testing machines */}
          <datalist id="proto-compressor-spec-list">
            {uniqueOptions.compSpecs.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-compressor-part-list">
            {uniqueOptions.compParts.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-compressor-supplier-list">
            {uniqueOptions.compSuppliers.map(s => <option key={s} value={s} />)}
          </datalist>

          <datalist id="proto-idu-motor-spec-list">
            {uniqueOptions.iduMotorSpecs.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-idu-motor-part-list">
            {uniqueOptions.iduMotorParts.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-idu-motor-supplier-list">
            {uniqueOptions.iduMotorSuppliers.map(s => <option key={s} value={s} />)}
          </datalist>

          <datalist id="proto-odu-motor-spec-list">
            {uniqueOptions.oduMotorSpecs.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-odu-motor-part-list">
            {uniqueOptions.oduMotorParts.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-odu-motor-supplier-list">
            {uniqueOptions.oduMotorSuppliers.map(s => <option key={s} value={s} />)}
          </datalist>

          <datalist id="proto-idu-pcb-part-list">
            {uniqueOptions.iduPcbParts.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-idu-pcb-supplier-list">
            {uniqueOptions.iduPcbSuppliers.map(s => <option key={s} value={s} />)}
          </datalist>

          <datalist id="proto-odu-pcb-part-list">
            {uniqueOptions.oduPcbParts.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-odu-pcb-supplier-list">
            {uniqueOptions.oduPcbSuppliers.map(s => <option key={s} value={s} />)}
          </datalist>

          <datalist id="proto-eev-spec-list">
            {uniqueOptions.eevSpecs.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-eev-part-list">
            {uniqueOptions.eevParts.map(s => <option key={s} value={s} />)}
          </datalist>
          <datalist id="proto-eev-supplier-list">
            {uniqueOptions.eevSuppliers.map(s => <option key={s} value={s} />)}
          </datalist>

        </form>
      </div>

      {/* Modal for image preview */}
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
