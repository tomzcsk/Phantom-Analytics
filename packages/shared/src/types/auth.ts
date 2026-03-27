export type UserRole = 'admin' | 'developer' | 'viewer'

export interface UserProfile {
  id: string
  username: string
  display_name: string
  role: UserRole
  created_at: string
}

export interface AuthResponse {
  token: string
  user: UserProfile
}

export interface LoginBody {
  username: string
  password: string
}

export interface RegisterBody {
  username: string
  password: string
  display_name: string
}
