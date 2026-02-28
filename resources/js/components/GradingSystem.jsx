import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import {
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  User,
  TrendingUp,
  Eye,
  Save,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Inbox,
  ArrowUpDown,
} from 'lucide-react'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function GradingSystem() {
  const [submissions, setSubmissions] = useState([])
  const [stats, setStats] = useState({ total: 0, graded: 0, pending: 0, late: 0, returned: 0 })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [editingScore, setEditingScore] = useState(null)
  const [editingFeedback, setEditingFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCourse, setFilterCourse] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  // Fetch submissions from the API
  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/grading/submissions', {
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('Failed to load submissions')
      const data = await res.json()
      setSubmissions(data.submissions || [])
      setStats(data.stats || { total: 0, graded: 0, pending: 0, late: 0, returned: 0 })
      setError(null)
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Trigger Google Classroom sync then refresh local data
  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      await fetch('/api/google/classroom/sync', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      await fetchSubmissions()
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      setSyncing(false)
    }
  }, [fetchSubmissions])

  // Initial load: sync then fetch
  useEffect(() => {
    handleSync()
  }, [])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      handleSync()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [handleSync])

  // Derived data
  const courses = [...new Set(submissions.map(s => s.course?.course_code).filter(Boolean))]

  const filteredSubmissions = submissions.filter(s => {
    if (filterStatus === 'pending' && s.state !== 'TURNED_IN') return false
    if (filterStatus === 'graded' && !(s.assigned_grade !== null && s.assigned_grade !== undefined)) return false
    if (filterStatus === 'late' && !s.late) return false
    if (filterStatus === 'returned' && s.state !== 'RETURNED') return false
    if (filterCourse !== 'all' && s.course?.course_code !== filterCourse) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.submitted_at || b.created_at || 0) - new Date(a.submitted_at || a.created_at || 0)
    if (sortBy === 'oldest') return new Date(a.submitted_at || a.created_at || 0) - new Date(b.submitted_at || b.created_at || 0)
    if (sortBy === 'name') return (a.student?.name || '').localeCompare(b.student?.name || '')
    return 0
  })

  const averageScore = (() => {
    const graded = submissions.filter(s => s.assigned_grade !== null && s.assigned_grade !== undefined)
    if (graded.length === 0) return 0
    const total = graded.reduce((sum, s) => sum + Number(s.assigned_grade), 0)
    return total / graded.length
  })()

  const handleGradeSubmission = (sub) => {
    setSelectedSubmission(sub)
    setEditingScore(sub.assigned_grade ?? sub.draft_grade ?? '')
    setEditingFeedback(sub.feedback || '')
  }

  const handleSaveGrade = async () => {
    if (!selectedSubmission) return
    setSaving(true)
    try {
      const res = await fetch(`/api/grading/submissions/${selectedSubmission.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getToken(),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          assigned_grade: editingScore !== '' ? Number(editingScore) : null,
          feedback: editingFeedback || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save grade')

      setSubmissions(prev =>
        prev.map(s =>
          s.id === selectedSubmission.id
            ? { ...s, assigned_grade: editingScore !== '' ? Number(editingScore) : null, feedback: editingFeedback }
            : s
        )
      )
      setSelectedSubmission(null)
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to save grade. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getStateDisplay = (sub) => {
    if (sub.assigned_grade !== null && sub.assigned_grade !== undefined) return 'graded'
    if (sub.late) return 'late'
    if (sub.state === 'TURNED_IN') return 'pending'
    if (sub.state === 'RETURNED') return 'returned'
    if (sub.state === 'CREATED' || sub.state === 'NEW') return 'not submitted'
    return sub.state?.toLowerCase() || 'unknown'
  }

  const getStatusColor = (display) => {
    switch (display) {
      case 'graded': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'late': return 'bg-red-100 text-red-800'
      case 'returned': return 'bg-blue-100 text-blue-800'
      case 'not submitted': return 'bg-gray-100 text-gray-600'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (display) => {
    switch (display) {
      case 'graded': return <CheckCircle className="w-4 h-4" />
      case 'pending': return <Clock className="w-4 h-4" />
      case 'late': return <AlertTriangle className="w-4 h-4" />
      case 'returned': return <ArrowUpDown className="w-4 h-4" />
      default: return <XCircle className="w-4 h-4" />
    }
  }

  const formatDate = (iso) => {
    if (!iso) return '\u2014'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-green-700 mx-auto mb-3" />
          <p className="text-gray-600">Loading submissions from Google Classroom...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Grading System</h1>
            <p className="text-gray-600">Review and grade student submissions from Google Classroom</p>
          </div>
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="bg-green-700 hover:bg-green-800"
          >
            {syncing
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing...</>
              : <><RefreshCw className="w-4 h-4 mr-2" />Sync Now</>
            }
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Graded
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.graded}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Late
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.late}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {averageScore > 0 ? averageScore.toFixed(1) : '\u2014'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-2">
            {[
              { key: 'all', label: `All (${stats.total})` },
              { key: 'pending', label: `Pending (${stats.pending})` },
              { key: 'graded', label: `Graded (${stats.graded})` },
              { key: 'late', label: `Late (${stats.late})` },
              { key: 'returned', label: `Returned (${stats.returned})` },
            ].map(f => (
              <Button
                key={f.key}
                variant={filterStatus === f.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(f.key)}
                className={filterStatus === f.key ? 'bg-green-700 hover:bg-green-800' : ''}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {courses.length > 1 && (
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm bg-white"
            >
              <option value="all">All Courses</option>
              {courses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-white ml-auto"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">By Student Name</option>
          </select>
        </div>

        {/* Empty State */}
        {filteredSubmissions.length === 0 && !loading && (
          <Card className="py-16">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Inbox className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {submissions.length === 0
                  ? 'No submissions yet'
                  : 'No submissions match your filters'
                }
              </h3>
              <p className="text-gray-500 mb-6 max-w-md">
                {submissions.length === 0
                  ? 'Submissions will appear here once students submit their coursework in Google Classroom. Click "Sync Now" to fetch the latest data.'
                  : 'Try adjusting your filters to see more submissions.'
                }
              </p>
              {submissions.length === 0 && (
                <Button onClick={handleSync} disabled={syncing} className="bg-green-700 hover:bg-green-800">
                  {syncing
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing...</>
                    : <><RefreshCw className="w-4 h-4 mr-2" />Sync Now</>
                  }
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submissions List */}
        <div className="grid gap-4">
          {filteredSubmissions.map((sub) => {
            const display = getStateDisplay(sub)
            const maxPts = sub.assessment?.max_points || 100
            return (
              <Card key={sub.id} className={sub.late ? 'border-red-200' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-lg">{sub.assessment?.title || 'Untitled Assignment'}</CardTitle>
                        <Badge className={getStatusColor(display)}>
                          {getStatusIcon(display)}
                          <span className="ml-1 capitalize">{display}</span>
                        </Badge>
                        {sub.late && display !== 'late' && (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Late
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {sub.student?.name || 'Unknown'}
                          {sub.student?.email && <span className="text-gray-400 ml-1">({sub.student.email})</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {sub.course?.course_code} {'\u2014'} {sub.course?.course_name}
                        </div>
                        {sub.submitted_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(sub.submitted_at)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGradeSubmission(sub)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {display === 'graded' ? 'View' : 'Grade'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 border">
                      <div className="text-sm text-gray-600 mb-2">Score</div>
                      {sub.assigned_grade !== null && sub.assigned_grade !== undefined ? (
                        <div className="text-2xl font-bold text-green-700">
                          {Number(sub.assigned_grade).toFixed(1)}/{maxPts}
                        </div>
                      ) : sub.draft_grade !== null && sub.draft_grade !== undefined ? (
                        <div>
                          <div className="text-2xl font-bold text-yellow-600">
                            {Number(sub.draft_grade).toFixed(1)}/{maxPts}
                          </div>
                          <span className="text-xs text-yellow-600">Draft</span>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Not graded yet</div>
                      )}
                    </div>

                    <div className="bg-white rounded-lg p-4 border">
                      <div className="text-sm text-gray-600 mb-2">Status</div>
                      <div className="text-lg font-semibold capitalize">
                        {sub.state?.replace(/_/g, ' ').toLowerCase() || '\u2014'}
                      </div>
                      {sub.assessment?.due_date && (
                        <div className="text-xs text-gray-500 mt-1">
                          Due: {formatDate(sub.assessment.due_date)}
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-lg p-4 border">
                      <div className="text-sm text-gray-600 mb-2">Feedback</div>
                      {sub.feedback ? (
                        <p className="text-sm text-gray-700 line-clamp-3">{sub.feedback}</p>
                      ) : (
                        <div className="text-sm text-gray-500">No feedback yet</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Grading Modal */}
        {selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl mb-2">
                      {selectedSubmission.assessment?.title || 'Untitled'}
                    </CardTitle>
                    <CardDescription>
                      {selectedSubmission.student?.name || 'Unknown Student'}
                      {selectedSubmission.student?.email && ` (${selectedSubmission.student.email})`}
                      {' \u2022 '}
                      {selectedSubmission.course?.course_code} {'\u2014'} {selectedSubmission.course?.course_name}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(null)}>
                    <XCircle className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <div className="font-semibold capitalize">
                      {selectedSubmission.state?.replace(/_/g, ' ').toLowerCase() || '\u2014'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Max Points</div>
                    <div className="font-semibold">
                      {selectedSubmission.assessment?.max_points || '\u2014'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Submitted</div>
                    <div className="font-semibold text-sm">
                      {selectedSubmission.submitted_at ? formatDate(selectedSubmission.submitted_at) : '\u2014'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Late</div>
                    <div className={`font-semibold ${selectedSubmission.late ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedSubmission.late ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>

                {selectedSubmission.assigned_grade !== null && selectedSubmission.assigned_grade !== undefined && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm text-green-800 font-medium mb-1">Current Grade</div>
                    <div className="text-3xl font-bold text-green-700">
                      {Number(selectedSubmission.assigned_grade).toFixed(1)}
                      <span className="text-lg text-green-600">
                        /{selectedSubmission.assessment?.max_points || 100}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    {selectedSubmission.assigned_grade !== null ? 'Update Grade' : 'Assign Grade'}
                  </h3>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Score (out of {selectedSubmission.assessment?.max_points || 100})
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={selectedSubmission.assessment?.max_points || 100}
                      step="0.5"
                      value={editingScore}
                      onChange={(e) => setEditingScore(e.target.value)}
                      className="max-w-xs"
                      placeholder="Enter score..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Feedback</label>
                    <Textarea
                      value={editingFeedback}
                      onChange={(e) => setEditingFeedback(e.target.value)}
                      rows={5}
                      placeholder="Provide detailed feedback for the student..."
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSaveGrade}
                      disabled={saving}
                      className="bg-green-700 hover:bg-green-800"
                    >
                      {saving
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                        : <><Save className="w-4 h-4 mr-2" />Save Grade</>
                      }
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
