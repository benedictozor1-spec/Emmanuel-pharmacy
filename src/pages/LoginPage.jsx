import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle, User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'

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
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-[#1C3375] via-[#1D3A94] to-[#1F45B8] relative overflow-hidden px-4">
      {/* Decorative background orbs */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(69,112,228,0.15)_0%,transparent_70%)] -top-[150px] -right-[150px] pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(69,112,228,0.1)_0%,transparent_70%)] -bottom-[100px] -left-[100px] pointer-events-none" />

      {/* Floating pills */}
      <div className="absolute rounded-full opacity-[0.04] bg-white pointer-events-none" style={{ width: 200, height: 60, top: '15%', left: '5%', transform: 'rotate(-15deg)' }} />
      <div className="absolute rounded-full opacity-[0.04] bg-white pointer-events-none" style={{ width: 140, height: 45, top: '70%', right: '8%', transform: 'rotate(20deg)' }} />

      <Card className="w-full max-w-[420px] shadow-2xl border-0 bg-white/[0.97] backdrop-blur-xl rounded-2xl relative z-10">
        <CardContent className="p-8 sm:p-10">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-[92px] h-[92px] rounded-[22px] bg-white flex items-center justify-center shadow-lg border border-[#1F45B8]/10 p-1.5 overflow-hidden">
              <img
                src="/logo.jpg"
                alt="Emmanuel Pharmacy Logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                className="w-full h-full object-contain rounded-2xl"
              />
              <div className="hidden items-center justify-center w-full h-full rounded-2xl bg-[#1F45B8] text-white text-2xl font-bold">
                EP
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-foreground tracking-tight mb-1">
            Emmanuel Pharmacy
          </h1>
          <p className="text-sm text-center text-muted-foreground mb-8">
            Sign in to your account
          </p>

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mb-5" id="login-error-message">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} autoComplete="off" className="space-y-4">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground" htmlFor="login-username">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="login-username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  className="h-12 pl-10 text-sm rounded-xl"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  className="h-12 pl-10 pr-12 text-sm rounded-xl"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  id="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              size="xl"
              className="w-full h-12 text-sm mt-2 rounded-xl"
              disabled={loading}
              id="login-submit-button"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center mt-6 text-xs text-muted-foreground">
            One person, one login — never share credentials
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
