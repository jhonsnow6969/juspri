import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthProvider';
import {
    API_URL,
    ALLOWED_FILE_TYPES,
    ALLOWED_EXTENSIONS,
    getFileExt
  } from './printUtils';
  
  
export function usePrint() {
    const { signOut, getAuthHeader } = useAuth();

  // ==========================================
  // 1. State
  // ==========================================
  const [status, setStatus] = useState('IDLE');
  const [config, setConfig] = useState(null);
  const [file, setFile] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [logs, setLogs] = useState([]);
  const [cameraError, setCameraError] = useState(null);
  const [scannerActive, setScannerActive] = useState(true);

  const addLog = useCallback((msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  // ==========================================
  // 2. Effects
  // ==========================================
  
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

  // Status polling for print jobs
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

  // ==========================================
  // 3. Handlers
  // ==========================================
  const handleScan = useCallback((detectedCodes) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    
    setScannerActive(false);
    const rawValue = detectedCodes[0].rawValue;
    
    try {
      let printerData = {};
      
      // Check if it's a URL (for QR codes from pi-agent/qr-server)
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
      // Check if it's JSON format
      else if (rawValue.trim().startsWith('{')) {
        printerData = JSON.parse(rawValue);
        if (!printerData.kiosk_id) {
          printerData.kiosk_id = printerData.ip || 'default_kiosk';
        }
        addLog(`QR Decoded: Kiosk ${printerData.kiosk_id}`);
      }
      // Treat as plain kiosk_id (manual entry or simple QR)
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
    
    const fileExt = getFileExt(selectedFile.name);
    
    if (!ALLOWED_FILE_TYPES.includes(selectedFile.type) && !ALLOWED_EXTENSIONS.includes(fileExt)) {
      alert(`⚠️ File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }
    
    if (fileExt !== 'pdf') {
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

  const printAnotherOnSameKiosk = useCallback(() => {
    setStatus('CONNECTED');
    setFile(null);
    setPricing(null);
    addLog('Ready for next document');
  }, [addLog]);

  // ==========================================
  // 4. Return
  // ==========================================
  return {
    // State
    status, config, file, pricing, logs, cameraError, scannerActive,
    
    // Handlers
    handleScan, handleScanError, connectPrinter, handleFileSelect, handlePayment, 
    resetFlow, printAnotherOnSameKiosk,
    
    // Setters (for views that need them)
    setStatus, setFile, setPricing, setScannerActive, setCameraError
  };
}