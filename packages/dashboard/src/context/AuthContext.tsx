import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, setToken as storeToken, clearToken, getToken } from '../lib/api'

export interface UserProfile {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'developer' | 'viewer'
  created_at: string
}

interface TotpPending {
  tempToken: string
}

interface AuthContextValue {
  user: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isDeveloper: boolean
  totpPending: TotpPending | null
  login: (username: string, password: string) => Promise<void>
  verifyTotp: (code: string) => Promise<void>
  cancelTotp: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [totpPending, setTotpPending] = useState<TotpPending | null>(null)
  const navigate = useNavigate()

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setTotpPending(null)
    navigate('/login')
  }, [navigate])

  // On mount: validate existing token
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }

    apiFetch<UserProfile>('/auth/me')
      .then(setUser)
      .catch(() => {
        clearToken()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(username: string, password: string) {
    const res = await apiFetch<{ token?: string; user?: UserProfile; requires_totp?: boolean; temp_token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })

    if (res.requires_totp && res.temp_token) {
      setTotpPending({ tempToken: res.temp_token })
      return
    }

    if (res.token && res.user) {
      storeToken(res.token)
      setUser(res.user)
    }
  }

  async function verifyTotp(code: string) {
    if (!totpPending) throw new Error('No TOTP pending')

    const res = await apiFetch<{ token: string; user: UserProfile }>('/auth/verify-totp', {
      method: 'POST',
      body: JSON.stringify({ temp_token: totpPending.tempToken, code }),
    })

    storeToken(res.token)
    setUser(res.user)
    setTotpPending(null)
  }

  function cancelTotp() {
    setTotpPending(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: user !== null,
        isAdmin: user?.role === 'admin',
        isDeveloper: user?.role === 'admin' || user?.role === 'developer',
        totpPending,
        login,
        verifyTotp,
        cancelTotp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
