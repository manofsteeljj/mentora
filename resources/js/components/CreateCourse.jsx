import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { ArrowLeft, BookOpen, Calendar, Users, FileText, Save } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function CreateCourse({ onBack, onSave }) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    instructor: '',
    schedule: {
      days: '',
      time: '',
    },
    maxStudents: 40,
    semester: '',
    academicYear: '2025-2026',
    syllabus: '',
    gradingSystem: 'percentage',
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const academicTerm = useMemo(() => {
    const semLabel =
      formData.semester === '1st-semester'
        ? '1st Semester'
        : formData.semester === '2nd-semester'
          ? '2nd Semester'
          : formData.semester === 'summer'
            ? 'Summer'
            : ''

    const scheduleLabel =
      formData.schedule.days && formData.schedule.time
        ? `${formData.schedule.days} ${formData.schedule.time}`
        : ''

    return [semLabel && formData.academicYear ? `${semLabel} ${formData.academicYear}` : (semLabel || formData.academicYear), scheduleLabel]
      .filter(Boolean)
      .join(' • ')
  }, [formData.semester, formData.academicYear, formData.schedule.days, formData.schedule.time])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))

    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleScheduleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [field]: value,
      },
    }))

    if (errors.schedule) {
      setErrors(prev => {
        const next = { ...prev }
        delete next.schedule
        return next
      })
    }
  }

  const validateForm = () => {
    const next = {}

    if (!formData.code.trim()) next.code = 'Course code is required'
    if (!formData.name.trim()) next.name = 'Course name is required'
    if (!formData.instructor.trim()) next.instructor = 'Instructor name is required'
    if (!formData.schedule.days) next.schedule = 'Schedule days are required'
    if (!formData.schedule.time) next.schedule = 'Schedule time is required'
    if (!formData.semester) next.semester = 'Semester is required'
    if (Number(formData.maxStudents) < 1) next.maxStudents = 'Maximum students must be at least 1'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)

    if (!validateForm()) return

    setSubmitting(true)
    try {
      // Persist via API
      const resp = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': getToken(),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          course_code: formData.code,
          course_name: formData.name,
          description: formData.instructor || formData.description || null,
          academic_term: academicTerm || null,
          // Keep extra fields in payload for future use; backend may ignore.
          meta: {
            description: formData.description || null,
            maxStudents: Number(formData.maxStudents) || 0,
            academicYear: formData.academicYear || null,
            semester: formData.semester || null,
            schedule: formData.schedule,
            syllabus: formData.syllabus || null,
            gradingSystem: formData.gradingSystem || null,
          },
        }),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => null)
        setSubmitError(data?.message || 'Failed to create course')
        return
      }

      onSave?.(formData)
      onBack?.()
    } catch {
      setSubmitError('Network error while creating course')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Courses
            </Button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-green-700" />
            Create New Course
          </h1>
          <p className="text-gray-500 mt-1">Add a new course to your teaching schedule</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Enter the course details and general information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Course Code <span className="text-red-500">*</span></Label>
                  <Input
                    id="code"
                    placeholder="e.g., CS301"
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    className={errors.code ? 'border-red-500' : ''}
                  />
                  {errors.code && <p className="text-sm text-red-500">{errors.code}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Course Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    placeholder="e.g., Network Engineering"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Course Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the course objectives and content"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructor">Instructor <span className="text-red-500">*</span></Label>
                <Input
                  id="instructor"
                  placeholder="e.g., Dr. Robert Smith"
                  value={formData.instructor}
                  onChange={(e) => handleInputChange('instructor', e.target.value)}
                  className={errors.instructor ? 'border-red-500' : ''}
                />
                {errors.instructor && <p className="text-sm text-red-500">{errors.instructor}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Schedule & Enrollment
              </CardTitle>
              <CardDescription>Set the class schedule and enrollment limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="semester">Semester <span className="text-red-500">*</span></Label>
                  <Select value={formData.semester} onValueChange={(value) => handleInputChange('semester', value)}>
                    <SelectTrigger className={errors.semester ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st-semester">1st Semester</SelectItem>
                      <SelectItem value="2nd-semester">2nd Semester</SelectItem>
                      <SelectItem value="summer">Summer</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.semester && <p className="text-sm text-red-500">{errors.semester}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="academicYear">Academic Year</Label>
                  <Input
                    id="academicYear"
                    placeholder="e.g., 2025-2026"
                    value={formData.academicYear}
                    onChange={(e) => handleInputChange('academicYear', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduleDays">Schedule Days <span className="text-red-500">*</span></Label>
                  <Select value={formData.schedule.days} onValueChange={(value) => handleScheduleChange('days', value)}>
                    <SelectTrigger className={errors.schedule ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select days" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MWF">Monday, Wednesday, Friday</SelectItem>
                      <SelectItem value="TTh">Tuesday, Thursday</SelectItem>
                      <SelectItem value="MW">Monday, Wednesday</SelectItem>
                      <SelectItem value="WF">Wednesday, Friday</SelectItem>
                      <SelectItem value="Sat">Saturday</SelectItem>
                      <SelectItem value="Daily">Daily (M-F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduleTime">Schedule Time <span className="text-red-500">*</span></Label>
                  <Input
                    id="scheduleTime"
                    placeholder="e.g., 10:00-11:30 AM"
                    value={formData.schedule.time}
                    onChange={(e) => handleScheduleChange('time', e.target.value)}
                    className={errors.schedule ? 'border-red-500' : ''}
                  />
                  {errors.schedule && <p className="text-sm text-red-500">{errors.schedule}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxStudents">Maximum Students <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <Input
                    id="maxStudents"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.maxStudents}
                    onChange={(e) => handleInputChange('maxStudents', parseInt(e.target.value, 10) || 0)}
                    className={`max-w-xs ${errors.maxStudents ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.maxStudents && <p className="text-sm text-red-500">{errors.maxStudents}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Course Materials & Grading
              </CardTitle>
              <CardDescription>Set up syllabus and grading system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="syllabus">Course Syllabus</Label>
                <Textarea
                  id="syllabus"
                  placeholder="Enter course syllabus, learning objectives, topics covered, etc."
                  value={formData.syllabus}
                  onChange={(e) => handleInputChange('syllabus', e.target.value)}
                  rows={6}
                />
                <p className="text-sm text-gray-500">You can also upload a PDF syllabus after creating the course</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gradingSystem">Grading System</Label>
                <Select value={formData.gradingSystem} onValueChange={(value) => handleInputChange('gradingSystem', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (0-100%)</SelectItem>
                    <SelectItem value="letter">Letter Grade (A-F)</SelectItem>
                    <SelectItem value="points">Points-based</SelectItem>
                    <SelectItem value="gpa">GPA Scale (1.0-5.0)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">This defines how student performance will be measured</p>
              </div>
            </CardContent>
          </Card>

          {submitError && (
            <div className="p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-green-700 hover:bg-green-800 gap-2" disabled={submitting}>
              <Save className="w-4 h-4" />
              {submitting ? 'Creating...' : 'Create Course'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
