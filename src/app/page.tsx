import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { 
  Scan, 
  Upload, 
  FileText, 
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
  Camera
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

interface AAMVAData {
  firstName: string;      // DAC
  lastName: string;       // DCS
  middleName: string;     // DAD
  dob: string;            // DBB (MMDDYYYY)
  issueDate: string;      // DBD (MMDDYYYY)
  expiryDate: string;     // DBA (MMDDYYYY)
  dlNumber: string;       // DAQ
  address: string;        // DAG
  city: string;           // DAI
  state: string;          // DAJ
  zip: string;            // DAK
  sex: 'M' | 'F' | '1' | '2'; // DBC (1=M, 2=F or M/F)
  height: string;         // DAU (e.g., 509 for 5'9")
  eyeColor: string;       // DAY
  hairColor: string;      // DAZ
  weight: string;         // DAW
  country: string;          // DCG (USA/CAN)
  documentNumber: string; // DCT (optional)
}

interface AuditResult {
  ocrText: string;
  barcodeData: string | null;
  discrepancies: string[];
  isMatch: boolean;
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

// --- Components ---

// 1. UI Primitives (Shadcn-like)
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
      "w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600",
      props.className
    )}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    {...props} 
    className={cn(
      "w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all appearance-none",
      props.className
    )}
  >
    {props.children}
  </select>
);

const Button = ({ 
  children, 
  variant = 'primary', 
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    ghost: "hover:bg-slate-800 text-slate-400 hover:text-slate-200",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
  };
  
  return (
    <button 
      {...props} 
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

// --- Main Application ---

export default function AAMVASuite() {
  // State
  const [data, setData] = useState<AAMVAData>(DEFAULT_DATA);
  const [version, setVersion] = useState<AAMVAVersion>('2016');
  const [showRaw, setShowRaw] = useState(false);
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  
  // Audit State
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // --- Logic: AAMVA String Construction ---
  const buildAAMVAString = useCallback((d: AAMVAData) => {
    // AAMVA Header
    const complianceIndicator = '@';
    const dataElementSeparator = '\n';
    const recordSeparator = '\x1E'; // RS
    const segmentTerminator = '\r'; // CR
    
    // Header Segment
    // DLDriverLicenseOrIDCardDesignVersionNumber (e.g., 08 for 2016)
    const versionNum = version === '2016' ? '08' : '09'; 
    const header = `${complianceIndicator}\n${recordSeparator}DL${versionNum}${recordSeparator}${segmentTerminator}`;
    
    // Subfile Designator (DL)
    // We construct the data elements first
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

  // --- Logic: Barcode Generation ---
  useEffect(() => {
    const generateBarcode = async () => {
      if (!canvasRef.current) return;
      
      const aamvaString = buildAAMVAString(data);
      
      try {
        // We use bwip-js to draw to the canvas
        // @ts-ignore - bwip-js browser API is slightly different from node
        await bwipjs.toCanvas(canvasRef.current, {
          bcid: 'pdf417',       // Barcode type
          text: aamvaString,    // Text to encode
          scale: 3,             // 3x scaling factor
          height: 12,           // Bar height, in millimeters
          width: 80,            // Width in mm
          includetext: false,   // No human readable text
          eclevel: 5,           // Error correction level
        });
        
        // Convert to PNG for download/display
        const url = canvasRef.current.toDataURL('image/png');
        setBarcodeUrl(url);
      } catch (e) {
        console.error("Barcode generation failed:", e);
      }
    };

    generateBarcode();
  }, [data, buildAAMVAString]);

  // --- Logic: Audit & OCR ---
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
      // 1. OCR Front
      if (frontImage) {
        const worker = await createWorker('eng');
        const ret = await worker.recognize(frontImage);
        ocrText = ret.data.text;
        await worker.terminate();
      }

      // 2. Scan Back (PDF417)
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

      // 3. Compare
      const discrepancies: string[] = [];
      // Simple string inclusion check for demo purposes
      if (ocrText && barcodeData) {
        // Check DOB
        if (barcodeData.includes(`DBB${data.dob}`) && !ocrText.includes(data.dob)) {
           discrepancies.push("DOB mismatch between OCR and Barcode");
        }
        // Check Name (Last)
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

      // 4. Auto-Sync if match is good enough
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
    // Very basic parser for demo
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <Head>
        <title>AAMVA PDF417 Suite</title>
      </Head>

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Scan className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-100">
              AAMVA<span className="text-indigo-400">Forge</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Client-Side Processing</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: GENERATOR FORM */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-400" />
                Data Generator
              </h2>
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
                {/* Personal */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-300 border-b border-slate-800 pb-2 mb-2">
                    <User className="w-4 h-4 text-indigo-400" /> Personal Info
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

                {/* Physical */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-300 border-b border-slate-800 pb-2 mb-2">
                    <Fingerprint className="w-4 h-4 text-indigo-400" /> Physical
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

                {/* Dates */}
                <div className="space-y-4 md:col-span-2">
                   <div className="flex items-center gap-2 text-sm font-medium text-slate-300 border-b border-slate-800 pb-2 mb-2">
                    <Calendar className="w-4 h-4 text-indigo-400" /> Dates (MMDDYYYY)
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

                {/* Address */}
                <div className="space-y-4 md:col-span-2">
                   <div className="flex items-center gap-2 text-sm font-medium text-slate-300 border-b border-slate-800 pb-2 mb-2">
                    <CreditCard className="w-4 h-4 text-indigo-400" /> Address
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

            {/* Raw Data Toggle */}
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
                  <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap break-all">
                    {buildAAMVAString(data).replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\x1E/g, '\\x1E')}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: PREVIEW & AUDIT */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Preview Card */}
            <div className="sticky top-24 space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-400" />
                Live Preview
              </h2>

              {/* The Card Visual */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center justify-center min-h-[320px]">
                  {/* IMPORTANT: White background for scan-ability */}
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

                  {/* Barcode Canvas */}
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

              {/* Audit Section */}
              <div className="pt-8 border-t border-slate-800">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                  <Scan className="w-5 h-5 text-indigo-400" />
                  ID Audit Tool
                </h2>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Front Upload */}
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-slate-900 min-h-[120px]",
                      frontImage ? "border-indigo-500/50 bg-indigo-500/5" : "border-slate-700"
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

                  {/* Back Upload */}
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-slate-900 min-h-[120px]",
                      backImage ? "border-indigo-500/50 bg-indigo-500/5" : "border-slate-700"
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

                {/* Audit Results */}
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
      </main>
    </div>
  );
}