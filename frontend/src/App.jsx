import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Printer, CheckCircle, Wifi, FileUp, Loader2, AlertCircle, IndianRupee, Zap, QrCode, LogOut, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Authentication imports
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './components/Login';

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

function MainApp() {
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

// Auto-connect if kiosk_id is in the URL (e.g., ?kiosk_id=kiosk_001&location=library)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kioskIdFromUrl = params.get('kiosk_id');
    const location = params.get('location');
    const floor = params.get('floor');
    
    if (kioskIdFromUrl) {
      // Save location and floor into the config state!
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
      
      if (rawValue.trim().startsWith('{')) {
        printerData = JSON.parse(rawValue);
        if (!printerData.kiosk_id) {
          printerData.kiosk_id = printerData.ip || 'default_kiosk';
        }
      } else {
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

  const connectPrinter = useCallback(async () => {
    try {
      setStatus('CONNECTING');
      addLog(`Checking kiosk ${config.kiosk_id}...`);
      
      // Note: /api/connect doesn't require auth, but we can include it
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
      
      // If the backend sent a note about conversion, log it
      if (response.data.note) {
        addLog(response.data.note);
      }
      
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
      addLog("Job creation failed: " + (e.response?.data?.error || e.message));
      console.error(e);
      
      if (e.response?.status === 401) {
        alert("Session expired. Please log in again.");
        signOut();
      } else {
        alert("Could not create job. " + (e.response?.data?.error || "Please try again."));
      }
    }
  }, [API_URL, addLog, config, getAuthHeader, signOut]);

  const handlePayment = useCallback(async () => {
    addLog(`Verifying payment for ₹${pricing.totalPrice}...`);
    
    try {
      const authHeader = await getAuthHeader();
      const response = await axios.post(
        `${API_URL}/api/jobs/${pricing.job_id}/verify-payment`,
        {
          payment_id: 'MOCK_PAYMENT_' + Date.now(),
          payment_signature: 'MOCK_SIGNATURE'
        },
        { 
          timeout: 10000,
          headers: { 'Authorization': authHeader }
        }
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
      addLog("Payment failed: " + (e.response?.data?.error || e.message));
      console.error(e);
      
      if (e.response?.status === 401) {
        alert("Session expired. Please log in again.");
        signOut();
      } else if (e.response?.status === 403) {
        alert("Forbidden: You can only pay for your own jobs.");
      } else {
        alert("Payment processing failed. Please try again.");
      }
    }
  }, [pricing, API_URL, addLog, getAuthHeader, signOut]);

  const resetFlow = useCallback(() => {
    setStatus('IDLE');
    setConfig(null);
    setFile(null);
    setPricing(null);
    setScannerActive(true);
    setCameraError(null);
  }, []);

  // Add this NEW function right after resetFlow (around line 249)
  const printAnotherOnSameKiosk = useCallback(() => {
    // Keep the config (kiosk connection), just reset the job
    setStatus('CONNECTED');
    setFile(null);
    setPricing(null);
    addLog('Ready for next document');
  }, [addLog]);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await signOut();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* User Header */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
              <Printer className="h-5 w-5 text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">DirectPrint</h1>
              <p className="text-xs text-slate-400">Fast & Easy Printing</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Profile" 
                className="w-9 h-9 rounded-full border-2 border-blue-500"
                title={user.displayName || user.email}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
                <User className="h-5 w-5 text-white"/>
              </div>
            )}
            
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white">{user?.displayName || 'User'}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              title="Logout"
            >
              <LogOut className="h-4 w-4"/>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md bg-slate-900/70 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardHeader className="text-center border-b border-slate-800/50">
            <div className="mx-auto bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl mb-4 w-fit shadow-lg">
              <Printer className="h-10 w-10 text-white"/>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              DirectPrint
            </CardTitle>
            <p className="text-slate-400 text-sm mt-2">
              {status === 'IDLE' && "Scan QR code to start"}
              {status === 'SCANNED' && "Kiosk detected"}
              {status === 'CONNECTING' && "Connecting to printer..."}
              {status === 'CONNECTED' && "Upload your document"}
              {status === 'CALCULATING' && "Processing file..."}
              {status === 'PAYMENT' && "Review and pay"}
              {status === 'PRINTING' && "Printing in progress"}
              {status === 'COMPLETED' && "All done!"}
              {status === 'ERROR' && "Connection failed"}
            </p>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            {/* VIEW 1: QR Scanner */}
            {status === 'IDLE' && (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700/50 shadow-inner">
                  <Suspense fallback={
                    <div className="aspect-square bg-slate-800/50 flex items-center justify-center">
                      <Loader2 className="animate-spin h-12 w-12 text-blue-400"/>
                    </div>
                  }>
                    {scannerActive && !cameraError ? (
                      <Scanner
                        onScan={handleScan}
                        onError={handleScanError}
                        constraints={{ facingMode: 'environment' }}
                        formats={['qr_code']}
                        classNames={{
                          container: 'aspect-square',
                          video: 'w-full h-full object-cover'
                        }}
                      />
                    ) : (
                      <div className="aspect-square bg-slate-800/50 flex flex-col items-center justify-center p-6 text-center">
                        <QrCode className="h-16 w-16 text-slate-600 mb-4"/>
                        <p className="text-slate-400 text-sm mb-4">{cameraError || 'Camera not active'}</p>
                        <Button 
                          size="sm" 
                          onClick={() => { setScannerActive(true); setCameraError(null); }}
                          className="bg-blue-600 hover:bg-blue-500"
                        >
                          Enable Camera
                        </Button>
                      </div>
                    )}
                  </Suspense>
                </div>
    
                {cameraError && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
                    <AlertCircle className="inline mr-2 h-4 w-4"/>
                    {cameraError}
                  </div>
                )}
    
                <div className="text-center text-slate-500 text-sm">
                  <p>Point camera at printer's QR code</p>
                </div>

                {/* ===== MANUAL ENTRY SECTION ===== */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500">Or enter manually</span>
                  </div>
                </div>
    
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Kiosk ID (e.g., kiosk_001)"
                    className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                    className="bg-blue-600 hover:bg-blue-500 px-6"
                  >
                    Connect
                  </Button>
                </div>
                {/* ===== END MANUAL ENTRY SECTION ===== */}
    
              </div>
            )}

            {/* VIEW 2: Kiosk Info & Connect */}
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
                  
                    <p className="text-base font-medium mb-1">
                      {file ? `${getFileIcon(file.name)} ${file.name}` : "Drop file here"}
                    </p>
                  
                    {file && (
                      <>
                        <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                        {getFileExt(file.name) !== '.pdf' && (
                          <p className="text-xs text-yellow-400 mt-2">
                            ⚡ Will be converted to PDF
                          </p>
                        )}
                      </>
                    )}
                  
                    {!file && (
                      <>
                        <p className="text-xs text-slate-500 mt-2">or click to browse</p>
                        <p className="text-xs text-slate-600 mt-1">
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
                  <div className="flex items-center justify-center gap-3 text-blue-400 bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                    <Loader2 className="animate-spin h-5 w-5"/>
                    <span className="text-sm font-medium">Processing file...</span>
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
    
                {/* NEW: Two options instead of one */}
                <div className="space-y-3">
                  <Button 
                    onClick={printAnotherOnSameKiosk} 
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-6"
                  >
                    <Printer className="mr-2 h-5 w-5"/>
                    Print Another Document
                  </Button>
      
                  <Button 
                    onClick={resetFlow} 
                    variant="ghost"
                    className="w-full text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
                  >
                    ← Exit to Scanner
                  </Button>
                </div>
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
    </div>
  );
}

// Root App component with routing
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <MainApp />
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