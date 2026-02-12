import { useState } from 'react';
import axios from 'axios';
import { Scanner } from '@yudiel/react-qr-scanner'; // REAL SCANNER
import { Printer, CheckCircle, Wifi, FileUp, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function App() {
  const [status, setStatus] = useState('IDLE'); // IDLE, SCANNING, CONNECTED, PRINTING, ERROR
  const [config, setConfig] = useState(null);
  const [file, setFile] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // 1. REAL Scanning Logic
  const handleScan = (detectedCodes) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const rawValue = detectedCodes[0].rawValue;
      try {
        // EXPECTED QR FORMAT: JSON -> {"ssid":"MyWifi", "ip":"192.168.1.50", "port":9100}
        // OR PLAIN TEXT: "192.168.1.50" (Simple fallback)
        let printerData = {};
        
        if (rawValue.trim().startsWith('{')) {
             printerData = JSON.parse(rawValue);
        } else {
             // Fallback: If QR just contains an IP
             printerData = { ssid: "Unknown_Network", ip: rawValue, port: 9100 };
        }

        setConfig(printerData);
        setStatus('SCANNED');
        addLog(`QR Decoded: Target IP ${printerData.ip}`);
      } catch (e) {
        addLog("Invalid QR Format. Need JSON or IP.");
      }
    }
  };

  const handleScanError = (error) => {
    // Only log critical errors to avoid console spam
    console.warn(error);
  };

  // 2. Real Network Check
  const connectPrinter = async () => {
    try {
        setStatus('CONNECTING');
        addLog(`Pinging ${config.ip}:${config.port}...`);
        
        // This talks to your Local Node Backend, which talks to the Printer
        const response = await axios.post('http://localhost:3001/api/connect', {
            ssid: config.ssid,
            ip: config.ip, 
            port: config.port || 9100
        });

        if (response.data.status === 'connected') {
            setStatus('CONNECTED');
            addLog("Bridge: Printer is Online & Reachable!");
        }
    } catch (e) {
        setStatus('ERROR');
        addLog("Handshake Failed: " + (e.response?.data?.message || "Printer Unreachable"));
    }
  };

  // 3. Real Printing (File -> Node -> Port 9100)
  const handlePrint = async () => {
    if (!file) return;
    
    // VALIDATION: RAW SOCKET PRINTING USUALLY REQUIRES PDF
    if (file.type !== 'application/pdf') {
        alert("Warning: Raw printing works best with PDFs. DOCX might print junk code.");
    }

    setStatus('PRINTING');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('printerIP', config.ip);
    fd.append('port', config.port || 9100);
    
    try {
        await axios.post('http://localhost:3001/api/print', fd);
        setStatus('COMPLETED');
        addLog(`Sent ${file.size} bytes to ${config.ip}`);
    } catch (e) {
        setStatus('CONNECTED'); // Return to ready state
        addLog("Print Error: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700 shadow-2xl">
        <CardHeader className="border-b border-slate-700 pb-4">
          <div className="flex justify-between items-center">
             <CardTitle className="flex items-center gap-2 text-white">
               <Printer className="text-blue-400"/> DirectPrint
             </CardTitle>
             <span className={`text-[10px] px-2 py-1 rounded font-bold border ${
                status === 'CONNECTED' ? 'bg-green-900/50 text-green-400 border-green-800' : 
                'bg-slate-700 text-slate-400 border-slate-600'
             }`}>
                {status}
             </span>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
            
            {/* VIEW 1: Camera */}
            {status === 'IDLE' && (
                <div className="space-y-4">
                    <div className="aspect-square bg-black rounded-lg overflow-hidden border-2 border-slate-600 relative">
                        <Scanner 
                            onScan={handleScan} 
                            onError={handleScanError} 
                            components={{ audio: false, finder: false }}
                            styles={{ container: { height: '100%' } }}
                        />
                        <div className="absolute inset-0 border-4 border-blue-500/30 m-8 rounded-lg animate-pulse pointer-events-none"></div>
                    </div>
                    <p className="text-center text-xs text-slate-400">Point at Printer Connection QR Code</p>
                </div>
            )}

            {/* VIEW 2: Connection Confirm */}
            {status === 'SCANNED' || status === 'CONNECTING' || status === 'ERROR' ? (
                <div className="space-y-4">
                    <div className="bg-slate-900 p-4 rounded text-xs font-mono border border-slate-700 space-y-2">
                        <div className="flex justify-between text-slate-400"><span>TARGET IP</span> <span className="text-white">{config?.ip}</span></div>
                        <div className="flex justify-between text-slate-400"><span>PORT</span> <span className="text-white">{config?.port}</span></div>
                    </div>
                    {status === 'ERROR' && <p className="text-red-400 text-sm text-center">Connection Timed Out</p>}
                    <Button onClick={connectPrinter} disabled={status === 'CONNECTING'} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                        {status === 'CONNECTING' ? <Loader2 className="animate-spin mr-2"/> : "Connect"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setStatus('IDLE')} className="w-full text-slate-400">Scan Again</Button>
                </div>
            ) : null}

            {/* VIEW 3: Printing */}
            {(status === 'CONNECTED' || status === 'PRINTING' || status === 'COMPLETED') && (
                <div className="space-y-4">
                     <label className="block w-full cursor-pointer">
                        <div className={`border-2 border-dashed rounded-xl p-8 text-center transition ${file ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-slate-500'}`}>
                            <FileUp className={`mx-auto h-8 w-8 mb-2 ${file ? 'text-green-500' : 'text-slate-400'}`} />
                            <p className="text-sm font-medium">{file ? file.name : "Select PDF"}</p>
                        </div>
                        <input type="file" className="hidden" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
                     </label>

                     <Button disabled={!file || status === 'PRINTING'} onClick={handlePrint} className={`w-full ${status === 'COMPLETED' ? "bg-green-600 hover:bg-green-500" : "bg-blue-600"}`}>
                        {status === 'PRINTING' ? "Sending..." : status === 'COMPLETED' ? "Print Again" : "Send Job"}
                     </Button>
                </div>
            )}
            
            {/* Logs */}
            <div className="bg-black text-green-500 text-[10px] font-mono p-3 rounded h-32 overflow-y-auto border border-slate-800">
                {logs.length === 0 ? "// Waiting for input..." : logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App;