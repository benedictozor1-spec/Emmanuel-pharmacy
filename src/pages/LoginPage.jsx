import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.')
      return
    }

    setLoading(true)

    try {
      const profile = await login(username, password)

      // Route to the correct area based on role
      navigate(`/${profile.role}`, { replace: true })

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      {/* Floating background elements */}
      <div className="bg-pill" style={{ width: 200, height: 60, top: '15%', left: '5%', transform: 'rotate(-15deg)' }} />
      <div className="bg-pill" style={{ width: 140, height: 45, top: '70%', right: '8%', transform: 'rotate(20deg)' }} />
      <div className="bg-pill" style={{ width: 100, height: 30, bottom: '20%', left: '12%', transform: 'rotate(-8deg)' }} />

      <div className="login-card animate-slide-up">
        {/* Logo */}
        <div className="login-logo-ring animate-fade-in">
          <img
            src="/logo.jpg"
            alt="Emmanuel Pharmacy Logo"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }}
          />
          <svg style={{ display: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L12 22" />
            <path d="M5 12H19" />
            <path d="M9 7H15" />
            <path d="M9 17H15" />
            <rect x="3" y="5" width="18" height="14" rx="2" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="login-title animate-fade-in delay-100">Emmanuel Pharmacy</h1>
        <p className="login-subtitle animate-fade-in delay-200">Sign in to your account</p>

        {/* Error message */}
        {error && (
          <div className="login-error" id="login-error-message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} autoComplete="off">
          {/* Username field */}
          <div className="login-field animate-fade-in delay-200">
            <label className="login-label" htmlFor="login-username">Username</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="login-username"
                className="login-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>

          {/* Password field */}
          <div className="login-field animate-fade-in delay-300">
            <label className="login-label" htmlFor="login-password">Password</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="login-password"
                className="login-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                className="login-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                id="toggle-password-visibility"
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <div className="animate-fade-in delay-400">
            <button
              type="submit"
              className="login-btn"
              disabled={loading}
              id="login-submit-button"
            >
              {loading ? (
                <>
                  <div className="login-spinner" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="login-footer animate-fade-in delay-500">
          One person, one login — never share credentials
        </div>
      </div>
    </div>
  )
}
