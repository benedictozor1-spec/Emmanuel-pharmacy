import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AttendantPage from './pages/AttendantPage'
import CashierPage from './pages/CashierPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  const { isAuthenticated, role, loading } = useAuth()

  return (
    <Routes>
      {/* Login — redirect to role page if already logged in */}
      <Route
        path="/"
        element={
          loading ? (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F4EE', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>💊</div>
                <p style={{ fontSize: '13px', color: '#86816F', fontWeight: 600 }}>Loading Emmanuel Pharmacy...</p>
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
  )
}
