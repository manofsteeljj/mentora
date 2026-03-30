import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { BookOpen, Users, Clock, Calendar, RefreshCw, Download, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react'
import { Progress } from './ui/progress'
import { CourseAskAI } from './CourseAskAI'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
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

export default function MyCourses({ onViewMaterials, onCreateCourse }) {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [aiViewCourse, setAiViewCourse] = useState(null)
  const syncIntervalRef = useRef(null)

  const fetchCourses = useCallback(() => {
    return fetch('/api/courses', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const mapped = (Array.isArray(data) ? data : []).map(c => ({
          id: c.id,
          code: c.course_code || 'N/A',
          name: c.course_name || 'Untitled Course',
          instructor: c.description || 'No description',
          schedule: c.academic_term || 'Not set',
          enrolled: c.students_count ?? 0,
          maxStudents: 45,
          progress: c.progress ?? 0,
          currentTopic: c.current_topic || 'No topic set',
          nextClass: c.next_class || 'Not scheduled',
          section: c.section || null,
          room: c.room || null,
          status: c.status || 'ACTIVE',
          googleClassroomId: c.google_classroom_id || null,
          lastSyncedAt: c.last_synced_at || null,
        }))
        setCourses(mapped)
      })
  }, [])

  // Full sync: courses + students from Google Classroom
  const triggerSync = useCallback(async (silent = false) => {
    if (syncing) return
    if (!silent) setSyncing(true)
    if (!silent) setSyncMessage(null)

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
        setSyncMessage({
          type: 'success',
          text: `Synced ${data.courses?.total || 0} courses & ${(data.students?.imported || 0) + (data.students?.updated || 0)} students from Google Classroom`,
        })
        await fetchCourses()
      } else if (data.error === 'not_connected' || data.error === 'token_expired') {
        setGoogleConnected(false)
        if (!silent) {
          setSyncMessage({ type: 'error', text: 'Google account not connected. Redirecting to sign in...' })
          setTimeout(() => { window.location.href = '/auth/google/redirect' }, 1500)
        }
      } else {
        if (!silent) {
          setSyncMessage({ type: 'error', text: data.message || 'Sync failed' })
        }
      }
    } catch {
      if (!silent) {
        setSyncMessage({ type: 'error', text: 'Network error during sync' })
      }
    } finally {
      setSyncing(false)
    }
  }, [syncing, fetchCourses])

  // Check Google connection + last sync time
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

  useEffect(() => {
    Promise.all([
      fetchCourses(),
      new Promise(resolve => { checkGoogleStatus(); resolve() }),
    ]).then(() => {
      setLoading(false)
      // Auto-sync on mount (background)
      triggerSync(true)
    }).catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic sync every 5 minutes
  useEffect(() => {
    if (googleConnected) {
      syncIntervalRef.current = setInterval(() => {
        triggerSync(true)
      }, SYNC_INTERVAL_MS)
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
    }
  }, [googleConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss sync messages after 8s
  useEffect(() => {
    if (syncMessage) {
      const t = setTimeout(() => setSyncMessage(null), 8000)
      return () => clearTimeout(t)
    }
  }, [syncMessage])

  // If viewing AI chat for a course, show that instead
  if (aiViewCourse) {
    return (
      <CourseAskAI
        courseId={aiViewCourse.id}
        courseName={aiViewCourse.name}
        courseCode={aiViewCourse.code}
        currentTopic={aiViewCourse.currentTopic}
        onBack={() => setAiViewCourse(null)}
      />
    )
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Teaching Courses</h1>
            <p className="text-gray-500">Courses you are currently teaching</p>
          </div>
          <div className="flex gap-2 items-center">
            {lastSyncedAt && (
              <span className="text-xs text-gray-400 mr-2">
                Last synced: {formatTimeAgo(lastSyncedAt)}
              </span>
            )}
            {googleConnected && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => triggerSync(false)}
                disabled={syncing}
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Google Classroom'}
              </Button>
            )}
            {!googleConnected && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => { window.location.href = '/auth/google/redirect' }}
              >
                <Download className="w-4 h-4" />
                Connect Google Classroom
              </Button>
            )}
          </div>
        </div>

        {syncMessage && (
          <div className={`p-3 rounded-lg text-sm ${
            syncMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {syncMessage.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading courses...</div>
        ) : courses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="font-medium text-lg mb-1">No courses yet</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Create a new course or sync from Google Classroom to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {courses.map((course) => (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{course.code}</Badge>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        {course.status === 'ACTIVE' ? 'Active' : course.status}
                      </Badge>
                      {course.googleClassroomId && (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
                          Google Classroom
                        </Badge>
                      )}
                      </div>
                      <CardTitle className="text-lg">{course.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {course.instructor}
                      </CardDescription>
                    </div>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-green-700" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Course Progress</span>
                      <span className="font-medium">{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} className="h-2" />
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 mt-0.5 text-gray-400" />
                      <div>
                        <p className="text-gray-500">Schedule</p>
                        <p className="font-medium">{course.schedule}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 mt-0.5 text-gray-400" />
                      <div>
                        <p className="text-gray-500">Next Class</p>
                        <p className="font-medium">{course.nextClass}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Users className="w-4 h-4 mt-0.5 text-gray-400" />
                      <div>
                        <p className="text-gray-500">Enrollment</p>
                        <p className="font-medium">
                          {course.enrolled} / {course.maxStudents} students
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Current Topic</p>
                    <p className="text-sm font-medium">{course.currentTopic}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => onViewMaterials?.({
                        id: course.id,
                        name: course.name,
                        code: course.code,
                      })}
                    >
                      View Materials
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-green-700 hover:bg-green-800 gap-1"
                      onClick={() => setAiViewCourse(course)}
                    >
                      <Sparkles className="w-4 h-4" />
                      Ask AI
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between py-8">
            <div>
              <h3 className="font-medium mb-1">Create New Course</h3>
              <p className="text-sm text-gray-500">
                Add a new course to your teaching schedule
              </p>
            </div>
            <Button className="bg-green-700 hover:bg-green-800" onClick={() => onCreateCourse?.()}>
              Create Course
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
