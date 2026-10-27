import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  NotebookPen, Search, RefreshCw, CheckCircle2, XCircle, Edit3,
  Clock, AlertTriangle, User, Loader2, Eye, MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from './ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import OnlyOfficeEditor from './OnlyOfficeEditor'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export const LESSON_PLAN_STATUS = {
  pending:        { label: 'Pending Review', colors: 'bg-blue-100 text-blue-800 border-blue-200' },
  approved:       { label: 'Approved',       colors: 'bg-green-100 text-green-800 border-green-200' },
  denied:         { label: 'Denied',         colors: 'bg-red-100 text-red-800 border-red-200' },
  needs_revision: { label: 'Needs Revision', colors: 'bg-amber-100 text-amber-800 border-amber-200' },
}

function StatusBadge({ status }) {
  const meta = LESSON_PLAN_STATUS[status] || { label: status, colors: 'bg-gray-100 text-gray-800 border-gray-200' }
  return <Badge className={`text-xs border ${meta.colors}`}>{meta.label}</Badge>
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Review dialog (deny / request revision) ─────────────────────────────────
function ReviewDialog({ dialog, onClose, onConfirm, processing }) {
  const isDeny = dialog?.action === 'deny'

  return (
    <Dialog open={!!dialog} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDeny
              ? <><XCircle className="w-5 h-5 text-red-500" /> Deny Lesson Plan</>
              : <><Edit3 className="w-5 h-5 text-amber-500" /> Request Revision</>
            }
          </DialogTitle>
          <DialogDescription>
            {isDeny ? 'Denying' : 'Requesting revision of'} <strong>{dialog?.plan?.title}</strong>
            {' '}by {dialog?.plan?.teacher?.name}.
            {isDeny
              ? ' The teacher will be able to edit and resubmit it.'
              : ' The teacher will see your notes and can resubmit an updated version.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Feedback for the teacher {isDeny ? '(optional)' : '(recommended)'}
          </label>
          <textarea
            value={dialog?.feedback || ''}
            onChange={e => dialog && onConfirm(undefined, e.target.value)}
            placeholder={isDeny
              ? 'e.g. Competency does not match the grade level…'
              : 'e.g. Please align Session 3 activities with the learning competency…'}
            rows={4}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className={isDeny ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}
            disabled={processing}
            onClick={() => onConfirm(true)}
          >
            {processing
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
              : isDeny ? 'Confirm Denial' : 'Send Revision Request'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Plan row ────────────────────────────────────────────────────────────────
function PlanRow({ plan, processing, onApprove, onDeny, onRequestRevision, onView }) {
  const isPending = plan.status === 'pending'

  return (
    <Card className={`${isPending ? 'border-blue-200' : ''} hover:shadow-md transition-shadow`}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <NotebookPen className="w-5 h-5 text-green-700" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{plan.title}</h3>
                <p className="text-sm text-gray-500 truncate">
                  {plan.grade_level} · {plan.subject} · {plan.topic}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {plan.teacher?.name}
                  <span className="mx-1">·</span>
                  Submitted {formatDate(plan.submitted_at || plan.created_at)}
                </p>
              </div>
              <StatusBadge status={plan.status} />
            </div>

            {plan.admin_feedback && (
              <div className="mt-2 p-2 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-start gap-2">
                <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                <span><span className="font-medium">Feedback:</span> {plan.admin_feedback}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="ghost" size="sm" title="Open in ONLYOFFICE" onClick={() => onView(plan)}>
              <Eye className="w-4 h-4" />
            </Button>

            {isPending && (
              <>
                <Button
                  size="sm"
                  className="bg-green-700 hover:bg-green-800 gap-1"
                  disabled={processing === plan.id}
                  onClick={() => onApprove(plan)}
                >
                  {processing === plan.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <CheckCircle2 className="w-3 h-3" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1"
                  disabled={processing === plan.id}
                  onClick={() => onRequestRevision(plan)}
                >
                  <Edit3 className="w-3 h-3" />
                  Request Revision
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 gap-1"
                  disabled={processing === plan.id}
                  onClick={() => onDeny(plan)}
                >
                  <XCircle className="w-3 h-3" />
                  Deny
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminLessonPlans({ onPendingCountChange }) {
  const [plans, setPlans]           = useState([])
  const [counts, setCounts]         = useState({ total: 0, pending: 0, approved: 0, denied: 0, revision: 0 })
  const [loading, setLoading]       = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab]   = useState('pending')
  const [statusFilter, setStatusFilter] = useState('all')
  const [processing, setProcessing] = useState(null)   // plan id being reviewed
  const [reviewDialog, setReviewDialog] = useState(null) // { action, plan, feedback }
  const [viewerPlan, setViewerPlan] = useState(null)   // plan open in the ONLYOFFICE review view

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/lesson-plans?status=all', {
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        const list = Array.isArray(data?.plans) ? data.plans : []
        setPlans(list)
        setCounts(data?.counts || counts)
        onPendingCountChange?.(data?.counts?.pending || 0)
      })
      .catch(() => toast.error('Failed to load lesson plans'))
      .finally(() => setLoading(false))
  }, [onPendingCountChange])

  useEffect(() => { load() }, [load])

  const handleApprove = async (plan) => {
    setProcessing(plan.id)
    try {
      const r = await fetch(`/api/admin/lesson-plans/${plan.id}/approve`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      if (!r.ok) throw new Error()
      toast.success(`"${plan.title}" has been approved.`)
      setViewerPlan(null)
      load()
    } catch {
      toast.error('Approval failed. Please try again.')
    } finally {
      setProcessing(null)
    }
  }

  // confirm=true submits; otherwise it's just a feedback text update
  const handleReviewConfirm = async (confirm, feedback) => {
    if (!reviewDialog) return
    if (!confirm) {
      setReviewDialog(prev => ({ ...prev, feedback }))
      return
    }

    const { action, plan } = reviewDialog
    setProcessing(plan.id)
    try {
      const r = await fetch(`/api/admin/lesson-plans/${plan.id}/${action === 'deny' ? 'deny' : 'request-revision'}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
        body: JSON.stringify({ feedback: reviewDialog.feedback || '' }),
      })
      if (!r.ok) throw new Error()
      toast.success(
        action === 'deny'
          ? `"${plan.title}" has been denied.`
          : `Revision requested for "${plan.title}".`
      )
      setReviewDialog(null)
      setViewerPlan(null)
      load()
    } catch {
      toast.error('Action failed. Please try again.')
    } finally {
      setProcessing(null)
    }
  }

  const filteredPlans = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return plans.filter(plan => {
      if (activeTab === 'pending' && plan.status !== 'pending') return false
      if (activeTab === 'all' && statusFilter !== 'all' && plan.status !== statusFilter) return false
      if (!searchQuery) return true
      return (
        String(plan.title || '').toLowerCase().includes(q)
        || String(plan.topic || '').toLowerCase().includes(q)
        || String(plan.subject || '').toLowerCase().includes(q)
        || String(plan.teacher?.name || '').toLowerCase().includes(q)
        || String(plan.teacher?.email || '').toLowerCase().includes(q)
      )
    })
  }, [plans, searchQuery, activeTab, statusFilter])

  const stats = [
    { label: 'Pending Review',  value: counts.pending,  icon: Clock,         classes: 'border-amber-200 bg-amber-50', valueClass: 'text-amber-700', iconClass: 'text-amber-600' },
    { label: 'Approved',        value: counts.approved, icon: CheckCircle2,  classes: 'border-green-200 bg-green-50',  valueClass: 'text-green-700',  iconClass: 'text-green-700' },
    { label: 'Needs Revision',  value: counts.revision, icon: Edit3,         classes: 'border-blue-200 bg-blue-50',   valueClass: 'text-blue-700',   iconClass: 'text-blue-700' },
    { label: 'Denied',          value: counts.denied,   icon: XCircle,       classes: 'border-red-200 bg-red-50',     valueClass: 'text-red-700',    iconClass: 'text-red-500' },
  ]

  // ── ONLYOFFICE review view (View button) ───────────────────────────────────
  // Read-only document + comments sidebar + the review actions in the toolbar.
  if (viewerPlan) {
    const isPending = viewerPlan.status === 'pending'
    return (
      <>
        <OnlyOfficeEditor
          documentType="lesson-plan"
          documentId={viewerPlan.id}
          title={viewerPlan.title}
          plan={viewerPlan}
          editorMode="view"
          showChatSidebar={false}
          showCommentsSidebar
          onBack={() => { setViewerPlan(null); load() }}
          toolbarExtra={isPending ? (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-800 gap-1"
                disabled={processing === viewerPlan.id}
                onClick={() => handleApprove(viewerPlan)}
              >
                {processing === viewerPlan.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1"
                disabled={processing === viewerPlan.id}
                onClick={() => setReviewDialog({ action: 'request-revision', plan: viewerPlan, feedback: '' })}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Request Revision
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50 gap-1"
                disabled={processing === viewerPlan.id}
                onClick={() => setReviewDialog({ action: 'deny', plan: viewerPlan, feedback: '' })}
              >
                <XCircle className="w-3.5 h-3.5" />
                Deny
              </Button>
            </div>
          ) : null}
        />

        <ReviewDialog
          dialog={reviewDialog}
          onClose={() => setReviewDialog(null)}
          onConfirm={handleReviewConfirm}
          processing={processing === reviewDialog?.plan?.id}
        />
      </>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-1">Lesson Plan Review</h1>
            <p className="text-gray-600 text-sm">Approve, deny, or request revisions on teacher-submitted lesson plans</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map(s => (
            <Card key={s.label} className={s.classes}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-medium flex items-center gap-2 ${s.iconClass}`}>
                  <s.icon className="w-4 h-4" /> {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${s.valueClass}`}>{s.value}</div>
                {s.label === 'Pending Review' && counts.pending > 0 && (
                  <button
                    onClick={() => setActiveTab('pending')}
                    className="text-xs text-amber-700 underline mt-0.5 hover:text-amber-900"
                  >
                    Review now →
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending" className="relative">
              Pending Review
              {counts.pending > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {counts.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All Lesson Plans ({counts.total})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {counts.pending > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Lesson plans awaiting your review</p>
                  <p className="text-amber-700 mt-0.5">
                    Newly generated lesson plans from teachers appear here. Approved plans are
                    final; denied or revision-requested plans can be updated and resubmitted by the teacher.
                  </p>
                </div>
              </div>
            )}
            <PlanList
              plans={filteredPlans}
              loading={loading}
              processing={processing}
              onApprove={handleApprove}
              onDeny={plan => setReviewDialog({ action: 'deny', plan, feedback: '' })}
              onRequestRevision={plan => setReviewDialog({ action: 'request-revision', plan, feedback: '' })}
              onView={setViewerPlan}
              emptyTitle="No lesson plans awaiting review"
              emptyText="Newly generated teacher lesson plans will appear here."
            />
          </TabsContent>

          <TabsContent value="all">
            <Card className="mb-5">
              <CardContent className="pt-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search title, teacher, subject…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="needs_revision">Needs Revision</option>
                    <option value="denied">Denied</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <PlanList
              plans={filteredPlans}
              loading={loading}
              processing={processing}
              onApprove={handleApprove}
              onDeny={plan => setReviewDialog({ action: 'deny', plan, feedback: '' })}
              onRequestRevision={plan => setReviewDialog({ action: 'request-revision', plan, feedback: '' })}
              onView={setViewerPlan}
              emptyTitle="No lesson plans found"
              emptyText="Try a different search or filter."
            />
          </TabsContent>
        </Tabs>
      </div>

      <ReviewDialog
        dialog={reviewDialog}
        onClose={() => setReviewDialog(null)}
        onConfirm={handleReviewConfirm}
        processing={processing === reviewDialog?.plan?.id}
      />
    </div>
  )
}

// ─── Shared list with empty state ────────────────────────────────────────────
function PlanList({ plans, loading, processing, onApprove, onDeny, onRequestRevision, onView, emptyTitle, emptyText }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <NotebookPen className="w-8 h-8 text-green-600" />
          </div>
          <p className="font-medium text-gray-700">{emptyTitle}</p>
          <p className="text-sm text-gray-400 mt-1">{emptyText}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {plans.map(plan => (
        <PlanRow
          key={plan.id}
          plan={plan}
          processing={processing}
          onApprove={onApprove}
          onDeny={onDeny}
          onRequestRevision={onRequestRevision}
          onView={onView}
        />
      ))}
    </div>
  )
}
