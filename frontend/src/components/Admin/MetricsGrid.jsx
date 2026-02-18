// frontend/src/components/Admin/MetricsGrid.jsx
// Stats cards showing system-wide metrics

import { motion } from 'framer-motion';
import { IndianRupee, FileText, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function MetricsGrid({ metrics, loading }) {
  const stats = [
    {
      label: 'Total Revenue',
      value: `₹${metrics?.overall?.totalRevenue?.toLocaleString() || 0}`,
      subtext: metrics?.today?.revenue 
        ? `+₹${metrics.today.revenue.toLocaleString()} today` 
        : null,
      icon: IndianRupee,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10'
    },
    {
      label: 'Pages Printed',
      value: metrics?.overall?.totalPages?.toLocaleString() || 0,
      subtext: metrics?.today?.pages 
        ? `+${metrics.today.pages.toLocaleString()} today` 
        : null,
      icon: FileText,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10'
    },
    {
      label: 'Success Rate',
      value: `${metrics?.overall?.successRate?.toFixed(1) || 0}%`,
      subtext: `${metrics?.overall?.completedJobs || 0} completed`,
      icon: CheckCircle,
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    {
      label: 'Failed Jobs',
      value: metrics?.overall?.failedJobs || 0,
      subtext: `${((metrics?.overall?.failedJobs / metrics?.overall?.totalJobs * 100) || 0).toFixed(1)}% failure rate`,
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card/60">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted/20 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-muted/20 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted/20 rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card className="bg-card/60 border-border hover:bg-card/80 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                {stat.subtext && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {stat.subtext.startsWith('+') && (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{stat.subtext}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}