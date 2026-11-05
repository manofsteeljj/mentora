import { useState } from 'react'
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import PasswordInput from './PasswordInput'
import logoImage from '../../logo/MENTORA LOGO.png'

export default function RecoveryPasswordCard({ status: initialStatus = '', errors: initialErrors = {}, email: initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState(initialErrors)
  const [status, setStatus] = useState(initialStatus)
  const [processing, setProcessing] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setErrors({})
    setStatus('')
    setProcessing(true)

    try {
      const pageResponse = await fetch('/forgot-password', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'text/html' },
      })

      if (!pageResponse.ok) {
        throw new Error('Unable to refresh your session security token. Reload the page and try again.')
      }

      const pageHtml = await pageResponse.text()
      const pageDocument = new DOMParser().parseFromString(pageHtml, 'text/html')
      const token = pageDocument.querySelector('meta[name="csrf-token"]')?.getAttribute('content')

      if (!token) {
        throw new Error('A session security token was not found. Reload the page and try again.')
      }

      const formData = new URLSearchParams({
        _token: token,
        email,
        recovery_key: recoveryKey,
        password,
        password_confirmation: passwordConfirmation,
      })

      const response = await fetch('/forgot-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'X-CSRF-TOKEN': token,
        },
        body: formData.toString(),
      })

      if (response.redirected) {
        window.location.assign(response.url)
        return
      }

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (result.errors) {
          setErrors(result.errors)
        } else {
          setErrors({ form: [result.message || 'Password recovery failed. Please try again.'] })
        }
        return
      }

      setRecoveryKey('')
      setPassword('')
      setPasswordConfirmation('')
      setStatus(result.status || 'Your password has been reset. You can now sign in.')
    } catch (error) {
      setErrors({ form: [error instanceof Error ? error.message : 'Unable to reach the server. Please try again.'] })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-green-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative w-full max-w-xl">
        <a href="/login" className="mb-6 inline-flex items-center gap-3">
          <img src={logoImage} alt="Mentora" className="h-10 w-auto object-contain" />
        </a>

        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-green-900/10">
          <header className="bg-gradient-to-r from-green-700 via-emerald-600 to-teal-600 px-6 py-7 text-white sm:px-9">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Recover your account</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-green-50 sm:text-base">
              Verify your email and recovery key, then choose a new password.
            </p>
          </header>

          <div className="px-6 py-7 sm:px-9 sm:py-8">
            {status && (
              <p className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
                {status}
              </p>
            )}

            {Object.keys(errors).length > 0 && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                <p className="font-semibold">Please check the information below.</p>
                {errors.form?.map((error) => <p className="mt-1" key={error}>{error}</p>)}
              </div>
            )}

            <form className="space-y-5" onSubmit={submit} noValidate>
              <div>
                <Label htmlFor="recovery-email" className="mb-2 block text-sm font-semibold text-gray-700">Account email</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.edu"
                  autoComplete="username"
                  autoFocus
                  required
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'recovery-email-error' : undefined}
                />
                {errors.email?.map((error) => <p id="recovery-email-error" className="mt-2 text-sm text-red-600" key={error}>{error}</p>)}
              </div>

              <div>
                <Label htmlFor="recovery-key" className="mb-2 block text-sm font-semibold text-gray-700">Recovery key</Label>
                <PasswordInput
                  id="recovery-key"
                  value={recoveryKey}
                  onChange={(event) => setRecoveryKey(event.target.value)}
                  placeholder="Enter the key provided to you"
                  autoComplete="off"
                  required
                  aria-invalid={Boolean(errors.recovery_key)}
                  aria-describedby={errors.recovery_key ? 'recovery-key-error' : undefined}
                  leadingIcon={<KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />}
                  className="pl-10"
                />
                <p className="mt-1.5 text-xs text-gray-500">The recovery key is specific to your account.</p>
                {errors.recovery_key?.map((error) => <p id="recovery-key-error" className="mt-2 text-sm text-red-600" key={error}>{error}</p>)}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="recovery-new-password" className="mb-2 block text-sm font-semibold text-gray-700">New password</Label>
                  <PasswordInput
                    id="recovery-new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'recovery-password-error' : undefined}
                  />
                  {errors.password?.map((error) => <p id="recovery-password-error" className="mt-2 text-sm text-red-600" key={error}>{error}</p>)}
                </div>

                <div>
                  <Label htmlFor="recovery-password-confirmation" className="mb-2 block text-sm font-semibold text-gray-700">Confirm password</Label>
                  <PasswordInput
                    id="recovery-password-confirmation"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    autoComplete="new-password"
                    required
                    aria-invalid={Boolean(errors.password_confirmation)}
                    aria-describedby={errors.password_confirmation ? 'recovery-password-confirmation-error' : undefined}
                  />
                  {errors.password_confirmation?.map((error) => <p id="recovery-password-confirmation-error" className="mt-2 text-sm text-red-600" key={error}>{error}</p>)}
                </div>
              </div>

              <Button
                type="submit"
                disabled={processing}
                className="w-full gap-2 rounded-lg bg-gradient-to-r from-green-700 to-emerald-600 text-white shadow-md shadow-green-700/20 hover:from-green-800 hover:to-emerald-700"
              >
                {processing ? 'Resetting password…' : 'Reset password'}
                {!processing && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </form>
          </div>
        </section>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-sm text-gray-600">
          Remembered your password?
          <a href="/login" className="inline-flex items-center gap-1 font-semibold text-green-700 hover:text-green-800">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </a>
        </p>
      </div>
    </main>
  )
}
