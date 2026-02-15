// frontend/src/components/Dashboard/History.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import axios from 'axios';
import { FileText, Clock, CheckCircle, XCircle, Loader2, Calendar, IndianRupee } from 'lucide-react';

export function History() {
    const { getAuthHeader } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, completed, printing, failed

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    useEffect(() => {
        fetchHistory();
    }, [filter]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const authHeader = await getAuthHeader();

            // Fetch jobs
            const jobsResponse = await axios.get(`${API_URL}/api/jobs/my-jobs`, {
                headers: { 'Authorization': authHeader },
                params: { status: filter !== 'all' ? filter : undefined }
            });

            // Fetch stats
            const statsResponse = await axios.get(`${API_URL}/api/users/stats`, {
                headers: { 'Authorization': authHeader }
            });

            setJobs(jobsResponse.data.jobs || []);
            setStats(statsResponse.data);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'COMPLETED': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
            case 'PRINTING': return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
            case 'FAILED': return <XCircle className="w-5 h-5 text-red-400" />;
            default: return <Clock className="w-5 h-5 text-yellow-400" />;
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            PRINTING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
            PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            PAID: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.PENDING}`}>
                {status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Total Jobs</span>
                            <FileText className="w-4 h-4 text-blue-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{stats.totalJobs || 0}</p>
                    </div>

                    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Total Pages</span>
                            <FileText className="w-4 h-4 text-purple-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{stats.totalPages || 0}</p>
                    </div>

                    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Total Spent</span>
                            <IndianRupee className="w-4 h-4 text-emerald-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">₹{stats.totalSpent || 0}</p>
                    </div>

                    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Success Rate</span>
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{Math.round((stats.successRate || 0) * 100)}%</p>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'COMPLETED', 'PRINTING', 'FAILED'].map((filterOption) => (
                    <button
                        key={filterOption}
                        onClick={() => setFilter(filterOption)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            filter === filterOption
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card/50 text-muted-foreground hover:bg-card border border-border'
                        }`}
                    >
                        {filterOption === 'all' ? 'All Jobs' : filterOption}
                    </button>
                ))}
            </div>

            {/* Jobs List */}
            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl overflow-hidden">
                {jobs.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No print jobs yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {jobs.map((job) => (
                            <div key={job.id} className="p-4 hover:bg-card/30 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="mt-1">
                                            {getStatusIcon(job.status)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-foreground truncate">
                                                {job.filename}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <FileText className="w-3 h-3" />
                                                    {job.pages} pages
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <IndianRupee className="w-3 h-3" />
                                                    ₹{job.total_cost}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(job.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        {getStatusBadge(job.status)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}