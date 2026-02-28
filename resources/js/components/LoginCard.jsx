import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { GraduationCap } from 'lucide-react'

export default function LoginCard() {
  const csrf = typeof document !== 'undefined'
    ? (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '')
    : ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('faculty')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setStatus('')

    try {
      const formData = new URLSearchParams()
      formData.append('email', email)
      formData.append('password', password)
      formData.append('role', role)

      const resp = await fetch('/login', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrf,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: formData.toString(),
        credentials: 'same-origin'
      })

      if (resp.redirected) {
        window.location.href = resp.url
        return
      }

      const contentType = resp.headers.get('content-type') || ''
      if (resp.status === 422 || contentType.includes('application/json')) {
        const data = await resp.json().catch(() => null)
        if (data) {
          if (data.errors) setErrors(data.errors)
          if (data.message) setStatus(data.message)
        }
      } else if (resp.ok) {
        window.location.reload()
      } else {
        const text = await resp.text().catch(() => '')
        setStatus('Login failed: ' + (text || resp.statusText))
      }
    } catch (err) {
      setStatus('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-green-700 rounded-full flex items-center justify-center">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl">Mentora</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {status && <div className="mb-4 text-sm text-red-600">{status}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Faculty Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="faculty@lorma.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Login as</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" className="w-full bg-green-700 hover:bg-green-800" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <a href="/auth/google/redirect" className="block">
            <Button type="button" variant="outline" className="w-full gap-2" onClick={(e) => { e.preventDefault(); window.location.href = '/auth/google/redirect'; }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
