import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import PasswordChangeForm from './PasswordChangeForm'

const defaults = {
  response_detail: 'balanced',
  include_code_examples: true,
  auto_load_course_context: true,
  show_related_topics: true,
  email_notifications: true,
  new_material_alerts: true,
  quiz_reminders: true,
  save_chat_history: true,
}

const responseLabels = {
  concise: 'Concise',
  balanced: 'Balanced',
  detailed: 'Detailed',
}

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

async function getFreshToken() {
  const response = await fetch('/api/csrf-token', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('Unable to refresh your session security token.')
  const data = await response.json()
  if (!data.token) throw new Error('A session security token was not returned.')
  return data.token
}

export default function Settings() {
  const [settings, setSettings] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': getToken() },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load your settings.')
        return response.json()
      })
      .then((data) => setSettings({ ...defaults, ...data }))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  async function updateSetting(name, value) {
    setSettings((current) => ({ ...current, [name]: value }))
    setSaving(name)
    setMessage('')
    setError('')

    try {
      const token = await getFreshToken()
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
        },
        body: JSON.stringify({ [name]: value }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to save this setting.')
      setSettings({ ...defaults, ...data })
      setMessage('Settings saved.')
    } catch (reason) {
      setSettings((current) => ({ ...current, [name]: settings[name] }))
      setError(reason.message)
    } finally {
      setSaving('')
    }
  }

  async function clearHistory() {
    if (!window.confirm('Delete all of your saved conversations? This cannot be undone.')) return
    setSaving('clear-history')
    setMessage('')
    setError('')

    try {
      const token = await getFreshToken()
      const response = await fetch('/api/chat/conversations', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': token },
      })
      if (!response.ok) throw new Error('Unable to clear your chat history.')
      setMessage('Chat history cleared.')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSaving('')
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-gray-500">Loading settings...</div>
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-gray-500">Manage your preferences and account settings</p>
        </div>

        {(message || error) && (
          <p className={error ? 'text-sm text-red-600' : 'text-sm text-green-700'} role="status">
            {error || message}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>AI Assistant Preferences</CardTitle>
            <CardDescription>Configure how the AI assistant interacts with you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Response Detail Level</Label>
                <p className="text-sm text-gray-500">Choose how detailed AI responses should be</p>
              </div>
              <Select value={settings.response_detail} onValueChange={(value) => updateSetting('response_detail', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue>{responseLabels[settings.response_detail]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />
            <SettingSwitch label="Include Code Examples" description="Show code examples in technical responses" name="include_code_examples" settings={settings} saving={saving} onChange={updateSetting} />
            <Separator />
            <SettingSwitch label="Auto-load Course Context" description="Automatically include relevant course materials" name="auto_load_course_context" settings={settings} saving={saving} onChange={updateSetting} />
            <Separator />
            <SettingSwitch label="Show Related Topics" description="Suggest related topics after each response" name="show_related_topics" settings={settings} saving={saving} onChange={updateSetting} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>Manage how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SettingSwitch label="Email Notifications" description="Receive updates via email" name="email_notifications" settings={settings} saving={saving} onChange={updateSetting} />
            <Separator />
            <SettingSwitch label="New Material Alerts" description="Notify when new course materials are uploaded" name="new_material_alerts" settings={settings} saving={saving} onChange={updateSetting} />
            <Separator />
            <SettingSwitch label="Quiz Reminders" description="Get reminders for upcoming quizzes" name="quiz_reminders" settings={settings} saving={saving} onChange={updateSetting} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy &amp; Security</CardTitle>
            <CardDescription>Manage your privacy settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettingSwitch label="Save Chat History" description="Store conversation history for future reference" name="save_chat_history" settings={settings} saving={saving} onChange={updateSetting} />
            <Separator />
            <div className="space-y-2">
              <Label>Change Password</Label>
              <PasswordChangeForm />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Clear All Chat History</Label>
                <p className="text-sm text-gray-500">This will permanently delete all your conversations</p>
              </div>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={clearHistory} disabled={saving === 'clear-history'}>
                {saving === 'clear-history' ? 'Clearing...' : 'Clear History'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SettingSwitch({ label, description, name, settings, saving, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <Switch
        checked={settings[name]}
        disabled={saving === name}
        onCheckedChange={(value) => onChange(name, value)}
        aria-label={label}
      />
    </div>
  )
}
