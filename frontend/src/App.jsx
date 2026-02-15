import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import { Printer, CheckCircle, Wifi, FileUp, Loader2, AlertCircle, IndianRupee, Zap, QrCode, LogOut, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Authentication imports
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './components/Login';

// Dashboard imports
import { DashboardLayout } from './components/Dashboard/DashboardLayout';
import { History } from './components/Dashboard/History';

// Lazy load the QR scanner
const Scanner = lazy(() => 
  import('@yudiel/react-qr-scanner').then(module => ({ 
    default: module.Scanner 
  }))
);

// Helper to get file extension
function getFileExt(filename) {
  return '.' + filename.split('.').pop().toLowerCase();
}

// Helper to get the right emoji icon
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  const icons = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    txt: '📃',
    md: '📃',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    rtf: '📝',
    odt: '📝'
  };
  
  return icons[ext] || '📎';
}

function PrintInterface() {
  const { user, signOut, getAuthHeader } = useAuth();
  
  const [status, setStatus] = useState('IDLE');
  const [config, setConfig] = useState(null);
  const [file, setFile] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [logs, setLogs] = useState([]);
  const [cameraError, setCameraError] = useState(null);
  const [scannerActive, setScannerActive] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const addLog = useCallback((msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  // Auto-connect if kiosk_id is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kioskIdFromUrl = params.get('kiosk_id');
    const location = params.get('location');
    const floor = params.get('floor');
    
    if (kioskIdFromUrl) {
      setConfig({ 
        kiosk_id: kioskIdFromUrl,
        location: location,
        floor: floor
      });
      setStatus('SCANNED');
      setScannerActive(false);
      
      addLog(`Auto-scanned: ${kioskIdFromUrl}`);
      if (location) addLog(`Location: ${location}, Floor: ${floor || 'N/A'}`);
    }
  }, [addLog]);

  // Status polling
  useEffect(() => {
    if (!pricing?.job_id || status !== 'PRINTING') return;

    const pollInterval = setInterval(async () => {
      try {
        const authHeader = await getAuthHeader();
        const response = await axios.get(`${API_URL}/api/jobs/${pricing.job_id}/status`, {
          headers: { 'Authorization': authHeader }
        });
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
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [pricing?.job_id, status, API_URL, addLog, getAuthHeader]);

  const handleScan = useCallback((detectedCodes) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    
    setScannerActive(false);
    const rawValue = detectedCodes[0].rawValue;
    
    try {
      let printerData = {};
      
      // STEP 1: Check if it's a URL (for QR codes from pi-agent/qr-server)
      if (rawValue.includes('http://') || rawValue.includes('https://')) {
        try {
          const url = new URL(rawValue);
          const kioskId = url.searchParams.get('kiosk_id');
          const location = url.searchParams.get('location');
          const floor = url.searchParams.get('floor');
          
          if (!kioskId) {
            addLog("QR URL missing kiosk_id parameter");
            setScannerActive(true);
            return;
          }
          
          printerData = {
            kiosk_id: kioskId,
            location: location || undefined,
            floor: floor || undefined
          };
          
          addLog(`QR Decoded: Kiosk ${kioskId}`);
          if (location) {
            addLog(`Location: ${location}${floor ? `, Floor ${floor}` : ''}`);
          }
        } catch (urlError) {
          addLog("Invalid URL format");
          setScannerActive(true);
          return;
        }
      }
      // STEP 2: Check if it's JSON format
      else if (rawValue.trim().startsWith('{')) {
        printerData = JSON.parse(rawValue);
        if (!printerData.kiosk_id) {
          printerData.kiosk_id = printerData.ip || 'default_kiosk';
        }
        addLog(`QR Decoded: Kiosk ${printerData.kiosk_id}`);
      }
      // STEP 3: Treat as plain kiosk_id (manual entry or simple QR)
      else {
        printerData = { 
          kiosk_id: rawValue.trim(),
          ip: rawValue.trim(), 
          port: 9100 
        };
        addLog(`QR Decoded: Kiosk ${rawValue.trim()}`);
      }
  
      setConfig(printerData);
      setStatus('SCANNED');
    } catch (e) {
      console.error('QR decode error:', e);
      addLog("Invalid QR Format");
      setScannerActive(true);
    }
  }, [addLog]);
  
  const handleScanError = useCallback((error) => {
    console.warn('Camera error:', error);
    setCameraError('Camera access denied. Allow permissions or use manual entry below.');
  }, []);

  const connectPrinter = useCallback(async () => {
    try {
      setStatus('CONNECTING');
      addLog(`Checking kiosk ${config.kiosk_id}...`);
      
      const response = await axios.post(`${API_URL}/api/connect`, {
        kiosk_id: config.kiosk_id
      }, { 
        timeout: 5000
      });

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

  const handleFileSelect = useCallback(async (selectedFile) => {
    if (!selectedFile) return;
    
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg'
    ];
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.rtf', '.odt', '.md'];
    const fileExt = '.' + selectedFile.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(selectedFile.type) && !allowedExtensions.includes(fileExt)) {
      alert(`⚠️ File type not supported. Allowed: ${allowedExtensions.join(', ')}`);
      return;
    }
    
    if (fileExt !== '.pdf') {
      addLog(`File will be converted to PDF before printing`);
    }
    
    setFile(selectedFile);
    setStatus('CALCULATING');
    addLog(`Creating job for ${selectedFile.name}...`);

    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('kiosk_id', config.kiosk_id);

    try {
      const authHeader = await getAuthHeader();
      
      const response = await axios.post(`${API_URL}/api/jobs/create`, fd, {
        timeout: 15000,
        headers: {
          'Authorization': authHeader
        }
      });

      const { job_id, pages, price_per_page, total_cost } = response.data;
      setPricing({ 
        job_id, 
        pages, 
        pricePerPage: price_per_page,
        totalPrice: total_cost 
      });
      setStatus('PAYMENT');
      addLog(`Job created: ${pages} pages × ₹${price_per_page} = ₹${total_cost}`);
    } catch (e) {
      if (e.response?.status === 401) {
        addLog('Session expired. Please log in again.');
        await signOut();
        return;
      }
      
      setStatus('ERROR');
      addLog(`Error: ${e.response?.data?.error || e.message}`);
    }
  }, [config, API_URL, addLog, getAuthHeader, signOut]);

  const handlePayment = useCallback(async () => {
    setStatus('PRINTING');
    addLog('Processing payment...');

    try {
      const authHeader = await getAuthHeader();
      
      await axios.post(
        `${API_URL}/api/jobs/${pricing.job_id}/verify-payment`,
        { payment_id: 'mock_payment_' + Date.now() },
        { headers: { 'Authorization': authHeader } }
      );

      addLog('Payment verified! Job sent to printer.');
    } catch (e) {
      if (e.response?.status === 401) {
        addLog('Session expired. Please log in again.');
        await signOut();
        return;
      }
      
      setStatus('ERROR');
      addLog(`Payment failed: ${e.response?.data?.error || e.message}`);
    }
  }, [pricing, API_URL, addLog, getAuthHeader, signOut]);

  const resetFlow = useCallback(() => {
    setStatus('IDLE');
    setConfig(null);
    setFile(null);
    setPricing(null);
    setScannerActive(true);
    addLog('Reset to scanner');
  }, [addLog]);

  // NEW: Print another on same kiosk
  const printAnotherOnSameKiosk = useCallback(() => {
    setStatus('CONNECTED');
    setFile(null);
    setPricing(null);
    addLog('Ready for next document');
  }, [addLog]);

return (
  <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-card/90 backdrop-blur-xl border border-border shadow-2xl rounded-3xl">
        <CardHeader className="space-y-1 pb-4 border-b border-border">
          <CardTitle className="flex items-center gap-3 text-2xl">
            
            <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center shadow-lg">
              <Printer className="h-6 w-6" />
            </div>
            
            <span className="text-foreground">
              JusPri
            </span>
            
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {/* VIEW 1: QR Scanner */}
          {status === 'IDLE' && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-border shadow-inner">
              <Suspense fallback={
                <div className="aspect-square bg-muted/20 flex items-center justify-center">
                  <Loader2 className="animate-spin h-8 w-8 text-white"/>
                </div>
              }>
                {scannerActive && !cameraError ? (
                  <Scanner
                    onScan={handleScan}
                    onError={handleScanError}
                    styles={{
                      container: { aspectRatio: '1/1' },
                      video: { objectFit: 'cover' }
                    }}
                  />
                ) : (
                  <div className="aspect-square bg-muted/10 flex flex-col items-center justify-center p-6 text-center">
                    <QrCode className="h-16 w-16 text-muted-foreground mb-4"/>
                    <p className="text-muted-foreground text-sm mb-4">{cameraError || 'Camera not active'}</p>
                    <Button 
                      size="sm" 
                      onClick={() => { setScannerActive(true); setCameraError(null); }}
                      className="bg-white text-black hover:bg-neutral-200 transition-colors"
                    >
                      Enable Camera
                    </Button>
                  </div>
                )}
              </Suspense>
              </div>
              
              {cameraError && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-500">
                  <AlertCircle className="inline mr-2 h-4 w-4"/>
                  {cameraError}
                </div>
              )}
              
              <div className="text-center text-muted-foreground text-sm">
                <p>Point camera at printer's QR code</p>
              </div>

              {/* Manual Entry */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or enter manually</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Kiosk ID (e.g., kiosk_001)"
                  className="w-full px-4 py-3 bg-muted/10 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 text-sm transition-all"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      handleScan([{ rawValue: e.target.value.trim() }]);
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  onClick={(e) => {
                    const input = e.target.parentElement.querySelector('input');
                    if (input.value.trim()) {
                      handleScan([{ rawValue: input.value.trim() }]);
                      input.value = '';
                    }
                  }}
                  className="w-full bg-white text-black hover:bg-neutral-200 py-3 transition-colors"
                >
                  Connect
                </Button>
              </div>
            </div>
          )}

          {/* VIEW 2: Connect to Printer */}
          {(status === 'SCANNED' || status === 'CONNECTING' || status === 'ERROR') && (
            <div className="space-y-4">
              {/* Removed blue gradient here */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <QrCode className="h-5 w-5 text-white"/>
                  <span className="text-sm font-medium text-muted-foreground">Kiosk Detected</span>
                </div>
                <p className="text-lg font-bold text-foreground font-mono">{config?.kiosk_id}</p>
                {config?.location && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📍 {config.location} {config.floor && `• Floor ${config.floor}`}
                  </p>
                )}
              </div>

              {status === 'ERROR' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-500">
                  <AlertCircle className="inline mr-2 h-4 w-4"/>
                  Kiosk offline or not found
                </div>
              )}
              
              {/* Removed blue gradient button here */}
              <Button 
                onClick={connectPrinter} 
                disabled={status === 'CONNECTING'} 
                className="w-full bg-white text-black hover:bg-neutral-200 shadow-lg font-semibold py-6 transition-colors"
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
                className="w-full text-muted-foreground hover:text-foreground hover:bg-white/5"
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
                  ? 'border-white/40 bg-white/5' 
                  : 'border-border hover:border-white/30 hover:bg-white/5'
                }`}>
                  <div className={`mx-auto h-16 w-16 mb-3 rounded-full flex items-center justify-center transition-all ${
                    file ? 'bg-white/10' : 'bg-muted/20 group-hover:bg-white/10'
                  }`}>
                    <FileUp className={`h-8 w-8 ${file ? 'text-white' : 'text-muted-foreground group-hover:text-white'}`} />
                  </div>
                
                  <p className="text-base font-medium mb-1 text-foreground">
                    {file ? `${getFileIcon(file.name)} ${file.name}` : "Drop file here"}
                  </p>
                
                  {file && (
                    <>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                      {getFileExt(file.name) !== '.pdf' && (
                        <p className="text-xs text-yellow-500 mt-2">
                          ⚡ Will be converted to PDF
                        </p>
                      )}
                    </>
                  )}
                
                  {!file && (
                    <>
                      <p className="text-xs text-muted-foreground mt-2">or click to browse</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Supports: PDF, Word, Text, Images
                      </p>
                    </>
                  )}
                </div>
              
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.rtf,.odt,.md"
                  onChange={e => handleFileSelect(e.target.files[0])}
                  disabled={status === 'CALCULATING'}
                />
              </label>
            
              {status === 'CALCULATING' && (
                <div className="flex items-center justify-center gap-3 text-foreground bg-white/5 rounded-lg p-4 border border-white/10">
                  <Loader2 className="animate-spin h-5 w-5"/>
                  <span className="text-sm font-medium">Processing file...</span>
                </div>
              )}
           </div>
          )}

          {/* VIEW 4: Payment */}
          {status === 'PAYMENT' && pricing && (
            <div className="space-y-4">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 shadow-lg">
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-border">
                    <span className="text-muted-foreground text-sm">Job ID</span>
                    <span className="text-foreground text-xs font-mono">{pricing.job_id.slice(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Pages</span>
                    <span className="text-foreground text-lg font-bold">{pricing.pages}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Rate</span>
                    <span className="text-foreground text-sm">₹{pricing.pricePerPage}/page</span>
                  </div>
                  <div className="border-t border-border mt-4 pt-4 flex justify-between items-center">
                    <span className="text-foreground font-semibold text-lg">Total</span>
                    {/* Changed from green to white */}
                    <span className="text-foreground text-3xl font-bold">₹{pricing.totalPrice}</span>
                  </div>
                </div>
              </div>
              
              {/* Removed green gradient button here */}
              <Button 
                onClick={handlePayment} 
                className="w-full bg-white text-black hover:bg-neutral-200 font-bold py-6 text-lg shadow-lg transition-colors"
              >
                <IndianRupee className="mr-2 h-5 w-5"/>
                Pay ₹{pricing.totalPrice} & Print
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setStatus('CONNECTED'); setFile(null); setPricing(null); }} 
                className="w-full text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                ← Choose Different File
              </Button>
            </div>
          )}

          {/* VIEW 5: Printing */}
          {status === 'PRINTING' && (
            <div className="space-y-6 text-center py-8">
              <div className="relative">
                {/* Changed spinner and glow from blue to white */}
                <Loader2 className="animate-spin h-16 w-16 mx-auto text-white"/>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-20 w-20 bg-white/10 rounded-full blur-xl"></div>
                </div>
              </div>
              <div>
                <p className="text-xl font-semibold mb-2 text-foreground">Printing...</p>
                <p className="text-sm text-muted-foreground">Checking status</p>
              </div>
            </div>
          )}

          {/* VIEW 6: Completed */}
          {status === 'COMPLETED' && (
            <div className="space-y-6 text-center py-8">
              <div className="relative">
                {/* Changed check mark to standard white */}
                <CheckCircle className="h-20 w-20 mx-auto text-foreground"/>
              </div>
              <div>
                {/* Removed text gradient, made it solid text-foreground */}
                <p className="text-2xl font-bold mb-2 text-foreground">
                  Print Complete!
                </p>
                <p className="text-sm text-muted-foreground">Collect your document</p>
              </div>
              
              <div className="space-y-3">
                {/* Removed blue/purple gradient button here */}
                <Button 
                  onClick={printAnotherOnSameKiosk} 
                  className="w-full bg-white text-black hover:bg-neutral-200 font-semibold py-6 transition-colors"
                >
                  <Printer className="mr-2 h-5 w-5"/>
                  Print Another Document
                </Button>
                
                <Button 
                  onClick={resetFlow} 
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground hover:bg-white/5"
                >
                  ← Exit to Scanner
                </Button>
              </div>
            </div>
          )}
          
          {/* Logs */}
          <div className="bg-black/40 backdrop-blur-sm text-muted-foreground text-[10px] font-mono p-4 rounded-xl h-24 overflow-y-auto border border-border shadow-inner">
            {logs.length === 0 ? (
              <div>// System ready...</div>
            ) : (
              logs.slice(0, 10).map((l, i) => <div key={i} className="mb-1">{l}</div>)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);
}

// Simple animated wrapper for page transitions
function AnimatedPage({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
// Root App component with routing - NO ANIMATION WRAPPER
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected routes with dashboard layout */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <DashboardLayout activeTab="print">
                  <PrintInterface />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/history" 
            element={
              <ProtectedRoute>
                <DashboardLayout activeTab="history">
                  <History />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;