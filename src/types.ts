export type UnitStatus = 
  | 'transferred'
  | 'live'
  | 'received'
  | 'rework'
  | 'completed'
  | 'pending_verification';

export type Department = 'BSR' | 'ELT' | 'R&D' | 'OQC' | 'AREA';

export interface TimelineStep {
  id: string;
  stageIndex: number;
  stageName: string;
  department: Department;
  personName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm AM/PM
  remarks: string;
  status: 'completed' | 'current' | 'pending';
}

export interface ObservationNote {
  id: string;
  text: string;
  timestamp: string;
}

export interface Unit {
  id: string;
  modelName: string;
  serialNumber: string;
  requiredBy: string; // YYYY-MM-DD
  dayDuration: number;
  transferDate: string; // YYYY-MM-DD HH:mm
  bsrPerson: string;
  eltPerson: string;
  rdPerson: string;
  oqcPerson?: string;
  currentHolder: string;
  currentStageIndex: number; // 0 to 9
  status: UnitStatus;
  timeline: TimelineStep[];
  priority?: 'High' | 'Medium' | 'Normal';
  notes?: string;
  observations?: ObservationNote[];
  createdAt: string;
  updatedAt: string;
}

export interface DynamicUnitRow {
  id: string;
  modelName: string;
  serialNumber: string;
}

export interface ActivityLog {
  id: string;
  unitId: string;
  modelName: string;
  serialNumber: string;
  action: string;
  performedBy: string;
  timestamp: string;
  stageName?: string;
  type: 'transfer' | 'stage_update' | 'rework' | 'received' | 'delete' | 'edit' | 'shift_start' | 'shift_off' | 'shift_change';
}

export interface LabNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'alert';
  unitId?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'Lab Manager' | 'BSR Specialist' | 'ELT Engineer' | 'R&D Lead' | 'OQC Inspector';
  department: Department;
  avatarUrl: string;
}

export interface ReportDetails {
  reportNo?: string;
  sampleType?: string;
  sampleReceived?: string;
  testCommenced?: string;
  testCompleted?: string;
}

export interface NamePlateDetails {
  coolingCapacity?: string;
  ratedCoolingPower?: string;
  ratedPower?: string;
  ratedCurrent?: string;
  voltage?: string;
  iseer?: string;
  gasQty?: string;
  mainProgramChecksumIdu?: string;
  mainProgramChecksumOdu?: string;
  gasInjectionVolume?: string;
  powerMode?: string;
  eeChecksumIdu?: string;
  eeChecksumOdu?: string;
  refrigerant?: string;
  fourWaySwing?: string;
  rpm?: string;
}

export interface ProtoUnitParts {
  // IDU Details
  iduMotorSpec?: string;
  iduMotorPartCode?: string;
  iduMotorSupplier?: string;
  iduPcbPartCode?: string;
  iduPcbSupplier?: string;
  iduRpm?: string;
  iduFourWaySwing?: string;
  fourWaySwing?: string;
  rpm?: string;

  // ODU Details
  oduMotorSpec?: string;
  oduMotorPartCode?: string;
  oduMotorSupplier?: string;
  oduPcbPartCode?: string;
  oduPcbSupplier?: string;

  // Compressor Details
  compressorSpec?: string;
  compressorPartCode?: string;
  compressorSupplier?: string;
  oduCompressorSpec?: string;
  oduCompressorPartCode?: string;
  oduCompressorSupplier?: string;

  // EEV Details
  eevSpec?: string;
  eevPartCode?: string;
  eevSupplier?: string;
  oduEevSpec?: string;
  oduEevSupplier?: string;
  oduEevPartCode?: string;
}

export interface ProtoPhotoRecord {
  photoKey: string;
  photoUrl: string;
  label?: string;
}

export interface ProtoUnitPhotos {
  indoorUnitPhoto?: string;
  productPhoto?: string;
  packingBoxPhoto?: string;
  iduNameplatePhoto?: string;
  oduNameplatePhoto?: string;
  iduPcbPhoto?: string;
  iduMotorPhoto?: string;
  oduPcbPhoto?: string;
  oduMotorPhoto?: string;
  oduCompressorPhoto?: string;
  oduEevPhoto?: string;
  stickerPhoto?: string;
  remotePhoto?: string;
  
  // Word Report Content Control Keys
  PHOTO_Indoor_Unit?: string;
  PHOTO_Product_Packing?: string;
  PHOTO_Packing_Box?: string;
  PHOTO_IDU_Motor?: string;
  PHOTO_IDU_PCB?: string;
  PHOTO_IDU_Product_Name_Plate?: string;
  PHOTO_IDU_Name_Plate?: string;
  PHOTO_Remote?: string;
  PHOTO_ODU_Name_Plate?: string;
  PHOTO_ODU_Motor?: string;
  PHOTO_ODU_PCB?: string;
  PHOTO_Electronic_Expansion_Valve?: string;
  PHOTO_EEV?: string;
  PHOTO_ODU_Compressor?: string;
  PHOTO_Compressor?: string;

  // Stored record list
  photoRecords?: ProtoPhotoRecord[];
  [key: string]: any;
}

export interface ProtoUnit {
  id: string;
  modelName: string;
  sampleType?: string;
  station?: string; // e.g. 'Station 01' to 'Station 20'
  iduSerialNumber: string;
  oduSerialNumber: string;
  requestBy: string;
  testPurpose: string;
  requiredHour: number;
  doneHour?: number;
  reportDetails?: ReportDetails;
  namePlate?: NamePlateDetails;
  partsInfo: ProtoUnitParts;
  photos: ProtoUnitPhotos;
  fourWaySwing?: string;
  rpm?: string;
  remarks?: string;
  observations?: ObservationNote[];
  status: 'live' | 'finished' | 'stopped';
  createdAt: string; // Formatted date time e.g., '2026-07-30 14:30'
  updatedAt: string;
  endDateTime?: string; // Machine End Date & Time (auto-synchronized with Test Completed)
  completedAt?: string; // Formatted date time when machine completed
}

export interface PpUnit {
  id: string;
  modelName: string;
  sampleType?: string;
  unitType?: 'IDU' | 'ODU' | 'BOTH';
  materialCode?: string;
  version?: string;
  quantity?: number;
  station?: string; // e.g. 'Station 01' to 'Station 20'
  iduSerialNumber: string;
  oduSerialNumber: string;
  requestBy: string;
  testPurpose: string;
  requiredHour: number;
  doneHour?: number;
  reportDetails?: ReportDetails;
  namePlate?: NamePlateDetails;
  partsInfo: ProtoUnitParts;
  photos: ProtoUnitPhotos;
  fourWaySwing?: string;
  rpm?: string;
  remarks?: string;
  observations?: ObservationNote[];
  status: 'live' | 'finished' | 'stopped';
  entrySource?: 'model_list' | 'unit_testing';
  isModelOnly?: boolean;
  createdAt: string; // Formatted date time e.g., '2026-07-30 14:30'
  updatedAt: string;
  endDateTime?: string; // Machine End Date & Time (auto-synchronized with Test Completed)
  completedAt?: string; // Formatted date time when machine completed
}

export interface FieldUnit {
  id: string;
  modelName: string;
  productType: 'IDU' | 'ODU' | 'BOTH';
  iduSerialNumber?: string;
  oduSerialNumber?: string;
  serialNumber: string;
  requestBy: string;
  station: string;
  startDateTime: string;
  endDateTime?: string;
  requiredHour: number;
  doneHour?: number;
  status: 'live' | 'stopped' | 'finished';
  remarks?: string;
  observations?: ObservationNote[];
  photos?: ProtoUnitPhotos;
  createdAt: string;
  updatedAt: string;
}

export const WORKFLOW_STAGES: { stageName: string; department: Department; defaultRole: string }[] = [
  { stageName: 'Step 1: BSR Person', department: 'BSR', defaultRole: 'BSR Person (Amit)' },
  { stageName: 'Step 2: ELT Person', department: 'ELT', defaultRole: 'ELT Person (Raju)' },
  { stageName: 'Step 3: R&D Person', department: 'R&D', defaultRole: 'R&D Person (Mukesh)' },
  { stageName: 'Step 4: R&D Area', department: 'AREA', defaultRole: 'Requested By' },
  { stageName: 'Step 5: R&D Person (Return)', department: 'R&D', defaultRole: 'R&D Person' },
  { stageName: 'Step 6: ELT Person', department: 'ELT', defaultRole: 'ELT Person' },
  { stageName: 'Step 7: OQC Person', department: 'OQC', defaultRole: 'OQC Inspector' },
  { stageName: 'Step 8: Unit Verification / Observation', department: 'OQC', defaultRole: 'OQC Inspector' },
  { stageName: 'Step 9: Rework Done', department: 'OQC', defaultRole: 'OQC / R&D Specialist' },
  { stageName: 'Step 10: OQC → BSR Transfer', department: 'BSR', defaultRole: 'BSR Transfer Officer' },
  { stageName: 'Step 11: BSR Transfer Completed', department: 'BSR', defaultRole: 'BSR Receiver' },
];

export type AuthRole = 'admin' | 'random';
export type UserAccountStatus = 'active' | 'disabled' | 'deleted';

export interface AppUserAccount {
  id: string; // Document ID / Auth UID
  name: string;
  userId: string; // Unique User ID e.g. ADMIN01, CLIENT001
  role: AuthRole;
  status: UserAccountStatus;
  passwordHash?: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
}

