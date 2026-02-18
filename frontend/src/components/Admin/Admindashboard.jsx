// frontend/src/components/Admin/AdminDashboard.jsx
// Main admin dashboard with auto-refresh

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, RefreshCw } from 'lucide-react';
import { MetricsGrid } from './MetricsGrid';
import { KioskHealthGrid } from './Kioskhealthgrid';
import { RecentJobsTable } from './Recentjobstable';
import { useAuth } from '../AuthProvider';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds

export function AdminDashboard() {
  const { getAuthHeader } = useAuth();
  
  const [metrics, setMetrics] = useState(null);
  const [kiosks, setKiosks] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingKiosks, setLoadingKiosks] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const authHeader = await getAuthHeader();
      const response = await axios.get(`${API_URL}/api/admin/metrics`, {
        headers: { 'Authorization': authHeader }
      });
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  }, [getAuthHeader]);

  // Fetch kiosks
  const fetchKiosks = useCallback(async () => {
    try {
      const authHeader = await getAuthHeader();
      const response = await axios.get(`${API_URL}/api/admin/kiosks`, {
        headers: { 'Authorization': authHeader }
      });
      setKiosks(response.data.kiosks || []);
    } catch (error) {
      console.error('Failed to fetch kiosks:', error);
    } finally {
      setLoadingKiosks(false);
    }
  }, [getAuthHeader]);

  // Fetch recent jobs
  const fetchRecentJobs = useCallback(async () => {
    try {
      const authHeader = await getAuthHeader();
      const response = await axios.get(`${API_URL}/api/admin/recent-jobs?limit=20`, {
        headers: { 'Authorization': authHeader }
      });
      setRecentJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch recent jobs:', error);
    } finally {
      setLoadingJobs(false);
    }
  }, [getAuthHeader]);

  // Manual refresh all
  const handleRefresh = useCallback(() => {
    setLoadingMetrics(true);
    setLoadingKiosks(true);
    setLoadingJobs(true);
    setLastRefresh(new Date());
    
    fetchMetrics();
    fetchKiosks();
    fetchRecentJobs();
  }, [fetchMetrics, fetchKiosks, fetchRecentJobs]);

  // Initial load
  useEffect(() => {
    fetchMetrics();
    fetchKiosks();
    fetchRecentJobs();
  }, [fetchMetrics, fetchKiosks, fetchRecentJobs]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      setLastRefresh(new Date());
      fetchMetrics();
      fetchKiosks();
      fetchRecentJobs();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, fetchMetrics, fetchKiosks, fetchRecentJobs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              System overview and kiosk management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              autoRefreshEnabled 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-muted/20 text-muted-foreground border border-border'
            }`}
          >
            Auto-refresh {autoRefreshEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Manual refresh */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Last refresh timestamp */}
      <p className="text-xs text-muted-foreground">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </p>

      {/* Metrics Grid */}
      <MetricsGrid metrics={metrics} loading={loadingMetrics} />

      {/* Kiosk Health Grid */}
      <KioskHealthGrid 
        kiosks={kiosks} 
        loading={loadingKiosks} 
        onRefresh={fetchKiosks}
        getAuthHeader={getAuthHeader}
      />

      {/* Recent Jobs Table */}
      <RecentJobsTable jobs={recentJobs} loading={loadingJobs} />
    </div>
  );
}