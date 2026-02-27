import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { BookOpen, Users, Clock, Calendar } from 'lucide-react'
import { Progress } from './ui/progress'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function MyCourses() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/courses', {
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
        }))
        setCourses(mapped)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Fallback demo data when no courses exist in the DB
  const displayCourses = courses.length > 0 ? courses : [
    {
      id: '1',
      code: 'CS301',
      name: 'Network Engineering',
      instructor: 'Dr. Robert Smith',
      schedule: 'MWF 10:00-11:00 AM',
      enrolled: 35,
      maxStudents: 40,
      progress: 65,
      currentTopic: 'OSPF Multi-Area Configuration',
      nextClass: '2026-02-15 10:00 AM',
    },
    {
      id: '2',
      code: 'CS205',
      name: 'Database Systems',
      instructor: 'Prof. Emily Johnson',
      schedule: 'TTh 1:00-2:30 PM',
      enrolled: 42,
      maxStudents: 45,
      progress: 48,
      currentTopic: 'Database Normalization (3NF, BCNF)',
      nextClass: '2026-02-16 1:00 PM',
    },
    {
      id: '3',
      code: 'CS101',
      name: 'Programming 101',
      instructor: 'Dr. Michael Williams',
      schedule: 'MWF 2:00-3:00 PM',
      enrolled: 38,
      maxStudents: 40,
      progress: 72,
      currentTopic: 'Object-Oriented Programming Basics',
      nextClass: '2026-02-15 2:00 PM',
    },
    {
      id: '4',
      code: 'CS302',
      name: 'Data Structures & Algorithms',
      instructor: 'Prof. Sarah Davis',
      schedule: 'TTh 10:00-11:30 AM',
      enrolled: 30,
      maxStudents: 35,
      progress: 55,
      currentTopic: 'Graph Algorithms (Dijkstra, BFS, DFS)',
      nextClass: '2026-02-16 10:00 AM',
    },
  ]

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Teaching Courses</h1>
          <p className="text-gray-500">Courses you are currently teaching</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading courses...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayCourses.map((course) => (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{course.code}</Badge>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          Active
                        </Badge>
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
                    <Button variant="outline" size="sm" className="flex-1">
                      View Materials
                    </Button>
                    <Button size="sm" className="flex-1 bg-green-700 hover:bg-green-800">
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
            <Button className="bg-green-700 hover:bg-green-800">
              Create Course
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
