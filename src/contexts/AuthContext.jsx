import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Supabase auth user
  const [profile, setProfile] = useState(null)  // Our profiles table data (username, role, etc.)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch the user's profile from our profiles table
  const fetchProfile = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null)
      return null
    }

    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name, role')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError.message)
        setProfile(null)
        return null
      }

      setProfile(data)
      return data
    } catch (err) {
      console.error('Profile fetch exception:', err)
      setProfile(null)
      return null
    }
  }, [])

  // Initialize: check if user is already logged in
  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get current session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        }
      } catch (err) {
        console.error('Auth init error:', err)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // Login with username + password
  const login = async (username, password) => {
    if (!supabase) {
      throw new Error('Supabase is not configured. Check your .env file.')
    }

    setError(null)

    // Convert username to email format for Supabase Auth
    const email = username.includes('@')
      ? username
      : `${username.toLowerCase().trim()}@emmanuelpharmacy.app`

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      throw new Error(
        authError.message === 'Invalid login credentials'
          ? 'Wrong username or password. Try again.'
          : authError.message
      )
    }

    // Fetch the profile to get the role
    const userProfile = await fetchProfile(data.user.id)

    if (!userProfile) {
      throw new Error('Account exists but no staff profile found. Contact Admin.')
    }

    return userProfile
  }

  // Logout
  const logout = async () => {
    if (!supabase) return

    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user && !!profile,
    role: profile?.role || null,
    username: profile?.username || null,
    fullName: profile?.full_name || null,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
