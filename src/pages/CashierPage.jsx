import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function CashierPage() {
  const navigate = useNavigate()
  const { logout, fullName, username } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const initial = (fullName || username || 'C').charAt(0).toUpperCase()

  return (
    <div className="role-page">
      <header className="role-header">
        <div className="role-header-left">
          <h1 className="role-header-title">Emmanuel Pharmacy</h1>
          <span className="role-header-badge cashier">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Cashier
          </span>
        </div>
        <div className="role-header-user">
          <div className="role-header-avatar" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>{initial}</div>
          <button
            className="role-logout-btn"
            onClick={handleLogout}
            id="cashier-logout-button"
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
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <p className="role-placeholder-text">Welcome, {fullName || username}</p>
          <p className="role-placeholder-sub">Payment queue coming soon</p>
        </div>
      </div>
    </div>
  )
}
