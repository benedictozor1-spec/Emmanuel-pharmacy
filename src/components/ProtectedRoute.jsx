import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute — guards a route by auth status and role.
 *
 * @param {string[]} allowedRoles - Roles that can access this route (e.g., ['admin', 'cashier'])
 * @param {React.ReactNode} children - The page component to render if authorized
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, loading, role } = useAuth()

  // Still checking auth state — show nothing (avoids flash)
  if (loading) {
    return (
      <div className="login-container" style={{ background: 'var(--color-neutral-50)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="login-spinner" style={{
            width: 32,
            height: 32,
            borderColor: 'rgba(30, 64, 175, 0.2)',
            borderTopColor: 'var(--color-primary-700)',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.875rem' }}>Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in → send to login
  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // Logged in but wrong role → send to their correct area
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={`/${role}`} replace />
  }

  return children
}
