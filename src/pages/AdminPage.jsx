import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminPage() {
  const navigate = useNavigate()
  const { logout, fullName, username } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const initial = (fullName || username || 'D').charAt(0).toUpperCase()

  return (
    <div className="role-page">
      <header className="role-header">
        <div className="role-header-left">
          <h1 className="role-header-title">Emmanuel Pharmacy</h1>
          <span className="role-header-badge admin">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Admin
          </span>
        </div>
        <div className="role-header-user">
          <div className="role-header-avatar" style={{ background: 'linear-gradient(135deg, #d97706, #92400e)' }}>{initial}</div>
          <button
            className="role-logout-btn"
            onClick={handleLogout}
            id="admin-logout-button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </header>

      <div className="role-content">
        <div className="role-placeholder animate-fade-in">
          <svg className="role-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="role-placeholder-text">Welcome, {fullName || username}</p>
          <p className="role-placeholder-sub">Overview, products & settings coming soon</p>
        </div>
      </div>
    </div>
  )
}
