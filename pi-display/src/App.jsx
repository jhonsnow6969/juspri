// pi-display/src/App.jsx - Kiosk Display Screen
import { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { Printer, CheckCircle, Loader2, Wifi, WifiOff, AlertTriangle, FileText, IndianRupee } from 'lucide-react';

function App() {
  const [qrCode, setQrCode] = useState('');
  const [kioskStatus, setKioskStatus] = useState('offline');
  const [currentJob, setCurrentJob] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [stats, setStats] = useState({ today: 0, revenue: 0 });
  
  const KIOSK_ID = import.meta.env.VITE_KIOSK_ID || 'kiosk_main';
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const KIOSK_NAME = import.meta.env.VITE_KIOSK_NAME || 'Main Printer';

  // Generate QR code on mount
  useEffect(() => {
    const qrData = JSON.stringify({
      kiosk_id: KIOSK_ID,
      name: KIOSK_NAME
    });
    
    QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    }).then(setQrCode);
  }, []);

  // Poll for kiosk status and jobs
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [kiosksRes, jobsRes] = await Promise.all([
          axios.get(`${API_URL}/api/admin/kiosks`),
          axios.get(`${API_URL}/api/admin/jobs?kiosk_id=${KIOSK_ID}`)
        ]);

        // Check if this kiosk is online
        const thisKiosk = kiosksRes.data.kiosks?.find(k => k.id === KIOSK_ID);
        setKioskStatus(thisKiosk?.status || 'offline');

        // Get jobs for this kiosk
        const jobs = jobsRes.data.jobs || [];
        const printing = jobs.find(j => j.status === 'PRINTING');
        setCurrentJob(printing);
        setRecentJobs(jobs.slice(0, 5));

        // Calculate today's stats
        const today = new Date().toDateString();
        const todayJobs = jobs.filter(j => 
          new Date(j.created_at).toDateString() === today &&
          j.status === 'COMPLETED'
        );
        setStats({
          today: todayJobs.length,
          revenue: todayJobs.reduce((sum, j) => sum + j.total_cost, 0)
        });

      } catch (error) {
        console.error('Status check error:', error);
        setKioskStatus('offline');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 text-white">
      
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30">
              <Printer className="h-10 w-10 text-white"/>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {KIOSK_NAME}
              </h1>
              <p className="text-slate-400 text-sm font-mono mt-1">ID: {KIOSK_ID}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/60 px-6 py-3 rounded-xl border border-slate-700">
            {kioskStatus === 'online' ? (
              <>
                <div className="relative">
                  <Wifi className="h-7 w-7 text-green-400"/>
                  <div className="absolute inset-0 bg-green-400/20 blur-lg rounded-full"></div>
                </div>
                <div>
                  <span className="text-green-400 font-bold text-lg">Online</span>
                  <p className="text-xs text-slate-500">Ready to print</p>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="h-7 w-7 text-red-400"/>
                <div>
                  <span className="text-red-400 font-bold text-lg">Offline</span>
                  <p className="text-xs text-slate-500">Connecting...</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
          {/* Left: QR Code - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-3xl p-10 shadow-2xl shadow-blue-900/20 border-4 border-white">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                  Scan to Print
                </h2>
                <p className="text-slate-600 text-sm">
                  Point your camera at the QR code
                </p>
              </div>
              
              {qrCode && (
                <div className="flex justify-center mb-8 p-4 bg-white rounded-2xl shadow-inner">
                  <img src={qrCode} alt="QR Code" className="w-80 h-80"/>
                </div>
              )}
              
              <div className="space-y-4 bg-blue-50/50 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-600/30 flex-shrink-0">1</div>
                  <p className="text-slate-700 font-medium">Scan QR code with your phone camera</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-600/30 flex-shrink-0">2</div>
                  <p className="text-slate-700 font-medium">Upload your PDF document</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-600/30 flex-shrink-0">3</div>
                  <p className="text-slate-700 font-medium">Pay ₹3/page and collect your print</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Status - Takes 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-xl shadow-blue-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-sm font-medium mb-1">Prints Today</p>
                    <p className="text-5xl font-bold text-white">{stats.today}</p>
                  </div>
                  <Printer className="h-16 w-16 text-blue-300/50"/>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 shadow-xl shadow-green-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-200 text-sm font-medium mb-1">Revenue Today</p>
                    <p className="text-5xl font-bold text-white">₹{stats.revenue}</p>
                  </div>
                  <IndianRupee className="h-16 w-16 text-green-300/50"/>
                </div>
              </div>
            </div>
            
            {/* Current Job */}
            {currentJob ? (
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-8 shadow-2xl shadow-orange-900/30 border border-orange-400/20">
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <Loader2 className="h-10 w-10 text-white animate-spin"/>
                    <div className="absolute inset-0 bg-white/30 blur-xl rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-white">Printing Now</h3>
                    <p className="text-orange-100 text-sm">Please wait...</p>
                  </div>
                </div>
                <div className="space-y-3 bg-white/10 backdrop-blur-sm rounded-xl p-6">
                  <div className="flex justify-between items-center">
                    <span className="text-orange-100 font-medium">File:</span>
                    <span className="text-white font-bold truncate max-w-md">{currentJob.filename}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-orange-100 font-medium">Pages:</span>
                    <span className="text-white font-bold text-2xl">{currentJob.pages}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-orange-100 font-medium">Job ID:</span>
                    <span className="text-white font-mono text-sm">{currentJob.id.slice(0, 20)}...</span>
                  </div>
                </div>
                
                <div className="mt-6 h-3 bg-orange-900/50 rounded-full overflow-hidden">
                  <div className="h-full bg-white animate-pulse w-full"></div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/60 backdrop-blur-sm border-2 border-dashed border-slate-600 rounded-2xl p-12 text-center">
                <div className="flex justify-center mb-6">
                  <div className="p-6 bg-slate-700/50 rounded-full">
                    <Printer className="h-20 w-20 text-slate-500"/>
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-400 mb-3">Ready to Print</h3>
                <p className="text-slate-500 text-lg">Waiting for print jobs...</p>
              </div>
            )}

            {/* Recent Jobs */}
            <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
              <h3 className="text-2xl font-bold mb-6 text-slate-200 flex items-center gap-3">
                <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                Recent Activity
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {recentJobs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-slate-600"/>
                    <p className="text-slate-500 text-lg">No recent activity</p>
                  </div>
                ) : (
                  recentJobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between p-4 bg-slate-900/60 rounded-xl hover:bg-slate-900/80 transition-all border border-slate-700/50">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          job.status === 'COMPLETED' ? 'bg-green-500/20' :
                          job.status === 'FAILED' ? 'bg-red-500/20' :
                          'bg-blue-500/20'
                        }`}>
                          {job.status === 'COMPLETED' ? (
                            <CheckCircle className="h-6 w-6 text-green-400"/>
                          ) : job.status === 'FAILED' ? (
                            <AlertTriangle className="h-6 w-6 text-red-400"/>
                          ) : (
                            <Loader2 className="h-6 w-6 text-blue-400 animate-spin"/>
                          )}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-white truncate max-w-sm">{job.filename}</p>
                          <p className="text-sm text-slate-500">{new Date(job.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{job.pages} pages</p>
                        <p className="text-sm text-green-400 font-medium">₹{job.total_cost}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-900/60 backdrop-blur-sm border-t border-slate-700 mt-8 py-6">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">
              Powered by <span className="font-semibold text-blue-400">DirectPrint</span>
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <span>Rate: <span className="text-white font-semibold">₹3/page</span></span>
              <span className="text-slate-600">•</span>
              <span>Format: <span className="text-white font-semibold">PDF only</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;