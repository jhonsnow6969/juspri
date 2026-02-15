// frontend/src/components/Dashboard/History.jsx
import { useState, useEffect, memo } from 'react';
import { useAuth } from '../AuthProvider';
import axios from 'axios';
import { FileText, Clock, CheckCircle, XCircle, Loader2, Calendar, IndianRupee, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

// Memoized stat card to prevent unnecessary re-renders
const StatCard = memo(({ icon: Icon, label, value, color, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay }}
        className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 hover:bg-card/70 transition-colors"
    >
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <motion.p
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: delay + 0.1, type: "spring" }}
            className="text-2xl font-bold text-foreground"
        >
            {value}
        </motion.p>
    </motion.div>
));

StatCard.displayName = 'StatCard';

// Memoized job card for better performance
const JobCard = memo(({ job, index }) => {
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

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            layout
            className="p-4 hover:bg-card/30 transition-colors cursor-pointer"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <motion.div
                        className="mt-1"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.05 + 0.1, type: "spring" }}
                    >
                        {getStatusIcon(job.status)}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                            {job.filename}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
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
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 + 0.15 }}
                >
                    {getStatusBadge(job.status)}
                </motion.div>
            </div>
        </motion.div>
    );
});

JobCard.displayName = 'JobCard';

// Skeleton loader component
const HistorySkeleton = () => (
    <div className="space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card/50 border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-4 rounded-full" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                </div>
            ))}
        </div>

        {/* Filter skeleton */}
        <Skeleton className="h-10 w-full max-w-md" />

        {/* Jobs skeleton */}
        <div className="bg-card/50 border border-border rounded-xl overflow-hidden">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 border-b border-border last:border-b-0">
                    <div className="flex items-start gap-3">
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export function History() {
    const { getAuthHeader } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    useEffect(() => {
        fetchHistory();
    }, [filter]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const authHeader = await getAuthHeader();

            // Fetch both in parallel for better performance
            const [jobsResponse, statsResponse] = await Promise.all([
                axios.get(`${API_URL}/api/jobs/my-jobs`, {
                    headers: { 'Authorization': authHeader },
                    params: { status: filter !== 'all' ? filter : undefined }
                }),
                axios.get(`${API_URL}/api/users/stats`, {
                    headers: { 'Authorization': authHeader }
                })
            ]);

            setJobs(jobsResponse.data.jobs || []);
            setStats(statsResponse.data);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <HistorySkeleton />;
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            {/* Stats Cards - Stagger animation */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={FileText}
                        label="Total Jobs"
                        value={stats.totalJobs || 0}
                        color="text-blue-400"
                        delay={0}
                    />
                    <StatCard
                        icon={FileText}
                        label="Total Pages"
                        value={stats.totalPages || 0}
                        color="text-purple-400"
                        delay={0.1}
                    />
                    <StatCard
                        icon={IndianRupee}
                        label="Total Spent"
                        value={`₹${stats.totalSpent || 0}`}
                        color="text-emerald-400"
                        delay={0.2}
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="Success Rate"
                        value={`${Math.round((stats.successRate || 0) * 100)}%`}
                        color="text-emerald-400"
                        delay={0.3}
                    />
                </div>
            )}

            {/* Filter Tabs - Using shadcn Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <Tabs value={filter} onValueChange={setFilter} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
                        <TabsTrigger value="all">All Jobs</TabsTrigger>
                        <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
                        <TabsTrigger value="PRINTING">Printing</TabsTrigger>
                        <TabsTrigger value="FAILED">Failed</TabsTrigger>
                    </TabsList>
                </Tabs>
            </motion.div>

            {/* Jobs List - Animated */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-card/50 backdrop-blur-sm border border-border rounded-xl overflow-hidden"
            >
                <AnimatePresence mode="wait">
                    {jobs.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="text-center py-12"
                        >
                            <motion.div
                                animate={{ 
                                    y: [0, -10, 0],
                                }}
                                transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                            >
                                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            </motion.div>
                            <p className="text-muted-foreground">No print jobs yet</p>
                            <p className="text-sm text-muted-foreground/60 mt-1">
                                Start by printing your first document!
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="jobs"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="divide-y divide-border"
                        >
                            <AnimatePresence>
                                {jobs.map((job, index) => (
                                    <JobCard key={job.id} job={job} index={index} />
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}