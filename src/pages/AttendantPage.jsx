import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AttendantPage() {
  const navigate = useNavigate()
  const { logout, fullName, username } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  // First letter of name for avatar
  const initial = (fullName || username || 'A').charAt(0).toUpperCase()

  return (
    <div className="role-page">
      <header className="role-header">
        <div className="role-header-left">
          <h1 className="role-header-title">Emmanuel Pharmacy</h1>
          <span className="role-header-badge attendant">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Attendant
          </span>
        </div>
        <div className="role-header-user">
          <div className="role-header-avatar">{initial}</div>
          <button
            className="role-logout-btn"
            onClick={handleLogout}
            id="attendant-logout-button"
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
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <p className="role-placeholder-text">Welcome, {fullName || username}</p>
          <p className="role-placeholder-sub">Selling screens coming soon</p>
        </div>
      </div>
    </div>
  )
}
