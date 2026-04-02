import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import logoImage from '../../logo/MENTORA LOGO.png'
import { motion } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, BookOpen, Brain, Users, Shield } from 'lucide-react'

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

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Assistance',
      description: 'Get intelligent support for lesson planning and student assessment'
    },
    {
      icon: Users,
      title: 'Student Management',
      description: 'Track progress and manage multiple courses effortlessly'
    },
    {
      icon: Shield,
      title: 'Academic Integrity',
      description: 'Advanced plagiarism detection and AI content analysis'
    }
  ]

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Left Side - Branding & Features - Animates based on role */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        className={`absolute top-0 bottom-0 left-0 hidden lg:flex w-1/2 bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 p-12 flex-col justify-between overflow-hidden transition-all duration-700 ${
          role === 'faculty' ? 'lg:left-0' : 'lg:left-1/2'
        }`}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center gap-3 mb-16"
          >
            <img src={logoImage} alt="Mentora" className="h-12" />
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h1 className="text-5xl font-bold text-white mb-6">
              Welcome to Mentora
            </h1>
            <p className="text-xl text-white/90 mb-12 max-w-lg">
              Your AI-powered teaching assistant for modern education. Streamline your workflow and enhance student outcomes.
            </p>

            {/* Features */}
            <div className="space-y-6">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-white/80 text-sm">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-white/70 text-sm relative z-10"
        >
          &copy; 2026 Mentora - Lorma Colleges. All rights reserved.
        </motion.p>
      </motion.div>

      {/* Right Side - Login Form - Animates based on role */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        className={`absolute top-0 bottom-0 left-0 w-full lg:w-1/2 flex items-center justify-center p-8 bg-white overflow-hidden transition-all duration-700 ${
          role === 'faculty' ? 'lg:left-1/2' : 'lg:left-0'
        }`}
      >
        <motion.div
          className="w-full max-w-md relative z-10"
          key={role}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={logoImage} alt="Mentora" className="h-12" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign In</h2>
            <p className="text-gray-600 mb-8">Enter your credentials to access your account</p>
          </motion.div>

          {status && <div className="mb-4 text-sm text-red-600">{status}</div>}

          <motion.form
            onSubmit={handleSubmit}
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                I am a
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  onClick={() => setRole('faculty')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    role === 'faculty'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <BookOpen className={`w-6 h-6 mx-auto mb-2 ${
                    role === 'faculty' ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    role === 'faculty' ? 'text-green-600' : 'text-gray-700'
                  }`}>
                    Faculty
                  </span>
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setRole('admin')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    role === 'admin'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <User className={`w-6 h-6 mx-auto mb-2 ${
                    role === 'admin' ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    role === 'admin' ? 'text-green-600' : 'text-gray-700'
                  }`}>
                    Admin
                  </span>
                </motion.button>
              </div>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <a
                  href="/forgot-password"
                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Forgot?
                </a>
              </div>
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

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
                Remember me for 30 days
              </label>
            </div>

            {/* Submit Button */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium shadow-lg shadow-green-500/30"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing In...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    Sign In
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </span>
                )}
              </Button>
            </motion.div>
          </motion.form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <a href="/auth/google/redirect" className="block">
              <Button type="button" variant="outline" className="w-full h-12 gap-2 border-gray-300 hover:bg-gray-50" onClick={(e) => { e.preventDefault(); window.location.href = '/auth/google/redirect' }}>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </Button>
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-6 text-center text-sm text-gray-600"
          >
            Don&apos;t have an account?{' '}
            <a href="/register" className="text-green-600 hover:text-green-700 font-medium">
              Register
            </a>
          </motion.p>

          {/* Help Text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 text-center text-sm text-gray-600"
          >
            Need help?{' '}
            <a href="/support" className="text-green-600 hover:text-green-700 font-medium">
              Contact Support
            </a>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  )
}
