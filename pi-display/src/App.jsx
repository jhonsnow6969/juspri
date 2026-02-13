// pi-display/src/App.jsx - Kiosk Display Screen
import { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { Printer, CheckCircle, Loader2, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Printer className="h-8 w-8 text-blue-400"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold">{KIOSK_NAME}</h1>
              <p className="text-slate-400 text-sm">Kiosk ID: {KIOSK_ID}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {kioskStatus === 'online' ? (
              <>
                <Wifi className="h-6 w-6 text-green-400"/>
                <span className="text-green-400 font-semibold">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-6 w-6 text-red-400"/>
                <span className="text-red-400 font-semibold">Offline</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left: QR Code */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
              Scan to Print
            </h2>
            {qrCode && (
              <div className="flex justify-center mb-6">
                <img src={qrCode} alt="QR Code" className="rounded-xl"/>
              </div>
            )}
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-2 justify-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</div>
                <span>Scan QR code with your phone</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">2</div>
                <span>Upload your PDF document</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">3</div>
                <span>Pay and collect your print</span>
              </div>
            </div>
          </div>

          {/* Today's Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Prints Today</p>
              <p className="text-3xl font-bold text-blue-400">{stats.today}</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Revenue Today</p>
              <p className="text-3xl font-bold text-green-400">₹{stats.revenue}</p>
            </div>
          </div>
        </div>

        {/* Right: Live Status */}
        <div className="space-y-6">
          
          {/* Current Job */}
          {currentJob ? (
            <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-6 backdrop-blur">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="h-6 w-6 text-blue-400 animate-spin"/>
                <h3 className="text-xl font-bold text-blue-400">Printing Now</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">File:</span>
                  <span className="text-white font-medium">{currentJob.filename}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Pages:</span>
                  <span className="text-white font-medium">{currentJob.pages}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Job ID:</span>
                  <span className="text-white font-mono text-xs">{currentJob.id.slice(0, 16)}...</span>
                </div>
              </div>
              
              {/* Progress animation */}
              <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 backdrop-blur text-center">
              <Printer className="h-16 w-16 mx-auto mb-4 text-slate-600"/>
              <h3 className="text-xl font-semibold text-slate-400 mb-2">Ready to Print</h3>
              <p className="text-sm text-slate-500">Waiting for print jobs...</p>
            </div>
          )}

          {/* Recent Jobs */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur">
            <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentJobs.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No recent activity</p>
              ) : (
                recentJobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {job.status === 'COMPLETED' ? (
                        <CheckCircle className="h-5 w-5 text-green-400"/>
                      ) : job.status === 'FAILED' ? (
                        <AlertTriangle className="h-5 w-5 text-red-400"/>
                      ) : (
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin"/>
                      )}
                      <div>
                        <p className="text-sm font-medium text-white truncate max-w-xs">{job.filename}</p>
                        <p className="text-xs text-slate-500">{new Date(job.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{job.pages} pg</p>
                      <p className="text-xs text-slate-400">₹{job.total_cost}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto mt-8 text-center">
        <p className="text-slate-500 text-sm">
          Powered by DirectPrint • Rate: ₹3 per page
        </p>
      </div>
    </div>
  );
}

export default App;