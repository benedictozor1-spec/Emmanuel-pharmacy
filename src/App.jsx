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
          loading ? null :
          isAuthenticated ? <Navigate to={`/${role}`} replace /> :
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
