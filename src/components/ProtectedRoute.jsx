import { useEffect } from 'react'
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

  // Handle browser Back/Forward Cache (bfcache) restorations after logout
  useEffect(() => {
    const handlePageShow = (e) => {
      const hasStoredProfile = !!localStorage.getItem('ep_staff_profile')
      const hasSbToken = Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (!hasStoredProfile && !hasSbToken) {
        window.location.replace('/')
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  // If local storage was cleared in another tab/window or after logout
  const hasStoredProfile = typeof window !== 'undefined' && !!localStorage.getItem('ep_staff_profile')
  const hasSbToken = typeof window !== 'undefined' && Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'))

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
  if (!isAuthenticated || (!hasStoredProfile && !hasSbToken)) {
    return <Navigate to="/" replace />
  }

  const normalizedRole = (role || '').toLowerCase().trim()
  const normalizedAllowed = (allowedRoles || []).map(r => r.toLowerCase().trim())

  // Logged in but wrong role → send to their correct area
  if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(normalizedRole)) {
    return <Navigate to={`/${normalizedRole || 'attendant'}`} replace />
  }

  return children
}
