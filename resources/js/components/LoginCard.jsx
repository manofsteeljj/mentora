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
        </CardContent>
      </Card>
    </div>
  )
}
