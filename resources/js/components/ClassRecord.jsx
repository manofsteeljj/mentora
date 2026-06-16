import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  BookOpen,
  Filter,
  Search,
  Download,
  Save,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  X,
} from 'lucide-react'
import { Progress } from './ui/progress'
import { formatCourseLabel } from '../lib/courseDisplay'

// ─── DepEd Transmutation ──────────────────────────────────────────────────────
function transmute(g) {
  g = Number(g)
  if (isNaN(g)) return null
  if (g >= 100) return 100
  if (g < 0) return 60
  const table = [
    [98.40,100],[96.80,99],[95.20,98],[93.60,97],[92.00,96],
    [90.40,95],[88.80,94],[87.20,93],[85.60,92],[84.00,91],
    [82.40,90],[80.80,89],[79.20,88],[77.60,87],[76.00,86],
    [74.40,85],[72.80,84],[71.20,83],[69.60,82],[68.00,81],
    [66.40,80],[64.80,79],[63.20,78],[61.60,77],[60.00,76],
    [56.00,75],[52.00,74],[48.00,73],[44.00,72],[40.00,71],
    [36.00,70],[32.00,69],[28.00,68],[24.00,67],[20.00,66],
    [16.00,65],[12.00,64],[8.00,63],[4.00,62],[0,61],
  ]
  for (let i = 0; i < table.length - 1; i++) {
    if (g >= table[i][0]) return table[i][1]
  }
  return 61
}

// ─── Subject weights ──────────────────────────────────────────────────────────
function getWeights(subject) {
  const upper = (subject || '').toUpperCase()
  if (upper.includes('MATH'))                        return { ww: 0.40, pt: 0.40, qa: 0.20 }
  if (upper.includes('SCIENCE'))                     return { ww: 0.40, pt: 0.40, qa: 0.20 }
  if (upper.includes('TLE') || upper.includes('PANTAHANAN')) return { ww: 0.20, pt: 0.60, qa: 0.20 }
  return { ww: 0.30, pt: 0.50, qa: 0.20 }
}

function quarterLabel(q) {
  const map = { '1st': 'FIRST QUARTER', '2nd': 'SECOND QUARTER', '3rd': 'THIRD QUARTER', '4th': 'FOURTH QUARTER' }
  return map[q] || (q + ' QUARTER')
}

// ─── Build one DepEd sheet ────────────────────────────────────────────────────
function buildDepEdSheet(XLSX, wb, sheetName, course, students, gradebook, teacherName) {
  const aoa = [] // array of arrays

  const subject = (course.course_name || '').toUpperCase()
  const weights = getWeights(subject)
  const section = course.section || ''
  const schoolYear = course.academic_term || ''
  const period = gradebook?.period || '4th'
  const qLabel = quarterLabel(period)

  const wwPct = Math.round(weights.ww * 100)
  const ptPct = Math.round(weights.pt * 100)
  const qaPct = Math.round(weights.qa * 100)

  // Header rows
  aoa.push(['Class Record'])
  aoa.push(['(Pursuant to Deped Order 8 series of 2015)'])
  aoa.push([])
  aoa.push(['', 'REGION', '', '', 1, '', 'DIVISION', '', 'LA UNION', '', 'DISTRICT', '', ''])
  aoa.push(['SCHOOL NAME', '', '', '', '', '', '', '', '', 'SCHOOL ID', '', ''])
  aoa.push([qLabel, '', '', 'GRADE & SECTION:', '', section, '', 'TEACHER:', '', teacherName, '', 'SCHOOL YEAR:', '', schoolYear])
  aoa.push(['LEARNERS\' NAMES', '', '', '', '', '', '', 'SUBJECT:', '', course.course_name || ''])
  aoa.push([])

  // Column headers
  const wwHdr = [`WRITTEN WORKS (${wwPct}%)`]
  for (let i = 1; i < 10; i++) wwHdr.push('')
  wwHdr.push('Total', 'PS', 'WS')

  const ptHdr = [`PERFORMANCE TASKS (${ptPct}%)`]
  for (let i = 1; i < 10; i++) ptHdr.push('')
  ptHdr.push('Total', 'PS', 'WS')

  const qaHdr = [`QUARTERLY ASSESSMENT (${qaPct}%)`, '', 'PS', 'WS']

  aoa.push(['', ...wwHdr, ...ptHdr, ...qaHdr, 'Initial', 'Quarterly'])

  // Sub-header: item numbers
  const wwNums = ['']; for (let i = 1; i <= 10; i++) wwNums.push(i); wwNums.push('Total', 'PS', 'WS')
  const ptNums = []; for (let i = 1; i <= 10; i++) ptNums.push(i); ptNums.push('Total', 'PS', 'WS')
  const qaNums = ['1', '', 'PS', 'WS']
  aoa.push([...wwNums, ...ptNums, ...qaNums, '', ''])

  // HPS row
  const wwHps = new Array(13).fill(''); wwHps[10] = 100; wwHps[11] = 100; wwHps[12] = `${wwPct}%`
  const ptHps = new Array(13).fill(''); ptHps[10] = 100; ptHps[11] = 100; ptHps[12] = `${ptPct}%`
  const qaHps = [40, '', 100, `${qaPct}%`]
  aoa.push(['HIGHEST POSSIBLE SCORE', ...wwHps, ...ptHps, ...qaHps, '', ''])

  // Build grade map
  const assessments = gradebook?.assessments || []
  const grades = gradebook?.grades || []
  const gradeMap = {}
  for (const g of grades) {
    if (!gradeMap[g.student_id]) gradeMap[g.student_id] = {}
    gradeMap[g.student_id][g.assessment_id] = g.score
  }

  const wwAssess = assessments.filter(a => ['activity', 'quiz'].includes(a.type))
  const ptAssess = assessments.filter(a => ['project', 'assignment'].includes(a.type))
  const qaAssess = assessments.filter(a => a.type === 'exam')

  // Student rows helper
  const buildRow = (num, student) => {
    const sg = gradeMap[student.id] || {}

    // WW
    const wwScores = new Array(10).fill('')
    let wwRaw = 0, wwMax = 0
    for (let i = 0; i < Math.min(wwAssess.length, 10); i++) {
      const sc = sg[wwAssess[i].id]
      if (sc != null) { wwScores[i] = Number(sc); wwRaw += Number(sc); wwMax += Number(wwAssess[i].max_score || 100) }
    }
    const wwPs = wwMax > 0 ? Math.round((wwRaw / wwMax) * 10000) / 100 : null
    const wwWs = wwPs != null ? Math.round(wwPs * weights.ww * 100) / 100 : ''
    const wwRow = [...wwScores, wwMax > 0 ? wwRaw : '', wwPs ?? '', wwWs]

    // PT
    const ptScores = new Array(10).fill('')
    let ptRaw = 0, ptMax = 0
    for (let i = 0; i < Math.min(ptAssess.length, 10); i++) {
      const sc = sg[ptAssess[i].id]
      if (sc != null) { ptScores[i] = Number(sc); ptRaw += Number(sc); ptMax += Number(ptAssess[i].max_score || 100) }
    }
    const ptPs = ptMax > 0 ? Math.round((ptRaw / ptMax) * 10000) / 100 : null
    const ptWs = ptPs != null ? Math.round(ptPs * weights.pt * 100) / 100 : ''
    const ptRow = [...ptScores, ptMax > 0 ? ptRaw : '', ptPs ?? '', ptWs]

    // QA
    let qaScore = '', qaPs = null, qaWs = ''
    if (qaAssess.length > 0) {
      const sc = sg[qaAssess[0].id]
      if (sc != null) {
        qaScore = Number(sc)
        const qMax = Number(qaAssess[0].max_score || 40)
        qaPs = Math.round((Number(sc) / qMax) * 10000) / 100
        qaWs = Math.round(qaPs * weights.qa * 100) / 100
      }
    }
    const qaRow = [qaScore, '', qaPs ?? '', qaWs]

    // Initial grade
    let initialGrade = ''
    let quarterly = ''
    if (wwPs != null && ptPs != null && qaPs != null) {
      initialGrade = Math.round((wwPs * weights.ww + ptPs * weights.pt + qaPs * weights.qa) * 100) / 100
    } else {
      const periodKey = { '1st': 'first', '2nd': 'second', '3rd': 'third', '4th': 'fourth' }[period]
      const avg = student.grades?.[periodKey]
      if (avg != null) initialGrade = Math.round(avg * 100) / 100
    }
    if (initialGrade !== '') quarterly = transmute(initialGrade) ?? ''

    return [num, student.name, ...wwRow, ...ptRow, ...qaRow, initialGrade, quarterly]
  }

  const males = students.filter(s => (s.gender || '').toUpperCase() !== 'F')
  const females = students.filter(s => (s.gender || '').toUpperCase() === 'F')

  aoa.push(['MALE'])
  let idx = 1
  for (const s of males) { aoa.push(buildRow(idx++, s)) }

  aoa.push(['FEMALE'])
  idx = 1
  for (const s of females) { aoa.push(buildRow(idx++, s)) }

  aoa.push([])
  aoa.push(['', 'MEAN'])
  aoa.push(['', '% OF MASTERY'])
  aoa.push([])
  aoa.push(['Prepared by:', '', '', '', '', 'Noted:'])
  aoa.push([teacherName])
  aoa.push(['Teacher'])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
}

// ─── Export entry point ───────────────────────────────────────────────────────
async function exportDepEdExcel(courses, classRows, gradebookByCourse, teacherName) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const studentsByCourse = {}
  for (const s of classRows) {
    const cid = String(s.courseId || '')
    if (!studentsByCourse[cid]) studentsByCourse[cid] = []
    studentsByCourse[cid].push(s)
  }

  for (const course of courses) {
    const cid = String(course.id)
    const courseStudents = studentsByCourse[cid] || []
    if (!courseStudents.length) continue
    const gradebook = gradebookByCourse[cid] || null
    const sheetName = (course.course_code || course.course_name || 'SUBJ').replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 28)
    buildDepEdSheet(XLSX, wb, sheetName, course, courseStudents, gradebook, teacherName)
  }

  if (!wb.SheetNames.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data']]), 'Sheet1')
  }

  XLSX.writeFile(wb, `ClassRecord_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export default function ClassRecord() {
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [teacherName, setTeacherName] = useState('')
  const [gradebookByCourse, setGradebookByCourse] = useState({})

  const [selectedCourse, setSelectedCourse] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [gradeOverrides, setGradeOverrides] = useState({})

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
  }, [])

  const fetchStudents = useCallback(async (courseId) => {
    setLoading(true)
    try {
      const url = courseId
        ? `/api/students?course_id=${encodeURIComponent(courseId)}`
        : '/api/students'

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('Failed to load students')
      const data = await res.json()
      setStudents(data.students || [])
      setError(null)
    } catch (e) {
      setError(e?.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCourses().catch(() => {})
  }, [fetchCourses])

  useEffect(() => {
    fetchStudents(selectedCourse).catch(() => {})
  }, [selectedCourse, fetchStudents])

  // Fetch logged-in user name for the teacher field in export
  useEffect(() => {
    fetch('/api/user', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : {})
      .then(data => setTeacherName(data?.name || ''))
      .catch(() => {})
  }, [])

  // Fetch gradebook assessments + grades for export
  useEffect(() => {
    if (!courses.length) return
    const coursesToFetch = selectedCourse
      ? [selectedCourse]
      : courses.map(c => c.id)
    const periods = ['1st', '2nd', '3rd', '4th']

    Promise.all(
      coursesToFetch.flatMap(courseId =>
        periods.map(period =>
          Promise.all([
            fetch(`/api/gradebook/assessments?course_id=${courseId}&grading_period=${encodeURIComponent(period)}`, {
              headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
              credentials: 'same-origin',
            }).then(r => r.ok ? r.json() : { assessments: [] }),
            fetch(`/api/gradebook/grades?course_id=${courseId}&grading_period=${encodeURIComponent(period)}`, {
              headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
              credentials: 'same-origin',
            }).then(r => r.ok ? r.json() : { grades: [] }),
          ]).then(([aData, gData]) => ({
            courseId: String(courseId),
            period,
            assessments: aData.assessments || [],
            grades: gData.grades || [],
          }))
        )
      )
    )
      .then(results => {
        // Pick the period with the most grade data per course
        const map = {}
        for (const result of results) {
          const cid = result.courseId
          const score = result.grades.length + result.assessments.length
          if (!map[cid] || score > (map[cid].grades.length + map[cid].assessments.length)) {
            map[cid] = result
          }
        }
        setGradebookByCourse(map)
      })
      .catch(() => {})
  }, [courses, selectedCourse])

  const courseOptions = useMemo(() => {
    return courses.map(c => ({
      id: String(c.id),
      label: formatCourseLabel(c),
    }))
  }, [courses])

  // Auto-select first course once courses load
  useEffect(() => {
    if (!selectedCourse && courseOptions.length > 0) {
      setSelectedCourse(courseOptions[0].id)
    }
  }, [courseOptions, selectedCourse])

  const splitIntoFour = (items) => {
    const n = items.length
    if (n === 0) return [[], [], [], []]
    const base = Math.floor(n / 4)
    const rem = n % 4
    const sizes = [0, 1, 2, 3].map(i => base + (i < rem ? 1 : 0))
    const result = []
    let cursor = 0
    for (const size of sizes) {
      result.push(items.slice(cursor, cursor + size))
      cursor += size
    }
    return result
  }

  const averagePercent = (items) => {
    const scored = items.filter(a => a && a.score !== null && a.score !== undefined)
    if (scored.length === 0) return null
    const sum = scored.reduce((acc, a) => {
      const max = Number(a.maxScore || 100) || 100
      const score = Number(a.score)
      if (!Number.isFinite(score) || max <= 0) return acc
      return acc + (score / max) * 100
    }, 0)
    return sum / scored.length
  }

  const classRows = useMemo(() => {
    return students.map(s => {
      const activities = Array.isArray(s.activities) ? s.activities : []
      const scoredSorted = activities
        .filter(a => a && a.score !== null && a.score !== undefined)
        .slice()
        .sort((a, b) => {
          const da = new Date(a.submittedDate || 0).getTime()
          const db = new Date(b.submittedDate || 0).getTime()
          return da - db
        })

      const [p1, p2, p3, p4] = splitIntoFour(scoredSorted)

      const computed = {
        first: averagePercent(p1),
        second: averagePercent(p2),
        third: averagePercent(p3),
        fourth: averagePercent(p4),
        final: s.average !== null && s.average !== undefined ? Number(s.average) : averagePercent(scoredSorted),
      }

      const pick = (period) => {
        const key = `${s.id}:${period}`
        if (Object.prototype.hasOwnProperty.call(gradeOverrides, key)) return gradeOverrides[key]
        return computed[period]
      }

      return {
        id: String(s.id),
        name: s.name,
        studentNumber: s.studentNumber || s.student_number || '',
        courseId: String(s.course?.id || ''),
        courseLabel: s.course ? `${s.course.course_code} - ${s.course.course_name}` : '—',
        section: s.course?.section || '—',
        grades: {
          first: pick('first'),
          second: pick('second'),
          third: pick('third'),
          fourth: pick('fourth'),
          final: pick('final'),
        },
      }
    })
  }, [students, gradeOverrides])

  const filteredStudents = useMemo(() => {
    return classRows.filter(student => {
      const matchesCourse = selectedCourse ? student.courseId === selectedCourse : false
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(student.studentNumber || '').includes(searchQuery)
      return matchesCourse && matchesSearch
    })
  }, [classRows, selectedCourse, searchQuery])

  const getGradeColor = (grade) => {
    if (grade === null || grade === undefined) return 'text-gray-400'
    if (grade >= 90) return 'text-green-600'
    if (grade >= 80) return 'text-blue-600'
    if (grade >= 75) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getGradeBadgeVariant = (grade) => {
    if (grade === null || grade === undefined) return 'outline'
    if (grade >= 90) return 'default'
    if (grade >= 80) return 'secondary'
    if (grade >= 75) return 'outline'
    return 'destructive'
  }

  const getPerformanceIcon = (grade) => {
    if (grade === null || grade === undefined) return <Minus className="w-4 h-4" />
    if (grade >= 85) return <TrendingUp className="w-4 h-4" />
    if (grade >= 75) return <Minus className="w-4 h-4" />
    return <TrendingDown className="w-4 h-4" />
  }

  const calculateClassAverage = (period) => {
    const validGrades = filteredStudents
      .map(s => {
        return s.grades?.[period]
      })
      .filter(g => g !== null && g !== undefined)

    if (validGrades.length === 0) return 0
    return validGrades.reduce((sum, grade) => sum + grade, 0) / validGrades.length
  }

  const handleEditGrade = (studentId, period, currentValue) => {
    setEditingCell({ studentId, period })
    setEditValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : '')
  }

  const handleSaveGrade = () => {
    if (!editingCell) return
    const parsed = Number.parseFloat(editValue)
    const next = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null

    setGradeOverrides(prev => ({
      ...prev,
      [`${editingCell.studentId}:${editingCell.period}`]: next,
    }))

    setEditingCell(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const exportCourses = selectedCourse
        ? courses.filter(c => String(c.id) === selectedCourse)
        : courses
      await exportDepEdExcel(exportCourses, classRows, gradebookByCourse, teacherName)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Class Record</h1>
              <p className="text-sm text-gray-600 mt-1">
                View and manage student grades across all grading periods
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
              <Button className="gap-2 bg-green-700 hover:bg-green-800" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting…' : 'Export to Excel'}
              </Button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {courseOptions.map(course => (
                  <option key={course.id} value={course.id}>{course.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">1st Grading</p>
                <p className="text-2xl font-bold text-green-700">
                  {calculateClassAverage('first').toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Class Average</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">2nd Grading</p>
                <p className="text-2xl font-bold text-blue-700">
                  {calculateClassAverage('second').toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Class Average</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">3rd Grading</p>
                <p className="text-2xl font-bold text-purple-700">
                  {calculateClassAverage('third').toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Class Average</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">4th Grading</p>
                <p className="text-2xl font-bold text-orange-700">
                  {calculateClassAverage('fourth').toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Class Average</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Final Grade</p>
                <p className="text-2xl font-bold text-gray-900">
                  {calculateClassAverage('final').toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Overall Average</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    Student Grade Records
                  </CardTitle>
                  <CardDescription>
                    Showing {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {courseOptions.find(c => c.id === selectedCourse)?.label || 'Select a course'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 bg-gray-50 sticky left-0">
                        Student
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 bg-green-50">
                        1st Grading
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 bg-blue-50">
                        2nd Grading
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 bg-purple-50">
                        3rd Grading
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 bg-orange-50">
                        4th Grading
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 bg-gray-50">
                        Final Grade
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 sticky left-0 bg-white">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-sm text-gray-600">{student.studentNumber || '—'}</p>
                            <p className="text-xs text-gray-500">{student.section}</p>
                          </div>
                        </td>

                        {/* 1st Grading */}
                        <td className="py-4 px-4 text-center">
                          {editingCell?.studentId === student.id && editingCell?.period === 'first' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8 text-center"
                                min="0"
                                max="100"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveGrade}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Badge
                                variant={getGradeBadgeVariant(student.grades.first)}
                                className="cursor-pointer"
                                onClick={() => handleEditGrade(student.id, 'first', student.grades.first)}
                              >
                                <span className={getGradeColor(student.grades.first)}>
                                  {student.grades.first?.toFixed(1) || 'N/A'}
                                </span>
                              </Badge>
                              {getPerformanceIcon(student.grades.first)}
                            </div>
                          )}
                          <Progress
                            value={student.grades.first || 0}
                            className="mt-2 h-1"
                          />
                        </td>

                        {/* 2nd Grading */}
                        <td className="py-4 px-4 text-center">
                          {editingCell?.studentId === student.id && editingCell?.period === 'second' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8 text-center"
                                min="0"
                                max="100"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveGrade}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Badge
                                variant={getGradeBadgeVariant(student.grades.second)}
                                className="cursor-pointer"
                                onClick={() => handleEditGrade(student.id, 'second', student.grades.second)}
                              >
                                <span className={getGradeColor(student.grades.second)}>
                                  {student.grades.second?.toFixed(1) || 'N/A'}
                                </span>
                              </Badge>
                              {getPerformanceIcon(student.grades.second)}
                            </div>
                          )}
                          <Progress
                            value={student.grades.second || 0}
                            className="mt-2 h-1"
                          />
                        </td>

                        {/* 3rd Grading */}
                        <td className="py-4 px-4 text-center">
                          {editingCell?.studentId === student.id && editingCell?.period === 'third' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8 text-center"
                                min="0"
                                max="100"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveGrade}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Badge
                                variant={getGradeBadgeVariant(student.grades.third)}
                                className="cursor-pointer"
                                onClick={() => handleEditGrade(student.id, 'third', student.grades.third)}
                              >
                                <span className={getGradeColor(student.grades.third)}>
                                  {student.grades.third?.toFixed(1) || 'N/A'}
                                </span>
                              </Badge>
                              {getPerformanceIcon(student.grades.third)}
                            </div>
                          )}
                          <Progress
                            value={student.grades.third || 0}
                            className="mt-2 h-1"
                          />
                        </td>

                        {/* 4th Grading */}
                        <td className="py-4 px-4 text-center">
                          {editingCell?.studentId === student.id && editingCell?.period === 'fourth' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8 text-center"
                                min="0"
                                max="100"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveGrade}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Badge
                                variant={getGradeBadgeVariant(student.grades.fourth)}
                                className="cursor-pointer"
                                onClick={() => handleEditGrade(student.id, 'fourth', student.grades.fourth)}
                              >
                                <span className={getGradeColor(student.grades.fourth)}>
                                  {student.grades.fourth?.toFixed(1) || 'N/A'}
                                </span>
                              </Badge>
                              {getPerformanceIcon(student.grades.fourth)}
                            </div>
                          )}
                          <Progress
                            value={student.grades.fourth || 0}
                            className="mt-2 h-1"
                          />
                        </td>

                        {/* Final Grade */}
                        <td className="py-4 px-4 text-center">
                          {editingCell?.studentId === student.id && editingCell?.period === 'final' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8 text-center"
                                min="0"
                                max="100"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveGrade}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Badge
                                variant={getGradeBadgeVariant(student.grades.final)}
                                className="cursor-pointer font-bold"
                                onClick={() => handleEditGrade(student.id, 'final', student.grades.final)}
                              >
                                <span className={getGradeColor(student.grades.final)}>
                                  {student.grades.final?.toFixed(1) || 'N/A'}
                                </span>
                              </Badge>
                              {getPerformanceIcon(student.grades.final)}
                            </div>
                          )}
                          <Progress
                            value={student.grades.final || 0}
                            className="mt-2 h-1"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredStudents.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No students found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Try adjusting your filters or search query
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
