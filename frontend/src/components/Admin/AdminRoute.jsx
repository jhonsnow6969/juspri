// frontend/src/components/Admin/AdminRoute.jsx
// Protected route wrapper - only allows admin access

import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { motion } from 'framer-motion';
import { ShieldX } from 'lucide-react';

export function AdminRoute({ children }) {
  const { user, role, loading } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not logged in at all
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not admin
  if (role !== 'admin' && role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="bg-card/60 border border-border rounded-2xl p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center"
            >
              <ShieldX className="w-8 h-8 text-red-400" />
            </motion.div>
            
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Access Denied
            </h2>
            <p className="text-muted-foreground mb-6">
              You don't have permission to access the admin dashboard.
              {role && role !== 'user' && (
                <span className="block mt-2 text-sm">
                  Your role: <span className="font-mono text-foreground">{role}</span>
                </span>
              )}
            </p>
            
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors font-medium"
            >
              ← Back to Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Admin access granted
  return children;
}
