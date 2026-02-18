// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./components/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./components/Dashboard/DashboardLayout";
import { Login } from "./components/Login";
import { History } from "./components/Dashboard/History";
import { PrintInterface } from "./components/Print/PrintInterface";
import { FAQPage } from "./components/FAQPage";
import { AdminRoute } from "./components/Admin/AdminRoute";
import { AdminDashboard } from "./components/Admin/Admindashboard";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Public FAQ route - no auth required */}
          <Route path="/faq" element={<FAQPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout activeTab="print">
                  <PrintInterface />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <DashboardLayout activeTab="history">
                  <History />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Admin route */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <ProtectedRoute>
                  <DashboardLayout activeTab="admin">
                    <AdminDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              </AdminRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
