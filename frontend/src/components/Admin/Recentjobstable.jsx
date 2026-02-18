// frontend/src/components/Admin/RecentJobsTable.jsx
// Table showing recent print jobs across all kiosks

import { motion } from 'framer-motion';
import { FileText, CheckCircle, Loader2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function RecentJobsTable({ jobs, loading }) {
  const getStatusIcon = (status) => {
    const icons = {
      'COMPLETED': <CheckCircle className="w-4 h-4 text-green-400" />,
      'PRINTING': <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
      'FAILED': <XCircle className="w-4 h-4 text-red-400" />,
      'PENDING': <Clock className="w-4 h-4 text-yellow-400" />
    };
    return icons[status] || <FileText className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusBadge = (status) => {
    const variants = {
      'COMPLETED': 'secondary',
      'PRINTING': 'secondary',
      'FAILED': 'destructive',
      'PENDING': 'secondary'
    };

    const colors = {
      'COMPLETED': 'bg-green-500/20 text-green-400 border-green-500/30',
      'PRINTING': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'FAILED': '',
      'PENDING': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    };

    return (
      <Badge variant={variants[status] || 'secondary'} className={`gap-1 ${colors[status] || ''}`}>
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <Card className="bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Recent Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-muted/10 rounded-lg p-3 h-16"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Recent Jobs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No jobs yet
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-muted/10 border border-border rounded-lg p-3 hover:bg-muted/20 transition-colors"
              >
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center text-sm">
                  {/* Time */}
                  <div className="text-muted-foreground">
                    {formatTimeAgo(job.createdAt)}
                  </div>

                  {/* User */}
                  <div className="text-muted-foreground">
                    {job.userEmail}
                  </div>

                  {/* Kiosk */}
                  <div>
                    <span className="text-foreground font-medium">{job.kioskName || job.kioskId}</span>
                  </div>

                  {/* File */}
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate max-w-[150px]" title={job.filename}>
                      {job.filename}
                    </span>
                  </div>

                  {/* Pages & Cost */}
                  <div className="text-foreground">
                    {job.pages} pages • ₹{job.totalCost}
                  </div>

                  {/* Status */}
                  <div className="flex justify-end">
                    {getStatusBadge(job.status)}
                  </div>
                </div>

                {/* Error message if failed */}
                {job.status === 'FAILED' && job.errorMessage && (
                  <div className="mt-2 text-xs text-red-400 flex items-start gap-2">
                    <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{job.errorMessage}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}