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
    const [printerStatusResult, setPrinterStatusResult] = useState(null);

    const addLog = useCallback((msg) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
    }, []);

    // ==========================================
    // 2. Core Helper Functions 
    // (Moved UP so they exist before they are called)
    // ==========================================
    console.log("API:", import.meta.env.VITE_API_URL);

    // Helper: Connect to printer (used by status check and manual connect)
    const connectPrinterAfterStatusCheck = useCallback(async (kioskId) => {
        try {
            setStatus('CONNECTING');
            addLog(`Connecting to kiosk ${kioskId}...`);

            const response = await axios.post(`${API_URL}/api/connect`, {
                kiosk_id: kioskId
            }, { timeout: 5000 });

            if (response.data.status === 'connected') {
                setStatus('CONNECTED');
                addLog(`✓ Connected to "${response.data.kiosk_name || kioskId}"`);
                addLog(`Printer: ${response.data.printer || 'Unknown'}`);
            }
        } catch (e) {
            setStatus('ERROR');
            addLog('✗ Kiosk offline or not found');
        }
    }, [API_URL, addLog]);

    // Helper: Check Kiosk Status
    // MOVED UP: Must be defined before handleScan and useEffect
    const checkKioskStatus = useCallback(async (kioskId) => {
        try {
            setStatus('CHECKING_STATUS');
            addLog(`Checking kiosk status...`);

            const response = await axios.get(
                `${API_URL}/api/kiosk/status`,
                {
                    params: { kiosk_id: kioskId },
                    timeout: 8000
                }
            );

            const result = response.data;
            setPrinterStatusResult(result);

            const printerStatus = result.printer_status;

            addLog(`Kiosk: ${result.kiosk_online ? 'Online' : 'Offline'}`);
            addLog(`Printer: ${printerStatus}`);

            if (!result.kiosk_online) {
                // Kiosk is completely offline → hard block
                setStatus('SCANNED'); // Stay on connect screen with error
                addLog('✗ Kiosk is offline');
                return;
            }

            if (printerStatus === 'healthy') {
                // All good → go straight to connect → connected
                addLog('✓ Printer ready');
                await connectPrinterAfterStatusCheck(kioskId);
                return;
            }

            if (printerStatus === 'error') {
                // Known printer error → hard block
                setStatus('PRINTER_ERROR');
                addLog(`✗ Printer error: ${result.printer_status_detail || 'unknown'}`);
                return;
            }

            // status === 'unknown' → soft warning, let user decide
            setStatus('PRINTER_WARNING');
            addLog('⚠ Printer status unverified');

        } catch (err) {
            // Network error reaching backend → treat as unknown, soft warning
            console.error('[Status Check] Error:', err.message);
            addLog('⚠ Could not reach status check, proceeding with warning');
            setPrinterStatusResult({ printer_status: 'unknown', kiosk_online: true });
            setStatus('PRINTER_WARNING');
        }
    }, [API_URL, addLog, connectPrinterAfterStatusCheck]);

    // ==========================================
    // 3. Effects (Now safe to define)
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

            // This call was causing the error before. Now it works.
            checkKioskStatus(kioskIdFromUrl);
        }
    }, [addLog, checkKioskStatus]);

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
    // 4. Handlers
    // ==========================================

    const handleScan = useCallback((detectedCodes) => {
        // ZXing sometimes sends undefined / empty arrays
        if (!Array.isArray(detectedCodes) || detectedCodes.length === 0) {
            return;
        }

        const code = detectedCodes[0];
        const rawValue = code?.rawValue;

        // Extra guard
        if (!rawValue || typeof rawValue !== 'string') {
            console.warn('⚠️ Invalid QR payload:', detectedCodes);
            setScannerActive(true);
            return;
        }

        // Stop scanner once we have *something*
        setScannerActive(false);

        console.log('🔍 QR Scanned:', rawValue);

        try {
            let printerData = {};

            // 1️⃣ URL QR (recommended)
            if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
                console.log('📍 Detected as URL');

                const url = new URL(rawValue);
                const kioskId = url.searchParams.get('kiosk_id');
                const location = url.searchParams.get('location');
                const floor = url.searchParams.get('floor');

                if (!kioskId) {
                    addLog('❌ QR URL missing kiosk_id');
                    setScannerActive(true);
                    return;
                }

                printerData = {
                    kiosk_id: kioskId,
                    location: location || undefined,
                    floor: floor || undefined,
                };

                addLog(`✅ QR Decoded: Kiosk ${kioskId}`);
                if (location) {
                    addLog(`📍 Location: ${location}${floor ? `, Floor ${floor}` : ''}`);
                }
            }
            // 2️⃣ JSON QR
            else if (rawValue.trim().startsWith('{')) {
                console.log('📍 Detected as JSON');
                const parsed = JSON.parse(rawValue);
                printerData = {
                    kiosk_id: parsed.kiosk_id || parsed.ip || 'default_kiosk',
                    ...parsed,
                };
                addLog(`✅ QR Decoded: Kiosk ${printerData.kiosk_id}`);
            }
            // 3️⃣ Plain text QR
            else {
                console.log('📍 Detected as plain text');
                const value = rawValue.trim();
                printerData = {
                    kiosk_id: value,
                    ip: value,
                    port: 9100,
                };
                addLog(`✅ QR Decoded: Kiosk ${value}`);
            }

            setConfig(printerData);
            setStatus('SCANNED');
            
            // This call was also causing errors. Now it works.
            checkKioskStatus(printerData.kiosk_id);

        } catch (err) {
            console.error('❌ QR decode error:', err);
            addLog('❌ Invalid QR format');
            setScannerActive(true);
        }
    }, [addLog, setConfig, setStatus, checkKioskStatus]);

    const handleScanError = useCallback((error) => {
        console.warn('📷 Camera error:', error);
        setCameraError(
            'Camera not available. Allow permissions or use manual entry.'
        );
        setScannerActive(false);
    }, []);

    // Manual connect button handler (if used in UI)
    const connectPrinter = useCallback(async () => {
        if (config?.kiosk_id) {
            await connectPrinterAfterStatusCheck(config.kiosk_id);
        }
    }, [config, connectPrinterAfterStatusCheck]);

    const proceedDespiteWarning = useCallback(async () => {
        addLog('User acknowledged warning, proceeding...');
        if (config?.kiosk_id) {
            await connectPrinterAfterStatusCheck(config.kiosk_id);
        }
    }, [config, connectPrinterAfterStatusCheck, addLog]);

    const rescanQR = useCallback(() => {
        setStatus('IDLE');
        setConfig(null);
        setPrinterStatusResult(null);
        setScannerActive(true);
        addLog('Ready to scan');
    }, [addLog]);

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
    // 5. Return
    // ==========================================
    return {
        // State
        status,
        config,
        file,
        pricing,
        logs,
        cameraError,
        scannerActive,
        printerStatusResult,

        // Handlers
        handleScan,
        handleScanError,
        connectPrinter,
        handleFileSelect,
        handlePayment,
        resetFlow,
        printAnotherOnSameKiosk,
        checkKioskStatus,
        proceedDespiteWarning,
        rescanQR,

        // Setters
        setStatus,
        setFile,
        setPricing,
        setScannerActive,
        setCameraError
    };
}