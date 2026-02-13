// admin-dashboard/src/App.jsx - Admin Dashboard
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Printer, CheckCircle, XCircle, Clock, TrendingUp, Users, FileText, AlertCircle, RefreshCw } from 'lucide-react';

function App() {
  const [kiosks, setKiosks] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, printing: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchData = async () => {
    try {
      const [kiosksRes, jobsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/kiosks`),
        axios.get(`${API_URL}/api/admin/jobs${filter !== 'all' ? `?status=${filter}` : ''}`)
      ]);

      setKiosks(kiosksRes.data.kiosks || []);
      setJobs(jobsRes.data.jobs || []);
      
      // Calculate stats
      const allJobs = jobsRes.data.jobs || [];
      setStats({
        total: allJobs.length,
        completed: allJobs.filter(j => j.status === 'COMPLETED').length,
        failed: allJobs.filter(j => j.status === 'FAILED').length,
        printing: allJobs.filter(j => j.status === 'PRINTING').length,
        revenue: allJobs.filter(j => j.status === 'COMPLETED').reduce((sum, j) => sum + j.total_cost, 0)
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'printing': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'failed': return 'bg-red-100 text-red-800 border-red-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'paid': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getKioskStatusColor = (status) => {
    return status === 'online' ? 'bg-green-500' : 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Printer className="h-8 w-8 text-blue-600"/>
              <h1 className="text-2xl font-bold text-gray-900">DirectPrint Admin</h1>
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <RefreshCw className="h-4 w-4"/>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="h-12 w-12 text-blue-500"/>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-12 w-12 text-green-500"/>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Printing</p>
                <p className="text-3xl font-bold text-blue-600">{stats.printing}</p>
              </div>
              <Clock className="h-12 w-12 text-blue-500"/>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-3xl font-bold text-purple-600">₹{stats.revenue}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-500"/>
            </div>
          </div>
        </div>

        {/* Kiosks */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5"/>
              Kiosks ({kiosks.length})
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kiosks.map(kiosk => (
                <div key={kiosk.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${getKioskStatusColor(kiosk.status)}`}></div>
                      <h3 className="font-semibold text-gray-900">{kiosk.id}</h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${kiosk.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {kiosk.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{kiosk.name}</p>
                  <p className="text-xs text-gray-500 mt-1">Printer: {kiosk.printer || 'Unknown'}</p>
                  {kiosk.last_seen && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last seen: {new Date(kiosk.last_seen).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {kiosks.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-400"/>
                <p>No kiosks registered</p>
              </div>
            )}
          </div>
        </div>

        {/* Jobs Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
              <div className="flex gap-2">
                {['all', 'PENDING', 'PAID', 'PRINTING', 'COMPLETED', 'FAILED'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 text-sm rounded ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kiosk</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pages</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{job.id.slice(0, 16)}...</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{job.kiosk_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{job.filename}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{job.pages}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">₹{job.total_cost}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jobs.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400"/>
                <p>No jobs found</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;