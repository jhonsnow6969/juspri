import { useState, useCallback, useMemo, lazy, Suspense, useEffect } from 'react';
import axios from 'axios';
import { Printer, CheckCircle, Wifi, FileUp, Loader2, AlertCircle, IndianRupee, Zap, QrCode, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Lazy load the QR scanner only when needed
const Scanner = lazy(() => 
  import('@yudiel/react-qr-scanner').then(module => ({ 
    default: module.Scanner 
  }))
);

function App() {
  const [status, setStatus] = useState('IDLE');
  const [config, setConfig] = useState(null);
  const [file, setFile] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [logs, setLogs] = useState([]);
  const [cameraError, setCameraError] = useState(null);
  const [scannerActive, setScannerActive] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Memoized log function
  const addLog = useCallback((msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  // V2: Status polling when job is created
  useEffect(() => {
    if (!pricing?.job_id || status !== 'PRINTING') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_URL}/api/jobs/${pricing.job_id}/status`);
        const jobStatus = response.data.status;
        
        addLog(`Status: ${jobStatus}`);
        
        if (jobStatus === 'COMPLETED') {
          setStatus('COMPLETED');
          clearInterval(pollInterval);
        } else if (jobStatus === 'FAILED') {
          setStatus('ERROR');
          clearInterval(pollInterval);
          addLog(`Print failed: ${response.data.error_message || 'Unknown error'}`);
        }
      } catch (e) {
        console.error('Status poll error:', e);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [pricing?.job_id, status, API_URL, addLog]);

  // Scan handler - V2: Expect kiosk_id in QR
  const handleScan = useCallback((detectedCodes) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    
    setScannerActive(false);
    
    const rawValue = detectedCodes[0].rawValue;
    try {
      let printerData = {};
      
      if (rawValue.trim().startsWith('{')) {
        printerData = JSON.parse(rawValue);
        // V2: Ensure kiosk_id exists
        if (!printerData.kiosk_id) {
          printerData.kiosk_id = printerData.ip || 'default_kiosk';
        }
      } else {
        // Fallback: use IP as kiosk_id
        printerData = { 
          kiosk_id: rawValue,
          ip: rawValue, 
          port: 9100 
        };
      }

      setConfig(printerData);
      setStatus('SCANNED');
      addLog(`QR Decoded: Kiosk ${printerData.kiosk_id}`);
    } catch (e) {
      addLog("Invalid QR Format");
      setScannerActive(true);
    }
  }, [addLog]);

  const handleScanError = useCallback((error) => {
    console.warn('Camera error:', error);
    setCameraError('Camera access denied. Allow permissions or use manual entry below.');
  }, []);

  // V2: Connect now just checks if kiosk is online
  const connectPrinter = useCallback(async () => {
    try {
      setStatus('CONNECTING');
      addLog(`Checking kiosk ${config.kiosk_id}...`);
      
      const response = await axios.post(`${API_URL}/api/connect`, {
        kiosk_id: config.kiosk_id
      }, { timeout: 5000 });

      if (response.data.status === 'connected') {
        setStatus('CONNECTED');
        addLog(`✓ Connected to "${response.data.kiosk_name || config.kiosk_id}"`);
        addLog(`Printer: ${response.data.printer || 'Unknown'}`);
      }
    } catch (e) {
      setStatus('ERROR');
      addLog("✗ Kiosk offline or not found");
    }
  }, [config, API_URL, addLog]);

  // V2: File select creates job on server
  const handleFileSelect = useCallback(async (selectedFile) => {
    if (!selectedFile) return;
    
    if (selectedFile.type !== 'application/pdf') {
      alert("⚠️ Only PDF files are supported");
      return;
    }

    setFile(selectedFile);
    setStatus('CALCULATING');
    addLog(`Creating job for ${selectedFile.name}...`);

    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('kiosk_id', config.kiosk_id);

    try {
      const response = await axios.post(`${API_URL}/api/jobs/create`, fd, {
        timeout: 15000
      });
      
      setPricing({
        job_id: response.data.job_id,
        pages: response.data.pages,
        pricePerPage: response.data.price_per_page,
        totalPrice: response.data.total_cost,
        estimatedTime: response.data.estimated_time_seconds
      });
      
      setStatus('PAYMENT');
      addLog(`Job ${response.data.job_id} created`);
      addLog(`${response.data.pages} pages × ₹${response.data.price_per_page} = ₹${response.data.total_cost}`);
    } catch (e) {
      setStatus('CONNECTED');
      addLog("Job creation failed");
      alert("Could not create job. Try again.");
    }
  }, [API_URL, addLog, config]);

  // V2: Payment verifies and authorizes print
  const handlePayment = useCallback(async () => {
    addLog(`Verifying payment for ₹${pricing.totalPrice}...`);
    
    try {
      const response = await axios.post(
        `${API_URL}/api/jobs/${pricing.job_id}/verify-payment`,
        {
          payment_id: 'MOCK_PAYMENT_' + Date.now(),
          payment_signature: 'MOCK_SIGNATURE'
        },
        { timeout: 10000 }
      );
      
      if (response.data.status === 'success') {
        setStatus('PRINTING');
        addLog('✓ Payment verified');
        addLog(response.data.message);
        
        if (response.data.queue_position > 0) {
          addLog(`Queue position: ${response.data.queue_position}`);
        }
      }
    } catch (e) {
      addLog('✗ Payment verification failed');
      alert('Payment failed. Try again.');
    }
  }, [pricing, API_URL, addLog]);

  const resetFlow = useCallback(() => {
    setStatus('IDLE');
    setFile(null);
    setPricing(null);
    setConfig(null);
    setCameraError(null);
    setScannerActive(true);
  }, []);

  // Memoized status color
  const statusColor = useMemo(() => {
    switch(status) {
      case 'CONNECTED':
      case 'CALCULATING':
      case 'PAYMENT':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'PRINTING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'COMPLETED':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'ERROR':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-700/50 text-slate-400 border-slate-600/30';
    }
  }, [status]);

  // Optimized scanner config
  const scannerConstraints = useMemo(() => ({
    facingMode: 'environment',
    aspectRatio: 1,
    frameRate: { ideal: 30, max: 30 }
  }), []);

  const scannerComponents = useMemo(() => ({ 
    audio: false, 
    finder: false,
    tracker: false
  }), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Optimized background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border-slate-700/50 shadow-2xl relative z-10">
        <CardHeader className="border-b border-slate-700/50 pb-4 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Printer className="text-blue-400 h-5 w-5"/>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                DirectPrint
              </span>
            </CardTitle>
            <span className={`text-[10px] px-3 py-1.5 rounded-full font-bold border ${statusColor}`}>
              {status}
            </span>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          
          {/* VIEW 1: Camera Scanner */}
          {status === 'IDLE' && (
            <div className="space-y-4">
              <div className="aspect-square bg-gradient-to-br from-slate-950 to-slate-900 rounded-2xl overflow-hidden border-2 border-slate-700/50 relative shadow-inner">
                {scannerActive && (
                  <Suspense fallback={
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-400"/>
                    </div>
                  }>
                    <Scanner 
                      onScan={handleScan} 
                      onError={handleScanError} 
                      components={scannerComponents}
                      constraints={scannerConstraints}
                      scanDelay={300}
                      styles={{ 
                        container: { height: '100%' },
                        video: { objectFit: 'cover' }
                      }}
                    />
                  </Suspense>
                )}
                <div className="absolute inset-0 border-4 border-blue-400/20 m-8 rounded-2xl pointer-events-none"></div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700/50">
                  <QrCode className="h-4 w-4 text-blue-400 inline mr-2"/>
                  <span className="text-xs text-slate-300">Scan Kiosk QR</span>
                </div>
              </div>
              
              {cameraError && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-400 backdrop-blur-sm">
                  <AlertCircle className="inline mr-2 h-4 w-4"/>
                  {cameraError}
                </div>
              )}
              
              {/* Manual Input */}
              <details className="group">
                <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300 flex items-center gap-2 p-3 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <Upload className="h-4 w-4"/>
                  <span>Manual Entry</span>
                </summary>
                <div className="mt-3 space-y-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
                  <input 
                    type="text" 
                    placeholder="Kiosk ID (e.g., kiosk_001)"
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && e.target.value) {
                        const kioskId = e.target.value.trim();
                        setConfig({ kiosk_id: kioskId, ip: kioskId });
                        setStatus('SCANNED');
                        addLog(`Manual: ${kioskId}`);
                        setScannerActive(false);
                      }
                    }}
                  />
                  <p className="text-[10px] text-slate-500">Press Enter to continue</p>
                </div>
              </details>
            </div>
          )}

          {/* VIEW 2: Connection */}
          {(status === 'SCANNED' || status === 'CONNECTING' || status === 'ERROR') && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl text-sm font-mono border border-slate-700/30 space-y-3">
                <div className="flex items-center gap-3">
                  <Wifi className="h-5 w-5 text-blue-400"/>
                  <span className="text-slate-400">Kiosk Details</span>
                </div>
                <div className="pl-8 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kiosk ID</span> 
                    <span className="text-white font-medium">{config?.kiosk_id}</span>
                  </div>
                </div>
              </div>
              
              {status === 'ERROR' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  <AlertCircle className="inline mr-2 h-4 w-4"/>
                  Kiosk offline or not found
                </div>
              )}
              
              <Button 
                onClick={connectPrinter} 
                disabled={status === 'CONNECTING'} 
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg font-semibold py-6"
              >
                {status === 'CONNECTING' ? (
                  <><Loader2 className="animate-spin mr-2 h-5 w-5"/> Checking...</>
                ) : (
                  <><Zap className="mr-2 h-5 w-5"/> Connect</>
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFlow}
                className="w-full text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
              >
                ← Scan Again
              </Button>
            </div>
          )}

          {/* VIEW 3: File Upload */}
          {(status === 'CONNECTED' || status === 'CALCULATING') && (
            <div className="space-y-4">
              <label className="block w-full cursor-pointer group">
                <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                  file 
                    ? 'border-emerald-500/50 bg-emerald-500/5' 
                    : 'border-slate-600/50 hover:border-blue-500/50 hover:bg-slate-800/30'
                }`}>
                  <div className={`mx-auto h-16 w-16 mb-3 rounded-full flex items-center justify-center transition-all ${
                    file ? 'bg-emerald-500/20' : 'bg-slate-700/50 group-hover:bg-blue-500/20'
                  }`}>
                    <FileUp className={`h-8 w-8 ${file ? 'text-emerald-400' : 'text-slate-400 group-hover:text-blue-400'}`} />
                  </div>
                  <p className="text-base font-medium mb-1">{file ? file.name : "Drop PDF Here"}</p>
                  {file && <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>}
                  {!file && <p className="text-xs text-slate-500 mt-2">or click to browse</p>}
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="application/pdf" 
                  onChange={e => handleFileSelect(e.target.files[0])}
                  disabled={status === 'CALCULATING'}
                />
              </label>
              
              {status === 'CALCULATING' && (
                <div className="flex items-center justify-center gap-3 text-blue-400 bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                  <Loader2 className="animate-spin h-5 w-5"/>
                  <span className="text-sm font-medium">Creating job...</span>
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: Payment */}
          {status === 'PAYMENT' && pricing && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/30 rounded-xl p-5 shadow-lg">
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700/30">
                    <span className="text-slate-400 text-sm">Job ID</span>
                    <span className="text-white text-xs font-mono">{pricing.job_id.slice(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Pages</span>
                    <span className="text-white text-lg font-bold">{pricing.pages}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Rate</span>
                    <span className="text-white text-sm">₹{pricing.pricePerPage}/page</span>
                  </div>
                  <div className="border-t border-slate-700/30 mt-4 pt-4 flex justify-between items-center">
                    <span className="text-white font-semibold text-lg">Total</span>
                    <span className="text-emerald-400 text-3xl font-bold">₹{pricing.totalPrice}</span>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handlePayment} 
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-6 text-lg shadow-lg"
              >
                <IndianRupee className="mr-2 h-5 w-5"/>
                Pay ₹{pricing.totalPrice} & Print
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setStatus('CONNECTED'); setFile(null); setPricing(null); }} 
                className="w-full text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
              >
                ← Choose Different File
              </Button>
            </div>
          )}

          {/* VIEW 5: Printing */}
          {status === 'PRINTING' && (
            <div className="space-y-6 text-center py-8">
              <div className="relative">
                <Loader2 className="animate-spin h-16 w-16 mx-auto text-blue-400"/>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-20 w-20 bg-blue-500/20 rounded-full blur-xl"></div>
                </div>
              </div>
              <div>
                <p className="text-xl font-semibold mb-2">Printing...</p>
                <p className="text-sm text-slate-400">Checking status</p>
              </div>
            </div>
          )}

          {/* VIEW 6: Completed */}
          {status === 'COMPLETED' && (
            <div className="space-y-6 text-center py-8">
              <div className="relative">
                <CheckCircle className="h-20 w-20 mx-auto text-emerald-400"/>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-24 w-24 bg-emerald-500/20 rounded-full blur-xl"></div>
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                  Print Complete!
                </p>
                <p className="text-sm text-slate-400">Collect your document</p>
              </div>
              <Button 
                onClick={resetFlow} 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-6"
              >
                Print Another
              </Button>
            </div>
          )}
          
          {/* Logs */}
          <div className="bg-black/50 backdrop-blur-sm text-emerald-400 text-[10px] font-mono p-4 rounded-xl h-24 overflow-y-auto border border-slate-800/50 shadow-inner">
            {logs.length === 0 ? (
              <div className="text-slate-600">// System ready...</div>
            ) : (
              logs.slice(0, 10).map((l, i) => <div key={i} className="mb-1">{l}</div>)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App;