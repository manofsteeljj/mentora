import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Plus, FileText, Calculator, TrendingUp, GraduationCap, BookOpen, Trash2, BarChart3 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

export default function GradingSystem() {
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedGradingPeriod, setSelectedGradingPeriod] = useState(() => {
    try {
      return window.localStorage.getItem('mentora_last_grading_period') || '1st'
    } catch {
      return '1st'
    }
  })
  const [showCreateAssessment, setShowCreateAssessment] = useState(false)
  const [students, setStudents] = useState([])
  const [assessments, setAssessments] = useState([])
  const [grades, setGrades] = useState([])

  const [newAssessment, setNewAssessment] = useState({
    name: '',
    description: '',
    type: 'quiz',
    maxScore: 100,
    weight: 10,
  })

  const selectedCourseInfo = useMemo(
    () => courses.find(c => String(c.id) === String(selectedCourse)),
    [courses, selectedCourse]
  )

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
    const list = Array.isArray(data) ? data : []
    setCourses(list)
    if (!selectedCourse && list.length > 0) {
      setSelectedCourse(String(list[0].id))
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
    const list = Array.isArray(data?.students) ? data.students : []
    setStudents(list.map(s => ({
      id: String(s.id),
      name: s.name,
      studentId: s.student_number || s.studentId || '',
    })))
  }, [])

  const fetchAssessments = useCallback(async (courseId, gradingPeriod) => {
    if (!courseId || !gradingPeriod) return
    const res = await fetch(`/api/gradebook/assessments?course_id=${encodeURIComponent(courseId)}&grading_period=${encodeURIComponent(gradingPeriod)}`, {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
    if (!res.ok) throw new Error('Failed to load assessments')
    const data = await res.json()
    const list = Array.isArray(data?.assessments) ? data.assessments : []
    setAssessments(list.map(a => ({
      id: String(a.id),
      name: a.name,
      description: a.description,
      type: a.type,
      maxScore: Number(a.max_score ?? a.maxScore ?? 0),
      weight: Number(a.weight ?? 0),
      gradingPeriod: a.grading_period || a.gradingPeriod || gradingPeriod,
    })))
  }, [])

  const fetchGrades = useCallback(async (courseId, gradingPeriod) => {
    if (!courseId || !gradingPeriod) return
    const res = await fetch(`/api/gradebook/grades?course_id=${encodeURIComponent(courseId)}&grading_period=${encodeURIComponent(gradingPeriod)}`, {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
    if (!res.ok) throw new Error('Failed to load grades')
    const data = await res.json()
    const list = Array.isArray(data?.grades) ? data.grades : []
    setGrades(list.map(g => ({
      studentId: String(g.student_id ?? g.studentId),
      assessmentId: String(g.assessment_id ?? g.assessmentId),
      score: g.score === null || g.score === undefined ? null : Number(g.score),
    })))
  }, [])

  const upsertGrades = useCallback(async (rows) => {
    if (!selectedCourse || !selectedGradingPeriod) return
    if (!Array.isArray(rows) || rows.length === 0) return

    await fetch('/api/gradebook/grades', {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        course_id: Number(selectedCourse),
        grading_period: selectedGradingPeriod,
        grades: rows.map(r => ({
          student_id: Number(r.studentId),
          assessment_id: Number(r.assessmentId),
          score: r.score === '' || r.score === undefined ? null : r.score,
        })),
      }),
    })
  }, [selectedCourse, selectedGradingPeriod])

  useEffect(() => {
    fetchCourses().catch(() => {})
  }, [fetchCourses])

  useEffect(() => {
    if (!selectedCourse) return
    fetchStudents(selectedCourse).catch(() => {})
  }, [selectedCourse, fetchStudents])

  useEffect(() => {
    if (!selectedCourse || !selectedGradingPeriod) return
    fetchAssessments(selectedCourse, selectedGradingPeriod).catch(() => {})
    fetchGrades(selectedCourse, selectedGradingPeriod).catch(() => {})
  }, [selectedCourse, selectedGradingPeriod, fetchAssessments, fetchGrades])

  useEffect(() => {
    try {
      window.localStorage.setItem('mentora_last_grading_period', selectedGradingPeriod)
    } catch {}
  }, [selectedGradingPeriod])

  const getFilteredAssessments = () => {
    return assessments.filter(a => a.gradingPeriod === selectedGradingPeriod)
  }

  const getGrade = (studentId, assessmentId) => {
    const grade = grades.find(g => g.studentId === studentId && g.assessmentId === assessmentId)
    return grade?.score
  }

  const updateGrade = (studentId, assessmentId, score) => {
    setGrades(prev => {
      const existing = prev.find(g => g.studentId === studentId && g.assessmentId === assessmentId)
      if (existing) {
        return prev.map(g =>
          g.studentId === studentId && g.assessmentId === assessmentId
            ? { ...g, score }
            : g
        )
      }
      return [...prev, { studentId, assessmentId, score }]
    })
  }

  const calculateFinalGrade = (studentId) => {
    const periodAssessments = getFilteredAssessments()
    let totalWeightedScore = 0
    let totalWeight = 0

    periodAssessments.forEach(assessment => {
      const grade = getGrade(studentId, assessment.id)
      if (typeof grade === 'number') {
        const percentage = (grade / assessment.maxScore) * 100
        totalWeightedScore += percentage * (assessment.weight / 100)
        totalWeight += assessment.weight
      }
    })

    return totalWeight > 0 ? totalWeightedScore : 0
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'quiz': return 'bg-blue-100 text-blue-800'
      case 'activity': return 'bg-green-100 text-green-800'
      case 'exam': return 'bg-red-100 text-red-800'
      case 'project': return 'bg-purple-100 text-purple-800'
      case 'assignment': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getNextAssessmentNumber = (type) => {
    const typeAssessments = assessments.filter(
      a => a.type === type && a.gradingPeriod === selectedGradingPeriod
    )
    return typeAssessments.length + 1
  }

  const getClassAverage = () => {
    if (students.length === 0) return 0
    const averages = students.map(s => calculateFinalGrade(s.id))
    return averages.reduce((acc, avg) => acc + avg, 0) / students.length || 0
  }

  const handleCreateAssessment = async () => {
    if (!selectedCourse) return
    if (!newAssessment.name.trim()) return

    await fetch('/api/gradebook/assessments', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        course_id: Number(selectedCourse),
        grading_period: selectedGradingPeriod,
        name: newAssessment.name,
        description: newAssessment.description || null,
        type: newAssessment.type,
        max_score: Number(newAssessment.maxScore) || 1,
        weight: Number(newAssessment.weight) || 0,
      }),
    })

    setNewAssessment({ name: '', description: '', type: 'quiz', maxScore: 100, weight: 10 })
    setShowCreateAssessment(false)
    await fetchAssessments(selectedCourse, selectedGradingPeriod).catch(() => {})
  }

  const handleDeleteAssessment = async (assessmentId) => {
    await fetch(`/api/gradebook/assessments/${encodeURIComponent(assessmentId)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
    })
    await fetchAssessments(selectedCourse, selectedGradingPeriod).catch(() => {})
    await fetchGrades(selectedCourse, selectedGradingPeriod).catch(() => {})
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50 relative">
      <div className="p-6 max-w-[1800px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Grading System</h1>
          <p className="text-gray-600">Manage student grades and assessments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Select Course</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {(c.course_name || 'Untitled Course')}{c.course_code ? ` (${c.course_code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Grading Period</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedGradingPeriod} onValueChange={setSelectedGradingPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select grading period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1st">1st Grading Period</SelectItem>
                  <SelectItem value="2nd">2nd Grading Period</SelectItem>
                  <SelectItem value="3rd">3rd Grading Period</SelectItem>
                  <SelectItem value="4th">4th Grading Period</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                Total Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{students.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-600" />
                Assessments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{getFilteredAssessments().length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Class Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{getClassAverage().toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calculator className="w-4 h-4 text-orange-600" />
                Total Weight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {getFilteredAssessments().reduce((acc, a) => acc + a.weight, 0)}%
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <Button className="bg-green-700 hover:bg-green-800" onClick={() => setShowCreateAssessment(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Assessment
          </Button>

          <Dialog open={showCreateAssessment} onOpenChange={setShowCreateAssessment}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Assessment</DialogTitle>
                <DialogDescription>
                    Add a new quiz, activity, exam, or project for {selectedGradingPeriod} grading period{selectedCourseInfo?.course_name ? ` (${selectedCourseInfo.course_name})` : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Assessment Type</Label>
                  <Select
                    value={newAssessment.type}
                    onValueChange={(value) => {
                      setNewAssessment(prev => ({ ...prev, type: value }))
                      const number = getNextAssessmentNumber(value)
                      const typeName = value.charAt(0).toUpperCase() + value.slice(1)
                      setNewAssessment(prev => ({ ...prev, name: `${typeName} ${number}` }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="activity">Activity</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assessment Name</Label>
                  <Input
                    value={newAssessment.name}
                    onChange={(e) => setNewAssessment(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Quiz 1, Activity 2"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newAssessment.description}
                    onChange={(e) => setNewAssessment(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional notes about coverage, instructions, or scope"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Maximum Score</Label>
                    <Input
                      type="number"
                      value={newAssessment.maxScore}
                      onChange={(e) => setNewAssessment(prev => ({ ...prev, maxScore: Number(e.target.value) }))}
                      min="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Weight (%)</Label>
                    <Input
                      type="number"
                      value={newAssessment.weight}
                      onChange={(e) => setNewAssessment(prev => ({ ...prev, weight: Number(e.target.value) }))}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <Button onClick={handleCreateAssessment} className="w-full bg-green-700 hover:bg-green-800">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Assessment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Grade Sheet - {selectedGradingPeriod} Grading Period
            </CardTitle>
            <CardDescription>
              Enter student scores for each assessment. Final grades are automatically calculated based on weighted scores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left p-3 bg-gray-50 sticky left-0 z-10 min-w-[200px]">Student Name</th>
                    <th className="text-left p-3 bg-gray-50 min-w-[120px]">Student ID</th>
                    {getFilteredAssessments().map(assessment => (
                      <th key={assessment.id} className="p-3 bg-gray-50 min-w-[140px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{assessment.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-red-100"
                              onClick={() => handleDeleteAssessment(assessment.id)}
                            >
                              <Trash2 className="w-3 h-3 text-red-600" />
                            </Button>
                          </div>
                          <Badge className={`${getTypeColor(assessment.type)} text-xs`}>{assessment.type}</Badge>
                          {assessment.description ? (
                            <div className="text-xs text-gray-600">{assessment.description}</div>
                          ) : null}
                          <div className="text-xs text-gray-500">/{assessment.maxScore} ({assessment.weight}%)</div>
                        </div>
                      </th>
                    ))}
                    <th className="p-3 bg-green-100 min-w-[120px] sticky right-0 z-10">
                      <div className="text-sm font-medium text-green-900">Final Grade</div>
                      <div className="text-xs text-green-700">Weighted</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => (
                    <tr key={student.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="p-3 font-medium sticky left-0 bg-inherit z-10">{student.name}</td>
                      <td className="p-3 text-sm text-gray-600">{student.studentId}</td>
                      {getFilteredAssessments().map(assessment => (
                        <td key={assessment.id} className="p-3">
                          <Input
                            type="number"
                            min="0"
                            max={assessment.maxScore}
                            value={getGrade(student.id, assessment.id) ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value
                              if (raw === '') {
                                updateGrade(student.id, assessment.id, null)
                                return
                              }
                              const score = Number(raw)
                              if (!Number.isNaN(score) && score <= assessment.maxScore) {
                                updateGrade(student.id, assessment.id, score)
                              }
                            }}
                            onBlur={() => {
                              const score = getGrade(student.id, assessment.id)
                              upsertGrades([{ studentId: student.id, assessmentId: assessment.id, score }]).catch(() => {})
                            }}
                            className="w-20 text-center"
                            placeholder="0"
                          />
                        </td>
                      ))}
                      <td className="p-3 sticky right-0 bg-green-100 z-10">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-900">{calculateFinalGrade(student.id).toFixed(2)}%</div>
                          <Badge className={
                            calculateFinalGrade(student.id) >= 90 ? 'bg-green-600' :
                              calculateFinalGrade(student.id) >= 80 ? 'bg-blue-600' :
                                calculateFinalGrade(student.id) >= 75 ? 'bg-yellow-600' :
                                  'bg-red-600'
                          }>
                            {calculateFinalGrade(student.id) >= 90 ? 'Excellent' :
                              calculateFinalGrade(student.id) >= 80 ? 'Good' :
                                calculateFinalGrade(student.id) >= 75 ? 'Fair' :
                                  'Needs Improvement'}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-100">
                    <td className="p-3 font-bold sticky left-0 bg-gray-100 z-10" colSpan={2}>Class Average</td>
                    {getFilteredAssessments().map(assessment => {
                      const scores = students.map(s => getGrade(s.id, assessment.id) ?? 0)
                      const avg = students.length ? (scores.reduce((acc, score) => acc + score, 0) / students.length) : 0
                      return (
                        <td key={assessment.id} className="p-3 text-center font-medium">
                          {avg.toFixed(1)}/{assessment.maxScore}
                        </td>
                      )
                    })}
                    <td className="p-3 text-center font-bold text-lg sticky right-0 bg-green-100 z-10">{getClassAverage().toFixed(2)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Final Grades Summary - {selectedGradingPeriod} Grading Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map(student => {
                const finalGrade = calculateFinalGrade(student.id)
                return (
                  <Card key={student.id} className="border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{student.name}</CardTitle>
                      <CardDescription className="text-xs">{student.studentId}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-bold text-green-700">{finalGrade.toFixed(2)}%</div>
                        <Badge className={`text-sm ${
                          finalGrade >= 90 ? 'bg-green-600' :
                            finalGrade >= 80 ? 'bg-blue-600' :
                              finalGrade >= 75 ? 'bg-yellow-600' :
                                'bg-red-600'
                        }`}>
                          {finalGrade >= 90 ? 'Excellent' :
                            finalGrade >= 80 ? 'Good' :
                              finalGrade >= 75 ? 'Fair' :
                                'Needs Improvement'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
