import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Trophy,
  AlertTriangle,
  TrendingUp,
  Users,
  Award,
  Star,
  BarChart3,
  BookOpen,
  Filter,
  FileText,
  MessageSquare,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

function getStatusBadge(status) {
  switch (status) {
    case 'excellent':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Excellent</Badge>
    case 'good':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Good</Badge>
    case 'at-risk':
      return <Badge className="bg-red-100 text-red-800 border-red-200">At Risk</Badge>
    default:
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200">No Data</Badge>
  }
}

function formatTimeAgo(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return date.toLocaleDateString()
}

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [stats, setStats] = useState({})
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [selectedView, setSelectedView] = useState('overview')

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const syncIntervalRef = useRef(null)

  // Fetch dashboard data from DB
  const fetchDashboard = useCallback(() => {
    return fetch('/api/dashboard', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : { courses: [], students: [], stats: {} })
      .then(data => {
        setCourses(data.courses || [])
        setAllStudents(data.students || [])
        setStats(data.stats || {})
      })
  }, [])

  // Trigger Google Classroom sync then reload dashboard
  const triggerSync = useCallback(async (silent = false) => {
    if (syncing) return
    if (!silent) setSyncing(true)
    setSyncResult(null)

    try {
      const resp = await fetch('/api/google/classroom/sync', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getToken(),
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
      })
      const data = await resp.json()

      if (resp.ok) {
        setLastSyncedAt(data.synced_at || new Date().toISOString())
        setSyncResult({
          type: 'success',
          text: `Synced ${data.courses?.total || 0} courses, ${(data.students?.imported || 0) + (data.students?.updated || 0)} students`,
        })
        // Refresh dashboard data after sync
        await fetchDashboard()
      } else if (data.error === 'not_connected' || data.error === 'token_expired') {
        setGoogleConnected(false)
        if (!silent) {
          setSyncResult({ type: 'error', text: 'Google not connected. Please sign in.' })
        }
      } else {
        if (!silent) {
          setSyncResult({ type: 'error', text: data.message || 'Sync failed' })
        }
      }
    } catch {
      if (!silent) {
        setSyncResult({ type: 'error', text: 'Network error during sync' })
      }
    } finally {
      setSyncing(false)
    }
  }, [syncing, fetchDashboard])

  // Check Google status & last sync
  const checkGoogleStatus = useCallback(() => {
    fetch('/api/google/classroom/sync-status', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setGoogleConnected(!!data.connected)
        if (data.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt)
      })
      .catch(() => {})
  }, [])

  // Initial load: fetch dashboard data, check Google status, then auto-sync
  useEffect(() => {
    Promise.all([
      fetchDashboard(),
      new Promise(resolve => {
        checkGoogleStatus()
        resolve()
      }),
    ]).then(() => {
      setLoading(false)
      // After initial load, do a background sync
      triggerSync(true)
    }).catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Set up periodic sync interval
  useEffect(() => {
    if (googleConnected) {
      syncIntervalRef.current = setInterval(() => {
        triggerSync(true) // silent background sync
      }, SYNC_INTERVAL_MS)
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [googleConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear sync result after 8 seconds
  useEffect(() => {
    if (syncResult) {
      const t = setTimeout(() => setSyncResult(null), 8000)
      return () => clearTimeout(t)
    }
  }, [syncResult])

  // Filter students based on selected course
  const students = selectedCourse === 'all'
    ? allStudents
    : allStudents.filter(s => String(s.courseId) === String(selectedCourse))

  const selectedCourseInfo = courses.find(c => String(c.id) === String(selectedCourse))

  // Only students that have grade data
  const gradedStudents = students.filter(s => s.status !== 'no-data')

  // Sort students by grade for ranking
  const rankedStudents = [...gradedStudents].sort((a, b) => b.averageGrade - a.averageGrade)

  // Get top performers (90+)
  const topPerformers = gradedStudents.filter(s => s.averageGrade >= 90)

  // Get at-risk students (below 75)
  const atRiskStudents = gradedStudents.filter(s => s.averageGrade < 75)

  // Calculate stats for filtered view
  const filteredAverage = gradedStudents.length > 0
    ? Math.round(gradedStudents.reduce((sum, s) => sum + s.averageGrade, 0) / gradedStudents.length)
    : 0

  // Grade distribution data
  const gradeDistribution = [
    { range: '90-100', count: gradedStudents.filter(s => s.averageGrade >= 90).length },
    { range: '80-89', count: gradedStudents.filter(s => s.averageGrade >= 80 && s.averageGrade < 90).length },
    { range: '75-79', count: gradedStudents.filter(s => s.averageGrade >= 75 && s.averageGrade < 80).length },
    { range: 'Below 75', count: gradedStudents.filter(s => s.averageGrade < 75).length },
  ]

  // Performance distribution for pie chart
  const performanceData = [
    { name: 'Excellent (90+)', value: gradedStudents.filter(s => s.averageGrade >= 90).length, color: '#15803d' },
    { name: 'Good (75-89)', value: gradedStudents.filter(s => s.averageGrade >= 75 && s.averageGrade < 90).length, color: '#65a30d' },
    { name: 'At Risk (<75)', value: gradedStudents.filter(s => s.averageGrade < 75).length, color: '#dc2626' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-green-700" />
      </div>
    )
  }

  // Empty state when no courses
  if (courses.length === 0) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50 min-h-screen">
        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="mb-6 bg-gradient-to-r from-green-700 to-emerald-600 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold mb-2">Academic Dashboard</h1>
                <p className="text-green-50">Monitor student performance across all your courses and sections</p>
              </div>
              {googleConnected && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 gap-2"
                  onClick={() => triggerSync(false)}
                  disabled={syncing}
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
            </div>
            {syncResult && (
              <div className={`flex items-center gap-2 mt-3 px-3 py-1.5 rounded-md text-sm ${
                syncResult.type === 'success'
                  ? 'bg-green-900/30 text-green-100'
                  : 'bg-red-900/30 text-red-200'
              }`}>
                {syncResult.type === 'success'
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <AlertTriangle className="w-4 h-4" />
                }
                {syncResult.text}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="border-t-4 border-t-green-600">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                <BookOpen className="w-5 h-5 text-green-700" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold text-green-700">0</div></CardContent>
            </Card>
            <Card className="border-t-4 border-t-blue-600">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <Users className="w-5 h-5 text-blue-700" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold text-blue-700">0</div></CardContent>
            </Card>
            <Card className="border-t-4 border-t-purple-600">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Materials Uploaded</CardTitle>
                <FileText className="w-5 h-5 text-purple-700" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold text-purple-700">{stats.totalMaterials || 0}</div></CardContent>
            </Card>
            <Card className="border-t-4 border-t-amber-600">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">AI Conversations</CardTitle>
                <MessageSquare className="w-5 h-5 text-amber-700" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold text-amber-700">{stats.totalConversations || 0}</div></CardContent>
            </Card>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="font-medium text-lg mb-1">No courses yet</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Create courses or sync from Google Classroom to see your academic dashboard with real student data.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50 min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header with Course Filter */}
        <div className="mb-6 bg-gradient-to-r from-green-700 to-emerald-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-semibold mb-2">Academic Dashboard</h1>
              <p className="text-green-50">Monitor student performance across all your courses and sections</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Sync Button */}
              {googleConnected && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 gap-2"
                  onClick={() => triggerSync(false)}
                  disabled={syncing}
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
              {!googleConnected && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 gap-2"
                  onClick={() => { window.location.href = '/auth/google/redirect' }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Connect Google
                </Button>
              )}
              <Filter className="w-5 h-5" />
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-64 bg-white text-gray-900">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.code} - {course.name}{course.section ? ` (Sec ${course.section})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sync status banner */}
          {(syncResult || lastSyncedAt) && (
            <div className="flex items-center justify-between mt-3 text-sm">
              {syncResult && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
                  syncResult.type === 'success'
                    ? 'bg-green-900/30 text-green-100'
                    : 'bg-red-900/30 text-red-200'
                }`}>
                  {syncResult.type === 'success'
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <AlertTriangle className="w-4 h-4" />
                  }
                  {syncResult.text}
                </div>
              )}
              {!syncResult && <div />}
              {lastSyncedAt && (
                <div className="flex items-center gap-1.5 text-green-200 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  Last synced: {formatTimeAgo(lastSyncedAt)}
                  {googleConnected && (
                    <span className="text-green-300 ml-1">&bull; Auto-refresh every 5 min</span>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedCourse !== 'all' && selectedCourseInfo && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mt-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-green-100 text-xs mb-1">Course Code</p>
                  <p className="font-semibold">{selectedCourseInfo.code}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Section</p>
                  <p className="font-semibold">{selectedCourseInfo.section || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Students</p>
                  <p className="font-semibold">{selectedCourseInfo.studentCount}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Assessments</p>
                  <p className="font-semibold">{selectedCourseInfo.assessmentCount}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* View Tabs */}
        <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v)} className="mb-6">
          <TabsList>
            <TabsTrigger value="overview">Performance Overview</TabsTrigger>
            <TabsTrigger value="byCourse">By Course</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Top Student Achiever Banner */}
            {rankedStudents[0] && (
              <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center">
                      <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="w-5 h-5 text-amber-600" />
                        <h2 className="text-xl font-semibold text-amber-900">
                          {selectedCourse === 'all' ? 'Top Student Achiever (Overall)' : 'Top Student in Course'}
                        </h2>
                      </div>
                      <p className="text-2xl font-bold text-amber-800 mb-1">{rankedStudents[0].name}</p>
                      <p className="text-amber-700">
                        {selectedCourse === 'all' && `${rankedStudents[0].courseCode}${rankedStudents[0].section ? ` Sec ${rankedStudents[0].section}` : ''} \u2022 `}
                        {selectedCourse !== 'all' && selectedCourseInfo && `${selectedCourseInfo.code}${selectedCourseInfo.section ? ` Sec ${selectedCourseInfo.section}` : ''} \u2022 `}
                        Average Grade: <span className="font-semibold">{rankedStudents[0].averageGrade}%</span> {'\u2022'} {rankedStudents[0].completedAssessments}/{rankedStudents[0].totalAssessments} Assessments Completed
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                      <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                      <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-t-4 border-t-green-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-700">{students.length}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedCourse === 'all' ? `Across ${courses.length} courses` : 'In selected course'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-blue-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Class Average</CardTitle>
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-700">
                    {gradedStudents.length > 0 ? `${filteredAverage}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {gradedStudents.length > 0 ? `Based on ${gradedStudents.length} graded students` : 'No graded assessments yet'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-amber-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-amber-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600">{topPerformers.length}</div>
                  <p className="text-xs text-gray-500 mt-1">Students with 90% or above</p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-red-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">At-Risk Students</CardTitle>
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{atRiskStudents.length}</div>
                  <p className="text-xs text-gray-500 mt-1">Students below 75%</p>
                </CardContent>
              </Card>
            </div>

            {/* Additional Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Materials Uploaded</CardTitle>
                  <FileText className="w-5 h-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-700">{stats.totalMaterials || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Assessments Created</CardTitle>
                  <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-700">{stats.totalAssessments || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">AI Conversations</CardTitle>
                  <MessageSquare className="w-5 h-5 text-teal-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-teal-700">{stats.totalConversations || 0}</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row - only show if there are graded students */}
            {gradedStudents.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Grade Distribution</CardTitle>
                    <CardDescription>Distribution of student grades across ranges</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={gradeDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="range" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#15803d" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Categories</CardTitle>
                    <CardDescription>Student distribution by performance level</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={performanceData.filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {performanceData.filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* No graded data message */}
            {gradedStudents.length === 0 && students.length > 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <ClipboardCheck className="w-10 h-10 text-gray-300 mb-3" />
                  <h3 className="font-medium text-lg mb-1">No graded assessments yet</h3>
                  <p className="text-sm text-gray-500 max-w-md">
                    Create assessments and grade student submissions to see performance charts and rankings.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Student Lists Row */}
            {gradedStudents.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Performers List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <CardTitle>Top Performers</CardTitle>
                    </div>
                    <CardDescription>Students with grades 90% and above</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {topPerformers.length > 0 ? (
                        topPerformers.slice(0, 5).map((student, index) => (
                          <div key={student.id} className="flex items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-bold text-sm">{index + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{student.name}</p>
                              <p className="text-xs text-gray-600 truncate">
                                {selectedCourse === 'all' ? `${student.courseCode}${student.section ? ` Sec ${student.section}` : ''} \u2022 ` : ''}{student.email || student.studentNumber}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-amber-700">{student.averageGrade}%</p>
                              <p className="text-xs text-gray-600">{student.completedAssessments}/{student.totalAssessments} completed</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No top performers yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* At-Risk Students List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <CardTitle>At-Risk Students</CardTitle>
                    </div>
                    <CardDescription>Students requiring immediate attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {atRiskStudents.length > 0 ? (
                        atRiskStudents.map((student) => (
                          <div key={student.id} className="flex items-center gap-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{student.name}</p>
                              <p className="text-xs text-gray-600 truncate">
                                {selectedCourse === 'all' ? `${student.courseCode}${student.section ? ` Sec ${student.section}` : ''} \u2022 ` : ''}{student.email || student.studentNumber}
                              </p>
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-gray-600">Progress</span>
                                  <span className="text-red-600">{student.completedAssessments}/{student.totalAssessments}</span>
                                </div>
                                <Progress value={student.totalAssessments > 0 ? (student.completedAssessments / student.totalAssessments) * 100 : 0} className="h-2" />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-red-600">{student.averageGrade}%</p>
                              <Badge className="bg-red-100 text-red-800 border-red-200 mt-1">Action Needed</Badge>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No students at risk</p>
                          <p className="text-sm mt-1">All students are performing well!</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Complete Student Ranking */}
            {rankedStudents.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-green-700" />
                    <CardTitle>Complete Student Ranking</CardTitle>
                  </div>
                  <CardDescription>All students ranked by average grade</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[600px] overflow-y-auto">
                    <div className="space-y-2">
                      {rankedStudents.map((student, index) => (
                        <div
                          key={student.id}
                          className={`flex items-center gap-4 p-4 rounded-lg border ${
                            index === 0
                              ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
                              : student.status === 'at-risk'
                              ? 'bg-red-50 border-red-200'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                            index === 0
                              ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white'
                              : index === 1
                              ? 'bg-gray-300 text-gray-700'
                              : index === 2
                              ? 'bg-amber-700 text-white'
                              : student.status === 'at-risk'
                              ? 'bg-red-200 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold truncate">{student.name}</p>
                              {index === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                            </div>
                            <p className="text-sm text-gray-600 truncate">
                              {selectedCourse === 'all' ? `${student.courseCode}${student.section ? ` Sec ${student.section}` : ''} \u2022 ` : ''}{student.email || student.studentNumber}
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Completed</p>
                              <p className="font-semibold">{student.completedAssessments}/{student.totalAssessments}</p>
                            </div>

                            {getStatusBadge(student.status)}

                            <div className="text-right min-w-[60px]">
                              <p className={`text-xl font-bold ${
                                student.status === 'excellent'
                                  ? 'text-green-700'
                                  : student.status === 'at-risk'
                                  ? 'text-red-600'
                                  : 'text-blue-600'
                              }`}>
                                {student.averageGrade}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="byCourse" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => {
                  setSelectedCourse(String(course.id))
                  setSelectedView('overview')
                }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{course.code}</CardTitle>
                        <CardDescription className="text-sm mt-1">{course.name}</CardDescription>
                      </div>
                      {course.section && <Badge variant="outline" className="ml-2">Sec {course.section}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {course.academicTerm && (
                        <div className="flex items-center gap-2 text-sm">
                          <BookOpen className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{course.academicTerm}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Students</p>
                          <p className="text-2xl font-bold text-green-700">{course.studentCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Avg Grade</p>
                          <p className="text-2xl font-bold text-blue-700">
                            {course.avgGrade > 0 ? `${course.avgGrade}%` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Assessments</p>
                          <p className="text-2xl font-bold text-indigo-700">{course.assessmentCount}</p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">At-Risk Students</span>
                          <span className={course.atRisk > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                            {course.atRisk} {course.atRisk === 1 ? 'student' : 'students'}
                          </span>
                        </div>
                        {course.atRisk > 0 && course.studentCount > 0 && (
                          <div className="w-full bg-red-100 rounded-full h-2">
                            <div
                              className="bg-red-600 h-2 rounded-full"
                              style={{ width: `${(course.atRisk / course.studentCount) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{course.materialCount} materials</span>
                        {course.googleClassroomId && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs ml-auto">Google</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
