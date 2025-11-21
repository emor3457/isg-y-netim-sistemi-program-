
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ShieldCheckIcon, 
  ExclamationTriangleIcon, 
  ClipboardDocumentCheckIcon, 
  ChartBarIcon, 
  CameraIcon,
  TrashIcon,
  ArrowPathIcon,
  BellIcon,
  EnvelopeIcon,
  CalculatorIcon,
  PlusIcon,
  XMarkIcon,
  BuildingStorefrontIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  CheckIcon,
  BriefcaseIcon,
  UserGroupIcon,
  AcademicCapIcon,
  HeartIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  ArrowDownTrayIcon,
  TableCellsIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  AdjustmentsHorizontalIcon,
  InformationCircleIcon,
  BookOpenIcon,
  MagnifyingGlassPlusIcon,
  UserIcon,
  PhotoIcon,
  DocumentTextIcon,
  FolderOpenIcon
} from '@heroicons/react/24/outline';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { analyzeHazard, parseEmployeeData } from './services/gemini';

// --- Data Types ---

interface RiskThresholds {
    intolerable: number; // Default 400
    substantial: number; // Default 200
    important: number;   // Default 70
    possible: number;    // Default 20
}

// Hierarchy: Registry (Sicil) -> BusinessUnit (İşletme)
interface BusinessUnit {
  id: string;
  name: string;
  thresholds?: RiskThresholds; // Custom thresholds per unit
}

interface Registry {
  id: string;
  name: string; // Sicil No / Firma Adı
  units: BusinessUnit[];
  isExpanded: boolean;
}

interface ActionItem {
  id: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  isCompleted: boolean;
  responsibleId?: string; // ID of the Employee responsible
}

interface RiskItem {
  id: string;
  location: string; // Stores the Unit Name (Flat reference for simplicity in MVP)
  department: string; // General Area (e.g. Kitchen)
  specific_area: string; // NEW: Specific spot (e.g. Fryer Section)
  detectionDate: string; // ISO Date YYYY-MM-DD - Immutable
  source: string;
  activity: string;
  hazard: string;
  risks: string;
  
  // Fine-Kinney Components
  probability: number; 
  frequency: number;   
  severity: number;    
  risk_score: number;

  current_measures: string;
  actions: ActionItem[]; // CHANGED: Now an array of objects
  status: 'Açık' | 'Devam Ediyor' | 'Tamamlandı';
  image?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'critical' | 'warning' | 'success';
  timestamp: string;
  riskId?: string;
  location: string;
}

// --- NEW: Employee Types ---
type HazardClass = 'Az Tehlikeli' | 'Tehlikeli' | 'Çok Tehlikeli';

interface Employee {
  id: string;
  name: string;
  location: string; // Unit Name
  jobTitle: string;
  hazardClass: HazardClass;
  lastTrainingDate: string; // ISO Date String YYYY-MM-DD
  lastHealthCheckDate: string; // ISO Date String YYYY-MM-DD
}

interface ReportConfig {
    companyTitle: string;
    address: string;
    sgkNo: string;
    hazardClass: HazardClass; 
    revisionNo: string;
    revisionDate: string;
    // Team Roles
    employer?: string; // Name string or ID
    specialistId?: string; // Employee ID
    doctorId?: string; // Employee ID
    repId?: string; // Employee ID
}

// --- Constants ---
const STANDARD_DEPARTMENTS = [
    "Genel Alan",
    "Ofisler",
    "Çay Ocağı",
    "Dinlenme Alanları",
    "Mutfak",
    "Depo / Arşiv",
    "Teknik Oda / Sistem Odası",
    "Tuvalet / Duş",
    "Dış Saha / Otopark",
    "Üretim Hattı",
    "Koridor / Merdiven",
    "Lobi / Karşılama"
];

const DEFAULT_THRESHOLDS: RiskThresholds = {
    intolerable: 400,
    substantial: 200,
    important: 70,
    possible: 20
};

// Sample Data for Initialization
const SAMPLE_RISKS: RiskItem[] = [
    {
        id: 'sample-1',
        location: 'Genel Müdürlük',
        department: 'Mutfak',
        specific_area: 'Bulaşıkhane',
        detectionDate: '2024-05-20',
        source: 'Zemin',
        activity: 'Temizlik ve Bulaşık Yıkama',
        hazard: 'Islak ve kaygan zemin',
        risks: 'Kayma ve düşme sonucu yaralanma',
        probability: 3,
        frequency: 6,
        severity: 7,
        risk_score: 126,
        current_measures: 'Kaymaz tabanlı ayakkabı kullanımı zorunlu değil.',
        actions: [
            { id: 'act-1', description: 'Kaymaz zemin kaplaması yapılmalı', dueDate: '2024-06-20', isCompleted: false },
            { id: 'act-2', description: 'Uyarı levhaları temin edilmeli', dueDate: '2024-05-25', isCompleted: true, responsibleId: 'emp-1' }
        ],
        status: 'Devam Ediyor',
        image: 'https://images.unsplash.com/photo-1584622412117-b1cc54fa9e95?q=80&w=150&auto=format&fit=crop'
    },
    {
        id: 'sample-2',
        location: 'Ek Bina',
        department: 'Teknik Oda / Sistem Odası',
        specific_area: 'Elektrik Panosu',
        detectionDate: '2024-05-18',
        source: 'Elektrik Tesisatı',
        activity: 'Bakım Onarım',
        hazard: 'Açıkta duran kablo uçları',
        risks: 'Elektrik çarpması, yangın',
        probability: 3,
        frequency: 3,
        severity: 40,
        risk_score: 360,
        current_measures: 'Pano kilitli değil.',
        actions: [
            { id: 'act-3', description: 'Kablolar izole edilmeli ve pano kilitlenmeli', dueDate: '2024-05-21', isCompleted: false, responsibleId: 'emp-2' }
        ],
        status: 'Açık',
        image: 'https://images.unsplash.com/photo-1544724569-5f546fd6dd2d?q=80&w=150&auto=format&fit=crop'
    }
];

// --- Helper Functions ---

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const getRiskClass = (score: number, thresholds: RiskThresholds = DEFAULT_THRESHOLDS) => {
  if (score > thresholds.intolerable) return { label: 'TOLERANS GÖSTERİLEMEZ', color: 'bg-red-600 text-white', pdfColor: [255, 0, 0], action: 'Hemen Durdur', hex: '#dc2626' };
  if (score > thresholds.substantial) return { label: 'ESASLI RİSK', color: 'bg-orange-600 text-white', pdfColor: [255, 69, 0], action: 'Acil İyileştir', hex: '#ea580c' };
  if (score > thresholds.important)  return { label: 'ÖNEMLİ RİSK', color: 'bg-orange-500 text-white', pdfColor: [255, 165, 0], action: 'Kısa Vadede Çöz', hex: '#f97316' };
  if (score > thresholds.possible)  return { label: 'OLASI RİSK', color: 'bg-yellow-500 text-black', pdfColor: [255, 255, 0], action: 'Gözetim Altında Tut', hex: '#eab308' };
  return { label: 'ÖNEMSİZ RİSK', color: 'bg-green-600 text-white', pdfColor: [0, 128, 0], action: 'İzlemeye Devam', hex: '#16a34a' };
};

// SLA Calculation Logic - Updated for Local Time & Specific Rules
const calculateSLADate = (score: number, thresholds: RiskThresholds = DEFAULT_THRESHOLDS): string => {
  const now = new Date();
  let targetDate = new Date(now);
  
  if (score > thresholds.intolerable) {
    // Hemen (Bugün) - Tolerans Gösterilemez
    // No days added
  } else if (score > thresholds.substantial) {
    // 1 Ay - Esaslı Risk
    targetDate.setDate(now.getDate() + 30);
  } else if (score > thresholds.important) {
    // 2 Ay - Önemli Risk
    targetDate.setDate(now.getDate() + 60);
  } else if (score > thresholds.possible) {
    // 3 Ay - Olası Risk
    targetDate.setDate(now.getDate() + 90);
  } else {
    // Önemsiz (6 Ay - Düşük Öncelik)
    targetDate.setDate(now.getDate() + 180);
  }
  
  // Format YYYY-MM-DD using local time components to avoid UTC shifts
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

const getSLALabel = (score: number, thresholds: RiskThresholds = DEFAULT_THRESHOLDS): string => {
    if (score > thresholds.intolerable) return "Acil (Hemen)";
    if (score > thresholds.substantial) return "1 Ay";
    if (score > thresholds.important) return "2 Ay";
    if (score > thresholds.possible) return "3 Ay";
    return "Düşük Öncelik";
};

// 6331 Logic for Training & Health Validity
const calculateValidity = (dateStr: string, hazardClass: HazardClass, type: 'training' | 'health') => {
  if (!dateStr) return { status: 'missing', label: 'Veri Yok', color: 'text-zinc-500 bg-zinc-800', days: 0 };

  const date = new Date(dateStr);
  const now = new Date();
  let yearsToAdd = 0;

  if (type === 'training') {
    // Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik
    if (hazardClass === 'Çok Tehlikeli') yearsToAdd = 1;
    else if (hazardClass === 'Tehlikeli') yearsToAdd = 2;
    else yearsToAdd = 3; // Az Tehlikeli
  } else {
    // Sağlık Gözetimi (Genel teamül ve yönetmelik taslakları - Periyodik Muayene)
    if (hazardClass === 'Çok Tehlikeli') yearsToAdd = 1;
    else if (hazardClass === 'Tehlikeli') yearsToAdd = 3;
    else yearsToAdd = 5; // Az Tehlikeli
  }

  const dueDate = new Date(date);
  dueDate.setFullYear(dueDate.getFullYear() + yearsToAdd);

  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { status: 'expired', label: 'Süresi Doldu', color: 'text-red-500 bg-red-900/20', days: diffDays };
  if (diffDays < 60) return { status: 'warning', label: `${diffDays} Gün Kaldı`, color: 'text-orange-500 bg-orange-900/20', days: diffDays };
  return { status: 'valid', label: 'Geçerli', color: 'text-green-500 bg-green-900/20', days: diffDays };
};

const isOverdue = (dateStr: string) => {
    if (!dateStr) return false;
    const due = new Date(dateStr);
    const now = new Date();
    // Reset times to compare dates only or end of day
    due.setHours(23, 59, 59, 999);
    return due < now;
};

// Helper to convert Excel date number to ISO string
const excelDateToJSDate = (serial: any) => {
   if (!serial) return '';
   // If already string like "2023-01-01" or "20.01.2023"
   if (typeof serial === 'string') {
       // Try simple parse first
       if (serial.includes('-')) return serial;
       if (serial.includes('.')) {
           const parts = serial.split('.');
           if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
       }
       return serial;
   }
   // Excel serial date
   const utc_days  = Math.floor(serial - 25569);
   const utc_value = utc_days * 86400;                                        
   const date_info = new Date(utc_value * 1000);
   return date_info.toISOString().split('T')[0];
}

// Turkish Character Normalization for jsPDF (standard fonts don't support full utf8)
const normalizeForPDF = (text: string): string => {
    if (!text) return "";
    const map: {[key: string]: string} = {
        'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ç': 'c', 'Ç': 'C'
    };
    return text.replace(/[ğĞüÜşŞıİöÖçÇ]/g, (char) => map[char] || char);
};

// --- Sub-Components ---

interface RiskRowProps {
  item: RiskItem;
  thresholds: RiskThresholds;
  employees: Employee[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: any) => void;
  onAddAction: (id: string, action: string, date: string, responsibleId?: string) => void;
  onDeleteAction: (id: string, actionId: string) => void;
  onToggleAction: (id: string, actionId: string) => void;
  onUpdateActionDate: (id: string, actionId: string, date: string) => void;
  onUpdateActionResponsible: (id: string, actionId: string, responsibleId: string) => void;
  onUpdateLocation: (id: string, dept: string, spec: string) => void;
  onExpandImage: (url: string) => void;
}

const RiskRow: React.FC<RiskRowProps> = ({ 
  item, 
  thresholds,
  employees,
  onDelete, 
  onStatusChange,
  onAddAction,
  onDeleteAction,
  onToggleAction,
  onUpdateActionDate,
  onUpdateActionResponsible,
  onUpdateLocation,
  onExpandImage
}) => {
  const [newActionText, setNewActionText] = useState("");
  const [newActionDate, setNewActionDate] = useState("");
  const [newActionResponsible, setNewActionResponsible] = useState("");
  
  // Location Editing State
  const [isEditingLoc, setIsEditingLoc] = useState(false);
  const [tempDept, setTempDept] = useState(item.department);
  const [tempSpec, setTempSpec] = useState(item.specific_area);

  const riskClass = getRiskClass(item.risk_score, thresholds);
  const slaLabel = getSLALabel(item.risk_score, thresholds);

  // Calculate days left for the nearest upcoming action
  const calculateDaysLeft = () => {
      if (item.actions.length === 0) return null;
      
      // Get active actions sorted by date
      const activeActions = item.actions
        .filter(a => !a.isCompleted)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      if (activeActions.length === 0) return null;

      const nearest = activeActions[0];
      const due = new Date(nearest.dueDate);
      const now = new Date();
      const diffTime = due.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
  };

  const daysLeft = calculateDaysLeft();

  // Set default SLA date when opening/rendering or if empty
  useEffect(() => {
      if (!newActionDate) {
          setNewActionDate(calculateSLADate(item.risk_score, thresholds));
      }
  }, [item.risk_score, thresholds]);

  const handleAddAction = () => {
    if (newActionText.trim()) {
      const dateToUse = newActionDate || calculateSLADate(item.risk_score, thresholds);
      onAddAction(item.id, newActionText.trim(), dateToUse, newActionResponsible);
      setNewActionText("");
      setNewActionResponsible("");
      setNewActionDate(calculateSLADate(item.risk_score, thresholds));
    }
  };

  const saveLocation = () => {
      onUpdateLocation(item.id, tempDept, tempSpec);
      setIsEditingLoc(false);
  };

  return (
    <tr className={`border-b border-zinc-800 transition-colors group text-sm ${item.status === 'Tamamlandı' ? 'bg-zinc-900/30 opacity-60' : 'hover:bg-zinc-800/30'}`}>
      <td className="p-4 align-top">
        {item.image && (
          <div className="relative w-16 h-16 mb-2 z-0 hover:z-50 group/img">
             <img 
                src={item.image} 
                alt="Hazard" 
                onClick={() => onExpandImage(item.image!)}
                className="w-16 h-16 object-cover rounded-md border border-zinc-700 transition-transform duration-200 ease-out origin-top-left hover:scale-[4] shadow-sm hover:shadow-2xl bg-zinc-800 cursor-zoom-in z-10 hover:z-50" 
             />
             {/* Small Hint Icon on Hover */}
             <div className="absolute bottom-0 right-0 bg-black/60 text-white p-0.5 rounded-tl text-[8px] opacity-0 group-hover/img:opacity-100 pointer-events-none z-50">
                <MagnifyingGlassPlusIcon className="w-3 h-3" />
             </div>
          </div>
        )}
        
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[10px] text-blue-400 uppercase tracking-wider font-bold">
                <MapPinIcon className="w-3 h-3" />
                {item.location}
            </div>
            
            {isEditingLoc ? (
                <div className="pl-4 border-l border-blue-500 flex flex-col gap-1 mt-1">
                    <select 
                        value={tempDept} 
                        onChange={(e) => setTempDept(e.target.value)}
                        className="text-[10px] bg-zinc-900 border border-zinc-700 rounded p-1 text-white outline-none"
                    >
                        {STANDARD_DEPARTMENTS.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                    <input 
                        type="text" 
                        value={tempSpec}
                        onChange={(e) => setTempSpec(e.target.value)}
                        className="text-[10px] bg-zinc-900 border border-zinc-700 rounded p-1 text-white outline-none"
                        placeholder="Örn: 2. Kat Balkon"
                    />
                    <div className="flex gap-1 mt-1">
                        <button onClick={saveLocation} className="bg-green-900/50 text-green-400 p-1 rounded hover:bg-green-800"><CheckIcon className="w-3 h-3" /></button>
                        <button onClick={() => setIsEditingLoc(false)} className="bg-red-900/50 text-red-400 p-1 rounded hover:bg-red-800"><XMarkIcon className="w-3 h-3" /></button>
                    </div>
                </div>
            ) : (
                <div className="text-[10px] text-zinc-400 pl-4 border-l border-zinc-700 flex flex-col group/editloc relative">
                    <div className="flex items-center gap-1">
                        <span className="font-semibold text-zinc-300">{item.department || "Genel"}</span>
                        <button 
                            onClick={() => setIsEditingLoc(true)}
                            className="opacity-0 group-hover/editloc:opacity-100 transition-opacity text-blue-400 hover:text-white"
                            title="Bölümü Düzenle"
                        >
                            <PencilSquareIcon className="w-3 h-3" />
                        </button>
                    </div>
                    {item.specific_area && (
                        <span className="text-zinc-500"> &gt; {item.specific_area}</span>
                    )}
                </div>
            )}

             <div className="text-[10px] text-zinc-500 pl-4 flex items-center gap-1 mt-1">
                <CalendarDaysIcon className="w-3 h-3" />
                <span title="Tespit Tarihi (Değiştirilemez)">{item.detectionDate}</span>
            </div>
        </div>

        <div className="font-medium text-zinc-200 mt-2">{item.source}</div>
        <div className="text-xs text-zinc-500">{item.activity}</div>
      </td>
      
      <td className="p-4 align-top w-1/5">
        <div className="text-red-400 font-medium mb-1">{item.hazard}</div>
        <div className="text-zinc-400 text-xs">{item.risks}</div>
      </td>

      {/* Fine-Kinney Calculation Column */}
      <td className="p-4 align-top font-mono text-xs">
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-zinc-400">
            <span>Olasılık:</span> <span className="text-zinc-200 font-bold">{item.probability}</span>
            <span>Frekans:</span> <span className="text-zinc-200 font-bold">{item.frequency}</span>
            <span>Şiddet:</span> <span className="text-zinc-200 font-bold">{item.severity}</span>
            <div className="col-span-2 border-t border-zinc-700 my-1"></div>
            <span className="font-bold text-white">SKOR:</span> 
            <span className={`font-bold px-1 rounded ${riskClass.color}`}>
                {item.risk_score}
            </span>
        </div>
        <div className="mt-2 text-[10px] uppercase tracking-wider font-bold text-zinc-500">
            {riskClass.label}
        </div>
        <div className="mt-1 text-[9px] text-zinc-600 border border-zinc-800 rounded px-1 py-0.5 inline-block">
            SLA: {slaLabel}
        </div>
      </td>

      <td className="p-4 align-top">
         {/* SLA Countdown Status */}
         {daysLeft !== null && item.status !== 'Tamamlandı' && (
            <div className={`mb-2 text-xs font-bold px-2 py-1 rounded inline-flex items-center gap-1 ${
                daysLeft < 0 ? 'bg-red-900/50 text-red-500 animate-pulse' :
                daysLeft < 5 ? 'bg-orange-900/30 text-orange-500' :
                'bg-green-900/30 text-green-500'
            }`}>
                <ClockIcon className="w-3.5 h-3.5" />
                {daysLeft < 0 ? `GECİKTİ (${Math.abs(daysLeft)} Gün)` : `${daysLeft} Gün Kaldı`}
            </div>
        )}

        <div className="space-y-2 mb-3">
          {item.actions.map((action) => {
            const overdue = isOverdue(action.dueDate) && !action.isCompleted;
            return (
            <div key={action.id} className={`flex items-start justify-between p-2 rounded border transition-all ${action.isCompleted ? 'bg-green-900/10 border-green-900/30' : overdue ? 'bg-red-900/10 border-red-900/30' : 'bg-zinc-900/50 border-zinc-800'}`}>
              <div className="flex items-start gap-2 w-full">
                  <button 
                    onClick={() => onToggleAction(item.id, action.id)}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${action.isCompleted ? 'bg-green-500 border-green-500' : 'border-zinc-600 hover:border-blue-500'}`}
                  >
                      {action.isCompleted && <CheckIcon className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex flex-col w-full">
                      <span className={`text-xs ${action.isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>{action.description}</span>
                      
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* Date Picker */}
                        <div className="flex items-center gap-1 bg-zinc-950/30 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors">
                            <ClockIcon className={`w-3 h-3 ${overdue ? 'text-red-400' : 'text-zinc-500'}`} />
                            <input 
                                type="date" 
                                value={action.dueDate}
                                onChange={(e) => onUpdateActionDate(item.id, action.id, e.target.value)}
                                className={`bg-transparent text-[10px] outline-none border-none p-0 w-20 ${action.isCompleted ? 'text-zinc-600' : overdue ? 'text-red-400 font-bold' : 'text-zinc-400 hover:text-white'} cursor-pointer`}
                            />
                        </div>

                        {/* Responsible Selector */}
                        <div className="flex items-center gap-1 bg-zinc-950/30 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors max-w-[140px]">
                            <UserIcon className="w-3 h-3 text-zinc-500" />
                            <select
                                value={action.responsibleId || ""}
                                onChange={(e) => onUpdateActionResponsible(item.id, action.id, e.target.value)}
                                className="bg-transparent text-[10px] text-zinc-400 outline-none border-none w-full cursor-pointer truncate"
                            >
                                <option value="">Sorumlu Ata...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>

                        {overdue && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded uppercase font-bold">Gecikti</span>}
                      </div>
                  </div>
              </div>
              <button 
                onClick={() => onDeleteAction(item.id, action.id)}
                className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 flex-shrink-0 ml-2"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )})}
        </div>

        {/* Add New Action */}
        <div className="flex flex-col gap-2 opacity-60 group-hover:opacity-100 transition-opacity bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
            <input 
                type="text" 
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                placeholder="Yeni aksiyon..." 
                className="bg-transparent text-xs text-zinc-200 placeholder-zinc-600 w-full outline-none"
            />
            <div className="flex items-center justify-between pt-1 border-t border-zinc-800 gap-2">
                <div className="flex items-center gap-2">
                    <input 
                        type="date" 
                        value={newActionDate}
                        onChange={(e) => setNewActionDate(e.target.value)}
                        className="bg-transparent text-[10px] text-zinc-400 outline-none focus:text-white hover:text-white transition-colors w-20"
                    />
                    
                    {/* Responsible Selector for New Action */}
                    <select
                        value={newActionResponsible}
                        onChange={(e) => setNewActionResponsible(e.target.value)}
                        className="bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-400 outline-none w-24"
                    >
                        <option value="">Personel...</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                    </select>

                    <span className="text-[9px] text-blue-500 hidden sm:inline">SLA: {slaLabel}</span>
                </div>
                <button 
                    onClick={handleAddAction}
                    disabled={!newActionText.trim()}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 font-medium shrink-0"
                >
                    EKLE
                </button>
            </div>
        </div>
      </td>
      <td className="p-4 align-top text-right">
        <select 
          value={item.status}
          onChange={(e) => onStatusChange(item.id, e.target.value)}
          className={`text-xs rounded px-2 py-1 border-none focus:ring-1 focus:ring-blue-500 cursor-pointer mb-2 block ml-auto w-full
            ${item.status === 'Açık' ? 'bg-red-900/30 text-red-400' : 
              item.status === 'Devam Ediyor' ? 'bg-yellow-900/30 text-yellow-400' : 
              'bg-green-900/30 text-green-400'}`}
        >
          <option value="Açık">Açık</option>
          <option value="Devam Ediyor">Sürüyor</option>
          <option value="Tamamlandı">Tamam</option>
        </select>
        <button 
          onClick={() => onDelete(item.id)}
          className="text-zinc-600 hover:text-red-500 transition-colors p-1"
          title="Sil"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

// --- Main Component ---

const App: React.FC = () => {
  // --- State Management ---
  
  // Initial Hierarchy Data - Updated for General Directorate structure
  const [registries, setRegistries] = useState<Registry[]>([
    {
        id: 'reg-hq',
        name: 'Genel Merkez',
        isExpanded: true,
        units: [
            { id: 'u-hq-1', name: 'Genel Müdürlük' },
            { id: 'u-hq-2', name: 'Ek Bina' }
        ]
    }
  ]);

  const [selectedLocation, setSelectedLocation] = useState<string>("Tüm İşletmeler");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTempName, setEditTempName] = useState("");
  
  // Logo State
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [risks, setRisks] = useState<RiskItem[]>(SAMPLE_RISKS);
  
  // Expanded Image State (Lightbox)
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  
  // Employee State
  const [employees, setEmployees] = useState<Employee[]>([
      { id: 'emp-1', name: 'Ahmet Yılmaz', location: 'Genel Müdürlük', jobTitle: 'İdari İşler Şefi', hazardClass: 'Az Tehlikeli', lastTrainingDate: '2023-01-15', lastHealthCheckDate: '2022-05-20' },
      { id: 'emp-2', name: 'Ayşe Demir', location: 'Genel Müdürlük', jobTitle: 'Mimar', hazardClass: 'Az Tehlikeli', lastTrainingDate: '2021-06-10', lastHealthCheckDate: '2020-01-10' }
  ]);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showImportEmployee, setShowImportEmployee] = useState(false);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  
  // Default blank employee
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ 
      hazardClass: 'Tehlikeli', 
      lastTrainingDate: '', 
      lastHealthCheckDate: '',
      location: '' 
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'risks' | 'personnel'>('dashboard');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  
  // Confirmation Modal State
  const [confirmation, setConfirmation] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Threshold Settings Modal State
  const [thresholdModal, setThresholdModal] = useState<{
      isOpen: boolean;
      registryId: string;
      unitId: string;
      unitName: string;
      values: RiskThresholds;
  }>({ isOpen: false, registryId: '', unitId: '', unitName: '', values: DEFAULT_THRESHOLDS });
  
  // Report Configuration State
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
      companyTitle: 'BELTUR A.Ş.',
      address: 'İstanbul, Türkiye',
      sgkNo: '...',
      hazardClass: 'Tehlikeli', // Default
      revisionNo: '00',
      revisionDate: new Date().toISOString().split('T')[0],
      employer: '' // Default empty
  });
  const [showReportConfig, setShowReportConfig] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get all flat units
  const getAllUnits = () => {
      const units: {id: string, name: string, thresholds?: RiskThresholds}[] = [];
      registries.forEach(reg => {
          reg.units.forEach(u => units.push(u));
      });
      return units;
  };

  const getThresholdsForLocation = (locName: string): RiskThresholds => {
      const allUnits = getAllUnits();
      const unit = allUnits.find(u => u.name === locName);
      return unit?.thresholds || DEFAULT_THRESHOLDS;
  };
  
  // Determine thresholds for the currently active view (for methodology display)
  const currentViewThresholds = selectedLocation === "Tüm İşletmeler" 
      ? DEFAULT_THRESHOLDS 
      : getThresholdsForLocation(selectedLocation);

  // --- Logic: Hierarchy Management ---
  // ... (Existing hierarchy logic omitted for brevity, keeping it same) ...

  const toggleRegistry = (id: string) => {
    setRegistries(prev => prev.map(reg => 
        reg.id === id ? { ...reg, isExpanded: !reg.isExpanded } : reg
    ));
  };

  const startEditing = (id: string, currentName: string) => {
      setEditingId(id);
      setEditTempName(currentName);
  };

  const saveEditing = () => {
      if (!editingId || !editTempName.trim()) {
          setEditingId(null);
          return;
      }
      
      let oldName = "";

      setRegistries(prev => prev.map(reg => {
          if (reg.id === editingId) {
              oldName = reg.name;
              return { ...reg, name: editTempName };
          }
          const unitExists = reg.units.find(u => u.id === editingId);
          if (unitExists) {
              oldName = unitExists.name;
              return {
                  ...reg,
                  units: reg.units.map(u => u.id === editingId ? { ...u, name: editTempName } : u)
              };
          }
          return reg;
      }));
      
      if (oldName && selectedLocation === oldName) {
          setSelectedLocation(editTempName);
      }

      setEditingId(null);
  };

  const addRegistry = () => {
      const newReg: Registry = {
          id: generateId(),
          name: 'Yeni Sicil',
          isExpanded: true,
          units: []
      };
      setRegistries([...registries, newReg]);
      setTimeout(() => startEditing(newReg.id, newReg.name), 100);
  };

  const addUnit = (registryId: string) => {
      const newUnit: BusinessUnit = {
          id: generateId(),
          name: 'Yeni İşletme'
      };
      setRegistries(prev => prev.map(reg => 
        reg.id === registryId ? { ...reg, units: [...reg.units, newUnit], isExpanded: true } : reg
      ));
      setTimeout(() => startEditing(newUnit.id, newUnit.name), 100);
  };

  const requestDeleteRegistry = (id: string) => {
      const regToDelete = registries.find(r => r.id === id);
      if (!regToDelete) return;
      
      setConfirmation({
          isOpen: true,
          title: 'Sicil Silinecek',
          message: `${regToDelete.name} sicilini ve altındaki tüm işletmeleri silmek istediğinize emin misiniz?`,
          onConfirm: () => {
              setRegistries(prev => prev.filter(r => r.id !== id));
              const isCurrentLocationInRegistry = regToDelete.units.some(u => u.name === selectedLocation);
              if (isCurrentLocationInRegistry) {
                  setSelectedLocation("Tüm İşletmeler");
              }
              setConfirmation(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const requestDeleteUnit = (registryId: string, unitId: string) => {
      const registry = registries.find(r => r.id === registryId);
      const unitToDelete = registry?.units.find(u => u.id === unitId);
      
      if (!unitToDelete) return;

      setConfirmation({
          isOpen: true,
          title: 'İşletme Silinecek',
          message: `${unitToDelete.name} işletmesini silmek istediğinize emin misiniz?`,
          onConfirm: () => {
              setRegistries(prev => prev.map(reg => 
                reg.id === registryId ? { ...reg, units: reg.units.filter(u => u.id !== unitId) } : reg
              ));
              
              if (selectedLocation === unitToDelete.name) {
                  setSelectedLocation("Tüm İşletmeler");
              }
              setConfirmation(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const openThresholdSettings = (registryId: string, unit: BusinessUnit) => {
      setThresholdModal({
          isOpen: true,
          registryId,
          unitId: unit.id,
          unitName: unit.name,
          values: unit.thresholds || DEFAULT_THRESHOLDS
      });
  };

  const saveThresholds = () => {
      setRegistries(prev => prev.map(reg => {
          if (reg.id !== thresholdModal.registryId) return reg;
          return {
              ...reg,
              units: reg.units.map(u => {
                  if (u.id !== thresholdModal.unitId) return u;
                  return { ...u, thresholds: thresholdModal.values };
              })
          };
      }));
      setThresholdModal(prev => ({ ...prev, isOpen: false }));
  };

  // --- Logic: Filtering & Stats (Keeping existing) ---
  // ... (Stats logic matches previous version) ...
  const sortedRisks = [...risks].sort((a, b) => b.risk_score - a.risk_score);
  const filteredRisks = selectedLocation === "Tüm İşletmeler" ? sortedRisks : sortedRisks.filter(r => r.location === selectedLocation);
  const filteredEmployees = selectedLocation === "Tüm İşletmeler" ? employees : employees.filter(e => e.location === selectedLocation);
  const totalRisks = filteredRisks.length;
  const criticalRisks = filteredRisks.filter(r => { const t = getThresholdsForLocation(r.location); return r.risk_score > t.substantial && r.status !== 'Tamamlandı'; }).length;
  const highRisks = filteredRisks.filter(r => { const t = getThresholdsForLocation(r.location); return r.risk_score > t.important && r.risk_score <= t.substantial && r.status !== 'Tamamlandı'; }).length;
  const overdueActionsCount = filteredRisks.reduce((count, risk) => count + risk.actions.filter(a => !a.isCompleted && isOverdue(a.dueDate)).length, 0);
  const expiredTraining = filteredEmployees.filter(e => calculateValidity(e.lastTrainingDate, e.hazardClass, 'training').status === 'expired').length;
  const expiredHealth = filteredEmployees.filter(e => calculateValidity(e.lastHealthCheckDate, e.hazardClass, 'health').status === 'expired').length;
  
  const pieData = useMemo(() => {
    const counts = { 'TOLERANS GÖSTERİLEMEZ': { count: 0, color: '#dc2626' }, 'ESASLI RİSK': { count: 0, color: '#ea580c' }, 'ÖNEMLİ RİSK': { count: 0, color: '#f97316' }, 'OLASI RİSK': { count: 0, color: '#eab308' }, 'ÖNEMSİZ RİSK': { count: 0, color: '#16a34a' } };
    filteredRisks.forEach(r => { const t = getThresholdsForLocation(r.location); const cls = getRiskClass(r.risk_score, t); if (counts[cls.label as keyof typeof counts]) counts[cls.label as keyof typeof counts].count++; });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key as keyof typeof counts].count, color: counts[key as keyof typeof counts].color })).filter(d => d.value > 0);
  }, [filteredRisks]);
  const barData = useMemo(() => { const locs: {[key: string]: number} = {}; filteredRisks.forEach(r => { if (!locs[r.location]) locs[r.location] = 0; locs[r.location] += r.risk_score; }); return Object.keys(locs).map(k => ({ name: k, totalScore: locs[k] })); }, [filteredRisks]);
  const lineData = useMemo(() => { const months: {[key: string]: number} = {}; filteredRisks.forEach(r => { r.actions.forEach(a => { if(a.isCompleted) { const m = a.dueDate.substring(0, 7); months[m] = (months[m] || 0) + 1; } }); }); return Object.keys(months).sort().map(k => ({ name: k, actions: months[k] })); }, [filteredRisks]);

  useEffect(() => {
      // ... (Notifications Logic same as before) ...
      const generateNotifications = () => {
         const newNotifs: NotificationItem[] = [];
         const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
         risks.forEach(risk => {
            const t = getThresholdsForLocation(risk.location);
            if (risk.status !== 'Tamamlandı') {
               if (risk.risk_score > t.substantial) newNotifs.push({ id: `crit-${risk.id}`, title: `ACİL: ${risk.location}`, message: `${risk.source} noktasında skor ${risk.risk_score}.`, type: 'critical', timestamp: now, riskId: risk.id, location: risk.location });
               else if (risk.risk_score > t.important) newNotifs.push({ id: `warn-${risk.id}`, title: `Risk: ${risk.location}`, message: `${risk.source} (Skor: ${risk.risk_score}).`, type: 'warning', timestamp: now, riskId: risk.id, location: risk.location });
            }
            if (risk.actions.filter(a => !a.isCompleted && isOverdue(a.dueDate)).length > 0) newNotifs.push({ id: `act-due-${risk.id}`, title: 'Geciken Aksiyonlar', message: `${risk.location} aksiyonları gecikti.`, type: 'critical', timestamp: now, location: risk.location });
         });
         employees.forEach(emp => {
             const t = calculateValidity(emp.lastTrainingDate, emp.hazardClass, 'training');
             if(t.status === 'expired') newNotifs.push({ id: `tr-exp-${emp.id}`, title: 'Eğitim Süresi Doldu', message: `${emp.name} eğitimi yenilenmeli.`, type: 'critical', timestamp: now, location: emp.location });
         });
         setNotifications(newNotifs);
      };
      generateNotifications();
  }, [risks, employees]);

  // ... (Employee Management Logic same as before) ...
  const handleAddEmployee = () => {
      if (!newEmployee.name || !newEmployee.jobTitle) { alert("Lütfen en az Ad Soyad ve Görev alanlarını doldurun"); return; }
      let loc = selectedLocation;
      if (selectedLocation === "Tüm İşletmeler") { if (!newEmployee.location) { alert("Lütfen personelin çalışacağı işletmeyi seçiniz."); return; } loc = newEmployee.location; }
      const emp: Employee = { id: generateId(), name: newEmployee.name!, jobTitle: newEmployee.jobTitle!, location: loc, hazardClass: newEmployee.hazardClass as HazardClass || 'Tehlikeli', lastTrainingDate: newEmployee.lastTrainingDate || '', lastHealthCheckDate: newEmployee.lastHealthCheckDate || '' };
      setEmployees(prev => [...prev, emp]); setShowAddEmployee(false); setNewEmployee({ hazardClass: 'Tehlikeli', lastTrainingDate: '', lastHealthCheckDate: '', location: '' });
  };
  const deleteEmployee = (id: string) => { if(confirm("Silmek istiyor musunuz?")) setEmployees(employees.filter(e => e.id !== id)); };
  const sendTrainingReminder = (emp: Employee) => { const val = calculateValidity(emp.lastTrainingDate, emp.hazardClass, 'training'); window.open(`mailto:?subject=İSG Eğitim&body=${emp.name} eğitim süresi doluyor.`); };
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... same as before ... */ };
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setCompanyLogo(ev.target?.result as string); r.readAsDataURL(f); } };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    /* ... same as before ... */
    const file = e.target.files?.[0];
    if (!file) return;
    if (selectedLocation === "Tüm İşletmeler") { alert("Lütfen şube seçiniz."); if(fileInputRef.current) fileInputRef.current.value = ''; return; }
    const currentThresholds = getThresholdsForLocation(selectedLocation);
    setIsAnalyzing(true);
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const res = await analyzeHazard("", base64, file.type);
            const slaDate = calculateSLADate(1, currentThresholds); // fallback date base
            const newRisks = res.map((r: any) => {
                const score = (r.probability||1)*(r.frequency||1)*(r.severity||1);
                return {
                    id: generateId(), location: selectedLocation, department: r.department || "Genel", specific_area: r.specific_area || "", detectionDate: new Date().toISOString().split('T')[0],
                    source: r.source||"Kaynak", activity: r.activity||"Faaliyet", hazard: r.hazard||"Tehlike", risks: r.risks||"Risk",
                    probability: r.probability||1, frequency: r.frequency||1, severity: r.severity||1, risk_score: score,
                    current_measures: r.current_measures||"Yok",
                    actions: Array.isArray(r.actions) ? r.actions.map((a: string) => ({ id: generateId(), description: a, dueDate: calculateSLADate(score, currentThresholds), isCompleted: false })) : [],
                    status: 'Açık' as const, image: reader.result as string
                };
            });
            setRisks(prev => [...newRisks, ...prev]);
        };
    } catch(e) { alert("Hata oluştu"); } finally { setIsAnalyzing(false); if(fileInputRef.current) fileInputRef.current.value = ''; }
  };

  // --- Risk Management Functions ---

  const deleteRisk = (id: string) => {
    if (window.confirm("Bu risk kaydını silmek istediğinize emin misiniz?")) {
      setRisks(prev => prev.filter(r => r.id !== id));
    }
  };

  const updateStatus = (id: string, status: any) => {
    setRisks(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const addAction = (id: string, description: string, dueDate: string, responsibleId?: string) => {
    const newAction: ActionItem = {
      id: generateId(),
      description,
      dueDate,
      isCompleted: false,
      responsibleId
    };
    setRisks(prev => prev.map(r => r.id === id ? { ...r, actions: [...r.actions, newAction] } : r));
  };

  const deleteAction = (riskId: string, actionId: string) => {
    setRisks(prev => prev.map(r => r.id === riskId ? { ...r, actions: r.actions.filter(a => a.id !== actionId) } : r));
  };

  const toggleAction = (riskId: string, actionId: string) => {
    setRisks(prev => prev.map(r => {
      if (r.id !== riskId) return r;
      return {
        ...r,
        actions: r.actions.map(a => a.id === actionId ? { ...a, isCompleted: !a.isCompleted } : a)
      };
    }));
  };

  const updateActionDate = (riskId: string, actionId: string, date: string) => {
    setRisks(prev => prev.map(r => {
      if (r.id !== riskId) return r;
      return {
        ...r,
        actions: r.actions.map(a => a.id === actionId ? { ...a, dueDate: date } : a)
      };
    }));
  };

  const updateActionResponsible = (riskId: string, actionId: string, responsibleId: string) => {
    setRisks(prev => prev.map(r => {
      if (r.id !== riskId) return r;
      return {
        ...r,
        actions: r.actions.map(a => a.id === actionId ? { ...a, responsibleId } : a)
      };
    }));
  };

  const updateRiskLocation = (id: string, department: string, specific_area: string) => {
    setRisks(prev => prev.map(r => r.id === id ? { ...r, department, specific_area } : r));
  };

  const sendEmailReport = () => {
    const subject = encodeURIComponent(`İSG Risk Raporu - ${reportConfig.companyTitle}`);
    const body = encodeURIComponent(`Merhaba,\n\n${selectedLocation} lokasyonu için güncel risk raporu ektedir.\n\nÖzet:\n- Toplam Risk: ${filteredRisks.length}\n- Kritik Riskler: ${criticalRisks}\n\nSaygılarımla.`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  // --- PDF GENERATION LOGIC ---

  // Helper for validity calc (shared)
  const getValidityInfo = () => {
      let validYears = 6; 
      if (reportConfig.hazardClass === 'Çok Tehlikeli') validYears = 2;
      else if (reportConfig.hazardClass === 'Tehlikeli') validYears = 4;
      
      const validityDateObj = new Date(reportConfig.revisionDate);
      validityDateObj.setFullYear(validityDateObj.getFullYear() + validYears);
      const validityDateStr = validityDateObj.toLocaleDateString('tr-TR');
      return { years: validYears, endDate: validityDateStr };
  };

  // 1. Main Risk Report
  const generatePDFReport = () => {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF('l', 'mm', 'a4');
      const valInfo = getValidityInfo();
      const validityText = normalizeForPDF(`${valInfo.years} Yil \n(Bitis: ${valInfo.endDate})`);
      
      // ... Header Table (Same as before) ...
      doc.autoTable({
          startY: 10, theme: 'plain', styles: { font: 'helvetica', fontSize: 8, lineWidth: 0.2, lineColor: [0,0,0], textColor: [0,0,0], valign: 'middle', halign: 'center' },
          body: [
              [{ content: companyLogo ? '' : 'LOGO', rowSpan: 3, styles: { fontSize: 12, fontStyle: 'bold' } }, { content: normalizeForPDF('İşyeri Unvanı'), styles: { fontStyle: 'bold', halign: 'left', cellWidth: 25 } }, { content: normalizeForPDF(reportConfig.companyTitle), styles: { halign: 'left' } }, { content: normalizeForPDF('İş Sağlığı ve Güvenliği Tehlike ve Risk Değerlendirme Analizi'), rowSpan: 3, styles: { fontSize: 14, fontStyle: 'bold', cellWidth: 100 } }, { content: normalizeForPDF('Yayın Tarihi'), styles: { fontStyle: 'bold', cellWidth: 25 } }, { content: new Date().toLocaleDateString('tr-TR'), styles: { cellWidth: 25 } }],
              [{ content: normalizeForPDF('İşyeri Adresi'), styles: { fontStyle: 'bold', halign: 'left' } }, { content: normalizeForPDF(reportConfig.address), styles: { halign: 'left' } }, { content: normalizeForPDF('Revizyon No'), styles: { fontStyle: 'bold' } }, { content: normalizeForPDF(reportConfig.revisionNo) }],
              [{ content: 'SGK NO', styles: { fontStyle: 'bold', halign: 'left' } }, { content: normalizeForPDF(reportConfig.sgkNo), styles: { halign: 'left' } }, { content: normalizeForPDF('Geçerlilik Süresi'), styles: { fontStyle: 'bold' } }, { content: validityText }]
          ],
          didDrawCell: (data: any) => { if(data.section === 'body' && data.column.index === 0 && data.row.index === 0 && companyLogo) { try { doc.addImage(companyLogo, 'JPEG', data.cell.x+2, data.cell.y+2, data.cell.width-4, data.cell.height-4, undefined, 'FAST'); } catch(e){} } }
      });

      const startY = (doc as any).lastAutoTable.finalY + 5;
      const getEmpName = (id?: string) => { const e = employees.find(x => x.id === id); return e ? normalizeForPDF(e.name) : ""; };

      const body = filteredRisks.map((risk, index) => {
          const t = getThresholdsForLocation(risk.location);
          const rc = getRiskClass(risk.risk_score, t);
          return [
              index + 1, normalizeForPDF(`${risk.department}\n${risk.specific_area}`), risk.detectionDate, normalizeForPDF(risk.hazard), normalizeForPDF(risk.risks), normalizeForPDF("Çalışanlar"), normalizeForPDF(risk.source),
              risk.probability, risk.frequency, risk.severity, risk.risk_score, { content: normalizeForPDF(rc.label), styles: { fillColor: rc.pdfColor, fontStyle: 'bold' } },
              risk.actions.map(a => `• ${normalizeForPDF(a.description)}`).join('\n'),
              risk.actions.map(a => `• ${getEmpName(a.responsibleId)}`).join('\n'),
              risk.actions.length > 0 ? risk.actions[0].dueDate : "",
              normalizeForPDF(risk.status), '', '', '', '', ''
          ];
      });

      doc.autoTable({
          startY: startY, theme: 'grid', margin: { bottom: 35 },
          head: [
              [{ content: '', colSpan: 7, styles: { fillColor: [255, 255, 255] } }, { content: normalizeForPDF('TEHLİKELERE GÖRE RİSK SEVİYESİNİN TESPİT TABLOSU'), colSpan: 5, styles: { fillColor: [220, 220, 220], fontStyle: 'bold', halign: 'center' } }, { content: normalizeForPDF('DÜZELTİCİ / ÖNLEYİCİ FAALİYETLER'), colSpan: 4, styles: { fillColor: [220, 220, 220], fontStyle: 'bold', halign: 'center' } }, { content: normalizeForPDF('DÖF SONRASI RİSK (HEDEF)'), colSpan: 5, styles: { fillColor: [220, 220, 220], fontStyle: 'bold', halign: 'center' } }],
              [normalizeForPDF('Sıra'), normalizeForPDF('Bölüm Adı'), normalizeForPDF('Tespit Tarihi'), normalizeForPDF('Tehlike'), normalizeForPDF('Risk'), normalizeForPDF('Etkilenen'), normalizeForPDF('Mevcut Durum'), 'O', 'F', 'Ş', normalizeForPDF('Skor'), normalizeForPDF('Seviye'), normalizeForPDF('Aksiyon'), normalizeForPDF('Sorumlu'), normalizeForPDF('Termin'), normalizeForPDF('Durum'), 'O', 'F', 'Ş', normalizeForPDF('Skor'), normalizeForPDF('Seviye')]
          ],
          body: body,
          styles: { font: 'helvetica', fontSize: 6, textColor: [0,0,0], lineColor: [100,100,100], lineWidth: 0.1, valign: 'middle', halign: 'center' },
          columnStyles: { 0: { cellWidth: 6 }, 1: { cellWidth: 18 }, 2: { cellWidth: 14 }, 3: { cellWidth: 18 }, 4: { cellWidth: 18 }, 5: { cellWidth: 10 }, 6: { cellWidth: 18 }, 7: { cellWidth: 6 }, 8: { cellWidth: 6 }, 9: { cellWidth: 6 }, 10: { cellWidth: 8, fontStyle: 'bold' }, 11: { cellWidth: 20 }, 12: { cellWidth: 40, halign: 'left' }, 13: { cellWidth: 14 }, 14: { cellWidth: 14 }, 15: { cellWidth: 10 }, 16: { cellWidth: 6 }, 17: { cellWidth: 6 }, 18: { cellWidth: 6 }, 19: { cellWidth: 8 }, 20: { cellWidth: 15 } },
          didDrawPage: (data: any) => {
               const y = doc.internal.pageSize.height - 25; doc.setFontSize(7); doc.setTextColor(0,0,0);
               doc.text(normalizeForPDF('İş Güvenliği Uzmanı'), 30, y); doc.text('..........................', 30, y+10);
               doc.text(normalizeForPDF('İşyeri Hekimi'), 80, y); doc.text('..........................', 80, y+10);
               doc.text(normalizeForPDF('Çalışan Temsilcisi'), 130, y); doc.text('..........................', 130, y+10);
               doc.text(normalizeForPDF('İşveren / İşveren Vekili'), 230, y); doc.text('..........................', 230, y+10);
               doc.text(`Sayfa ${doc.internal.getNumberOfPages()}`, 280, doc.internal.pageSize.height - 10);
          }
      });

      // Methodology Summary Box
      let finalY = (doc as any).lastAutoTable.finalY + 5;
      const pageHeight = doc.internal.pageSize.height;
      
      // Check if we need a new page for the methodology box (height approx 25mm)
      // Footer margin is 35, so check if finalY + 25 > pageHeight - 35
      if (finalY + 25 > pageHeight - 35) {
          doc.addPage();
          finalY = 20;
      }

      // Use autoTable for the methodology box to handle page breaks and hooks automatically
      doc.autoTable({
          startY: finalY,
          theme: 'plain',
          head: [[{ content: normalizeForPDF('METODOLOJİ ÖZETİ (FINE-KINNEY)'), styles: { fontStyle: 'bold', fontSize: 8, fillColor: [240, 240, 240] } }]],
          body: [[{ 
              content: normalizeForPDF(
                  "Bu raporda Fine-Kinney Risk Değerlendirme Metodu kullanılmıştır. Risk seviyesi (R); İhtimal (O), Frekans (F) ve Şiddet (Ş) değerlerinin çarpımı ile hesaplanır.\n" +
                  "FORMÜL: Risk Skoru (R) = Olasılık x Frekans x Şiddet\n" +
                  "Hesaplanan R değerine göre riskler sınıflandırılır: Tolerans Gösterilemez (>400), Esaslı (200-400), Önemli (70-200), Olası (20-70) ve Önemsiz (<20)."
              ),
              styles: { fontSize: 7, cellPadding: 3 }
          }]],
          styles: { font: 'helvetica', lineColor: [200, 200, 200], lineWidth: 0.1 },
          margin: { bottom: 35 },
          didDrawPage: (data: any) => {
               const y = doc.internal.pageSize.height - 25; doc.setFontSize(7); doc.setTextColor(0,0,0);
               doc.text(normalizeForPDF('İş Güvenliği Uzmanı'), 30, y); doc.text('..........................', 30, y+10);
               doc.text(normalizeForPDF('İşyeri Hekimi'), 80, y); doc.text('..........................', 80, y+10);
               doc.text(normalizeForPDF('Çalışan Temsilcisi'), 130, y); doc.text('..........................', 130, y+10);
               doc.text(normalizeForPDF('İşveren / İşveren Vekili'), 230, y); doc.text('..........................', 230, y+10);
               doc.text(`Sayfa ${doc.internal.getNumberOfPages()}`, 280, doc.internal.pageSize.height - 10);
          }
      });

      doc.save(`Risk_Analizi_${selectedLocation.replace(/\s+/g, '_')}.pdf`);
  };

  // 2. COMPREHENSIVE RISK FILE (Cover, Team, Training, Methodology)
  const generateRiskAssessmentFile = () => {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF('p', 'mm', 'a4'); // Portrait
      const valInfo = getValidityInfo();
      const getEmpName = (id?: string) => { const e = employees.find(x => x.id === id); return e ? normalizeForPDF(e.name) : "........................."; };
      const getEmpTitle = (id?: string) => { const e = employees.find(x => x.id === id); return e ? normalizeForPDF(e.jobTitle) : "........................."; };

      // --- PAGE 1: COVER ---
      doc.setLineWidth(1);
      doc.rect(10, 10, 190, 277); // Border
      
      if (companyLogo) {
          try { doc.addImage(companyLogo, 'JPEG', 70, 30, 70, 40, undefined, 'FAST'); } catch(e){}
      } else {
          doc.setFontSize(20); doc.text(normalizeForPDF(reportConfig.companyTitle), 105, 50, { align: 'center' });
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text(normalizeForPDF("RİSK DEĞERLENDİRME"), 105, 100, { align: 'center' });
      doc.text(normalizeForPDF("DOSYASI"), 105, 112, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(normalizeForPDF("6331 Sayılı İş Sağlığı ve Güvenliği Kanunu"), 105, 130, { align: 'center' });
      doc.text(normalizeForPDF("Risk Değerlendirmesi Yönetmeliği"), 105, 136, { align: 'center' });

      // Info Box
      doc.autoTable({
          startY: 160,
          margin: { left: 30, right: 30 },
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 10, textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.1 },
          body: [
              [{ content: normalizeForPDF('İŞYERİ UNVANI'), styles: { fontStyle: 'bold', fillColor: [240,240,240] } }, normalizeForPDF(reportConfig.companyTitle)],
              [{ content: normalizeForPDF('ADRES'), styles: { fontStyle: 'bold', fillColor: [240,240,240] } }, normalizeForPDF(reportConfig.address)],
              [{ content: normalizeForPDF('SGK SİCİL NO'), styles: { fontStyle: 'bold', fillColor: [240,240,240] } }, normalizeForPDF(reportConfig.sgkNo)],
              [{ content: normalizeForPDF('TEHLİKE SINIFI'), styles: { fontStyle: 'bold', fillColor: [240,240,240] } }, normalizeForPDF(reportConfig.hazardClass)],
              [{ content: normalizeForPDF('GEÇERLİLİK BAŞLANGIÇ'), styles: { fontStyle: 'bold', fillColor: [240,240,240] } }, normalizeForPDF(reportConfig.revisionDate)],
              [{ content: normalizeForPDF('GEÇERLİLİK BİTİŞ'), styles: { fontStyle: 'bold', fillColor: [240,240,240] } }, valInfo.endDate]
          ]
      });

      // Signatures
      const ySig = 250;
      doc.setFontSize(10);
      doc.text(normalizeForPDF("İŞVEREN / VEKİLİ"), 50, ySig, { align: 'center' });
      doc.text(normalizeForPDF(reportConfig.employer || "........................."), 50, ySig + 5, { align: 'center' });
      doc.text("İmza / Kaşe", 50, ySig + 15, { align: 'center' });

      doc.text(normalizeForPDF("İŞ GÜVENLİĞİ UZMANI"), 160, ySig, { align: 'center' });
      doc.text(getEmpName(reportConfig.specialistId), 160, ySig + 5, { align: 'center' });
      doc.text("İmza", 160, ySig + 15, { align: 'center' });

      // --- PAGE 2: TEAM ASSIGNMENT ---
      doc.addPage();
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text(normalizeForPDF("RİSK DEĞERLENDİRME EKİBİ LİSTESİ"), 105, 20, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(normalizeForPDF("(İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği - Madde 6)"), 105, 26, { align: 'center' });

      doc.autoTable({
          startY: 40,
          theme: 'grid',
          head: [[normalizeForPDF('GÖREVİ'), normalizeForPDF('ADI SOYADI'), normalizeForPDF('UNVANI'), normalizeForPDF('İMZA')]],
          body: [
              [normalizeForPDF('İşveren / Vekili'), normalizeForPDF(reportConfig.employer || ""), "Yönetici", ""],
              [normalizeForPDF('İş Güvenliği Uzmanı'), getEmpName(reportConfig.specialistId), getEmpTitle(reportConfig.specialistId), ""],
              [normalizeForPDF('İşyeri Hekimi'), getEmpName(reportConfig.doctorId), getEmpTitle(reportConfig.doctorId), ""],
              [normalizeForPDF('Çalışan Temsilcisi'), getEmpName(reportConfig.repId), getEmpTitle(reportConfig.repId), ""],
              [normalizeForPDF('Destek Elemanı'), "", "", ""]
          ],
          styles: { font: 'helvetica', textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.1, valign: 'middle', cellPadding: 4 },
          headStyles: { fillColor: [220,220,220], textColor: [0,0,0], fontStyle: 'bold' }
      });

      doc.setFontSize(10);
      doc.text(normalizeForPDF("Yukarıda adı geçen kişiler, işyerimizde yapılacak risk değerlendirmesi çalışmalarını yürütmek üzere 'Risk Değerlendirme Ekibi' olarak görevlendirilmiştir."), 15, (doc as any).lastAutoTable.finalY + 20, { maxWidth: 180 });

      // --- PAGE 3: TEAM TRAINING ---
      doc.addPage();
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text(normalizeForPDF("RİSK DEĞERLENDİRME EKİBİ EĞİTİM TUTANAĞI"), 105, 20, { align: 'center' });
      
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      doc.text(normalizeForPDF(`Eğitim Tarihi: ${reportConfig.revisionDate}`), 15, 35);
      doc.text(normalizeForPDF("Eğitim Konusu: Risk Değerlendirme Metodolojisi (Fine-Kinney) ve Uygulama Esasları"), 15, 42);
      doc.text(normalizeForPDF("Eğitici: İş Güvenliği Uzmanı"), 15, 49);

      const trainees = [
           [normalizeForPDF(reportConfig.employer || ""), "İşveren V.", normalizeForPDF("2 Saat"), ""],
           [getEmpName(reportConfig.repId), "Çalışan Temsilcisi", normalizeForPDF("2 Saat"), ""],
           [getEmpName(reportConfig.doctorId), "İşyeri Hekimi", normalizeForPDF("2 Saat"), ""]
      ].filter(x => x[0] !== "........................." && x[0] !== "");

      doc.autoTable({
          startY: 60,
          theme: 'grid',
          head: [[normalizeForPDF('ADI SOYADI'), normalizeForPDF('GÖREVİ'), normalizeForPDF('SÜRE'), normalizeForPDF('İMZA')]],
          body: trainees,
          styles: { font: 'helvetica', textColor: [0,0,0], lineColor: [0,0,0] }
      });

      // --- PAGE 4: METHODOLOGY ---
      doc.addPage();
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text(normalizeForPDF("KULLANILAN METODOLOJİ (FINE-KINNEY)"), 105, 20, { align: 'center' });
      
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(normalizeForPDF("Risk Değerlendirmesinde Fine-Kinney metodu kullanılmıştır. Bu yöntemde Risk Skoru (R) aşağıdaki formülle hesaplanır:"), 15, 35);
      doc.setFont('helvetica', 'bold');
      doc.text("R = Olasılık (O) x Frekans (F) x Şiddet (Ş)", 105, 45, { align: 'center' });

      // Tables
      doc.autoTable({
          startY: 55,
          head: [[{content: normalizeForPDF('Tablo 1: İhtimal (Olasılık) Skalası'), colSpan: 2, styles: {halign: 'center'}}]],
          body: [['10', 'Beklenir, Kesin'], ['6', normalizeForPDF('Yüksek / Oldukça mümkün')], ['3', normalizeForPDF('Olası (Muhtemel)')], ['1', normalizeForPDF('Mümkün fakat düşük')], ['0.5', normalizeForPDF('Beklenmez fakat mümkün')], ['0.2', normalizeForPDF('Beklenmez')]],
          styles: { font: 'helvetica', fontSize: 8, textColor: [0,0,0] }
      });

      doc.autoTable({
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [[{content: normalizeForPDF('Tablo 2: Frekans (Sıklık) Skalası'), colSpan: 2, styles: {halign: 'center'}}]],
          body: [['10', normalizeForPDF('Hemen hemen sürekli')], ['6', normalizeForPDF('Sıklıkla')], ['3', normalizeForPDF('Ara sıra')], ['2', normalizeForPDF('Sık değil')], ['1', normalizeForPDF('Seyrek')], ['0.5', normalizeForPDF('Çok Seyrek')]],
          styles: { font: 'helvetica', fontSize: 8, textColor: [0,0,0] }
      });

      doc.autoTable({
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [[{content: normalizeForPDF('Tablo 3: Şiddet Skalası'), colSpan: 2, styles: {halign: 'center'}}]],
          body: [['100', normalizeForPDF('Birden fazla ölümlü kaza')], ['40', normalizeForPDF('Öldürücü kaza')], ['15', normalizeForPDF('Kalıcı hasar')], ['7', normalizeForPDF('Önemli hasar / İş kaybı')], ['3', normalizeForPDF('Küçük hasar')], ['1', normalizeForPDF('Ucuz atlatma')]],
          styles: { font: 'helvetica', fontSize: 8, textColor: [0,0,0] }
      });

      doc.save("Risk_Degerlendirme_Dosyasi_Kapak.pdf");
  };

  // --- RENDER ---
  // ... (Rest of the component structure remains mostly same, updating Risk Tab UI and Config Modal) ...

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar (Unchanged) */}
      <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex-shrink-0 flex flex-col">
          <div className="p-6 flex items-center space-x-3 border-b border-zinc-800">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                <ShieldCheckIcon className="w-5 h-5 text-white" />
            </div>
            <div>
                <h1 className="font-bold text-sm tracking-wide">AI İSG ASİSTANI</h1>
                <p className="text-[10px] text-zinc-500">Profesyonel Sürüm</p>
            </div>
          </div>
          {/* ... Navigation & Hierarchy code (same as before) ... */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
              {/* ... Modules & Registry list logic (same as before) ... */}
              {/* Keeping existing sidebar content */}
              <div className="mb-6">
                <h3 className="px-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Yönetim Paneli</h3>
                <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600/10 text-blue-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}>
                    <ChartBarIcon className="w-5 h-5" />
                    <span>Genel Bakış</span>
                </button>
                <button onClick={() => setActiveTab('risks')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'risks' ? 'bg-blue-600/10 text-blue-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}>
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    <span>Risk Değerlendirme Analizi</span>
                </button>
                <button onClick={() => setActiveTab('personnel')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'personnel' ? 'bg-blue-600/10 text-blue-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}>
                    <UserGroupIcon className="w-5 h-5" />
                    <span>Personel & Eğitim</span>
                </button>
              </div>
              {/* Hierarchy Logic */}
               <div className="mb-2">
                 <div className="flex items-center justify-between px-2 mb-2">
                    <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">SİCİL VE İŞLETMELER</h3>
                    <button onClick={addRegistry} className="text-zinc-400 hover:text-blue-400 p-1 hover:bg-zinc-800 rounded transition-colors" title="Yeni Sicil Ekle">
                        <PlusIcon className="w-3 h-3" />
                    </button>
                 </div>
                 <button 
                    onClick={() => setSelectedLocation("Tüm İşletmeler")}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-3 ${selectedLocation === "Tüm İşletmeler" ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                 >
                     <BuildingOfficeIcon className="w-5 h-5" />
                     <span>Tüm İşletmeler</span>
                 </button>
                 <div className="space-y-1">
                     {registries.map(registry => (
                         <div key={registry.id} className="mb-1">
                             <div className="flex items-center group/reg px-2 py-1.5 rounded hover:bg-zinc-800/30 transition-colors">
                                <button onClick={() => toggleRegistry(registry.id)} className="text-zinc-500 hover:text-zinc-300 p-0.5 mr-1">
                                    {registry.isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                                </button>
                                <div className="flex-1 flex items-center min-w-0 gap-2">
                                    <BriefcaseIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                                    {editingId === registry.id ? (
                                        <div className="flex items-center flex-1 mr-1">
                                            <input autoFocus className="bg-zinc-950 text-xs text-white px-1 py-0.5 w-full border border-blue-500 rounded outline-none" value={editTempName} onChange={e => setEditTempName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditing()} onBlur={saveEditing} />
                                        </div>
                                    ) : (
                                        <span className="text-xs font-semibold text-zinc-300 truncate cursor-default select-none" title={registry.name}>{registry.name}</span>
                                    )}
                                </div>
                                <div className="flex items-center ml-1 opacity-0 group-hover/reg:opacity-100 transition-opacity duration-200">
                                    <button onClick={(e) => { e.stopPropagation(); startEditing(registry.id, registry.name); }} className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded"><PencilIcon className="w-3 h-3" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); addUnit(registry.id); }} className="p-1.5 text-zinc-500 hover:text-green-400 hover:bg-zinc-800 rounded"><PlusIcon className="w-3 h-3" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); requestDeleteRegistry(registry.id); }} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded"><TrashIcon className="w-3 h-3" /></button>
                                </div>
                             </div>
                             {registry.isExpanded && (
                                 <div className="ml-6 border-l border-zinc-800 pl-2 mt-1 space-y-0.5">
                                     {registry.units.length === 0 && (<div className="text-[10px] text-zinc-600 italic px-2 py-1">İşletme eklenmedi</div>)}
                                     {registry.units.map(unit => (
                                         <div key={unit.id} className={`group/unit flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors min-h-[32px] ${selectedLocation === unit.name ? 'bg-blue-900/20 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}>
                                             <div className="flex-1 flex items-center gap-2 min-w-0" onClick={() => setSelectedLocation(unit.name)}>
                                                 <BuildingStorefrontIcon className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
                                                 {editingId === unit.id ? (
                                                    <input autoFocus onClick={(e) => e.stopPropagation()} className="bg-zinc-950 text-xs text-white px-1 py-0.5 w-full border border-blue-500 rounded outline-none" value={editTempName} onChange={e => setEditTempName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditing()} onBlur={saveEditing} />
                                                 ) : (<span className="text-xs truncate select-none">{unit.name}</span>)}
                                             </div>
                                             <div className="flex items-center bg-zinc-900 rounded ml-2 opacity-0 group-hover/unit:opacity-100 transition-opacity duration-200 shadow-sm border border-zinc-800">
                                                 <button onClick={(e) => { e.stopPropagation(); openThresholdSettings(registry.id, unit); }} className="p-1.5 text-zinc-500 hover:text-yellow-400 hover:bg-zinc-800 rounded-l"><Cog6ToothIcon className="w-3 h-3" /></button>
                                                 <div className="w-px h-3 bg-zinc-800"></div>
                                                 <button onClick={(e) => { e.stopPropagation(); startEditing(unit.id, unit.name); }} className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800"><PencilIcon className="w-3 h-3" /></button>
                                                 <div className="w-px h-3 bg-zinc-800"></div>
                                                 <button onClick={(e) => { e.stopPropagation(); requestDeleteUnit(registry.id, unit.id); }} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-r"><XMarkIcon className="w-3 h-3" /></button>
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                     ))}
                 </div>
              </div>
          </nav>
          {/* Bottom Controls */}
          <div className="p-4 border-t border-zinc-800 space-y-2">
             <button onClick={() => logoInputRef.current?.click()} className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                 <PhotoIcon className="w-5 h-5" /> <span>{companyLogo ? 'Logoyu Değiştir' : 'Logo Yükle'}</span>
             </button>
             <input type="file" ref={logoInputRef} accept="image/*" className="hidden" onChange={handleLogoUpload} />
             <button onClick={() => setShowReportConfig(true)} className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors shadow-lg shadow-black/20">
                <ArrowDownTrayIcon className="w-5 h-5 text-red-500" /> <span>PDF Rapor İndir</span>
             </button>
             <button onClick={sendEmailReport} className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                <EnvelopeIcon className="w-5 h-5" /> <span>E-Posta ile Paylaş</span>
             </button>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between px-8 backdrop-blur-md z-20">
           <div className="flex flex-col">
             <h2 className="font-semibold text-lg flex items-center gap-2 text-white">
                {activeTab === 'dashboard' ? 'Kurumsal Güvenlik Panosu' : activeTab === 'risks' ? 'Risk Değerlendirme Analizi' : 'Personel Takip Sistemi'}
             </h2>
             <div className="text-xs text-blue-400 font-medium flex items-center gap-1">
                 <MapPinIcon className="w-3 h-3" /> {selectedLocation}
             </div>
           </div>
           <div className="flex items-center space-x-4">
              <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className={`p-2 rounded-full transition-colors relative ${showNotifications ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                    <BellIcon className="w-6 h-6" />
                    {notifications.length > 0 && (<span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse"></span>)}
                </button>
                {showNotifications && (
                    <div className="absolute right-0 mt-2 w-96 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50 origin-top-right">
                        <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                            <h3 className="font-semibold text-sm">İSG Bildirimleri</h3>
                            <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">{notifications.length}</span>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (<div className="p-8 text-center text-zinc-500 text-sm">Tüm işletmelerde durum normal.</div>) : (
                                <div className="divide-y divide-zinc-800/50">
                                    {notifications.map(notif => (
                                        <div key={notif.id} className={`p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer ${notif.type === 'critical' ? 'bg-red-900/10' : notif.type === 'warning' ? 'bg-orange-900/10' : ''}`} onClick={() => { setActiveTab(notif.id.startsWith('tr') || notif.id.startsWith('hl') ? 'personnel' : 'risks'); setShowNotifications(false); }}>
                                            <div className="flex items-start gap-3">
                                                {notif.type === 'critical' ? <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> : <ShieldCheckIcon className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1"><p className={`text-sm font-medium ${notif.type === 'critical' ? 'text-red-400' : 'text-orange-400'}`}>{notif.title}</p></div>
                                                    <p className="text-xs text-zinc-400 leading-relaxed">{notif.message}</p>
                                                    <p className="text-[10px] text-zinc-600 mt-2">{notif.timestamp}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
              </div>
              <div className="h-6 w-px bg-zinc-800"></div>
              {activeTab === 'personnel' ? (
                  <div className="flex gap-2">
                     <button onClick={() => setShowImportEmployee(true)} className="flex items-center space-x-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-sm font-medium transition-all" title="Excel'den Yükle">
                        <TableCellsIcon className="w-4 h-4" /> <span>Excel'den Yükle</span>
                    </button>
                    <button onClick={() => setShowAddEmployee(true)} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-all" title='Personel Ekle'>
                        <PlusIcon className="w-4 h-4" /> <span>Personel Ekle</span>
                    </button>
                  </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className={`flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] ${isAnalyzing ? 'opacity-50 cursor-wait' : ''} ${selectedLocation === 'Tüm İşletmeler' ? 'opacity-80 grayscale' : ''}`} title={selectedLocation === "Tüm İşletmeler" ? "Lütfen önce bir şube seçiniz" : "Seçili şube için risk analizi yap"}>
                    {isAnalyzing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CameraIcon className="w-4 h-4" />} <span>Analiz Ekle</span>
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
           </div>
        </header>

        <main className="flex-1 overflow-auto p-8" onClick={() => setShowNotifications(false)}>
            {activeTab === 'dashboard' ? (
                /* ... Dashboard Content (kept same) ... */
                <div className="flex flex-col gap-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group col-span-1">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <CalendarDaysIcon className="w-16 h-16 text-red-400" />
                            </div>
                            <h3 className="text-zinc-500 text-sm font-medium mb-2">Geciken Aksiyonlar</h3>
                            <div className={`text-4xl font-bold ${overdueActionsCount > 0 ? 'text-red-500' : 'text-green-500'}`}>{overdueActionsCount}</div>
                            <div className="text-xs text-zinc-500 mt-2">Hedef tarihi geçen işler</div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group col-span-1">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ExclamationTriangleIcon className="w-16 h-16 text-orange-400" />
                            </div>
                            <h3 className="text-zinc-500 text-sm font-medium mb-2">Kritik Riskler</h3>
                            <div className={`text-4xl font-bold ${criticalRisks + highRisks > 0 ? 'text-orange-500' : 'text-zinc-200'}`}>{criticalRisks + highRisks}</div>
                            <div className="text-xs text-zinc-500 mt-2">Skor > 70 (Önemli ve üzeri)</div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group col-span-1">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <AcademicCapIcon className="w-16 h-16 text-blue-400" />
                            </div>
                            <h3 className="text-zinc-500 text-sm font-medium mb-2">Eğitimi Geçenler</h3>
                            <div className={`text-4xl font-bold ${expiredTraining > 0 ? 'text-orange-500' : 'text-green-500'}`}>{expiredTraining}</div>
                            <div className="text-xs text-zinc-500 mt-2">Yenileme eğitimi gereken personel</div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group col-span-1">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <HeartIcon className="w-16 h-16 text-pink-400" />
                            </div>
                            <h3 className="text-zinc-500 text-sm font-medium mb-2">Sağlık Raporu Eksik</h3>
                            <div className={`text-4xl font-bold ${expiredHealth > 0 ? 'text-pink-500' : 'text-green-500'}`}>{expiredHealth}</div>
                            <div className="text-xs text-zinc-500 mt-2">Muayene süresi dolanlar</div>
                        </div>
                    </div>
                    
                    {/* Charts ... */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">
                         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
                            <h3 className="text-sm font-semibold text-zinc-400 mb-4">Risk Seviyesi Dağılımı</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.5)" />))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                                        <Legend verticalAlign="middle" align="right" layout="vertical" iconSize={8} wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
                            <h3 className="text-sm font-semibold text-zinc-400 mb-4">İşletme Bazlı Risk Yoğunluğu (Toplam Skor)</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                                        <XAxis type="number" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} width={100} />
                                        <Tooltip cursor={{ fill: '#27272a' }} contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
                                        <Bar dataKey="totalScore" name="Toplam Risk Skoru" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-80 flex flex-col">
                        <h3 className="text-sm font-semibold text-zinc-400 mb-4">Tamamlanan Aksiyon Performansı (Aylık)</h3>
                         <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={lineData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                    <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
                                    <Line type="monotone" dataKey="actions" name="Kapatılan Aksiyon" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                     </div>
                </div>
            ) : activeTab === 'risks' ? (
                <div className="flex flex-col gap-4">
                    {/* NEW: DOCUMENTATION MODULE */}
                    <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-900/30">
                                <FolderOpenIcon className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Resmi Dokümantasyon</h3>
                                <p className="text-xs text-zinc-400">Yasal gerekliliklere uygun kapak, ekip ataması ve metodoloji dosyaları.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => generateRiskAssessmentFile()}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-md text-sm font-bold transition-colors shadow-lg"
                        >
                            <DocumentTextIcon className="w-5 h-5" />
                            Risk Dosyası Oluştur (Kapak & Prosedür)
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={() => setShowMethodology(!showMethodology)} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-blue-400 transition-colors">
                            <InformationCircleIcon className="w-4 h-4" /> {showMethodology ? 'Metodolojiyi Gizle' : 'Metodoloji ve Değerlendirme Kriterleri'}
                        </button>
                    </div>
                    
                    {showMethodology && (
                         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-3 mb-4">
                                <BookOpenIcon className="w-6 h-6 text-blue-500" />
                                <h3 className="text-lg font-bold text-white">Fine-Kinney Risk Değerlendirme Metodolojisi</h3>
                                {selectedLocation !== "Tüm İşletmeler" && (<span className="text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded border border-blue-900/50">{selectedLocation} için özelleştirilmiş kriterler</span>)}
                            </div>
                            {/* Methodology Tables (kept same) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                                <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg text-center">
                                    <p className="text-sm text-blue-200 font-mono">Risk Skoru (R) = İhtimal (O) x Frekans (F) x Şiddet (Ş)</p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-1">1. İhtimal (Olasılık)</h4>
                                    <div className="text-xs space-y-1">
                                        <div className="flex justify-between"><span className="text-zinc-500">Beklenir, Kesin</span> <span className="font-bold text-white">10</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Yüksek / Oldukça mümkün</span> <span className="font-bold text-white">6</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Olası (Muhtemel)</span> <span className="font-bold text-white">3</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Mümkün fakat düşük</span> <span className="font-bold text-white">1</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Beklenmez fakat mümkün</span> <span className="font-bold text-white">0.5</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Beklenmez (Teorik)</span> <span className="font-bold text-white">0.2</span></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-1">2. Frekans (Sıklık)</h4>
                                    <div className="text-xs space-y-1">
                                        <div className="flex justify-between"><span className="text-zinc-500">Hemen hemen sürekli</span> <span className="font-bold text-white">10</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Sıklıkla (Günde 1+)</span> <span className="font-bold text-white">6</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Ara sıra (Haftada 1+)</span> <span className="font-bold text-white">3</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Sık değil (Ayda 1+)</span> <span className="font-bold text-white">2</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Seyrek (Yılda birkaç)</span> <span className="font-bold text-white">1</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Çok Seyrek</span> <span className="font-bold text-white">0.5</span></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-1">3. Şiddet (Zarar)</h4>
                                    <div className="text-xs space-y-1">
                                        <div className="flex justify-between"><span className="text-zinc-500">Birden fazla ölümlü</span> <span className="font-bold text-white">100</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Öldürücü kaza</span> <span className="font-bold text-white">40</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Kalıcı hasar / Uzuv</span> <span className="font-bold text-white">15</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Önemli hasar / İş kaybı</span> <span className="font-bold text-white">7</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Küçük hasar / İlk yardım</span> <span className="font-bold text-white">3</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Ucuz atlatma</span> <span className="font-bold text-white">1</span></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-1">4. Karar Matrisi</h4>
                                    <div className="text-xs space-y-1">
                                        <div className="flex items-center justify-between"><span className="text-red-500 font-bold">{currentViewThresholds.intolerable} +</span> <span className="text-white">Tolerans Gösterilemez</span></div>
                                        <div className="flex items-center justify-between"><span className="text-orange-500 font-bold">{currentViewThresholds.substantial} - {currentViewThresholds.intolerable}</span> <span className="text-white">Esaslı Risk</span></div>
                                        <div className="flex items-center justify-between"><span className="text-orange-300 font-bold">{currentViewThresholds.important} - {currentViewThresholds.substantial}</span> <span className="text-white">Önemli Risk</span></div>
                                        <div className="flex items-center justify-between"><span className="text-yellow-500 font-bold">{currentViewThresholds.possible} - {currentViewThresholds.important}</span> <span className="text-white">Olası Risk</span></div>
                                        <div className="flex items-center justify-between"><span className="text-green-500 font-bold">&lt; {currentViewThresholds.possible}</span> <span className="text-white">Önemsiz Risk</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden min-h-[500px] flex flex-col shadow-lg">
                        <div className="grid grid-cols-1">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-950 text-xs uppercase text-zinc-500 font-semibold tracking-wider sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4 w-1/6 border-b border-zinc-800">Lokasyon / Faaliyet</th>
                                            <th className="p-4 w-1/5 border-b border-zinc-800">Tehlike Tanımı</th>
                                            <th className="p-4 w-48 border-b border-zinc-800">Risk Skoru</th>
                                            <th className="p-4 w-1/3 border-b border-zinc-800">Aksiyon Planı</th>
                                            <th className="p-4 w-32 border-b border-zinc-800 text-right">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800 bg-zinc-900/50">
                                        {filteredRisks.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-12 text-center">
                                                    <div className="flex flex-col items-center justify-center text-zinc-500">
                                                        <CameraIcon className="w-12 h-12 mb-4 opacity-20" />
                                                        <p className="text-lg font-medium mb-2">Kayıt Bulunamadı</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRisks.map(item => (
                                                <RiskRow 
                                                    key={item.id} item={item} thresholds={getThresholdsForLocation(item.location)} employees={employees}
                                                    onDelete={deleteRisk} onStatusChange={updateStatus} onAddAction={addAction} onDeleteAction={deleteAction} onToggleAction={toggleAction} onUpdateActionDate={updateActionDate} onUpdateActionResponsible={updateActionResponsible} onUpdateLocation={updateRiskLocation} onExpandImage={setExpandedImage}
                                                />
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
               </div>
            ) : ( /* Personnel Tab Content */
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden min-h-[500px] flex flex-col shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-zinc-950 text-xs uppercase text-zinc-500 font-semibold tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b border-zinc-800">Ad Soyad / Görev</th>
                                    <th className="p-4 border-b border-zinc-800">Lokasyon</th>
                                    <th className="p-4 border-b border-zinc-800">Tehlike Sınıfı</th>
                                    <th className="p-4 border-b border-zinc-800">Eğitim Durumu (Madde 17)</th>
                                    <th className="p-4 border-b border-zinc-800">Sağlık Gözetimi (Madde 15)</th>
                                    <th className="p-4 border-b border-zinc-800 text-right">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 bg-zinc-900/50">
                                {filteredEmployees.map(emp => {
                                    const trainingStatus = calculateValidity(emp.lastTrainingDate, emp.hazardClass, 'training');
                                    const healthStatus = calculateValidity(emp.lastHealthCheckDate, emp.hazardClass, 'health');
                                    return (
                                        <tr key={emp.id} className="group hover:bg-zinc-800/30 transition-colors">
                                            <td className="p-4">
                                                <div className="font-medium text-zinc-200">{emp.name}</div>
                                                <div className="text-xs text-zinc-500">{emp.jobTitle}</div>
                                            </td>
                                            <td className="p-4 text-sm text-zinc-400">{emp.location}</td>
                                            <td className="p-4">
                                                <span className={`text-xs px-2 py-1 rounded border ${
                                                    emp.hazardClass === 'Çok Tehlikeli' ? 'border-red-900/50 bg-red-900/20 text-red-400' :
                                                    emp.hazardClass === 'Tehlikeli' ? 'border-orange-900/50 bg-orange-900/20 text-orange-400' :
                                                    'border-green-900/50 bg-green-900/20 text-green-400'
                                                }`}>
                                                    {emp.hazardClass}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className={`text-xs px-2 py-1 rounded inline-block ${trainingStatus.color}`}>
                                                    {trainingStatus.label}
                                                </div>
                                                <div className="text-[10px] text-zinc-600 mt-1">Son: {emp.lastTrainingDate || '-'}</div>
                                            </td>
                                            <td className="p-4">
                                                 <div className={`text-xs px-2 py-1 rounded inline-block ${healthStatus.color}`}>
                                                    {healthStatus.label}
                                                </div>
                                                <div className="text-[10px] text-zinc-600 mt-1">Son: {emp.lastHealthCheckDate || '-'}</div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                     <button onClick={() => sendTrainingReminder(emp)} className="p-1 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded" title="Hatırlat">
                                                        <EnvelopeIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => deleteEmployee(emp.id)} className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded" title="Sil">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredEmployees.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-zinc-500 text-sm">Kayıtlı personel bulunamadı.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </main>
      </div>

      {/* MODALS */}
      
      {/* Add Employee Modal */}
      {showAddEmployee && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <UserIcon className="w-5 h-5 text-blue-500" /> Personel Ekle
                  </h3>
                  <div className="space-y-3">
                      <input className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Ad Soyad" value={newEmployee.name || ''} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} />
                      <input className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Görevi" value={newEmployee.jobTitle || ''} onChange={e => setNewEmployee({...newEmployee, jobTitle: e.target.value})} />
                      
                      {selectedLocation === "Tüm İşletmeler" && (
                           <select 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm outline-none focus:border-blue-500"
                                value={newEmployee.location || ""}
                                onChange={e => setNewEmployee({...newEmployee, location: e.target.value})}
                           >
                               <option value="">İşletme Seçiniz...</option>
                               {getAllUnits().map(u => (
                                   <option key={u.id} value={u.name}>{u.name}</option>
                               ))}
                           </select>
                      )}

                      <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Tehlike Sınıfı</label>
                          <select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm outline-none focus:border-blue-500" value={newEmployee.hazardClass} onChange={e => setNewEmployee({...newEmployee, hazardClass: e.target.value as HazardClass})}>
                              <option value="Az Tehlikeli">Az Tehlikeli</option>
                              <option value="Tehlikeli">Tehlikeli</option>
                              <option value="Çok Tehlikeli">Çok Tehlikeli</option>
                          </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                              <label className="text-xs text-zinc-500">Son İSG Eğitimi</label>
                              <input type="date" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm outline-none focus:border-blue-500 text-zinc-400" value={newEmployee.lastTrainingDate} onChange={e => setNewEmployee({...newEmployee, lastTrainingDate: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs text-zinc-500">Son Sağlık Raporu</label>
                              <input type="date" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm outline-none focus:border-blue-500 text-zinc-400" value={newEmployee.lastHealthCheckDate} onChange={e => setNewEmployee({...newEmployee, lastHealthCheckDate: e.target.value})} />
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setShowAddEmployee(false)} className="px-4 py-2 text-sm hover:bg-zinc-800 rounded transition-colors">İptal</button>
                      <button onClick={handleAddEmployee} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors">Kaydet</button>
                  </div>
              </div>
          </div>
      )}

      {/* Import Employee Modal */}
      {showImportEmployee && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-2xl shadow-2xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TableCellsIcon className="w-5 h-5 text-green-500" /> Toplu Personel Yükle (Excel / Liste)
                </h3>
                
                <div className="bg-blue-900/20 border border-blue-900/30 p-4 rounded-lg mb-4 flex items-start gap-3">
                    <InformationCircleIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-200">
                        <p className="font-bold mb-1">Nasıl Çalışır?</p>
                        <p>Excel dosyanızı (.xlsx) yükleyebilir veya listenizi kopyalayıp aşağıya yapıştırabilirsiniz. Yapay zeka verileri otomatik ayrıştıracaktır.</p>
                        <div className="mt-3 flex gap-3">
                            <button 
                                onClick={() => {
                                    const wb = (window as any).XLSX.utils.book_new();
                                    const ws = (window as any).XLSX.utils.aoa_to_sheet([["Ad Soyad", "Görevi", "Tehlike Sınıfı", "Son Eğitim Tarihi", "Son Sağlık Raporu", "Şube"]]);
                                    (window as any).XLSX.utils.book_append_sheet(wb, ws, "Personel");
                                    (window as any).XLSX.writeFile(wb, "Personel_Sablonu.xlsx");
                                }}
                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded flex items-center gap-1"
                            >
                                <ArrowDownTrayIcon className="w-3 h-3" /> Şablonu İndir (Excel)
                            </button>
                            <button 
                                onClick={() => excelInputRef.current?.click()}
                                className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded flex items-center gap-1"
                            >
                                <FolderOpenIcon className="w-3 h-3" /> Excel Dosyası Seç
                            </button>
                            <input 
                                type="file" 
                                ref={excelInputRef} 
                                className="hidden" 
                                accept=".xlsx, .xls, .csv"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if(!file) return;
                                    setIsImporting(true);
                                    const reader = new FileReader();
                                    reader.onload = async (evt) => {
                                        try {
                                            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                                            const workbook = (window as any).XLSX.read(data, {type: 'array'});
                                            const sheetName = workbook.SheetNames[0];
                                            const worksheet = workbook.Sheets[sheetName];
                                            const json = (window as any).XLSX.utils.sheet_to_json(worksheet, {header: 1});
                                            // Convert array of arrays to string for AI or process directly
                                            // For simplicity, passing raw text representation to AI to handle mapping
                                            const textDump = json.map((row: any[]) => row.join(" , ")).join("\n");
                                            setImportText(textDump);
                                            setIsImporting(false);
                                        } catch(err) {
                                            alert("Dosya okunamadı.");
                                            setIsImporting(false);
                                        }
                                    };
                                    reader.readAsArrayBuffer(file);
                                }} 
                            />
                        </div>
                    </div>
                </div>

                <textarea 
                    className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded p-3 text-sm font-mono text-zinc-300 outline-none focus:border-blue-500"
                    placeholder="Örnek:&#10;Ahmet Yılmaz, Şoför, Tehlikeli, 20.01.2023&#10;Ayşe Kaya, Ofis, Az Tehlikeli, 15.05.2022"
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                ></textarea>

                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setShowImportEmployee(false)} className="px-4 py-2 text-sm hover:bg-zinc-800 rounded transition-colors">Vazgeç</button>
                    <button 
                        onClick={async () => {
                            if(!importText.trim()) return;
                            setIsImporting(true);
                            try {
                                const parsed = await parseEmployeeData(importText);
                                const newEmps: Employee[] = parsed.map((p: any) => ({
                                    id: generateId(),
                                    name: p.name,
                                    jobTitle: p.jobTitle,
                                    location: selectedLocation === "Tüm İşletmeler" ? (p.location || "Genel Merkez") : selectedLocation,
                                    hazardClass: (p.hazardClass as HazardClass) || 'Tehlikeli',
                                    lastTrainingDate: p.lastTrainingDate || '',
                                    lastHealthCheckDate: p.lastHealthCheckDate || ''
                                }));
                                setEmployees(prev => [...prev, ...newEmps]);
                                setShowImportEmployee(false);
                                setImportText("");
                            } catch(e) {
                                alert("Ayrıştırma hatası. Lütfen veriyi kontrol edin.");
                            } finally {
                                setIsImporting(false);
                            }
                        }}
                        disabled={isImporting}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors flex items-center gap-2"
                    >
                        {isImporting ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                        {isImporting ? 'İşleniyor...' : 'Verileri Analiz Et ve Ekle'}
                    </button>
                </div>
            </div>
          </div>
      )}
      
      {/* Report Configuration Modal */}
      {showReportConfig && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-2xl shadow-2xl h-[90vh] overflow-y-auto custom-scrollbar">
                  <h3 className="text-lg font-bold mb-4 text-white border-b border-zinc-800 pb-2">Rapor ve Dosya Ayarları</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Firma Unvanı</label>
                          <input className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-white" value={reportConfig.companyTitle} onChange={e => setReportConfig({...reportConfig, companyTitle: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-zinc-500">SGK Sicil No</label>
                          <input className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-white" value={reportConfig.sgkNo} onChange={e => setReportConfig({...reportConfig, sgkNo: e.target.value})} />
                      </div>
                      <div className="space-y-1 col-span-2">
                          <label className="text-xs text-zinc-500">Adres</label>
                          <input className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-white" value={reportConfig.address} onChange={e => setReportConfig({...reportConfig, address: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Tehlike Sınıfı (Yönetmelik Md. 12)</label>
                          <select className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-white" value={reportConfig.hazardClass} onChange={e => setReportConfig({...reportConfig, hazardClass: e.target.value as HazardClass})}>
                              <option value="Çok Tehlikeli">Çok Tehlikeli (2 Yıl)</option>
                              <option value="Tehlikeli">Tehlikeli (4 Yıl)</option>
                              <option value="Az Tehlikeli">Az Tehlikeli (6 Yıl)</option>
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Yayın/Revizyon Tarihi</label>
                          <input type="date" className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-white" value={reportConfig.revisionDate} onChange={e => setReportConfig({...reportConfig, revisionDate: e.target.value})} />
                      </div>
                  </div>

                  <h4 className="text-sm font-bold text-blue-400 mb-3 border-b border-blue-900/30 pb-1">Risk Değerlendirme Ekibi (Yönetmelik Md. 6)</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1">
                          <label className="text-xs text-zinc-500">İşveren / İşveren Vekili</label>
                          <input className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-white" placeholder="Ad Soyad Yazınız" value={reportConfig.employer} onChange={e => setReportConfig({...reportConfig, employer: e.target.value})} />
                      </div>
                       <div className="space-y-1">
                          <label className="text-xs text-zinc-500">İş Güvenliği Uzmanı</label>
                          <select className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300" value={reportConfig.specialistId || ""} onChange={e => setReportConfig({...reportConfig, specialistId: e.target.value})}>
                              <option value="">Seçiniz...</option>
                              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.jobTitle})</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-zinc-500">İşyeri Hekimi</label>
                          <select className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300" value={reportConfig.doctorId || ""} onChange={e => setReportConfig({...reportConfig, doctorId: e.target.value})}>
                              <option value="">Seçiniz...</option>
                              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.jobTitle})</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Çalışan Temsilcisi</label>
                          <select className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300" value={reportConfig.repId || ""} onChange={e => setReportConfig({...reportConfig, repId: e.target.value})}>
                              <option value="">Seçiniz...</option>
                              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.jobTitle})</option>)}
                          </select>
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6 border-t border-zinc-800 pt-4">
                      <button onClick={() => setShowReportConfig(false)} className="px-4 py-2 text-sm hover:bg-zinc-800 rounded transition-colors">Kapat</button>
                      <button onClick={() => { generatePDFReport(); setShowReportConfig(false); }} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors shadow-lg flex items-center gap-2">
                          <DocumentArrowUpIcon className="w-4 h-4" /> Tablo Raporunu İndir
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmation.isOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-sm shadow-2xl transform transition-all scale-100">
                  <h3 className="text-lg font-bold mb-2 text-white">{confirmation.title}</h3>
                  <p className="text-zinc-400 text-sm mb-6">{confirmation.message}</p>
                  <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setConfirmation(prev => ({ ...prev, isOpen: false }))} 
                        className="px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                      >
                          İptal
                      </button>
                      <button 
                        onClick={confirmation.onConfirm} 
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded font-medium shadow-lg transition-colors"
                      >
                          Evet, Sil
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Threshold Settings Modal */}
      {thresholdModal.isOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-sm shadow-2xl">
                  <h3 className="text-lg font-bold mb-1 text-white">Risk Eşik Ayarları</h3>
                  <p className="text-xs text-zinc-500 mb-4 border-b border-zinc-800 pb-2">
                      <span className="text-blue-400 font-bold">{thresholdModal.unitName}</span> için özel değerler
                  </p>
                  
                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-red-500">Tolerans Gösterilemez</label>
                          <input type="number" className="w-20 bg-zinc-950 border border-zinc-700 rounded p-1 text-xs text-white text-right outline-none focus:border-red-500" value={thresholdModal.values.intolerable} onChange={e => setThresholdModal({...thresholdModal, values: {...thresholdModal.values, intolerable: parseInt(e.target.value)}})} />
                      </div>
                      <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-orange-500">Esaslı Risk</label>
                          <input type="number" className="w-20 bg-zinc-950 border border-zinc-700 rounded p-1 text-xs text-white text-right outline-none focus:border-orange-500" value={thresholdModal.values.substantial} onChange={e => setThresholdModal({...thresholdModal, values: {...thresholdModal.values, substantial: parseInt(e.target.value)}})} />
                      </div>
                      <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-orange-300">Önemli Risk</label>
                          <input type="number" className="w-20 bg-zinc-950 border border-zinc-700 rounded p-1 text-xs text-white text-right outline-none focus:border-orange-300" value={thresholdModal.values.important} onChange={e => setThresholdModal({...thresholdModal, values: {...thresholdModal.values, important: parseInt(e.target.value)}})} />
                      </div>
                      <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-yellow-500">Olası Risk</label>
                          <input type="number" className="w-20 bg-zinc-950 border border-zinc-700 rounded p-1 text-xs text-white text-right outline-none focus:border-yellow-500" value={thresholdModal.values.possible} onChange={e => setThresholdModal({...thresholdModal, values: {...thresholdModal.values, possible: parseInt(e.target.value)}})} />
                      </div>
                  </div>

                  <div className="flex justify-between gap-2 mt-6 pt-4 border-t border-zinc-800">
                      <button 
                          onClick={() => setThresholdModal({...thresholdModal, values: DEFAULT_THRESHOLDS})}
                          className="text-xs text-zinc-500 hover:text-white underline decoration-zinc-700 underline-offset-2"
                      >
                          Varsayılanlara Dön
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => setThresholdModal(prev => ({ ...prev, isOpen: false }))} className="px-3 py-1.5 text-xs hover:bg-zinc-800 rounded transition-colors">İptal</button>
                        <button onClick={saveThresholds} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors">Kaydet</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* Lightbox for Images */}
      {expandedImage && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center cursor-zoom-out backdrop-blur-sm" onClick={() => setExpandedImage(null)}>
              <img src={expandedImage} alt="Expanded Hazard" className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl" />
          </div>
      )}

    </div>
  );
};

export default App;
