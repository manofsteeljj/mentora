import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Upload,
  Download,
  FileSpreadsheet,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Button } from './ui/button'
import { toast } from 'sonner'

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

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

export default function Dashboard() {
  const [courses, setCourses] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [selectedView, setSelectedView] = useState('overview')
  const [importing, setImporting] = useState(false)

  const fileInputRef = useRef(null)
  const xlsxModuleRef = useRef(null)

  const loadXlsx = useCallback(async () => {
    if (xlsxModuleRef.current) return xlsxModuleRef.current
    const mod = await import('xlsx')
    xlsxModuleRef.current = mod
    return mod
  }, [])

  const fetchDashboard = useCallback(async () => {
    const res = await fetch('/api/dashboard', {
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
    if (!res.ok) throw new Error('Failed to load dashboard')
    const data = await res.json()
    setCourses(Array.isArray(data?.courses) ? data.courses : [])
    setAllStudents(Array.isArray(data?.students) ? data.students : [])
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchDashboard()
      .catch(() => {
        toast.error('Failed to load dashboard')
      })
      .finally(() => setLoading(false))
  }, [fetchDashboard])

  const students = useMemo(() => {
    if (selectedCourse === 'all') return allStudents
    return allStudents.filter((s) => String(s.courseId) === String(selectedCourse))
  }, [allStudents, selectedCourse])

  const selectedCourseInfo = useMemo(
    () => courses.find((c) => String(c.id) === String(selectedCourse)),
    [courses, selectedCourse]
  )

  const rankedStudents = useMemo(
    () => [...students].sort((a, b) => (b.averageGrade || 0) - (a.averageGrade || 0)),
    [students]
  )

  const topPerformers = useMemo(() => students.filter((s) => (s.averageGrade || 0) >= 90), [students])

  const atRiskStudents = useMemo(
    () => students.filter((s) => (s.averageGrade || 0) < 75 && s.status !== 'no-data'),
    [students]
  )

  const averageClassGrade = useMemo(() => {
    if (students.length === 0) return 0
    return Math.round(students.reduce((sum, s) => sum + (s.averageGrade || 0), 0) / students.length)
  }, [students])

  const totalCompleted = useMemo(
    () => students.reduce((sum, s) => sum + (s.completedAssessments || 0), 0),
    [students]
  )

  const totalAssessments = useMemo(() => students.reduce((sum, s) => sum + (s.totalAssessments || 0), 0), [
    students,
  ])

  const completionRate = useMemo(() => {
    if (!totalAssessments) return 0
    return Math.round((totalCompleted / totalAssessments) * 100)
  }, [totalAssessments, totalCompleted])

  const gradeDistribution = useMemo(
    () => [
      {
        range: '90-100',
        count: students.filter((s) => (s.averageGrade || 0) >= 90).length,
        id: `grade-90-100-${selectedCourse}`,
      },
      {
        range: '80-89',
        count: students.filter((s) => (s.averageGrade || 0) >= 80 && (s.averageGrade || 0) < 90).length,
        id: `grade-80-89-${selectedCourse}`,
      },
      {
        range: '75-79',
        count: students.filter((s) => (s.averageGrade || 0) >= 75 && (s.averageGrade || 0) < 80).length,
        id: `grade-75-79-${selectedCourse}`,
      },
      {
        range: 'Below 75',
        count: students.filter((s) => (s.averageGrade || 0) < 75 && s.status !== 'no-data').length,
        id: `grade-below-75-${selectedCourse}`,
      },
    ],
    [students, selectedCourse]
  )

  const performanceData = useMemo(
    () => [
      {
        name: 'Excellent (90+)',
        value: students.filter((s) => (s.averageGrade || 0) >= 90).length,
        color: '#15803d',
        id: `perf-excellent-${selectedCourse}`,
      },
      {
        name: 'Good (75-89)',
        value: students.filter((s) => (s.averageGrade || 0) >= 75 && (s.averageGrade || 0) < 90).length,
        color: '#65a30d',
        id: `perf-good-${selectedCourse}`,
      },
      {
        name: 'At Risk (<75)',
        value: students.filter((s) => (s.averageGrade || 0) < 75 && s.status !== 'no-data').length,
        color: '#dc2626',
        id: `perf-atrisk-${selectedCourse}`,
      },
    ],
    [students, selectedCourse]
  )

  const coursePerformance = useMemo(() => {
    return courses.map((course) => {
      const courseStudents = allStudents.filter((s) => String(s.courseId) === String(course.id))
      const graded = courseStudents.filter((s) => s.status !== 'no-data')
      const avgGrade = graded.length > 0 ? Math.round(graded.reduce((sum, s) => sum + (s.averageGrade || 0), 0) / graded.length) : 0
      const atRisk = graded.filter((s) => (s.averageGrade || 0) < 75).length

      return {
        ...course,
        avgGrade,
        atRisk,
        studentCount: courseStudents.length,
      }
    })
  }, [courses, allStudents])

  const openImportPicker = () => {
    if (selectedCourse === 'all') {
      toast.error('Select a specific course before importing students.')
      return
    }
    fileInputRef.current?.click?.()
  }

  const parseStudentsFromWorksheet = (xlsx, worksheet) => {
    const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' })
    if (!Array.isArray(rows) || rows.length === 0) return []

    return rows
      .map((row) => {
        const normalized = {}
        for (const [k, v] of Object.entries(row)) {
          normalized[normalizeHeader(k)] = v
        }

        const studentNumber = String(
          normalized.student_number ??
            normalized.studentnumber ??
            normalized.id_number ??
            normalized.student_id ??
            normalized.studentid ??
            ''
        ).trim()

        const name = String(normalized.name ?? normalized.full_name ?? normalized.fullname ?? '').trim()
        const email = String(normalized.email ?? '').trim()

        if (!studentNumber || !name) return null
        return { student_number: studentNumber, name, email: email || null }
      })
      .filter(Boolean)
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // allow re-uploading the same file
    event.target.value = ''

    setImporting(true)
    try {
      const XLSX = await loadXlsx()
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const studentsToImport = parseStudentsFromWorksheet(XLSX, worksheet)

      if (studentsToImport.length === 0) {
        toast.error('No valid rows found. Required columns: student_number (or student id) and name.')
        return
      }

      const resp = await fetch('/api/students/import', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': getToken(),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          course_id: Number(selectedCourse),
          students: studentsToImport,
        }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => null)
        toast.error(err?.message || 'Import failed')
        return
      }

      const result = await resp.json().catch(() => null)
      toast.success(`Imported ${result?.imported ?? 0}, updated ${result?.updated ?? 0} students`)
      await fetchDashboard()
    } catch {
      toast.error('Failed to read file')
    } finally {
      setImporting(false)
    }
  }

  const handleFileDownload = () => {
    ;(async () => {
      try {
        const XLSX = await loadXlsx()
        const exportRows = (selectedCourse === 'all' ? allStudents : students).map((s) => ({
          student_number: s.studentNumber || '',
          name: s.name || '',
          email: s.email || '',
          course_code: s.courseCode || '',
          section: s.section || '',
        }))

        const worksheet = XLSX.utils.json_to_sheet(exportRows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
        XLSX.writeFile(workbook, `students_${selectedCourse === 'all' ? 'all' : selectedCourse}.xlsx`)
        toast.success('Students data exported successfully!')
      } catch {
        toast.error('Export failed')
      }
    })()
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="text-gray-600">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />

      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6 bg-gradient-to-r from-green-700 to-emerald-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-semibold mb-2">Academic Dashboard</h1>
              <p className="text-green-50">Monitor student performance across all your courses and sections</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                className="bg-white/90 hover:bg-white text-gray-900"
                onClick={openImportPicker}
                disabled={importing}
              >
                <Upload className="w-4 h-4 mr-2" />
                {importing ? 'Importing...' : 'Import Students'}
              </Button>

              <Button variant="secondary" className="bg-white/90 hover:bg-white text-gray-900" onClick={handleFileDownload}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>

              <Filter className="w-5 h-5" />
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-64 bg-white text-gray-900">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.code} - {course.name}
                      {course.section ? ` (Section ${course.section})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCourse !== 'all' && selectedCourseInfo && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mt-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-green-100 text-xs mb-1">Course Code</p>
                  <p className="font-semibold">{selectedCourseInfo.code}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Section</p>
                  <p className="font-semibold">{selectedCourseInfo.section || '—'}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Assessments</p>
                  <p className="font-semibold">{selectedCourseInfo.assessmentCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Materials</p>
                  <p className="font-semibold">{selectedCourseInfo.materialCount ?? 0}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-green-50 opacity-90">
                <FileSpreadsheet className="w-4 h-4" />
                Import expects columns: student_number, name, email (optional)
              </div>
            </div>
          )}
        </div>

        <Tabs value={selectedView} onValueChange={setSelectedView} className="mb-6">
          <TabsList>
            <TabsTrigger value="overview">Performance Overview</TabsTrigger>
            <TabsTrigger value="byCourse">By Course</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6 relative">
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
                        {selectedCourse !== 'all' && selectedCourseInfo
                          ? `${selectedCourseInfo.code}${selectedCourseInfo.section ? ` Section ${selectedCourseInfo.section}` : ''} • `
                          : ''}
                        Average Grade: <span className="font-semibold">{rankedStudents[0].averageGrade || 0}%</span> •{' '}
                        {rankedStudents[0].completedAssessments || 0}/{rankedStudents[0].totalAssessments || 0} Assessments Completed
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
                  <div className="text-3xl font-bold text-blue-700">{averageClassGrade}%</div>
                  <p className="text-xs text-gray-500 mt-1">Completion rate: {completionRate}%</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Grade Distribution</CardTitle>
                  <CardDescription>Distribution of student grades across ranges</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300} key={`bar-${selectedCourse}`}>
                    <BarChart data={gradeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#15803d" radius={[8, 8, 0, 0]} name="Students" />
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
                  <ResponsiveContainer width="100%" height={300} key={`pie-${selectedCourse}`}>
                    <PieChart>
                      <Pie
                        data={performanceData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                      >
                        {performanceData.map((entry, index) => (
                          <Cell key={`cell-${entry.id}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            <p className="text-xs text-gray-600 truncate">{student.email}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-amber-700">{student.averageGrade || 0}%</p>
                            <p className="text-xs text-gray-600">
                              {student.completedAssessments || 0}/{student.totalAssessments || 0} completed
                            </p>
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
                            <p className="text-xs text-gray-600 truncate">{student.email}</p>
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-600">Progress</span>
                                <span className="text-red-600">
                                  {student.completedAssessments || 0}/{student.totalAssessments || 0}
                                </span>
                              </div>
                              <Progress
                                value={
                                  student.totalAssessments
                                    ? ((student.completedAssessments || 0) / student.totalAssessments) * 100
                                    : 0
                                }
                                className="h-2"
                              />
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-red-600">{student.averageGrade || 0}%</p>
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
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                            index === 0
                              ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white'
                              : index === 1
                                ? 'bg-gray-300 text-gray-700'
                                : index === 2
                                  ? 'bg-amber-700 text-white'
                                  : student.status === 'at-risk'
                                    ? 'bg-red-200 text-red-700'
                                    : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{student.name}</p>
                            {index === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                          </div>
                          <p className="text-sm text-gray-600 truncate">{student.email}</p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Completed</p>
                            <p className="font-semibold">
                              {student.completedAssessments || 0}/{student.totalAssessments || 0}
                            </p>
                          </div>

                          {getStatusBadge(student.status)}

                          <div className="text-right min-w-[60px]">
                            <p
                              className={`text-xl font-bold ${
                                student.status === 'excellent'
                                  ? 'text-green-700'
                                  : student.status === 'at-risk'
                                    ? 'text-red-600'
                                    : 'text-blue-600'
                              }`}
                            >
                              {student.averageGrade || 0}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="byCourse" className="space-y-6 mt-6 relative">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coursePerformance.map((course) => (
                <Card
                  key={course.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedCourse(String(course.id))
                    setSelectedView('overview')
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{course.code}</CardTitle>
                        <CardDescription className="text-sm mt-1">{course.name}</CardDescription>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {course.section ? `Sec ${course.section}` : 'Section —'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <BookOpen className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">{course.academicTerm || '—'}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Students</p>
                          <p className="text-2xl font-bold text-green-700">{course.studentCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Avg Grade</p>
                          <p className="text-2xl font-bold text-blue-700">{course.avgGrade}%</p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">At-Risk Students</span>
                          <span className={course.atRisk > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                            {course.atRisk} {course.atRisk === 1 ? 'student' : 'students'}
                          </span>
                        </div>
                        {course.atRisk > 0 && (
                          <div className="w-full bg-red-100 rounded-full h-2">
                            <div
                              className="bg-red-600 h-2 rounded-full"
                              style={{ width: `${course.studentCount ? (course.atRisk / course.studentCount) * 100 : 0}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500 mb-1">Assessments</p>
                        <p className="text-sm font-medium">{course.assessmentCount ?? 0}</p>
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
