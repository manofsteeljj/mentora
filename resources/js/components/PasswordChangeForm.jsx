import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

const fields = [
  { name: 'current_password', label: 'Current password', autocomplete: 'current-password' },
  { name: 'password', label: 'New password', autocomplete: 'new-password' },
  { name: 'password_confirmation', label: 'Confirm new password', autocomplete: 'new-password' },
]

export default function PasswordChangeForm() {
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')
  const [processing, setProcessing] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    setErrors({})
    setStatus('')
    setProcessing(true)

    const formData = new FormData(form)

    try {
      const tokenResponse = await fetch('/api/csrf-token', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })

      if (!tokenResponse.ok) {
        throw new Error('Unable to refresh your session security token. Reload the page and try again.')
      }

      const { token } = await tokenResponse.json()
      if (!token) {
        throw new Error('A session security token was not returned. Reload the page and try again.')
      }

      formData.set('_token', token)
      formData.set('_method', 'PUT')
      const response = await fetch(
        document.querySelector('meta[name="password-update-url"]')?.getAttribute('content') || '/password',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'X-CSRF-TOKEN': token,
          },
          body: new URLSearchParams(formData).toString(),
        }
      )

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (result.errors) {
          setErrors(result.errors)
        } else {
          setErrors({ form: [result.message || 'Password could not be updated. Please try again.'] })
        }
        return
      }

      form.reset()
      setStatus('Password updated successfully.')
    } catch {
      setErrors({ form: ['Unable to reach the server. Check your connection and try again.'] })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form
      action={document.querySelector('meta[name="password-update-url"]')?.getAttribute('content') || '/password'}
      method="POST"
      className="space-y-3"
      onSubmit={submit}
    >
      <input type="hidden" name="_method" value="PUT" />
      {fields.map(({ name, label, autocomplete }) => (
        <div className="space-y-1" key={name}>
          <Label htmlFor={`password-change-${name}`}>{label}</Label>
          <Input
            id={`password-change-${name}`}
            name={name}
            type="password"
            autoComplete={autocomplete}
            required
            aria-invalid={Boolean(errors[name])}
            aria-describedby={errors[name] ? `password-change-${name}-error` : undefined}
          />
          {errors[name]?.map((error) => (
            <p className="text-sm text-red-600" id={`password-change-${name}-error`} key={error}>{error}</p>
          ))}
        </div>
      ))}
      {errors.form?.map((error) => <p className="text-sm text-red-600" key={error}>{error}</p>)}
      {status && <p className="text-sm text-green-700" role="status">{status}</p>}
      <Button type="submit" variant="outline" disabled={processing}>
        {processing ? 'Updating…' : 'Update Password'}
      </Button>
    </form>
  )
}
