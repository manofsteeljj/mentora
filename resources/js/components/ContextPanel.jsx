import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { FileText, BookOpen, Calendar, User, ChevronDown } from 'lucide-react'
import { formatCourseLabel } from '../lib/courseDisplay'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function ContextPanel({ onQuickAction, onCourseChange }) {
  const [materials, setMaterials] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCourseId, setSelectedCourseId] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/materials', {
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      }).then(r => r.ok ? r.json() : []),
      fetch('/api/courses', {
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      }).then(r => r.ok ? r.json() : []),
    ])
      .then(([mats, crs]) => {
        setMaterials(Array.isArray(mats) ? mats : [])
        setCourses(Array.isArray(crs) ? crs : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleCourseChange = (e) => {
    const val = e.target.value ? Number(e.target.value) : null
    setSelectedCourseId(val)
    onCourseChange?.(val)
  }

  const selectedCourse = courses.find(c => c.id === selectedCourseId)

  const currentCourse = selectedCourse
    ? formatCourseLabel(selectedCourse)
    : courses.length > 0
      ? 'All Courses'
      : 'No courses yet'

  // Filter materials by selected course
  const filteredMaterials = selectedCourseId
    ? materials.filter(m => m.course_id === selectedCourseId)
    : materials

  const currentTopic = filteredMaterials.length > 0
    ? filteredMaterials[0].title
    : 'No materials yet'

  const quickActions = [
    { emoji: '📝', label: 'Generate Quiz', message: 'Generate quiz questions based on my uploaded course materials' },
    { emoji: '📄', label: 'Summarize Materials', message: 'Summarize the key concepts from my course materials' },
    { emoji: '📚', label: 'Create Study Guide', message: 'Create a comprehensive study guide from my course materials' },
    { emoji: '🎯', label: 'Lesson Plan', message: 'Create a detailed lesson plan for my current course topic' },
    { emoji: '🧩', label: 'Build Rubric', message: 'Create a grading rubric for an assignment with clear criteria and point breakdown' },
    { emoji: '🗂️', label: 'Exam Blueprint', message: 'Create an exam blueprint (topics, difficulty, number of items, and time estimate) for my course' },
    { emoji: '💡', label: 'Activity Ideas', message: 'Suggest 5 engaging in-class activities related to my current course materials, with time estimates' },
    { emoji: '📣', label: 'Draft Announcement', message: 'Draft a short class announcement (professional tone) about an upcoming quiz/assignment and reminders' },
  ]

  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto shrink-0 hidden lg:block">
      <div className="space-y-4">
        {/* Current Context */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Current Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 mt-0.5 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Role</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  Faculty
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <BookOpen className="w-4 h-4 mt-0.5 text-gray-500" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">Course</p>
                {courses.length > 0 ? (
                  <select
                    value={selectedCourseId || ''}
                    onChange={handleCourseChange}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">All Courses</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{formatCourseLabel(c, { includeSection: false })}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium">{currentCourse}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 mt-0.5 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Current Topic</p>
                <p className="text-sm font-medium">{currentTopic}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Materials */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Available Materials</CardTitle>
              {filteredMaterials.length > 0 && (
                <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                  {filteredMaterials.length} loaded
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Context sources for AI responses (RAG)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <p className="text-xs text-gray-400 py-2">Loading...</p>
              ) : filteredMaterials.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No materials uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {filteredMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-start gap-2 p-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      onClick={() => window.open(`/api/materials/${material.id}/download`, '_blank')}
                    >
                      <FileText className="w-4 h-4 mt-0.5 text-green-700 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{material.title}</p>
                        <p className="text-xs text-gray-500">{material.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                className="w-full text-left text-sm p-2 rounded-md hover:bg-white border border-gray-200 transition-colors"
                onClick={() => onQuickAction?.(action.message)}
              >
                {action.emoji} {action.label}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
