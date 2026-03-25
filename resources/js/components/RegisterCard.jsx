import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { motion } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, GraduationCap } from 'lucide-react'

export default function RegisterCard() {
  const csrf = typeof document !== 'undefined'
    ? (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '')
    : ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setStatus('')

    if (!agreeTerms) {
      setStatus('Please agree to the terms and conditions')
      setLoading(false)
      return
    }

    try {
      const formData = new URLSearchParams()
      formData.append('name', name)
      formData.append('email', email)
      formData.append('password', password)
      formData.append('password_confirmation', passwordConfirmation)
      formData.append('role', 'faculty')

      const resp = await fetch('/register', {
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
        setStatus('Registration successful! Redirecting to login...')
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      } else {
        const text = await resp.text().catch(() => '')
        setStatus('Registration failed: ' + (text || resp.statusText))
      }
    } catch (err) {
      setStatus('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-center"
      >
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-700 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <span className="text-3xl font-bold text-gray-900">Mentora</span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Faculty Registration</h2>
            <p className="text-gray-600 mb-8">Create your faculty account</p>
          </motion.div>

          {status && <div className={`mb-4 text-sm p-3 rounded ${status.includes('successful') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>{status}</div>}

          <motion.form
            onSubmit={handleSubmit}
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="pl-10 h-12 border-gray-300 focus:border-green-600 focus:ring-green-600"
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name[0]}</p>}
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@lorma.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 border-gray-300 focus:border-green-600 focus:ring-green-600"
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email[0]}</p>}
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-12 border-gray-300 focus:border-green-600 focus:ring-green-600"
                />
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password[0]}</p>}
            </div>

            {/* Password Confirmation */}
            <div className="space-y-2">
              <Label htmlFor="passwordConfirmation" className="text-sm font-medium text-gray-700">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="passwordConfirmation"
                  type="password"
                  placeholder="••••••••"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  required
                  className="pl-10 h-12 border-gray-300 focus:border-green-600 focus:ring-green-600"
                />
              </div>
              {errors.password_confirmation && <p className="mt-1 text-xs text-red-600">{errors.password_confirmation[0]}</p>}
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start gap-2">
              <input
                id="agreeTerms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-4 h-4 mt-1 text-green-600 border-gray-300 rounded focus:ring-green-600"
              />
              <label htmlFor="agreeTerms" className="text-sm text-gray-700">
                I agree to the <a href="/terms" className="text-green-600 hover:text-green-700 font-medium">Terms and Conditions</a> and <a href="/privacy" className="text-green-600 hover:text-green-700 font-medium">Privacy Policy</a>
              </label>
            </div>

            {/* Submit Button */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Button
                type="submit"
                disabled={loading || !agreeTerms}
                className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Account...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    Register
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </span>
                )}
              </Button>
            </motion.div>
          </motion.form>

          {/* Sign In Link */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 text-center text-sm text-gray-600"
          >
            Already have an account?{' '}
            <a href="/login" className="text-green-600 hover:text-green-700 font-medium">
              Sign In
            </a>
          </motion.p>
        </div>
      </motion.div>
    </div>
  )
}
