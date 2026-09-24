import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './components/theme-provider'
import { TooltipProvider } from './components/ui/tooltip'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AttendantPage from './pages/AttendantPage'
import CashierPage from './pages/CashierPage'
import AdminPage from './pages/AdminPage'
import { Loader2 } from 'lucide-react'

export default function App() {
  const { isAuthenticated, role, loading } = useAuth()

  return (
    <ThemeProvider defaultTheme="system" storageKey="emmanuel-pharmacy-theme">
      <TooltipProvider delayDuration={300}>
        <Routes>
          {/* Login — redirect to role page if already logged in */}
          <Route
            path="/"
            element={
              loading ? (
                <div className="min-h-dvh flex items-center justify-center bg-background">
                  <div className="text-center flex flex-col items-center">
                    <div className="w-14 h-14 mb-3 rounded-2xl bg-white border border-border/60 shadow-sm p-1.5 flex items-center justify-center">
                      <img src="/logo.png" alt="Emmanuel Pharmacy" className="w-full h-full object-contain" />
                    </div>
                    <Loader2 className="h-6 w-6 animate-spin text-[#1F45B8] mx-auto mb-2" />
                    <p className="text-xs font-medium text-muted-foreground">Loading Emmanuel Pharmacy…</p>
                  </div>
                </div>
              ) :
              isAuthenticated ? <Navigate to={`/${role || 'attendant'}`} replace /> :
              <LoginPage />
            }
          />

          {/* Attendant area — attendants and admin can access */}
          <Route
            path="/attendant"
            element={
              <ProtectedRoute allowedRoles={['attendant', 'admin']}>
                <AttendantPage />
              </ProtectedRoute>
            }
          />

          {/* Cashier area — cashier and admin can access */}
          <Route
            path="/cashier"
            element={
              <ProtectedRoute allowedRoles={['cashier', 'admin']}>
                <CashierPage />
              </ProtectedRoute>
            }
          />

          {/* Admin area — admin only */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TooltipProvider>
    </ThemeProvider>
  )
}
