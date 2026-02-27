import { useState } from 'react'
import {
  Trophy,
  AlertTriangle,
  TrendingUp,
  Users,
  Award,
  Star,
  BarChart3,
  BookOpen,
  Filter
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

// Mock courses data
const courses = [
  { id: '1', code: 'CS101', name: 'Introduction to Programming', section: 'A', gradingSystem: 'Percentage (100%)', totalStudents: 35, schedule: 'MWF 8:00-9:00 AM' },
  { id: '2', code: 'CS101', name: 'Introduction to Programming', section: 'B', gradingSystem: 'Percentage (100%)', totalStudents: 32, schedule: 'TTH 10:00-11:30 AM' },
  { id: '3', code: 'CS201', name: 'Data Structures & Algorithms', section: 'A', gradingSystem: 'Percentage (100%)', totalStudents: 28, schedule: 'MWF 1:00-2:00 PM' },
  { id: '4', code: 'CS301', name: 'Database Management Systems', section: 'A', gradingSystem: 'Weighted (40-30-30)', totalStudents: 25, schedule: 'TTH 2:00-3:30 PM' },
  { id: '5', code: 'IT101', name: 'Networking Fundamentals', section: 'A', gradingSystem: 'Percentage (100%)', totalStudents: 30, schedule: 'MWF 3:00-4:00 PM' },
]

// Mock student data
const allStudents = [
  // CS101 Section A
  { id: '1', name: 'Maria Santos', email: 'maria.santos@lorma.edu', averageGrade: 96, totalAssignments: 10, completedAssignments: 10, status: 'excellent', courseId: '1', section: 'A' },
  { id: '2', name: 'Juan Dela Cruz', email: 'juan.delacruz@lorma.edu', averageGrade: 94, totalAssignments: 10, completedAssignments: 10, status: 'excellent', courseId: '1', section: 'A' },
  { id: '3', name: 'Ana Reyes', email: 'ana.reyes@lorma.edu', averageGrade: 92, totalAssignments: 10, completedAssignments: 9, status: 'excellent', courseId: '1', section: 'A' },
  { id: '4', name: 'Pedro Garcia', email: 'pedro.garcia@lorma.edu', averageGrade: 88, totalAssignments: 10, completedAssignments: 9, status: 'good', courseId: '1', section: 'A' },
  { id: '5', name: 'Sofia Rodriguez', email: 'sofia.rodriguez@lorma.edu', averageGrade: 85, totalAssignments: 10, completedAssignments: 8, status: 'good', courseId: '1', section: 'A' },
  { id: '6', name: 'Carlos Martinez', email: 'carlos.martinez@lorma.edu', averageGrade: 72, totalAssignments: 10, completedAssignments: 7, status: 'at-risk', courseId: '1', section: 'A' },
  // CS101 Section B
  { id: '7', name: 'Lisa Fernandez', email: 'lisa.fernandez@lorma.edu', averageGrade: 91, totalAssignments: 10, completedAssignments: 10, status: 'excellent', courseId: '2', section: 'B' },
  { id: '8', name: 'Miguel Torres', email: 'miguel.torres@lorma.edu', averageGrade: 87, totalAssignments: 10, completedAssignments: 9, status: 'good', courseId: '2', section: 'B' },
  { id: '9', name: 'Elena Ramos', email: 'elena.ramos@lorma.edu', averageGrade: 68, totalAssignments: 10, completedAssignments: 6, status: 'at-risk', courseId: '2', section: 'B' },
  { id: '10', name: 'Roberto Cruz', email: 'roberto.cruz@lorma.edu', averageGrade: 78, totalAssignments: 10, completedAssignments: 8, status: 'good', courseId: '2', section: 'B' },
  // CS201 Section A
  { id: '11', name: 'Carmen Lopez', email: 'carmen.lopez@lorma.edu', averageGrade: 95, totalAssignments: 8, completedAssignments: 8, status: 'excellent', courseId: '3', section: 'A' },
  { id: '12', name: 'Diego Morales', email: 'diego.morales@lorma.edu', averageGrade: 89, totalAssignments: 8, completedAssignments: 7, status: 'good', courseId: '3', section: 'A' },
  { id: '13', name: 'Isabella Gomez', email: 'isabella.gomez@lorma.edu', averageGrade: 70, totalAssignments: 8, completedAssignments: 6, status: 'at-risk', courseId: '3', section: 'A' },
  // CS301 Section A
  { id: '14', name: 'Rafael Diaz', email: 'rafael.diaz@lorma.edu', averageGrade: 93, totalAssignments: 6, completedAssignments: 6, status: 'excellent', courseId: '4', section: 'A' },
  { id: '15', name: 'Lucia Hernandez', email: 'lucia.hernandez@lorma.edu', averageGrade: 86, totalAssignments: 6, completedAssignments: 6, status: 'good', courseId: '4', section: 'A' },
  { id: '16', name: 'Marco Valdez', email: 'marco.valdez@lorma.edu', averageGrade: 74, totalAssignments: 6, completedAssignments: 5, status: 'at-risk', courseId: '4', section: 'A' },
  // IT101 Section A
  { id: '17', name: 'Gabriela Rivas', email: 'gabriela.rivas@lorma.edu', averageGrade: 97, totalAssignments: 9, completedAssignments: 9, status: 'excellent', courseId: '5', section: 'A' },
  { id: '18', name: 'Antonio Flores', email: 'antonio.flores@lorma.edu', averageGrade: 84, totalAssignments: 9, completedAssignments: 8, status: 'good', courseId: '5', section: 'A' },
  { id: '19', name: 'Valentina Castro', email: 'valentina.castro@lorma.edu', averageGrade: 71, totalAssignments: 9, completedAssignments: 7, status: 'at-risk', courseId: '5', section: 'A' },
]

function getStatusBadge(status) {
  switch (status) {
    case 'excellent':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Excellent</Badge>
    case 'good':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Good</Badge>
    case 'at-risk':
      return <Badge className="bg-red-100 text-red-800 border-red-200">At Risk</Badge>
    default:
      return <Badge>Unknown</Badge>
  }
}

export default function Dashboard() {
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [selectedView, setSelectedView] = useState('overview')

  // Filter students based on selected course
  const students = selectedCourse === 'all'
    ? allStudents
    : allStudents.filter(s => s.courseId === selectedCourse)

  const selectedCourseInfo = courses.find(c => c.id === selectedCourse)

  // Sort students by grade for ranking
  const rankedStudents = [...students].sort((a, b) => b.averageGrade - a.averageGrade)

  // Get top performers (90+)
  const topPerformers = students.filter(s => s.averageGrade >= 90)

  // Get at-risk students (below 75)
  const atRiskStudents = students.filter(s => s.averageGrade < 75)

  // Calculate overall statistics
  const averageClassGrade = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.averageGrade, 0) / students.length)
    : 0
  const totalCompleted = students.reduce((sum, s) => sum + s.completedAssignments, 0)
  const totalAssignmentsSum = students.reduce((sum, s) => sum + s.totalAssignments, 0)
  const completionRate = totalAssignmentsSum > 0 ? Math.round((totalCompleted / totalAssignmentsSum) * 100) : 0

  // Grade distribution data
  const gradeDistribution = [
    { range: '90-100', count: students.filter(s => s.averageGrade >= 90).length },
    { range: '80-89', count: students.filter(s => s.averageGrade >= 80 && s.averageGrade < 90).length },
    { range: '75-79', count: students.filter(s => s.averageGrade >= 75 && s.averageGrade < 80).length },
    { range: 'Below 75', count: students.filter(s => s.averageGrade < 75).length },
  ]

  // Performance distribution for pie chart
  const performanceData = [
    { name: 'Excellent (90+)', value: students.filter(s => s.averageGrade >= 90).length, color: '#15803d' },
    { name: 'Good (75-89)', value: students.filter(s => s.averageGrade >= 75 && s.averageGrade < 90).length, color: '#65a30d' },
    { name: 'At Risk (<75)', value: students.filter(s => s.averageGrade < 75).length, color: '#dc2626' },
  ]

  // Course performance summary
  const coursePerformance = courses.map(course => {
    const courseStudents = allStudents.filter(s => s.courseId === course.id)
    const avgGrade = courseStudents.length > 0
      ? Math.round(courseStudents.reduce((sum, s) => sum + s.averageGrade, 0) / courseStudents.length)
      : 0
    const atRisk = courseStudents.filter(s => s.averageGrade < 75).length

    return {
      ...course,
      avgGrade,
      atRisk,
      studentCount: courseStudents.length
    }
  })

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
              <Filter className="w-5 h-5" />
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-64 bg-white text-gray-900">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} - {course.name} (Section {course.section})
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
                  <p className="font-semibold">{selectedCourseInfo.section}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Grading System</p>
                  <p className="font-semibold">{selectedCourseInfo.gradingSystem}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs mb-1">Schedule</p>
                  <p className="font-semibold">{selectedCourseInfo.schedule}</p>
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
                        {selectedCourse !== 'all' && selectedCourseInfo && `${selectedCourseInfo.code} Section ${selectedCourseInfo.section} \u2022 `}
                        Average Grade: <span className="font-semibold">{rankedStudents[0].averageGrade}%</span> \u2022 {rankedStudents[0].completedAssignments}/{rankedStudents[0].totalAssignments} Assignments Completed
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
              {/* Total Students */}
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

              {/* Average Grade */}
              <Card className="border-t-4 border-t-blue-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Class Average</CardTitle>
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-700">{averageClassGrade}%</div>
                  <p className="text-xs text-green-600 mt-1">&uarr; 3% from last month</p>
                </CardContent>
              </Card>

              {/* Top Performers */}
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

              {/* At-Risk Students */}
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

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Grade Distribution Bar Chart */}
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
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#15803d" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Performance Distribution Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Categories</CardTitle>
                  <CardDescription>Student distribution by performance level</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
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
                      >
                        {performanceData.map((entry, index) => (
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

            {/* Student Lists Row */}
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
                      topPerformers.slice(0, 5).map((student, index) => {
                        const course = courses.find(c => c.id === student.courseId)
                        return (
                          <div key={student.id} className="flex items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-bold text-sm">{index + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{student.name}</p>
                              <p className="text-xs text-gray-600 truncate">
                                {selectedCourse === 'all' && course ? `${course.code} Sec ${student.section} \u2022 ` : ''}{student.email}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-amber-700">{student.averageGrade}%</p>
                              <p className="text-xs text-gray-600">{student.completedAssignments}/{student.totalAssignments} completed</p>
                            </div>
                          </div>
                        )
                      })
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
                      atRiskStudents.map((student) => {
                        const course = courses.find(c => c.id === student.courseId)
                        return (
                          <div key={student.id} className="flex items-center gap-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{student.name}</p>
                              <p className="text-xs text-gray-600 truncate">
                                {selectedCourse === 'all' && course ? `${course.code} Sec ${student.section} \u2022 ` : ''}{student.email}
                              </p>
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-gray-600">Progress</span>
                                  <span className="text-red-600">{student.completedAssignments}/{student.totalAssignments}</span>
                                </div>
                                <Progress value={(student.completedAssignments / student.totalAssignments) * 100} className="h-2" />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-red-600">{student.averageGrade}%</p>
                              <Badge className="bg-red-100 text-red-800 border-red-200 mt-1">Action Needed</Badge>
                            </div>
                          </div>
                        )
                      })
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

            {/* Complete Student Ranking */}
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
                    {rankedStudents.map((student, index) => {
                      const course = courses.find(c => c.id === student.courseId)
                      return (
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
                              {selectedCourse === 'all' && course ? `${course.code} Section ${student.section} \u2022 ` : ''}{student.email}
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Completed</p>
                              <p className="font-semibold">{student.completedAssignments}/{student.totalAssignments}</p>
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
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="byCourse" className="space-y-6 mt-6">
            {/* Course Performance Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coursePerformance.map((course) => (
                <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => {
                  setSelectedCourse(course.id)
                  setSelectedView('overview')
                }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{course.code}</CardTitle>
                        <CardDescription className="text-sm mt-1">{course.name}</CardDescription>
                      </div>
                      <Badge variant="outline" className="ml-2">Sec {course.section}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <BookOpen className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">{course.schedule}</span>
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
                              style={{ width: `${(course.atRisk / course.studentCount) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500 mb-1">Grading System</p>
                        <p className="text-sm font-medium">{course.gradingSystem}</p>
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
