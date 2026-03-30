import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  User,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  BookOpen,
  CheckCircle,
  Award,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  BarChart3,
  GraduationCap
} from 'lucide-react'
import { Progress } from './ui/progress'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCourse, setSelectedCourse] = useState('All Courses')
  const [expandedStudents, setExpandedStudents] = useState(new Set())
  const [sortBy, setSortBy] = useState('name')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/students', {
          headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
          credentials: 'same-origin',
        })
        if (!res.ok) throw new Error('Failed to load students')
        const data = await res.json()

        const mapped = (data.students || []).map((s) => ({
          id: String(s.id),
          name: s.name || 'Unknown',
          studentId: s.studentNumber || String(s.id),
          email: s.email || null,
          photoUrl: s.photoUrl || null,
          course: s.course?.course_code || s.course?.course_name || '—',
          section: s.course?.section || '',
          activities: (s.activities || []).map((a) => ({
            id: a.id || a.assessmentId,
            title: a.title || 'Untitled',
            type: a.type || 'Assignment',
            score: a.score,
            maxScore: a.maxScore || 100,
            submittedDate: a.submittedDate || null,
            weight: a.weight || 0,
            state: a.state,
            late: a.late,
          })),
        }))

        if (!cancelled) {
          setStudents(mapped)
          setError(null)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Get unique courses
  const courses = useMemo(() => ['All Courses', ...Array.from(new Set(students.map(s => s.course).filter(Boolean)) )], [students])

  const calculateWeightedAverage = (activities) => {
    const totalWeight = activities.reduce((sum, a) => sum + (a.weight || 0), 0)
    const weightedSum = activities.reduce((sum, a) => sum + ((a.score !== null && a.maxScore) ? (a.score / a.maxScore * 100 * (a.weight || 0)) : 0), 0)
    if (totalWeight > 0) return weightedSum / totalWeight
    // fallback to simple average if no weights
    const scored = activities.filter(a => a.score !== null && a.maxScore)
    if (scored.length === 0) return 0
    return scored.reduce((acc, a) => acc + (a.score / a.maxScore * 100), 0) / scored.length
  }

  const calculateSimpleAverage = (activities) => {
    const scored = activities.filter(a => a.score !== null && a.maxScore)
    if (scored.length === 0) return 0
    return scored.reduce((acc, a) => acc + (a.score / a.maxScore * 100), 0) / scored.length
  }

  const getFilteredStudents = () => {
    let filtered = students

    if (selectedCourse !== 'All Courses') {
      filtered = filtered.filter(s => s.course === selectedCourse)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.studentId || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      )
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'average') return calculateWeightedAverage(b.activities) - calculateWeightedAverage(a.activities)
      return (a.studentId || '').localeCompare(b.studentId || '')
    })

    return filtered
  }

  const toggleStudentExpanded = (studentId) => {
    setExpandedStudents(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  const getAverageColor = (average) => {
    if (average >= 90) return 'text-green-700'
    if (average >= 80) return 'text-blue-600'
    if (average >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAverageBgColor = (average) => {
    if (average >= 90) return 'bg-green-100'
    if (average >= 80) return 'bg-blue-100'
    if (average >= 70) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getPerformanceTrend = (average) => {
    if (average >= 90) return { icon: TrendingUp, color: 'text-green-600', label: 'Excellent' }
    if (average >= 80) return { icon: TrendingUp, color: 'text-blue-600', label: 'Good' }
    if (average >= 70) return { icon: Minus, color: 'text-yellow-600', label: 'Average' }
    return { icon: TrendingDown, color: 'text-red-600', label: 'Needs Improvement' }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'Assignment': return 'bg-blue-100 text-blue-800'
      case 'Quiz': return 'bg-purple-100 text-purple-800'
      case 'Exam': return 'bg-red-100 text-red-800'
      case 'Lab': return 'bg-orange-100 text-orange-800'
      case 'Project': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredStudents = getFilteredStudents()

  const totalStudents = filteredStudents.length
  const overallAverage = totalStudents > 0
    ? filteredStudents.reduce((sum, s) => sum + calculateWeightedAverage(s.activities), 0) / totalStudents
    : 0
  const excellentCount = filteredStudents.filter(s => calculateWeightedAverage(s.activities) >= 90).length
  const strugglingCount = filteredStudents.filter(s => calculateWeightedAverage(s.activities) < 70).length

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-green-700 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-600">Loading students and activities from Google Classroom...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Students</h1>
          <p className="text-gray-600">View student performance and grades across all activities</p>
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
              <div className="text-2xl font-bold text-blue-600">{totalStudents}</div>
              <p className="text-xs text-gray-600 mt-1">{selectedCourse === 'All Courses' ? 'across all courses' : `in ${selectedCourse}`}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-green-600" />
                Class Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{overallAverage.toFixed(1)}%</div>
              <p className="text-xs text-gray-600 mt-1">weighted average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-600" />
                Excellent (90%+)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{excellentCount}</div>
              <p className="text-xs text-gray-600 mt-1">{totalStudents > 0 ? `${((excellentCount / totalStudents) * 100).toFixed(0)}% of class` : '0%'}</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-orange-600" />
                At Risk (&lt;70%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{strugglingCount}</div>
              <p className="text-xs text-orange-600 mt-1">needs attention</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input type="text" placeholder="Search by name, ID, or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500">
                  {courses.map(course => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="name">Sort by Name</option>
                  <option value="average">Sort by Average</option>
                  <option value="id">Sort by Student ID</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredStudents.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-gray-500 py-8">
                  <User className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No students found matching your criteria.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredStudents.map((student) => {
              const weightedAverage = calculateWeightedAverage(student.activities)
              const simpleAverage = calculateSimpleAverage(student.activities)
              const isExpanded = expandedStudents.has(student.id)
              const trend = getPerformanceTrend(weightedAverage)
              const TrendIcon = trend.icon

              return (
                <Card key={student.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="bg-green-100 rounded-full p-2">
                            <User className="w-5 h-5 text-green-700" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{student.name}</CardTitle>
                            <CardDescription className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1">
                                <span className="font-medium">{student.studentId}</span>
                              </span>
                              <span>•</span>
                              <span>{student.email}</span>
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-12 text-sm">
                          <Badge className="bg-blue-100 text-blue-800">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {student.course}
                          </Badge>
                          <Badge variant="outline">{student.section}</Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendIcon className={`w-4 h-4 ${trend.color}`} />
                            <span className={`text-xs font-medium ${trend.color}`}>{trend.label}</span>
                          </div>
                          <div className={`text-2xl font-bold ${getAverageColor(weightedAverage)}`}>{weightedAverage.toFixed(1)}%</div>
                          <div className="text-xs text-gray-600">weighted avg</div>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => toggleStudentExpanded(student.id)}>
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4 mr-2" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4 mr-2" />
                              View Details
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                          <div className={`rounded-lg p-4 ${getAverageBgColor(weightedAverage)}`}>
                            <div className="text-sm text-gray-600 mb-1">Weighted Average</div>
                            <div className={`text-2xl font-bold ${getAverageColor(weightedAverage)}`}>{weightedAverage.toFixed(2)}%</div>
                            <div className="text-xs text-gray-600 mt-1">based on activity weights</div>
                          </div>

                          <div className={`rounded-lg p-4 ${getAverageBgColor(simpleAverage)}`}>
                            <div className="text-sm text-gray-600 mb-1">Simple Average</div>
                            <div className={`text-2xl font-bold ${getAverageColor(simpleAverage)}`}>{simpleAverage.toFixed(2)}%</div>
                            <div className="text-xs text-gray-600 mt-1">unweighted calculation</div>
                          </div>

                          <div className="rounded-lg p-4 bg-gray-100">
                            <div className="text-sm text-gray-600 mb-1">Activities Completed</div>
                            <div className="text-2xl font-bold text-gray-900">{student.activities.length}</div>
                            <div className="text-xs text-gray-600 mt-1">graded submissions</div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Graded Activities
                          </h4>
                          <div className="space-y-3">
                            {student.activities.map((activity) => {
                              const percentage = (activity.score !== null && activity.maxScore) ? (activity.score / activity.maxScore) * 100 : 0
                              return (
                                <div key={activity.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-green-300 transition-colors">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h5 className="font-medium text-gray-900">{activity.title}</h5>
                                        <Badge className={getTypeColor(activity.type)}>{activity.type}</Badge>
                                      </div>
                                      <div className="flex items-center gap-3 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          {activity.submittedDate ? new Date(activity.submittedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                        </span>
                                        <span>•</span>
                                        <span className="font-medium">Weight: {activity.weight || 0}%</span>
                                      </div>
                                    </div>

                                    <div className="text-right ml-4">
                                      <div className={`text-xl font-bold ${getAverageColor(percentage)}`}>{activity.score !== null ? `${activity.score}/${activity.maxScore}` : '—'}</div>
                                      <div className={`text-sm font-medium ${getAverageColor(percentage)}`}>{percentage.toFixed(1)}%</div>
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    <Progress value={percentage} className={`${percentage >= 90 ? 'bg-green-200' : percentage >= 80 ? 'bg-blue-200' : percentage >= 70 ? 'bg-yellow-200' : 'bg-red-200'} h-2`} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
