import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Check,
  X,
  Clock,
  FileText,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  UserCheck,
  UserX,
  Image as ImageIcon,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Textarea } from './ui/textarea'
import { Progress } from './ui/progress'

export default function Attendance() {
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [studentStats, setStudentStats] = useState({})
  const [todayStats, setTodayStats] = useState({ present: 0, absent: 0, late: 0, excused: 0 })
  const [pendingExcuseLetters, setPendingExcuseLetters] = useState(0)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [viewExcuseDialog, setViewExcuseDialog] = useState({ open: false, letter: null, studentName: null })
  const [expandedStudent, setExpandedStudent] = useState(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const selectedCourseInfo = useMemo(() => courses.find(c => String(c.id) === String(selectedCourse)), [courses, selectedCourse])

  function getToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
  }

  const fetchCourses = useCallback(async () => {
    const res = await fetch('/api/courses', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
    if (!res.ok) throw new Error('Failed to load courses')
    const data = await res.json()
    setCourses(Array.isArray(data) ? data : [])
    if (!selectedCourse) {
      const first = Array.isArray(data) && data.length > 0 ? String(data[0].id) : ''
      setSelectedCourse(first)
    }
  }, [selectedCourse])

  const fetchStudents = useCallback(async (courseId) => {
    if (!courseId) return
    const res = await fetch(`/api/students?course_id=${encodeURIComponent(courseId)}`, {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
    if (!res.ok) throw new Error('Failed to load students')
    const data = await res.json()
    setStudents(data.students || [])
  }, [])

  const fetchAttendance = useCallback(async (courseId, date) => {
    if (!courseId || !date) return
    const res = await fetch(`/api/attendance/records?course_id=${encodeURIComponent(courseId)}&date=${encodeURIComponent(date)}`, {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
    if (!res.ok) throw new Error('Failed to load attendance')
    const data = await res.json()
    setAttendanceRecords(data.records || [])
    setTodayStats(data.todayStats || { present: 0, absent: 0, late: 0, excused: 0 })
    setPendingExcuseLetters(data.pendingExcuseLetters || 0)
    setStudentStats(data.studentStats || {})
  }, [])

  useEffect(() => {
    fetchCourses().catch(() => {})
  }, [fetchCourses])

  useEffect(() => {
    if (!selectedCourse) return
    fetchStudents(selectedCourse).catch(() => {})
  }, [selectedCourse, fetchStudents])

  useEffect(() => {
    if (!selectedCourse || !selectedDate) return
    fetchAttendance(selectedCourse, selectedDate).catch(() => {})
  }, [selectedCourse, selectedDate, fetchAttendance])

  const attendanceByStudentId = useMemo(() => {
    const map = new Map()
    for (const r of attendanceRecords) {
      map.set(String(r.studentId), r)
    }
    return map
  }, [attendanceRecords])

  const getAttendanceForDate = (studentId) => {
    return attendanceByStudentId.get(String(studentId))
  }

  const updateAttendance = async (studentId, status, remarks) => {
    if (!selectedCourse) return
    await fetch('/api/attendance/records', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        course_id: Number(selectedCourse),
        student_id: Number(studentId),
        date: selectedDate,
        status,
        remarks: remarks ?? null,
      }),
    })
    await fetchAttendance(selectedCourse, selectedDate).catch(() => {})
  }

  const reviewExcuseLetter = async (excuseLetterId, action, notes) => {
    await fetch(`/api/attendance/excuse-letters/${encodeURIComponent(excuseLetterId)}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
      body: JSON.stringify({ action, notes: notes ?? null }),
    })
    setViewExcuseDialog({ open: false, letter: null, studentName: null })
    setReviewNotes('')
    await fetchAttendance(selectedCourse, selectedDate).catch(() => {})
  }

  const getAttendanceStats = (studentId) => {
    return studentStats[String(studentId)] || { present: 0, absent: 0, late: 0, excused: 0, total: 0, attendanceRate: 100 }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'present':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <Check className="w-3 h-3 mr-1" />Present
          </Badge>
        )
      case 'absent':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <X className="w-3 h-3 mr-1" />Absent
          </Badge>
        )
      case 'late':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
            <Clock className="w-3 h-3 mr-1" />Late
          </Badge>
        )
      case 'excused':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <FileText className="w-3 h-3 mr-1" />Excused
          </Badge>
        )
      default:
        return null
    }
  }

  const getExcuseStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Review</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>
      default:
        return null
    }
  }

  // todayStats + pendingExcuseLetters come from API

  return (
    <div className="flex-1 overflow-auto bg-gray-50 relative">
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 bg-gradient-to-r from-green-700 to-emerald-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-semibold mb-2">Class Attendance</h1>
              <p className="text-green-50">Track and manage student attendance with excuse letter review</p>
            </div>
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5" />
              <Select value={selectedCourse} onValueChange={(v) => setSelectedCourse(v)}>
                <SelectTrigger className="w-64 bg-white text-gray-900">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.course_code} - {course.course_name} (Section {course.section})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCourseInfo && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-green-100 text-xs mb-1">Course Code</p>
                  <p className="font-semibold">{selectedCourseInfo.course_code}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Section</p>
                  <p className="font-semibold">{selectedCourseInfo.section}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Schedule</p>
                  <p className="font-semibold">\u2014</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Total Students</p>
                  <p className="font-semibold">{students.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Date Selector and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-700" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    Selected:{' '}
                    <span className="font-semibold">
                      {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today's Summary</CardTitle>
              <CardDescription>Attendance for {selectedDate}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Present
                  </span>
                  <span className="font-semibold">{todayStats.present}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    Absent
                  </span>
                  <span className="font-semibold">{todayStats.absent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    Late
                  </span>
                  <span className="font-semibold">{todayStats.late}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    Excused
                  </span>
                  <span className="font-semibold">{todayStats.excused}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Pending Review
              </CardTitle>
              <CardDescription>Excuse letters awaiting review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-600 mb-2">{pendingExcuseLetters}</div>
                <p className="text-sm text-gray-600">
                  {pendingExcuseLetters === 1 ? 'excuse letter needs' : 'excuse letters need'} your attention
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Student Attendance</CardTitle>
                <CardDescription>Mark attendance and review excuse letters</CardDescription>
              </div>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {students.map((student) => {
                const attendance = getAttendanceForDate(student.id)
                const stats = getAttendanceStats(student.id)
                const isExpanded = expandedStudent === student.id
                const hasExcuseLetter = attendance?.excuseLetter

                return (
                  <div key={student.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Main Row */}
                    <div className="p-4 bg-white hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        {/* Student Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold truncate">{student.name}</p>
                            {hasExcuseLetter && (
                              <Badge variant="outline" className="gap-1">
                                <FileText className="w-3 h-3" />
                                Has excuse letter
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">{student.email}</p>
                        </div>

                        {/* Attendance Rate */}
                        <div className="w-32 text-center">
                          <p className="text-xs text-gray-500 mb-1">Attendance Rate</p>
                          <p
                            className={`text-lg font-bold ${
                              stats.attendanceRate >= 90
                                ? 'text-green-600'
                                : stats.attendanceRate >= 75
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {stats.attendanceRate}%
                          </p>
                        </div>

                        {/* Status Buttons */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={attendance?.status === 'present' ? 'default' : 'outline'}
                            className={attendance?.status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                            onClick={() => updateAttendance(student.id, 'present')}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={attendance?.status === 'absent' ? 'default' : 'outline'}
                            className={attendance?.status === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                            onClick={() => updateAttendance(student.id, 'absent')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={attendance?.status === 'late' ? 'default' : 'outline'}
                            className={attendance?.status === 'late' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                            onClick={() => updateAttendance(student.id, 'late')}
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={attendance?.status === 'excused' ? 'default' : 'outline'}
                            className={attendance?.status === 'excused' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                            onClick={() => updateAttendance(student.id, 'excused')}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Current Status */}
                        <div className="w-32">
                          {attendance?.status
                            ? getStatusBadge(attendance.status)
                            : <Badge variant="outline" className="text-gray-500">Not marked</Badge>
                          }
                        </div>

                        {/* Expand Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>

                      {/* Excuse Letter Notification */}
                      {hasExcuseLetter && hasExcuseLetter.status === 'pending' && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                              <span className="text-sm font-medium text-amber-900">
                                Excuse letter pending review
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => {
                                setViewExcuseDialog({ open: true, letter: hasExcuseLetter, studentName: student.name })
                                setReviewNotes('')
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              Review
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          {/* Attendance Stats */}
                          <div>
                            <h4 className="font-semibold text-sm mb-3 mt-3">Attendance Statistics</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Classes:</span>
                                <span className="font-semibold">{stats.total}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 flex items-center gap-1">
                                  <UserCheck className="w-3 h-3" /> Present:
                                </span>
                                <span className="font-semibold text-green-600">{stats.present}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 flex items-center gap-1">
                                  <UserX className="w-3 h-3" /> Absent:
                                </span>
                                <span className="font-semibold text-red-600">{stats.absent}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Late:
                                </span>
                                <span className="font-semibold text-amber-600">{stats.late}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 flex items-center gap-1">
                                  <FileText className="w-3 h-3" /> Excused:
                                </span>
                                <span className="font-semibold text-blue-600">{stats.excused}</span>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-600">Attendance Rate</span>
                                <span className="font-semibold">{stats.attendanceRate}%</span>
                              </div>
                              <Progress value={stats.attendanceRate} className="h-2" />
                            </div>
                          </div>

                          {/* Excuse Letter Info */}
                          <div>
                            <h4 className="font-semibold text-sm mb-3 mt-3">Excuse Letter Details</h4>
                            {hasExcuseLetter ? (
                              <div className="bg-white p-3 rounded-md border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">Status:</span>
                                  {getExcuseStatusBadge(hasExcuseLetter.status)}
                                </div>
                                <div className="text-sm space-y-1 mb-3">
                                  <p className="text-gray-600">
                                    <span className="font-medium">Submitted:</span>{' '}
                                    {new Date(hasExcuseLetter.submittedDate).toLocaleDateString()}
                                  </p>
                                  <p className="text-gray-700">
                                    <span className="font-medium">Reason:</span> {hasExcuseLetter.reason}
                                  </p>
                                  {hasExcuseLetter.attachments && hasExcuseLetter.attachments.length > 0 && (
                                    <p className="text-gray-600">
                                      <span className="font-medium">Attachments:</span> {hasExcuseLetter.attachments.length} file(s)
                                    </p>
                                  )}
                                </div>
                                {hasExcuseLetter.status !== 'pending' && hasExcuseLetter.reviewNotes && (
                                  <div className="pt-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Review Notes:</p>
                                    <p className="text-sm text-gray-700">{hasExcuseLetter.reviewNotes}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Reviewed by {hasExcuseLetter.reviewedBy} on {hasExcuseLetter.reviewDate}
                                    </p>
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full mt-3 gap-2"
                                  onClick={() => {
                                    setViewExcuseDialog({ open: true, letter: hasExcuseLetter, studentName: student.name })
                                    setReviewNotes('')
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                  View Full Details
                                </Button>
                              </div>
                            ) : (
                              <div className="bg-white p-3 rounded-md border border-gray-200 text-center text-sm text-gray-500">
                                No excuse letter submitted for this date
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Remarks */}
                        {attendance?.remarks && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">Remarks:</p>
                            <p className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                              {attendance.remarks}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Excuse Letter Review Dialog */}
      <Dialog
        open={viewExcuseDialog.open}
        onOpenChange={(open) => {
          if (!open) setReviewNotes('')
          setViewExcuseDialog(prev => ({ ...prev, open }))
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Excuse Letter</DialogTitle>
            <DialogDescription>
              {viewExcuseDialog.studentName ? `From ${viewExcuseDialog.studentName}` : ''}
            </DialogDescription>
          </DialogHeader>

          {viewExcuseDialog.letter && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Current Status:</span>
                {getExcuseStatusBadge(viewExcuseDialog.letter.status)}
              </div>

              {/* Letter Details */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Submitted Date:</p>
                  <p className="text-sm text-gray-900">
                    {new Date(viewExcuseDialog.letter.submittedDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Reason for Absence:</p>
                  <p className="text-sm text-gray-900">{viewExcuseDialog.letter.reason}</p>
                </div>

                {viewExcuseDialog.letter.attachments && viewExcuseDialog.letter.attachments.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Attachments:</p>
                    <div className="space-y-2">
                      {viewExcuseDialog.letter.attachments.map((attachment, index) => (
                        <div key={`${attachment}-${index}`} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                          {attachment.endsWith('.pdf') ? (
                            <FileText className="w-5 h-5 text-red-600" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-blue-600" />
                          )}
                          <span className="text-sm flex-1">{attachment}</span>
                          <Button size="sm" variant="outline" className="gap-2">
                            <Download className="w-3 h-3" />
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Previous Review (if exists) */}
              {viewExcuseDialog.letter.status !== 'pending' && viewExcuseDialog.letter.reviewNotes && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900 mb-2">Previous Review:</p>
                  <p className="text-sm text-blue-800 mb-2">{viewExcuseDialog.letter.reviewNotes}</p>
                  <p className="text-xs text-blue-700">
                    Reviewed by {viewExcuseDialog.letter.reviewedBy} on {viewExcuseDialog.letter.reviewDate}
                  </p>
                </div>
              )}

              {/* Review Form (only for pending) */}
              {viewExcuseDialog.letter.status === 'pending' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Review Notes:
                    </label>
                    <Textarea
                      placeholder="Add your review notes here..."
                      className="min-h-[100px]"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setViewExcuseDialog({ open: false, letter: null, studentName: null })
                        setReviewNotes('')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (viewExcuseDialog.letter?.id) reviewExcuseLetter(viewExcuseDialog.letter.id, 'rejected', reviewNotes || 'Rejected')
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        if (viewExcuseDialog.letter?.id) reviewExcuseLetter(viewExcuseDialog.letter.id, 'approved', reviewNotes || 'Approved')
                      }}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
