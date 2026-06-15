import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  User, Search, Filter, Download, Mail, BookOpen, Building2,
  Phone, Calendar, ChevronDown, ChevronUp, GraduationCap,
  Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from './ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

// ─── Pending Approvals Tab ────────────────────────────────────────────────────
function PendingApprovals({ pendingCount, onCountChange }) {
  const [pending, setPending]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [rejectDialog, setRejectDialog] = useState(null) // { id, name }
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing]   = useState(null)   // id being processed

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/faculty/pending', {
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        const list = Array.isArray(data?.pending) ? data.pending : []
        setPending(list)
        onCountChange?.(list.length)
      })
      .catch(() => toast.error('Failed to load pending registrations'))
      .finally(() => setLoading(false))
  }, [onCountChange])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id, name) => {
    setProcessing(id)
    try {
      const r = await fetch(`/api/admin/faculty/${id}/approve`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      if (!r.ok) throw new Error()
      toast.success(`${name} has been approved and can now log in.`)
      load()
    } catch {
      toast.error('Approval failed. Please try again.')
    } finally {
      setProcessing(null)
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectDialog) return
    setProcessing(rejectDialog.id)
    try {
      const r = await fetch(`/api/admin/faculty/${rejectDialog.id}/reject`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (!r.ok) throw new Error()
      toast.success(`${rejectDialog.name}'s registration has been rejected.`)
      setRejectDialog(null)
      setRejectReason('')
      load()
    } catch {
      toast.error('Rejection failed. Please try again.')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (pending.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="font-medium text-gray-700">No pending registrations</p>
          <p className="text-sm text-gray-400 mt-1">All teacher accounts have been reviewed.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {pending.map(member => (
          <Card key={member.id} className="border-amber-200">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  {member.avatar
                    ? <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full object-cover" />
                    : <User className="w-6 h-6 text-amber-600" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{member.name}</p>
                  <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 shrink-0" />
                    {member.email}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    Registered {member.registered
                      ? new Date(member.registered).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                      : 'recently'}
                  </p>
                </div>

                {/* Status badge */}
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 shrink-0">
                  Pending
                </Badge>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-700 hover:bg-green-800 gap-1"
                    disabled={processing === member.id}
                    onClick={() => handleApprove(member.id, member.name)}
                  >
                    {processing === member.id
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : <CheckCircle2 className="w-3 h-3" />
                    }
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50 gap-1"
                    disabled={processing === member.id}
                    onClick={() => { setRejectDialog({ id: member.id, name: member.name }); setRejectReason('') }}
                  >
                    <XCircle className="w-3 h-3" />
                    Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reject confirmation dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={open => { if (!open) { setRejectDialog(null); setRejectReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Reject Registration
            </DialogTitle>
            <DialogDescription>
              You are about to reject <strong>{rejectDialog?.name}</strong>'s registration.
              They will be notified on their next login attempt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Reason (optional)</label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Duplicate account, unrecognised email domain…"
              rows={3}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason('') }}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={processing === rejectDialog?.id}
              onClick={handleRejectConfirm}
            >
              {processing === rejectDialog?.id
                ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Rejecting…</>
                : 'Confirm Rejection'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminFaculty() {
  const [faculty, setFaculty]                   = useState([])
  const [loading, setLoading]                   = useState(true)
  const [searchQuery, setSearchQuery]           = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments')
  const [selectedPosition, setSelectedPosition] = useState('All Positions')
  const [expandedFaculty, setExpandedFaculty]   = useState(null)
  const [pendingCount, setPendingCount]         = useState(0)
  const [activeTab, setActiveTab]               = useState('faculty')

  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/faculty', {
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => null)
          throw new Error(d?.message || 'Failed to load faculty')
        }
        return r.json()
      })
      .then(data => setFaculty(Array.isArray(data?.faculty) ? data.faculty : []))
      .catch(err => { toast.error(err?.message || 'Unable to load faculty'); setFaculty([]) })
      .finally(() => setLoading(false))

    // Also fetch pending count for the badge
    fetch('/api/admin/faculty/pending', {
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : { pending: [] })
      .then(data => setPendingCount(Array.isArray(data?.pending) ? data.pending.length : 0))
      .catch(() => {})
  }, [])

  const departments = useMemo(
    () => ['All Departments', ...Array.from(new Set(faculty.map(f => f.department).filter(Boolean)))],
    [faculty]
  )
  const positions = useMemo(
    () => ['All Positions', ...Array.from(new Set(faculty.map(f => f.position).filter(Boolean)))],
    [faculty]
  )

  const filteredFaculty = useMemo(() =>
    faculty.filter(member => {
      const q = searchQuery.toLowerCase()
      const matchesSearch = !searchQuery
        || String(member.name || '').toLowerCase().includes(q)
        || String(member.employeeId || '').toLowerCase().includes(q)
        || String(member.email || '').toLowerCase().includes(q)
        || (Array.isArray(member.courses) && member.courses.some(c => String(c).toLowerCase().includes(q)))
      const matchesDept = selectedDepartment === 'All Departments' || member.department === selectedDepartment
      const matchesPos  = selectedPosition   === 'All Positions'   || member.position   === selectedPosition
      return matchesSearch && matchesDept && matchesPos
    }),
    [faculty, searchQuery, selectedDepartment, selectedPosition]
  )

  const handleExport = () => {
    const rows = filteredFaculty.map(f => ({
      'Employee ID':    f.employeeId,
      'Name':           f.name,
      'Email':          f.email,
      'Department':     f.department,
      'Position':       f.position,
      'Courses':        Array.isArray(f.courses) ? f.courses.join(', ') : '',
      'Total Students': f.totalStudents,
      'Join Date':      f.joinDate,
      'Status':         f.status,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Faculty')
    XLSX.writeFile(wb, 'faculty_members.xlsx')
    toast.success('Faculty data exported!')
  }

  const totalFaculty      = faculty.length
  const activeFaculty     = faculty.filter(f => f.status === 'Active').length
  const totalCourses      = faculty.reduce((s, f) => s + (Array.isArray(f.courses) ? f.courses.length : 0), 0)
  const totalStudents     = faculty.reduce((s, f) => s + (Number(f.totalStudents) || 0), 0)

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-1">Faculty Members</h1>
            <p className="text-gray-600 text-sm">Manage teacher accounts and approve new registrations</p>
          </div>
          <Button onClick={handleExport} className="bg-green-700 hover:bg-green-800" disabled={loading || filteredFaculty.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export to Excel
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-blue-700" /> Total Faculty
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-700">{totalFaculty}</div></CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-700" /> Active
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-700">{activeFaculty}</div></CardContent>
          </Card>
          <Card className={`${pendingCount > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 ${pendingCount > 0 ? 'text-amber-800' : 'text-gray-600'}`}>
                <Clock className={`w-4 h-4 ${pendingCount > 0 ? 'text-amber-600' : 'text-gray-400'}`} /> Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>{pendingCount}</div>
              {pendingCount > 0 && (
                <button
                  onClick={() => setActiveTab('pending')}
                  className="text-xs text-amber-700 underline mt-0.5 hover:text-amber-900"
                >
                  Review now →
                </button>
              )}
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-700" /> Students Served
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-purple-700">{totalStudents}</div></CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="faculty">
              Faculty Directory
            </TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pending Approvals
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Faculty directory tab ── */}
          <TabsContent value="faculty">
            {/* Filters */}
            <Card className="mb-5">
              <CardContent className="pt-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search name, ID, email, course…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={selectedDepartment}
                      onChange={e => setSelectedDepartment(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    >
                      {departments.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={selectedPosition}
                      onChange={e => setSelectedPosition(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    >
                      {positions.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Faculty list */}
            <div className="space-y-4">
              {loading ? (
                <Card><CardContent className="pt-6 text-center py-12 text-gray-400">Loading faculty members…</CardContent></Card>
              ) : filteredFaculty.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center py-12">
                    <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">No faculty members found.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredFaculty.map(member => (
                  <Card key={member.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                              <User className="w-7 h-7 text-blue-700" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                              <p className="text-sm text-gray-500">{member.employeeId}</p>
                              <Badge className="mt-1 bg-green-100 text-green-800">{member.position}</Badge>
                            </div>
                          </div>

                          <div className="ml-18 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm pl-18" style={{ paddingLeft: '4.5rem' }}>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="text-gray-600 truncate">{member.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="text-gray-600">{member.department}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="text-gray-600">
                                Joined {member.joinDate
                                  ? new Date(member.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {expandedFaculty === member.id && (
                            <div className="mt-4 pt-4 border-t border-gray-100" style={{ paddingLeft: '4.5rem' }}>
                              <p className="font-medium text-sm mb-2 flex items-center gap-2 text-gray-700">
                                <BookOpen className="w-4 h-4" /> Courses Teaching
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {(member.courses || []).map((c, i) => (
                                  <Badge key={i} variant="outline">{c}</Badge>
                                ))}
                                {(member.courses || []).length === 0 && (
                                  <p className="text-sm text-gray-400">No courses assigned</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-3 shrink-0 ml-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-700">{member.totalStudents}</div>
                            <div className="text-xs text-gray-400">Students</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-700">{(member.courses || []).length}</div>
                            <div className="text-xs text-gray-400">Courses</div>
                          </div>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => setExpandedFaculty(expandedFaculty === member.id ? null : member.id)}
                          >
                            {expandedFaculty === member.id
                              ? <><ChevronUp className="w-4 h-4 mr-1" />Less</>
                              : <><ChevronDown className="w-4 h-4 mr-1" />More</>
                            }
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* ── Pending approvals tab ── */}
          <TabsContent value="pending">
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Pending Teacher Registrations</p>
                <p className="text-amber-700 mt-0.5">
                  These accounts were created via the registration form and are waiting for your review.
                  Approved teachers can log in immediately. Rejected accounts will see an error message at login.
                </p>
              </div>
            </div>

            <PendingApprovals
              pendingCount={pendingCount}
              onCountChange={setPendingCount}
            />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  )
}
