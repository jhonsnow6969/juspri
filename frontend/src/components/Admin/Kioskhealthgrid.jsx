// frontend/src/components/Admin/KioskHealthGrid.jsx
// Real-time kiosk status monitor with paper tracking

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Droplet,
  RefreshCw,
  Edit
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import axios from 'axios';

export function KioskHealthGrid({ kiosks, loading, onRefresh, getAuthHeader }) {
  const [editingKiosk, setEditingKiosk] = useState(null);
  const [newPaperCount, setNewPaperCount] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleSetPaper = async () => {
    if (!editingKiosk || !newPaperCount) return;

    const count = parseInt(newPaperCount);
    if (isNaN(count) || count < 0 || count > 1000) {
      alert('Paper count must be between 0 and 1000');
      return;
    }

    setUpdating(true);
    try {
      const authHeader = await getAuthHeader();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      await axios.post(
        `${API_URL}/api/admin/kiosks/${editingKiosk.id}/set-paper`,
        { paperCount: count },
        { headers: { Authorization: authHeader } }
      );

      setEditingKiosk(null);
      setNewPaperCount('');
      onRefresh();
    } catch (error) {
      console.error('Failed to set paper count:', error);
      alert(error.response?.data?.message || 'Failed to update paper count');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (kiosk) => {
    if (!kiosk.isOnline) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" /> Offline
        </Badge>
      );
    }
    if (kiosk.currentJobId) {
      return (
        <Badge className="gap-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          🟡 Busy
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 bg-green-500/20 text-green-400 border-green-500/30">
        <CheckCircle className="w-3 h-3" /> Online
      </Badge>
    );
  };

  const getPrinterStatusBadge = (status, detail) => {
    if (status === 'healthy') {
      return (
        <Badge className="gap-1 bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="w-3 h-3" /> Ready
        </Badge>
      );
    }
    if (status === 'error') {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" /> {detail || 'Error'}
        </Badge>
      );
    }
    return (
      <Badge className="gap-1">
        <AlertTriangle className="w-3 h-3" /> Unknown
      </Badge>
    );
  };

  const getPaperBadge = (level, count) => {
    const base = 'gap-1 border';
    const map = {
      high: `bg-green-500/20 text-green-400 border-green-500/30`,
      medium: `bg-yellow-500/20 text-yellow-400 border-yellow-500/30`,
      low: `bg-orange-500/20 text-orange-400 border-orange-500/30`
    };
    if (level === 'empty') {
      return (
        <Badge variant="destructive" className="gap-1">
          <Droplet className="w-3 h-3" /> Empty
        </Badge>
      );
    }
    return (
      <Badge className={`${base} ${map[level]}`}>
        <Droplet className="w-3 h-3" /> {count}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Kiosk Health Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-muted/10 rounded-lg p-4 h-20" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card/60">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Kiosk Health Monitor
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </CardHeader>

        <CardContent>
          {kiosks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No kiosks registered yet
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {kiosks.map((kiosk, index) => (
                  <motion.div
                    key={kiosk.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="bg-muted/10 border border-border rounded-lg p-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-start lg:items-center">
                      {/* Name */}
                      <div>
                        <p className="text-sm font-medium">{kiosk.hostname || kiosk.id}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {kiosk.id}
                        </p>
                      </div>

                      {/* Status */}
                      <div>{getStatusBadge(kiosk)}</div>

                      {/* Printer */}
                      <div>{getPrinterStatusBadge(kiosk.printerStatus, kiosk.printerStatusDetail)}</div>

                      {/* Paper */}
                      <div className="flex items-center gap-2">
                        {getPaperBadge(kiosk.paperLevel, kiosk.paperCount)}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditingKiosk(kiosk);
                            setNewPaperCount(kiosk.paperCount.toString());
                          }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Stats */}
                      <div className="text-sm">
                        <p className="text-muted-foreground">
                          Jobs: <span className="text-foreground font-medium">{kiosk.jobsToday}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Revenue:{' '}
                          <span className="text-foreground font-medium">
                            ₹{kiosk.revenueToday}
                          </span>
                        </p>
                      </div>

                      {/* Last seen */}
                      <div className="text-sm text-muted-foreground">
                        {kiosk.isOnline ? (
                          <span className="text-green-400">Active now</span>
                        ) : kiosk.lastSeen ? (
                          `Last seen ${new Date(kiosk.lastSeen).toLocaleTimeString()}`
                        ) : (
                          'Never seen'
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editingKiosk} onOpenChange={(o) => !o && setEditingKiosk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Paper Count</DialogTitle>
            <DialogDescription>
              Update paper for{' '}
              <span className="font-medium text-foreground">
                {editingKiosk?.hostname || editingKiosk?.id}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              type="number"
              min="0"
              max="1000"
              value={newPaperCount}
              onChange={(e) => setNewPaperCount(e.target.value)}
              className="bg-muted/10"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Current: {editingKiosk?.paperCount} pages
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingKiosk(null)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleSetPaper} disabled={updating}>
              {updating ? 'Updating…' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
