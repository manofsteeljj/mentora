import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  FileText, Plus, Trash2, Download, Check, ArrowLeft,
  Sparkles, BookOpen, Clock, Target, Loader2, ChevronDown,
  ChevronUp, Save, Eye, EyeOff, RefreshCw,
} from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

// ── Grade levels & DepEd subjects ──────────────────────────────────────────────
const GRADE_LEVELS = [
  'Kindergarten',
  'Grade 1', 'Grade 2', 'Grade 3',
  'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
  'Grade 11', 'Grade 12',
]

const SUBJECTS = [
  'English', 'Filipino', 'Mathematics', 'Science',
  'Araling Panlipunan', 'Edukasyon sa Pagpapakatao (EsP)',
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
  'Technology and Livelihood Education (TLE)',
  'Music', 'Arts', 'Physical Education', 'Health (MAPEH)',
  'Mother Tongue', 'Edukasyong Pantahanan at Pangkabuhayan',
  'Applied and Specialized Subjects', 'Core Subjects',
]

const STRATEGIES = [
  '5E Model (Engage, Explore, Explain, Elaborate, Evaluate)',
  '4As (Activity, Analysis, Abstraction, Application)',
  'Direct Instruction',
  'Inquiry-Based Learning',
  'Cooperative Learning',
  'Problem-Based Learning',
  'Differentiated Instruction',
  'Flipped Classroom',
]

const DURATIONS = ['30 minutes', '45 minutes', '50 minutes', '60 minutes', '90 minutes']

const STATUS_COLORS = {
  draft:     'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved:  'bg-green-100  text-green-800  border-green-200',
  published: 'bg-blue-100   text-blue-800   border-blue-200',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

// ══════════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════════
export default function LessonPlanCreator() {
  const [view, setView]         = useState('list')      // list | form | editor
  const [plans, setPlans]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activePlan, setActivePlan] = useState(null)    // full plan object
  const [courses, setCourses]   = useState([])

  // Form state
  const [form, setForm] = useState({
    grade_level: '',
    subject: '',
    topic: '',
    duration: '60 minutes',
    learning_competency: '',
    teaching_strategy: '',
    available_resources: '',
    course_id: '',
  })

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lesson-plans', {
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
        credentials: 'same-origin',
      })
      if (res.ok) setPlans(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses', {
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
        credentials: 'same-origin',
      })
      if (res.ok) setCourses(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchPlans()
    fetchCourses()
  }, [fetchPlans, fetchCourses])

  // ── Generate ────────────────────────────────────────────────────────────────
  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!form.grade_level || !form.subject || !form.topic) {
      toast.error('Grade level, subject, and topic are required.')
      return
    }

    setGenerating(true)
    toast.loading('Generating lesson plan…', { id: 'gen' })

    try {
      const body = { ...form, course_id: form.course_id || null }
      const res  = await fetch('/api/lesson-plans/generate', {
        method:  'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
        credentials: 'same-origin',
        body:    JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Generation failed.', { id: 'gen' })
        return
      }

      toast.success('Lesson plan generated!', { id: 'gen' })
      setActivePlan(data)
      setView('editor')
      fetchPlans()
    } catch (err) {
      toast.error('Network error: ' + err.message, { id: 'gen' })
    } finally {
      setGenerating(false)
    }
  }

  // ── Load existing plan ──────────────────────────────────────────────────────
  const openPlan = async (id) => {
    toast.loading('Loading…', { id: 'open' })
    try {
      const res  = await fetch(`/api/lesson-plans/${id}`, {
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
        credentials: 'same-origin',
      })
      const data = await res.json()
      toast.dismiss('open')
      setActivePlan(data)
      setView('editor')
    } catch {
      toast.error('Could not load plan.', { id: 'open' })
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deletePlan = async (id) => {
    if (!confirm('Delete this lesson plan?')) return
    try {
      await fetch(`/api/lesson-plans/${id}`, {
        method:  'DELETE',
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
        credentials: 'same-origin',
      })
      toast.success('Deleted.')
      fetchPlans()
    } catch {
      toast.error('Delete failed.')
    }
  }

  // ── Export docx ─────────────────────────────────────────────────────────────
  const exportDocx = (id) => {
    window.location.href = `/api/lesson-plans/${id}/export-docx`
  }

  // ── FORM field helper ───────────────────────────────────────────────────────
  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // ════════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'editor' && activePlan) {
    return (
      <LessonPlanEditor
        plan={activePlan}
        onBack={() => { setView('list'); fetchPlans() }}
        onExport={() => exportDocx(activePlan.id)}
        onUpdate={(updated) => setActivePlan(updated)}
      />
    )
  }

  if (view === 'form') {
    return (
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" onClick={() => setView('list')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">New Lesson Plan</h1>
              <p className="text-sm text-gray-500">Fill in the details — Mentora AI will generate your DLL.</p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-5">
            {/* Row 1: grade + subject */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Grade Level *</Label>
                <Select value={form.grade_level} onValueChange={v => setField('grade_level', v)}>
                  <SelectTrigger><SelectValue placeholder="Select grade…" /></SelectTrigger>
                  <SelectContent>
                    {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Select value={form.subject} onValueChange={v => setField('subject', v)}>
                  <SelectTrigger><SelectValue placeholder="Select subject…" /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: topic */}
            <div className="space-y-1.5">
              <Label>Topic / Lesson Title *</Label>
              <Input
                value={form.topic}
                onChange={e => setField('topic', e.target.value)}
                placeholder="e.g. Addition of Dissimilar Fractions"
              />
            </div>

            {/* Row 3: duration + course */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select value={form.duration} onValueChange={v => setField('duration', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Course (optional)</Label>
                <Select value={form.course_id} onValueChange={v => setField('course_id', v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {courses.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.course_code} – {c.course_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: learning competency */}
            <div className="space-y-1.5">
              <Label>Learning Competency</Label>
              <Input
                value={form.learning_competency}
                onChange={e => setField('learning_competency', e.target.value)}
                placeholder="e.g. The learner adds and subtracts dissimilar fractions (M6NS-Ie-81)"
              />
            </div>

            {/* Row 5: teaching strategy */}
            <div className="space-y-1.5">
              <Label>Teaching Strategy</Label>
              <Select value={form.teaching_strategy} onValueChange={v => setField('teaching_strategy', v)}>
                <SelectTrigger><SelectValue placeholder="Let AI decide…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Let AI decide</SelectItem>
                  {STRATEGIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Row 6: available resources */}
            <div className="space-y-1.5">
              <Label>Available Resources</Label>
              <Input
                value={form.available_resources}
                onChange={e => setField('available_resources', e.target.value)}
                placeholder="e.g. textbook, whiteboard, printed activity sheets, laptop"
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={generating}
                className="w-full bg-green-700 hover:bg-green-800 text-white h-11 text-base"
              >
                {generating
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                  : <><Sparkles className="w-4 h-4 mr-2" />Generate Lesson Plan</>
                }
              </Button>
              <p className="text-xs text-center text-gray-400 mt-2">
                The AI will create a full DepEd DLL which you can edit before saving.
              </p>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-700" />
              Lesson Plans
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              AI-generated DepEd Daily Lesson Logs — edit, approve, and export.
            </p>
          </div>
          <Button
            onClick={() => setView('form')}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Lesson Plan
          </Button>
        </div>

        {/* Plans grid */}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />Loading…
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-14 text-center">
            <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No lesson plans yet</p>
            <p className="text-sm text-gray-400 mb-4">Click "New Lesson Plan" to generate your first DLL.</p>
            <Button onClick={() => setView('form')} className="bg-green-700 hover:bg-green-800 text-white">
              <Sparkles className="w-4 h-4 mr-2" />Create your first plan
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map(plan => (
              <div
                key={plan.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-sm transition-all"
              >
                <div className="p-4 flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate">{plan.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {plan.grade_level} · {plan.subject} · {plan.topic}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`text-xs border ${STATUS_COLORS[plan.status] || STATUS_COLORS.draft}`}>
                          {plan.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{plan.duration}
                      </span>
                      {plan.ai_model && (
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />{plan.ai_model}
                        </span>
                      )}
                      <span>{formatDate(plan.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openPlan(plan.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => exportDocx(plan.id)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deletePlan(plan.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Lesson Plan Editor — DLL-structured editable viewer
// ══════════════════════════════════════════════════════════════════════════════
function LessonPlanEditor({ plan: initialPlan, onBack, onExport, onUpdate }) {
  const [plan, setPlan]         = useState(initialPlan)
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)
  const [collapsed, setCollapsed] = useState({})

  const toggleSection = (key) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  const updateField = (path, value) => {
    setPlan(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      const parts = path.split('.')
      let obj = next
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]]
      obj[parts[parts.length - 1]] = value
      return next
    })
    setDirty(true)
  }

  // objectives helper
  const updateObjectiveItem = (group, idx, value) => {
    const next = JSON.parse(JSON.stringify(plan.objectives || { knowledge: [], skills: [], attitude: [] }))
    if (!next[group]) next[group] = []
    next[group][idx] = value
    setPlan(prev => ({ ...prev, objectives: next }))
    setDirty(true)
  }
  const addObjectiveItem = (group) => {
    const next = JSON.parse(JSON.stringify(plan.objectives || { knowledge: [], skills: [], attitude: [] }))
    if (!next[group]) next[group] = []
    next[group].push('')
    setPlan(prev => ({ ...prev, objectives: next }))
    setDirty(true)
  }
  const removeObjectiveItem = (group, idx) => {
    const next = JSON.parse(JSON.stringify(plan.objectives || {}))
    if (next[group]) next[group].splice(idx, 1)
    setPlan(prev => ({ ...prev, objectives: next }))
    setDirty(true)
  }

  // generic array field helpers
  const updateArrayItem = (field, idx, value) => {
    const arr = [...(plan[field] || [])]
    arr[idx] = value
    setPlan(prev => ({ ...prev, [field]: arr }))
    setDirty(true)
  }
  const addArrayItem = (field) => {
    const arr = [...(plan[field] || []), '']
    setPlan(prev => ({ ...prev, [field]: arr }))
    setDirty(true)
  }
  const removeArrayItem = (field, idx) => {
    const arr = [...(plan[field] || [])]
    arr.splice(idx, 1)
    setPlan(prev => ({ ...prev, [field]: arr }))
    setDirty(true)
  }

  // nested content arrays (content.references, etc.)
  const updateContentArray = (subField, idx, value) => {
    const cont = JSON.parse(JSON.stringify(plan.content || {}))
    if (!cont[subField]) cont[subField] = []
    cont[subField][idx] = value
    setPlan(prev => ({ ...prev, content: cont }))
    setDirty(true)
  }
  const addContentArrayItem = (subField) => {
    const cont = JSON.parse(JSON.stringify(plan.content || {}))
    if (!cont[subField]) cont[subField] = []
    cont[subField].push('')
    setPlan(prev => ({ ...prev, content: cont }))
    setDirty(true)
  }
  const removeContentArrayItem = (subField, idx) => {
    const cont = JSON.parse(JSON.stringify(plan.content || {}))
    if (cont[subField]) cont[subField].splice(idx, 1)
    setPlan(prev => ({ ...prev, content: cont }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/lesson-plans/${plan.id}`, {
        method:  'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
        credentials: 'same-origin',
        body: JSON.stringify({
          title:               plan.title,
          grade_level:         plan.grade_level,
          subject:             plan.subject,
          topic:               plan.topic,
          duration:            plan.duration,
          learning_competency: plan.learning_competency,
          objectives:          plan.objectives,
          content:             plan.content,
          learning_resources:  plan.learning_resources,
          procedures:          plan.procedures,
          remarks:             plan.remarks,
          reflection:          plan.reflection,
          status:              plan.status,
        }),
      })
      const updated = await res.json()
      setPlan(updated)
      setDirty(false)
      onUpdate?.(updated)
      toast.success('Saved!')
    } catch {
      toast.error('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    await fetch(`/api/lesson-plans/${plan.id}`, {
      method:  'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
      credentials: 'same-origin',
      body: JSON.stringify({ status: 'approved' }),
    })
    setPlan(prev => ({ ...prev, status: 'approved' }))
    toast.success('Lesson plan approved!')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const proc = plan.procedures || {}
  const obj  = plan.objectives  || { knowledge: [], skills: [], attitude: [] }
  const cont = plan.content     || { subject_matter: '', references: [], other_learning_resources: [] }
  const rem  = plan.remarks     || {}
  const ref  = plan.reflection  || {}

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <div className="flex-1 min-w-0">
          <input
            className="text-lg font-bold text-gray-900 bg-transparent border-none outline-none w-full truncate"
            value={plan.title || ''}
            onChange={e => updateField('title', e.target.value)}
          />
          <p className="text-xs text-gray-400">
            {plan.grade_level} · {plan.subject} · {plan.duration}
            {plan.ai_model && <> · <span className="text-green-600">{plan.ai_model}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
          <Badge className={`text-xs border ${STATUS_COLORS[plan.status] || STATUS_COLORS.draft}`}>
            {plan.status}
          </Badge>
          {plan.status === 'draft' && (
            <Button variant="outline" size="sm" onClick={handleApprove}>
              <Check className="w-4 h-4 mr-1" />Approve
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-1" />Export .docx
          </Button>
          <Button
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* ── DLL Body ────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto p-6 space-y-4">

        {/* Section I — Objectives */}
        <DllSection
          number="I"
          title="Objectives"
          icon={<Target className="w-4 h-4" />}
          collapsed={collapsed['obj']}
          onToggle={() => toggleSection('obj')}
        >
          <div className="space-y-4">
            {['knowledge', 'skills', 'attitude'].map(group => (
              <div key={group}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-600 capitalize">{group}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-green-700"
                    onClick={() => addObjectiveItem(group)}>
                    <Plus className="w-3 h-3 mr-0.5" />Add
                  </Button>
                </div>
                {(obj[group] || []).map((item, i) => (
                  <div key={i} className="flex gap-2 mb-1.5">
                    <span className="text-gray-400 text-sm mt-1.5 w-5 flex-shrink-0">{i + 1}.</span>
                    <Input
                      className="flex-1 h-8 text-sm"
                      value={item}
                      onChange={e => updateObjectiveItem(group, i, e.target.value)}
                      placeholder={`${group} objective…`}
                    />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400"
                      onClick={() => removeObjectiveItem(group, i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {(obj[group] || []).length === 0 && (
                  <p className="text-xs text-gray-400 italic">No {group} objectives yet.</p>
                )}
              </div>
            ))}
          </div>
        </DllSection>

        {/* Section II — Content */}
        <DllSection
          number="II"
          title="Content"
          icon={<BookOpen className="w-4 h-4" />}
          collapsed={collapsed['content']}
          onToggle={() => toggleSection('content')}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Subject Matter</Label>
              <Input
                value={cont.subject_matter || ''}
                onChange={e => updateField('content.subject_matter', e.target.value)}
                placeholder="Specific topic / subject matter…"
              />
            </div>
            <ArrayEditor
              label="References (textbook, module, page)"
              items={cont.references || []}
              onAdd={() => addContentArrayItem('references')}
              onChange={(i, v) => updateContentArray('references', i, v)}
              onRemove={(i) => removeContentArrayItem('references', i)}
              placeholder="e.g. Mathematics 6 LM p.45"
            />
            <ArrayEditor
              label="Other Learning Resources"
              items={cont.other_learning_resources || []}
              onAdd={() => addContentArrayItem('other_learning_resources')}
              onChange={(i, v) => updateContentArray('other_learning_resources', i, v)}
              placeholder="e.g. DepEd Module, YouTube video link"
            />
          </div>
        </DllSection>

        {/* Section III — Learning Resources */}
        <DllSection
          number="III"
          title="Learning Resources / Materials"
          icon={<FileText className="w-4 h-4" />}
          collapsed={collapsed['lr']}
          onToggle={() => toggleSection('lr')}
        >
          <ArrayEditor
            label="Materials needed"
            items={plan.learning_resources || []}
            onAdd={() => addArrayItem('learning_resources')}
            onChange={(i, v) => updateArrayItem('learning_resources', i, v)}
            onRemove={(i) => removeArrayItem('learning_resources', i)}
            placeholder="e.g. printed activity sheets, ruler, calculator"
          />
        </DllSection>

        {/* Section IV — Procedures */}
        <DllSection
          number="IV"
          title="Procedures"
          icon={<RefreshCw className="w-4 h-4" />}
          collapsed={collapsed['proc']}
          onToggle={() => toggleSection('proc')}
        >
          <div className="space-y-4">
            {[
              ['reviewing_past_lesson',    'A. Reviewing Previous Lesson / Presenting New Lesson', '~5 min'],
              ['establishing_purpose',     'B. Establishing Purpose for the Lesson', '~5 min'],
              ['presenting_examples',      'C. Presenting Examples / Instances of New Lesson', '~15 min'],
              ['discussing_concepts',      'D. Discussing New Concepts and Practising New Skills', '~10 min'],
              ['developing_mastery',       'E. Developing Mastery (Leads to Formative Assessment)', '~10 min'],
              ['finding_applications',     'F. Finding Practical Applications of Concepts and Skills', '~5 min'],
              ['making_generalizations',   'G. Making Generalizations and Abstractions about the Lesson', '~5 min'],
              ['evaluating_learning',      'H. Evaluating Learning', '~5 min'],
              ['additional_activities',    'I. Additional Activities for Application or Remediation', 'Optional'],
            ].map(([key, label, time]) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{time}</span>
                </div>
                <Textarea
                  className="text-sm min-h-[72px] resize-y"
                  value={proc[key] || ''}
                  onChange={e => updateField(`procedures.${key}`, e.target.value)}
                  placeholder={`Describe the ${label.toLowerCase()}…`}
                />
              </div>
            ))}
          </div>
        </DllSection>

        {/* Section V — Remarks */}
        <DllSection
          number="V"
          title="Remarks"
          icon={<FileText className="w-4 h-4" />}
          collapsed={collapsed['rem']}
          onToggle={() => toggleSection('rem')}
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              ['no_of_learners_earned_80',                'No. of learners who earned 80%'],
              ['no_of_learners_for_remediation',          'No. of learners who need remediation'],
              ['did_remedial_work',                       'Did the remedial lessons work?'],
              ['no_of_learners_caught_up',                'No. of learners caught up'],
              ['no_of_learners_continuing_remediation',   'No. continuing remediation'],
              ['strategies_used',                         'Strategies / activities used'],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-gray-500">{label}</Label>
                <Input
                  className="h-8 text-sm"
                  value={rem[key] || ''}
                  onChange={e => {
                    const next = { ...rem, [key]: e.target.value }
                    setPlan(prev => ({ ...prev, remarks: next }))
                    setDirty(true)
                  }}
                />
              </div>
            ))}
          </div>
        </DllSection>

        {/* Section VI — Reflection */}
        <DllSection
          number="VI"
          title="Reflection"
          icon={<Sparkles className="w-4 h-4" />}
          collapsed={collapsed['refl']}
          onToggle={() => toggleSection('refl')}
        >
          <div className="space-y-3">
            {[
              ['what_worked_well',         'What worked well?'],
              ['challenges_encountered',   'Challenges encountered?'],
              ['innovations_used',         'Innovations / strategies used?'],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-sm text-gray-600">{label}</Label>
                <Textarea
                  className="text-sm min-h-[60px] resize-y"
                  value={ref[key] || ''}
                  onChange={e => {
                    const next = { ...ref, [key]: e.target.value }
                    setPlan(prev => ({ ...prev, reflection: next }))
                    setDirty(true)
                  }}
                />
              </div>
            ))}
          </div>
        </DllSection>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-2 pb-6">
          Generated by Mentora AI · {plan.ai_model || 'AI model'}
        </div>
      </div>
    </div>
  )
}

// ── DLL Section wrapper ────────────────────────────────────────────────────────
function DllSection({ number, title, icon, collapsed, onToggle, children }) {
  return (
    <Card className="border border-gray-200 shadow-none">
      <CardHeader
        className="px-5 py-3 cursor-pointer flex flex-row items-center gap-2 select-none"
        onClick={onToggle}
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-700 text-white text-xs font-bold flex-shrink-0">
          {number}
        </div>
        <div className="flex items-center gap-1.5 text-green-800 flex-1">
          {icon}
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-gray-400" />
          : <ChevronUp   className="w-4 h-4 text-gray-400" />
        }
      </CardHeader>
      {!collapsed && (
        <CardContent className="px-5 pb-5 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}

// ── Reusable array editor ─────────────────────────────────────────────────────
function ArrayEditor({ label, items, onAdd, onChange, onRemove, placeholder = '' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-sm">{label}</Label>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-green-700" onClick={onAdd}>
          <Plus className="w-3 h-3 mr-0.5" />Add
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 mb-1.5">
          <span className="text-gray-400 text-sm mt-1.5 w-5 flex-shrink-0">{i + 1}.</span>
          <Input
            className="flex-1 h-8 text-sm"
            value={item}
            onChange={e => onChange(i, e.target.value)}
            placeholder={placeholder}
          />
          {onRemove && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400" onClick={() => onRemove(i)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-gray-400 italic">None added yet.</p>}
    </div>
  )
}
