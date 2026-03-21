"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { 
  Scan, 
  Upload, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Code, 
  User, 
  Calendar, 
  CreditCard,
  Eye,
  Fingerprint,
  ShieldCheck,
  Camera,
  LayoutTemplate,
  FileText,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Settings,
  ChevronRight,
  Check,
  Trash2,
  Home,
  QrCode,
  ArrowRight,
  Star,
  Zap,
  Lock,
  Mail,
  Database,
Search,
Copy,
MapPin,
Phone,
Hash,
Clock3,
ExternalLink,
  Globe,
  ChevronDown
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { BrowserPDF417Reader, Result } from '@zxing/library';
import bwipjs from 'bwip-js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type AAMVAVersion = '2016' | '2020';
type ViewMode = 'home' | 'verification' | 'smart-template' | 'sandbox';
interface AAMVAData {
  firstName: string;
  lastName: string;
  middleName: string;
  dob: string;
  issueDate: string;
  expiryDate: string;
  dlNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  sex: 'M' | 'F' | '1' | '2';
  height: string;
  eyeColor: string;
  hairColor: string;
  weight: string;
  country: string;
  documentNumber: string;
}

interface AuditResult {
  ocrText: string;
  barcodeData: string | null;
  discrepancies: string[];
  isMatch: boolean;
}

interface DetectedField {
  id: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'barcode';
  x: number;
  y: number;
  width: number;
  height: number;
  detectedValue: string;
  confidence: number;
  fontSize: number;
  color: string;
  isBold: boolean;
}

interface SandboxRow {
  email: string | null;
  fullName: string;
  phone: string | null;
  ssn: string;
  dob: string; // Format: YYYY-MM-DD
  address: string;
}

interface SmartTemplate {
  id: string;
  name: string;
  type: 'drivers_license' | 'student_id' | 'national_id' | 'passport' | 'other';
  baseImage: string;
  width: number;
  height: number;
  fields: DetectedField[];
  analyzed: boolean;
}

// --- Constants ---
const DEFAULT_DATA: AAMVAData = {
  firstName: 'JOHN',
  lastName: 'DOE',
  middleName: 'QUINCY',
  dob: '01011990',
  issueDate: '01012020',
  expiryDate: '01012030',
  dlNumber: 'D12345678',
  address: '123 MAIN ST',
  city: 'ANYTOWN',
  state: 'NY',
  zip: '12345',
  sex: 'M',
  height: '509',
  eyeColor: 'BRO',
  hairColor: 'BRO',
  weight: '180',
  country: 'USA',
  documentNumber: ''
};

const SANDBOX_DATA: SandboxRow[] = [
  {
    email: "mike@cofp.net",
    fullName: "McKinnon Michael",
    phone: "224-409-9921",
    ssn: "373-13-6866",
    dob: "1991-07-11",
    address: "1114 w Belmont ave, Chicago, IL, 60657",
  },
  {
    email: null,
    fullName: "McKinnon Micheal",
    phone: "630-971-2300",
    ssn: "351-46-0137",
    dob: "1951-12-04",
    address: "2s675 Gloucester Way W, Oak Brook, IL, 60523",
  },
  {
    email: "ebmclaughlin96@gmail.com",
    fullName: "McLaughlin Elizabeth",
    phone: "314-744-1697",
    ssn: "488-13-7086",
    dob: "1996-07-29",
    address: "3140 N Kenmore Ave Unit 1, Chicago, IL, 60657",
  },
  {
    email: "at.meyer28@gmail.com",
    fullName: "Meyer Andrew",
    phone: null,
    ssn: "486-08-0505",
    dob: "1992-10-28",
    address: "500 West Fullerton Parkway, Chicago, IL, 60614",
  },
  {
    email: null,
    fullName: "Meyer Billie",
    phone: "630-974-7314",
    ssn: "338-80-9515",
    dob: "1976-01-16",
    address: "6508 RT 34, OSWEGO, IL, 60543",
  },
  {
    email: null,
    fullName: "Meyer Corey",
    phone: "314-898-2543",
    ssn: "491-08-1365",
    dob: "1993-04-02",
    address: "5536 North Winthrop Avenue, Chicago, IL, 60640",
  },
  {
    email: "cameyer8@gmail.com",
    fullName: "Meyer Corey",
    phone: null,
    ssn: "491-08-1366",
    dob: "1993-04-02",
    address: "5536 N Winthrop avenue, Chicago, IL, 60640",
  },
  {
    email: "franmmeyer@gmail.com",
    fullName: "Meyer Frances",
    phone: "708-990-8870",
    ssn: "361-90-3307",
    dob: "1995-06-12",
    address: "16 Olympia Ct, Oak Brook, IL, 60523",
  },
  {
    email: "meyerjenmeyer52@gmail.com",
    fullName: "Meyer Jennifer",
    phone: "248-752-5312",
    ssn: "305-17-3944",
    dob: "1995-08-18",
    address: "1818 N Halsted St., Chicago, IL, 60614",
  },
  {
    email: "michaelmeye@gmail.com",
    fullName: "Meyer Michael",
    phone: "847-849-3547",
    ssn: "322-82-3234",
    dob: "1985-09-06",
    address: "347 W CHESTNUT ST, CHICAGO, IL, 60610",
  },
];

// --- UI Components ---
const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl", className)}>
    {children}
  </div>
);

const InputGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props} 
    className={cn(
      "w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all placeholder:text-slate-600",
      props.className
    )}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    {...props} 
    className={cn(
      "w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all appearance-none",
      props.className
    )}
  >
    {props.children}
  </select>
);

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'glow' | 'warm';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'xl';
}) => {
  const variants = {
    primary: "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    ghost: "hover:bg-slate-800 text-slate-400 hover:text-slate-200",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20",
    outline: "border-2 border-slate-600 text-slate-300 hover:border-amber-500 hover:text-amber-400",
    glow: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/30",
    warm: "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-900 font-semibold shadow-lg shadow-amber-500/30"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    xl: "px-8 py-4 text-lg",
    icon: "p-2"
  };
  
  return (
    <button 
      {...props} 
      className={cn(
        "rounded-lg font-medium transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
};

// --- Feature Card Component ---
const FeatureCard = ({ icon: Icon, title, description, className }: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  className?: string;
}) => (
  <div className={cn(
    "bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-amber-500/30 transition-all group",
    className
  )}>
    <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
      <Icon className="w-6 h-6 text-amber-500" />
    </div>
    <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
    <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
  </div>
);

// --- Main Application ---

export default function SharpBoysCorner() {
  // View Mode - now includes 'home'
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [sandboxQuery, setSandboxQuery] = useState('');
const [toast, setToast] = useState<string | null>(null);

  // Generator State
  const [data, setData] = useState<AAMVAData>(DEFAULT_DATA);
  const [version, setVersion] = useState<AAMVAVersion>('2016');
  const [showRaw, setShowRaw] = useState(false);
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Smart Template State
  const [templates, setTemplates] = useState<SmartTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<SmartTemplate | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Generator Logic ---
  const buildAAMVAString = useCallback((d: AAMVAData) => {
    const complianceIndicator = '@';
    const dataElementSeparator = '\n';
    const recordSeparator = '\x1E';
    const segmentTerminator = '\r';
    
    const versionNum = version === '2016' ? '08' : '09'; 
    const header = `${complianceIndicator}\n${recordSeparator}DL${versionNum}${recordSeparator}${segmentTerminator}`;
    
    const elements = [
      `DAQ${d.dlNumber}`,
      `DCS${d.lastName}`,
      `DAC${d.firstName}`,
      `DAD${d.middleName}`,
      `DBB${d.dob}`,
      `DBA${d.expiryDate}`,
      `DBD${d.issueDate}`,
      `DBC${d.sex === 'M' || d.sex === '1' ? '1' : '2'}`,
      `DAY${d.eyeColor}`,
      `DAU${d.height}`,
      `DAG${d.address}`,
      `DAI${d.city}`,
      `DAJ${d.state}`,
      `DAK${d.zip}`,
      `DCG${d.country}`,
      d.weight ? `DAW${d.weight}` : '',
      d.hairColor ? `DAZ${d.hairColor}` : '',
      d.documentNumber ? `DCT${d.documentNumber}` : ''
    ].filter(Boolean).join(dataElementSeparator);

    const subfile = `DL${recordSeparator}${elements}${segmentTerminator}`;
    return `${header}${subfile}`;
  }, [version]);

  useEffect(() => {
    if (viewMode !== 'verification') return;
    const generateBarcode = async () => {
      if (!canvasRef.current) return;
      const aamvaString = buildAAMVAString(data);
      
      try {
        await bwipjs.toCanvas(canvasRef.current, {
          bcid: 'pdf417',
          text: aamvaString,
          scale: 3,
          height: 12,
          width: 80,
          includetext: false,
        });
        
        const url = canvasRef.current.toDataURL('image/png');
        setBarcodeUrl(url);
      } catch (e) {
        console.error("Barcode generation failed:", e);
      }
    };

    generateBarcode();
  }, [data, buildAAMVAString, viewMode]);

  // --- Smart Template Logic ---

  const analyzeTemplate = async (imageUrl: string, fileName: string) => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    try {
      const img = await loadImage(imageUrl);
      setAnalysisProgress(20);
      
      const worker = await createWorker('eng');
      const ocrResult = await worker.recognize(imageUrl);
      await worker.terminate();
      setAnalysisProgress(60);
      
      const detectedFields = parseOCRToFields(ocrResult.data.text, img.width, img.height);
      setAnalysisProgress(80);
      
      const newTemplate: SmartTemplate = {
        id: Date.now().toString(),
        name: fileName.replace(/\.[^/.]+$/, ""),
        type: detectIDType(ocrResult.data.text),
        baseImage: imageUrl,
        width: img.width,
        height: img.height,
        fields: detectedFields,
        analyzed: true
      };
      
      setTemplates(prev => [...prev, newTemplate]);
      setActiveTemplate(newTemplate);
      
      const initialForm: Record<string, string> = {};
      detectedFields.forEach(field => {
        initialForm[field.id] = field.detectedValue;
      });
      setFormData(initialForm);
      
      setAnalysisProgress(100);
      
      setTimeout(() => generateFinalImage(newTemplate, initialForm), 500);
      
    } catch (err) {
      console.error('Analysis failed:', err);
      alert('Failed to analyze template. Please try again with a clearer image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const parseOCRToFields = (ocrText: string, imgWidth: number, imgHeight: number): DetectedField[] => {
    const fields: DetectedField[] = [];
    
    const patterns = [
      { regex: /(name|nombre|nom)\s*[:;]?\s*(.+)/i, type: 'text', label: 'Full Name', y: imgHeight * 0.25 },
      { regex: /(first\s*name|given\s*name)\s*[:;]?\s*(.+)/i, type: 'text', label: 'First Name', y: imgHeight * 0.20 },
      { regex: /(last\s*name|surname|family\s*name)\s*[:;]?\s*(.+)/i, type: 'text', label: 'Last Name', y: imgHeight * 0.25 },
      { regex: /(id\s*number|license\s*number|document\s*number|no\.?|num)\s*[:;]?\s*([A-Z0-9\-]+)/i, type: 'text', label: 'ID Number', y: imgHeight * 0.35 },
      { regex: /(date\s*of\s*birth|dob|birth\s*date|born)\s*[:;]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i, type: 'date', label: 'Date of Birth', y: imgHeight * 0.45 },
      { regex: /(expir(y|ation)|exp\s*date|valid\s*until)\s*[:;]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i, type: 'date', label: 'Expiry Date', y: imgHeight * 0.55 },
      { regex: /(issue\s*date|issued|date\s*of\s*issue)\s*[:;]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i, type: 'date', label: 'Issue Date', y: imgHeight * 0.60 },
      { regex: /(address|addr|street)\s*[:;]?\s*(.+)/i, type: 'text', label: 'Address', y: imgHeight * 0.70 },
      { regex: /(city|town)\s*[:;]?\s*(.+)/i, type: 'text', label: 'City', y: imgHeight * 0.75 },
      { regex: /(state|province|st)\s*[:;]?\s*([A-Za-z\s]+)/i, type: 'text', label: 'State', y: imgHeight * 0.75 },
      { regex: /(zip|postal|code)\s*[:;]?\s*(\d[\w\s-]+)/i, type: 'text', label: 'ZIP Code', y: imgHeight * 0.80 },
      { regex: /(sex|gender)\s*[:;]?\s*([MF]|male|female)/i, type: 'text', label: 'Sex', y: imgHeight * 0.50 },
      { regex: /(height|ht)\s*[:;]?\s*(\d[\d\s\']+)/i, type: 'text', label: 'Height', y: imgHeight * 0.55 },
      { regex: /(eyes?|eye\s*color)\s*[:;]?\s*([A-Za-z]+)/i, type: 'text', label: 'Eye Color', y: imgHeight * 0.60 },
    ];
    
    let yOffset = imgHeight * 0.15;
    const lineHeight = imgHeight * 0.08;
    
    patterns.forEach((pattern, index) => {
      const match = ocrText.match(pattern.regex);
      if (match) {
        const value = match[2] || match[3] || match[1];
        fields.push({
          id: `field_${index}`,
          label: pattern.label,
          type: pattern.type as any,
          x: imgWidth * 0.05,
          y: pattern.y || yOffset,
          width: imgWidth * 0.4,
          height: lineHeight,
          detectedValue: value.trim(),
          confidence: 0.85,
          fontSize: Math.max(14, imgHeight * 0.025),
          color: '#000000',
          isBold: pattern.label.includes('Name') || pattern.label.includes('ID')
        });
        yOffset += lineHeight;
      }
    });
    
    if (fields.length === 0) {
      const defaults = [
        { label: 'Full Name', value: 'JOHN DOE', y: 0.20 },
        { label: 'ID Number', value: 'ID-12345678', y: 0.30 },
        { label: 'Date of Birth', value: '01/01/1990', y: 0.40 },
        { label: 'Address', value: '123 MAIN STREET', y: 0.55 },
        { label: 'Expiry Date', value: '01/01/2030', y: 0.70 },
      ];
      
      defaults.forEach((def, idx) => {
        fields.push({
          id: `field_${idx}`,
          label: def.label,
          type: 'text',
          x: imgWidth * 0.05,
          y: imgHeight * def.y,
          width: imgWidth * 0.4,
          height: lineHeight,
          detectedValue: def.value,
          confidence: 0.5,
          fontSize: Math.max(14, imgHeight * 0.025),
          color: '#000000',
          isBold: def.label === 'Full Name'
        });
      });
    }
    
    return fields;
  };

  const detectIDType = (ocrText: string): SmartTemplate['type'] => {
    const text = ocrText.toLowerCase();
    if (text.includes('driver') || text.includes('license') || text.includes('dl')) return 'drivers_license';
    if (text.includes('student') || text.includes('university') || text.includes('school')) return 'student_id';
    if (text.includes('passport')) return 'passport';
    if (text.includes('national') || text.includes('identity') || text.includes('id card')) return 'national_id';
    return 'other';
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      analyzeTemplate(imageUrl, file.name);
    };
    reader.readAsDataURL(file);
  };

const showToast = useCallback((message: string) => {
  setToast(message);
  const timer = window.setTimeout(() => setToast(null), 1400);
  return () => window.clearTimeout(timer);
}, []);

const handleCopyCell = useCallback(async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    showToast('Copied!');
  } catch {
    showToast('Copy failed');
  }
}, [showToast]);

const filteredSandboxRows = SANDBOX_DATA.filter((row) => {
  const q = sandboxQuery.trim().toLowerCase();
  if (!q) return true;
  return (
    row.fullName.toLowerCase().includes(q) ||
    row.ssn.toLowerCase().includes(q)
  );
});

  const generateFinalImage = async (template: SmartTemplate, data: Record<string, string>) => {
    setIsGenerating(true);
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = template.width;
      canvas.height = template.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const baseImg = await loadImage(template.baseImage);
      ctx.drawImage(baseImg, 0, 0);

      template.fields.forEach(field => {
        const value = data[field.id] || field.detectedValue;
        if (!value) return;

        ctx.font = `${field.isBold ? 'bold' : 'normal'} ${field.fontSize}px Arial, sans-serif`;
        ctx.fillStyle = field.color;
        ctx.textBaseline = 'top';
        
        const maxWidth = field.width;
        const words = value.split(' ');
        let line = '';
        let y = field.y;
        
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, field.x, y);
            line = words[i] + ' ';
            y += field.fontSize * 1.2;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, field.x, y);
      });

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      setGeneratedImage(dataUrl);
      
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const CopyCellButton = ({ value }: { value: string }) => (
  <button
    type="button"
    onClick={() => handleCopyCell(value)}
    className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-500 transition hover:border-amber-500/40 hover:text-amber-400"
    title={`Copy ${value}`}
  >
    <Copy className="h-3.5 w-3.5" />
  </button>
);

  const downloadGenerated = () => {
    if (!generatedImage || !activeTemplate) return;
    
    const link = document.createElement('a');
    link.download = `${activeTemplate.name}_generated.png`;
    link.href = generatedImage;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (activeTemplate?.id === id) {
      setActiveTemplate(null);
      setGeneratedImage(null);
    }
  };

  // --- Generator Handlers ---
  const handleFrontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setFrontImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setBackImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const runAudit = async () => {
    if (!frontImage && !backImage) return;
    setIsProcessing(true);
    setAuditResult(null);

    let ocrText = '';
    let barcodeData = '';

    try {
      if (frontImage) {
        const worker = await createWorker('eng');
        const ret = await worker.recognize(frontImage);
        ocrText = ret.data.text;
        await worker.terminate();
      }

      if (backImage) {
        const codeReader = new BrowserPDF417Reader();
        const img = document.createElement('img');
        img.src = backImage;
        await new Promise(resolve => { img.onload = resolve; });
        
        try {
          const result: Result = await codeReader.decodeFromImageElement(img);
          barcodeData = result.getText();
        } catch (e) {
          console.warn("No barcode found on back image");
        }
      }

      const discrepancies: string[] = [];
      if (ocrText && barcodeData) {
        if (barcodeData.includes(`DBB${data.dob}`) && !ocrText.includes(data.dob)) {
           discrepancies.push("DOB mismatch between OCR and Barcode");
        }
        if (barcodeData.includes(`DCS${data.lastName}`) && !ocrText.toUpperCase().includes(data.lastName)) {
           discrepancies.push("Last Name mismatch");
        }
      }

      setAuditResult({
        ocrText,
        barcodeData,
        discrepancies,
        isMatch: discrepancies.length === 0 && !!barcodeData
      });

      if (barcodeData) {
        parseAndSync(barcodeData);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const parseAndSync = (rawData: string) => {
    const getVal = (key: string) => {
      const regex = new RegExp(`${key}([^\\n\\x1E\\r]+)`);
      const match = rawData.match(regex);
      return match ? match[1] : '';
    };

    setData(prev => ({
      ...prev,
      firstName: getVal('DAC') || prev.firstName,
      lastName: getVal('DCS') || prev.lastName,
      middleName: getVal('DAD') || prev.middleName,
      dlNumber: getVal('DAQ') || prev.dlNumber,
      dob: getVal('DBB') || prev.dob,
      expiryDate: getVal('DBA') || prev.expiryDate,
      issueDate: getVal('DBD') || prev.issueDate,
      address: getVal('DAG') || prev.address,
      city: getVal('DAI') || prev.city,
      state: getVal('DAJ') || prev.state,
      zip: getVal('DAK') || prev.zip,
      sex: getVal('DBC') === '1' ? 'M' : 'F',
      height: getVal('DAU') || prev.height,
      eyeColor: getVal('DAY') || prev.eyeColor,
    }));
  };

  const handleDownload = () => {
    if (!barcodeUrl) return;
    const link = document.createElement('a');
    link.href = barcodeUrl;
    link.download = `AAMVA-${data.dlNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Navigation Component ---
  const GlobalHeader = () => (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setViewMode('home')}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Star className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-100">
              Sharp Boys <span className="text-amber-500">Corner</span>
            </h1>
          </div>
        </div>
        
        <nav className="flex items-center gap-1">
          <button 
            onClick={() => setViewMode('home')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
              viewMode === 'home' 
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          <button 
            onClick={() => setViewMode('verification')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
              viewMode === 'verification' 
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            ID/DL Verification Centre
          </button>
            <Button   size="sm"
              onClick={() => setViewMode('smart-template')}
            >
              <Wand2 className="w-5 h-5" />
              Generate your ID/DL
            </Button>
            <Button  
  size="sm"
  onClick={() => setViewMode('sandbox')}
>
  <Database className="w-5 h-5" />
  Get Access to Fullz Centre
</Button>
          <a 
            href="https://barcode-generator-kohl.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-amber-400 hover:bg-slate-800/50 transition-colors flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Barcode Generator ProMax
          </a>
          <a 
  href="https://u.pcloud.link/publink/show?code=kZWF29VZXF6haiiID7hV9g1q62FMzYsWNweV"
  target="_blank"
  rel="noopener noreferrer"
  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-amber-400 hover:bg-slate-800/50 transition-colors flex items-center gap-2"
>
  <Globe className="w-4 h-4" />
  Access All Template
  <ExternalLink className="w-3.5 h-3.5" />
</a>
        </nav>
      </div>
    </header>
  );

const DataSandboxView = () => {
  // Updated columns to match new interface properties
  const columns = [
    { key: "ssn", label: "SSN", icon: Hash },
    { key: "fullName", label: "Full Name", icon: User },
    { key: "email", label: "Email", icon: Mail },
    { key: "phone", label: "Phone", icon: Phone },
    { key: "dob", label: "DOB", icon: Clock3 },
    { key: "address", label: "Address", icon: MapPin },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-slate-950 p-6 shadow-2xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <Database className="h-3.5 w-3.5" />
              Internal Testing Surface
            </div>
            <h2 className="text-2xl font-semibold text-zinc-100">FULLZ CENTRE</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              A synthetic FULLZ HUB-style table for Sharp boys and Freelancers,
              quick copy actions, and filtering workflows.
            </p>
          </div>

          <div className="w-full max-w-md">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Global Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={sandboxQuery}
                onChange={(e) => setSandboxQuery(e.target.value)}
                placeholder="Search by name, SSN, or email..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="border-b border-zinc-800 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-mono text-sm uppercase tracking-[0.22em] text-zinc-300">
                FULLZ HUB
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                {filteredSandboxRows.length} visible row{filteredSandboxRows.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-400">
              DEV / SYNTHETIC / use -ONLY
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-collapse font-mono text-sm">
            <thead className="bg-zinc-900/80">
              <tr>
                {columns.map(({ key, label, icon: Icon }) => (
                  <th
                    key={key}
                    className="border-b border-r border-zinc-800 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 last:border-r-0"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-zinc-500" />
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredSandboxRows.map((row, index) => (
                <tr
                  // Fixed duplicate key error by appending index
                  key={`${row.ssn}-${index}`}
                  className={index % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}
                >
                  {columns.map(({ key }) => {
                    // Safe indexing using type cast
                    const value = row[key as keyof SandboxRow];
                    return (
                      <td
                        key={key}
                        className="border-b border-r border-zinc-900 px-4 py-3 align-middle text-zinc-200 last:border-r-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{value ?? "N/A"}</span>
                          <CopyCellButton value={value?.toString() ?? ""} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {filteredSandboxRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center font-mono text-sm text-zinc-500"
                  >
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
  // --- Homepage View ---
  const HomeView = () => (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjUxLCAxOTEsIDM2LCAwLjAzKSIvPjwvc3ZnPg==')] opacity-20"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-6xl mx-auto px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            Welcome to the Future of Identity Verification
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-slate-100 mb-6 leading-tight">
            Your One-Stop Hub for<br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Mafuluu(fullz), DL/ID Templates All countries,Utility bills & Scannable Barcode Generator 
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Professional-grade identity verification, data synchronization, and auditing tools. 
            Built for precision, designed for simplicity, secured for your peace of mind.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Button 
              variant="warm" 
              size="xl"
              onClick={() => setViewMode('verification')}
            >
              <ShieldCheck className="w-5 h-5" />
              Enter Verification Centre
            </Button>
            <Button 
              variant="outline" 
              size="xl"
              onClick={() => setViewMode('smart-template')}
            >
              <Wand2 className="w-5 h-5" />
              Generate your ID/DL With Ai
            </Button>
            <Button 
  variant="outline" 
  size="xl"
  onClick={() => setViewMode('sandbox')}
>
  <Database className="w-5 h-5" />
  Get Access to Fullz Centre
</Button>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500 mb-1">100%</div>
              <div className="text-sm text-slate-500">Client-Side</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500 mb-1">AAMVA</div>
              <div className="text-sm text-slate-500">Compliant</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500 mb-1">Zero</div>
              <div className="text-sm text-slate-500">Data Stored</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-100 mb-4">Professional Tools at Your Fingertips</h2>
          <p className="text-slate-400">Everything you need for identity verification and document generation</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon={ShieldCheck}
            title="ID/DL Verification Centre"
            description="Comprehensive AAMVA-compliant verification with OCR scanning, PDF417 barcode generation, and automated audit tools."
          />
          <FeatureCard 
            icon={QrCode}
            title="Barcode Generator ProMax"
            description="Advanced barcode generation suite with support for multiple formats including PDF417, QR codes, and more."
          />
          <FeatureCard 
            icon={Wand2}
            title="Smart Template System"
            description="AI-powered template analysis that automatically detects fields and generates updated documents."
          />
          <FeatureCard 
            icon={Scan}
            title="OCR & Data Extraction"
            description="Extract text from ID documents with high accuracy using advanced Tesseract.js integration."
          />
          <FeatureCard 
            icon={Lock}
            title="Privacy First"
            description="All processing happens client-side. Your data never leaves your browser, ensuring maximum security."
          />
          <FeatureCard 
            icon={Zap}
            title="Real-Time Preview"
            description="See changes instantly with live preview capabilities across all tools and generators."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl p-12 text-center border border-amber-500/20">
        <h2 className="text-3xl font-bold text-slate-100 mb-4">Ready to Get Started?</h2>
        <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
          Join thousands of professionals who trust Sharp Boys Corner for their identity verification needs.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button 
            variant="warm" 
            size="lg"
            onClick={() => setViewMode('verification')}
          >
            Start been Sharp
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 pt-12 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Star className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-bold text-slate-100">Sharp Boys Corner</span>
          </div>
          <p className="text-sm text-slate-500">© 2026 Premium Identity Tools. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500/30">
      <Head>
        <title>Sharp Boys Corner - Premium Identity Tools</title>
        <meta name="description" content="Professional-grade identity verification, data synchronization, and auditing tools." />
      </Head>

      <GlobalHeader />

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {viewMode === 'home' ? (
  <HomeView />
) : viewMode === 'verification' ? (
          /* VERIFICATION CENTRE VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-400">
                    <ShieldCheck className="w-5 h-5" />
                    ID/DL Verification Centre
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">AAMVA-compliant data generation and verification</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select 
                    value={version} 
                    onChange={(e) => setVersion(e.target.value as AAMVAVersion)}
                    className="w-32 text-xs h-8"
                  >
                    <option value="2016">AAMVA 2016</option>
                    <option value="2020">AAMVA 2020</option>
                  </Select>
                  <Button 
                    variant="secondary" 
                    className="h-8 text-xs px-3"
                    onClick={() => setData(DEFAULT_DATA)}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                </div>
              </div>

              <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-300 border-b border-slate-800 pb-2 mb-2">
                      <User className="w-4 h-4 text-amber-500" /> Personal Info
                    </div>
                    <InputGroup label="First Name (DAC)">
                      <Input value={data.firstName} onChange={e => setData({...data, firstName: e.target.value.toUpperCase()})} />
                    </InputGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup label="Last Name (DCS)">
                        <Input value={data.lastName} onChange={e => setData({...data, lastName: e.target.value.toUpperCase()})} />
                      </InputGroup>
                      <InputGroup label="Middle (DAD)">
                        <Input value={data.middleName} onChange={e => setData({...data, middleName: e.target.value.toUpperCase()})} />
                      </InputGroup>
                    </div>
                    <InputGroup label="DL Number (DAQ)">
                      <Input value={data.dlNumber} onChange={e => setData({...data, dlNumber: e.target.value.toUpperCase()})} />
                    </InputGroup>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-300 border-b border-slate-800 pb-2 mb-2">
                      <Fingerprint className="w-4 h-4 text-amber-500" /> Physical
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup label="Sex (DBC)">
                        <Select value={data.sex} onChange={e => setData({...data, sex: e.target.value as any})}>
                          <option value="M">Male (1)</option>
                          <option value="F">Female (2)</option>
                        </Select>
                      </InputGroup>
                      <InputGroup label="Height (DAU)">
                        <Input placeholder="509" value={data.height} onChange={e => setData({...data, height: e.target.value})} />
                      </InputGroup>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup label="Eye Color (DAY)">
                        <Input placeholder="BRO" value={data.eyeColor} onChange={e => setData({...data, eyeColor: e.target.value.toUpperCase()})} />
                      </InputGroup>
                      <InputGroup label="Hair Color (DAZ)">
                        <Input placeholder="BLK" value={data.hairColor} onChange={e => setData({...data, hairColor: e.target.value.toUpperCase()})} />
                      </InputGroup>
                    </div>
                     <InputGroup label="Weight (DAW)">
                        <Input placeholder="180" value={data.weight} onChange={e => setData({...data, weight: e.target.value})} />
                      </InputGroup>
                  </div>

                  <div className="space-y-4 md:col-span-2">
                     <div className="flex items-center gap-2 text-sm font-medium text-slate-300 border-b border-slate-800 pb-2 mb-2">
                      <Calendar className="w-4 h-4 text-amber-500" /> Dates (MMDDYYYY)
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <InputGroup label="Date of Birth (DBB)">
                        <Input placeholder="MMDDYYYY" value={data.dob} onChange={e => setData({...data, dob: e.target.value})} />
                      </InputGroup>
                      <InputGroup label="Issue Date (DBD)">
                        <Input placeholder="MMDDYYYY" value={data.issueDate} onChange={e => setData({...data, issueDate: e.target.value})} />
                      </InputGroup>
                      <InputGroup label="Expiry Date (DBA)">
                        <Input placeholder="MMDDYYYY" value={data.expiryDate} onChange={e => setData({...data, expiryDate: e.target.value})} />
                      </InputGroup>
                    </div>
                  </div>

                  <div className="space-y-4 md:col-span-2">
                     <div className="flex items-center gap-2 text-sm font-medium text-slate-300 border-b border-slate-800 pb-2 mb-2">
                      <CreditCard className="w-4 h-4 text-amber-500" /> Address
                    </div>
                    <InputGroup label="Street (DAG)">
                      <Input value={data.address} onChange={e => setData({...data, address: e.target.value.toUpperCase()})} />
                    </InputGroup>
                    <div className="grid grid-cols-3 gap-4">
                      <InputGroup label="City (DAI)">
                        <Input value={data.city} onChange={e => setData({...data, city: e.target.value.toUpperCase()})} />
                      </InputGroup>
                      <InputGroup label="State (DAJ)">
                        <Input value={data.state} onChange={e => setData({...data, state: e.target.value.toUpperCase()})} />
                      </InputGroup>
                      <InputGroup label="ZIP (DAK)">
                        <Input value={data.zip} onChange={e => setData({...data, zip: e.target.value})} />
                      </InputGroup>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                <button 
                  onClick={() => setShowRaw(!showRaw)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
                >
                  <span className="flex items-center gap-2"><Code className="w-4 h-4" /> View Raw AAMVA String</span>
                  {showRaw ? <span className="text-xs bg-slate-800 px-2 py-0.5 rounded">Hide</span> : <span className="text-xs bg-slate-800 px-2 py-0.5 rounded">Show</span>}
                </button>
                {showRaw && (
                  <div className="p-4 bg-black/30 border-t border-slate-800">
                    <pre className="text-xs font-mono text-amber-400 whitespace-pre-wrap break-all">
                      {buildAAMVAString(data).replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\x1E/g, '\\x1E')}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="sticky top-24 space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-400">
                  <Eye className="w-5 h-5" />
                  Live Preview
                </h2>

                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  <div className="relative bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center justify-center min-h-[320px]">
                    <div className="w-full flex justify-between items-start mb-8 text-slate-900">
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Driver License</div>
                        <div className="text-2xl font-bold">{data.state}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">ID Number</div>
                        <div className="font-mono text-lg">{data.dlNumber}</div>
                      </div>
                    </div>

                    <div className="bg-white p-2 rounded border border-slate-200">
                      <canvas ref={canvasRef} className="max-w-full h-auto" />
                    </div>

                    <div className="w-full mt-8 grid grid-cols-2 gap-4 text-slate-900">
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 font-bold">Name</div>
                        <div className="text-sm font-semibold truncate">{data.lastName}, {data.firstName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-slate-500 font-bold">Expires</div>
                        <div className="text-sm font-semibold">{data.expiryDate}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button onClick={handleDownload} className="w-full py-3 text-base">
                  <Download className="w-5 h-5" />
                  Download High-Res PNG
                </Button>

                <div className="pt-8 border-t border-slate-800">
                  <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-400 mb-4">
                    <Scan className="w-5 h-5" />
                    ID\DL Audit Tool
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-slate-900 min-h-[120px]",
                        frontImage ? "border-amber-500/50 bg-amber-500/5" : "border-slate-700"
                      )}
                      onClick={() => frontInputRef.current?.click()}
                    >
                      <input type="file" ref={frontInputRef} className="hidden" accept="image/*" onChange={handleFrontUpload} />
                      {frontImage ? (
                        <img src={frontImage} className="h-16 w-auto object-contain rounded mb-2" alt="Front" />
                      ) : (
                        <Camera className="w-8 h-8 text-slate-600 mb-2" />
                      )}
                      <span className="text-xs font-medium text-slate-400">Upload Front (OCR)</span>
                    </div>

                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-slate-900 min-h-[120px]",
                        backImage ? "border-amber-500/50 bg-amber-500/5" : "border-slate-700"
                      )}
                      onClick={() => backInputRef.current?.click()}
                    >
                      <input type="file" ref={backInputRef} className="hidden" accept="image/*" onChange={handleBackUpload} />
                      {backImage ? (
                        <img src={backImage} className="h-16 w-auto object-contain rounded mb-2" alt="Back" />
                      ) : (
                        <Scan className="w-8 h-8 text-slate-600 mb-2" />
                      )}
                      <span className="text-xs font-medium text-slate-400">Upload Back (PDF417)</span>
                    </div>
                  </div>

                  <Button 
                    onClick={runAudit} 
                    disabled={isProcessing || (!frontImage && !backImage)}
                    variant="secondary"
                    className="w-full mb-6"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                    {isProcessing ? 'Processing...' : 'Run Verification Audit'}
                  </Button>

                  {auditResult && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className={cn(
                        "p-4 rounded-lg border flex items-start gap-3",
                        auditResult.isMatch 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                          : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      )}>
                        {auditResult.isMatch ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                        <div>
                          <div className="font-semibold text-sm">
                            {auditResult.isMatch ? 'Verification Successful' : 'Discrepancies Found'}
                          </div>
                          <div className="text-xs opacity-80 mt-1">
                            {auditResult.isMatch 
                              ? 'OCR text matches Barcode data.' 
                              : 'Data mismatch detected between visual text and encoded barcode.'}
                          </div>
                        </div>
                      </div>

                      {auditResult.discrepancies.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          <div className="text-xs font-semibold text-red-400 mb-2">Issues:</div>
                          <ul className="list-disc list-inside text-xs text-red-300 space-y-1">
                            {auditResult.discrepancies.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="bg-slate-900 p-3 rounded border border-slate-800">
                          <span className="text-slate-500 font-semibold block mb-1">OCR EXTRACT (Front)</span>
                          <p className="text-slate-300 font-mono line-clamp-4">{auditResult.ocrText || "No text extracted"}</p>
                        </div>
                        <div className="bg-slate-900 p-3 rounded border border-slate-800">
                          <span className="text-slate-500 font-semibold block mb-1">BARCODE DATA (Back)</span>
                          <p className="text-slate-300 font-mono line-clamp-4">{auditResult.barcodeData || "No barcode found"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) :
        
        viewMode === 'sandbox' ? (
  <DataSandboxView />
) : 
        
        (
          /* SMART TEMPLATE VIEW */
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-400">
                  <Wand2 className="w-5 h-5" />
                  Smart Template Editing System
                </h2>
                <p className="text-sm text-slate-500 mt-1">AI-powered template analysis and generation</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left: Templates List & Upload */}
              <div className="lg:col-span-4 space-y-4">
                <Card className="p-6">
                  <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-500" />
                    Upload Your ID/DL Template
                  </h3>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleTemplateUpload}
                      className="hidden"
                      id="template-upload"
                      disabled={isAnalyzing}
                    />
                    <label 
                      htmlFor="template-upload"
                      className={cn(
                        "flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all",
                        isAnalyzing 
                          ? "border-slate-600 bg-slate-800/50 cursor-not-allowed"
                          : "border-slate-600 hover:border-amber-500 hover:bg-amber-500/5"
                      )}
                    >
                      {isAnalyzing ? (
                        <div className="text-center">
                          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-2" />
                          <p className="text-sm text-slate-300">Analyzing template...</p>
                          <div className="w-48 h-2 bg-slate-700 rounded-full mt-3 overflow-hidden">
                            <div 
                              className="h-full bg-amber-500 transition-all duration-300"
                              style={{ width: `${analysisProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{analysisProgress}%</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                          <p className="text-sm text-slate-300">Click to upload ID template</p>
                          <p className="text-xs text-slate-500 mt-1">PNG, JPG, PSD or WebP</p>
                        </div>
                      )}
                    </label>
                  </div>
                </Card>

                {templates.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-500" />
                      Saved Templates ({templates.length})
                    </h3>
                    
                    <div className="space-y-2">
                      {templates.map((t) => (
                        <div 
                          key={t.id}
                          onClick={() => {
                            setActiveTemplate(t);
                            const initialData: Record<string, string> = {};
                            t.fields.forEach(f => initialData[f.id] = f.detectedValue);
                            setFormData(initialData);
                            setTimeout(() => generateFinalImage(t, initialData), 100);
                          }}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3",
                            activeTemplate?.id === t.id
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-slate-800 hover:border-slate-700"
                          )}
                        >
                          <img src={t.baseImage} className="w-12 h-12 object-cover rounded" alt={t.name} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{t.name}</p>
                            <p className="text-xs text-slate-500 capitalize">{t.type.replace('_', ' ')} • {t.fields.length} fields</p>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                            className="text-slate-500 hover:text-red-400 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              {/* Center: Form Editor */}
              <div className="lg:col-span-4">
                {activeTemplate ? (
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                          <Settings className="w-4 h-4 text-amber-500" />
                          Edit Data
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{activeTemplate.name}</p>
                      </div>
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
                        {activeTemplate.fields.length} fields
                      </span>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                      {activeTemplate.fields.map((field) => (
                        <div key={field.id} className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                            {field.label}
                            {field.confidence > 0.8 && (
                              <Check className="w-3 h-3 text-emerald-500" />
                            )}
                          </label>
                          <Input 
                            value={formData[field.id] || ''}
                            onChange={(e) => {
                              const newData = { ...formData, [field.id]: e.target.value };
                              setFormData(newData);
                              clearTimeout((window as any).regenTimeout);
                              (window as any).regenTimeout = setTimeout(() => {
                                generateFinalImage(activeTemplate, newData);
                              }, 300);
                            }}
                            placeholder={field.detectedValue}
                          />
                          <p className="text-[10px] text-slate-600">
                            Detected: {field.detectedValue || 'None'}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800">
                      <Button 
                        variant="glow" 
                        className="w-full"
                        onClick={() => generateFinalImage(activeTemplate, formData)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4" />
                        )}
                        {isGenerating ? 'Generating...' : 'Regenerate Preview'}
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center h-full flex flex-col items-center justify-center">
                    <LayoutTemplate className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-slate-300 font-medium mb-2">No Template Selected</h3>
                    <p className="text-sm text-slate-500">
                      Upload a template or select one from your saved templates to start editing
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Preview & Export */}
              <div className="lg:col-span-4">
                {activeTemplate && generatedImage ? (
                  <div className="space-y-4">
                    <Card className="p-4">
                      <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-amber-500" />
                        Generated Preview
                      </h3>
                      
                      <div className="relative bg-slate-950 rounded-lg overflow-hidden">
                        <img 
                          src={generatedImage} 
                          alt="Generated" 
                          className="w-full h-auto"
                        />
                        {isGenerating && (
                          <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <Button variant="secondary" onClick={downloadGenerated}>
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                        <Button onClick={() => alert('Image ready for use!')}>
                          <ChevronRight className="w-4 h-4" />
                          Use This
                        </Button>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <h3 className="font-semibold text-slate-100 mb-3 text-sm">Detected Field Positions</h3>
                      <div className="space-y-2 text-xs">
                        {activeTemplate.fields.map((field) => (
                          <div key={field.id} className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0">
                            <span className="text-slate-400">{field.label}</span>
                            <span className="text-slate-500 font-mono">
                              {Math.round(field.x)}, {Math.round(field.y)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center h-full flex flex-col items-center justify-center">
                    <Eye className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-slate-300 font-medium mb-2">Preview Will Appear Here</h3>
                    <p className="text-sm text-slate-500">
                      Fill in the form fields to see the generated result in real-time
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {toast && (
  <div className="fixed bottom-5 right-5 z-[100] rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 shadow-2xl backdrop-blur">
    {toast}
  </div>
)}
      </main>
    </div>
  );
}