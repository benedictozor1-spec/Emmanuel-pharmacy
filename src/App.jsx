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
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#1F45B8] mx-auto mb-3" />
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
