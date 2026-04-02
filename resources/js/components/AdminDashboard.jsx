import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import {
  Users,
  BookOpen,
  GraduationCap,
  FileText,
  TrendingUp,
  Building2,
  FolderOpen,
  UserCheck,
} from 'lucide-react'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    totalCourses: 0,
    totalMaterials: 0,
    activeStudents: 0,
    activeCourses: 0,
    materialsThisMonth: 0,
    newFacultyThisMonth: 0,
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [coursesByDepartment, setCoursesByDepartment] = useState([])

  const fetchAdminDashboard = useCallback(async () => {
    const response = await fetch('/api/dashboard/admin', {
      headers: {
        Accept: 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
    })

    if (!response.ok) {
      throw new Error('Failed to load admin dashboard data')
    }

    const data = await response.json()

    setStats((prev) => ({
      ...prev,
      ...(data?.stats || {}),
    }))
    setRecentActivity(Array.isArray(data?.recentActivity) ? data.recentActivity : [])
    setCoursesByDepartment(Array.isArray(data?.coursesByDepartment) ? data.coursesByDepartment : [])
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')

    fetchAdminDashboard()
      .catch(() => setError('Unable to load admin dashboard data right now.'))
      .finally(() => setLoading(false))
  }, [fetchAdminDashboard])

  const visibleActivity = useMemo(() => recentActivity.slice(0, 5), [recentActivity])

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="text-gray-600">Loading admin dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Centralized overview of all system data</p>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-600">
                <GraduationCap className="w-5 h-5 text-green-700" />
                Total Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700">{stats.totalStudents}</div>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {stats.activeStudents} active this semester
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-600">
                <UserCheck className="w-5 h-5 text-blue-700" />
                Faculty Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">{stats.totalFaculty}</div>
              <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +{stats.newFacultyThisMonth} added this month
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-600">
                <BookOpen className="w-5 h-5 text-purple-700" />
                Active Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-700">{stats.totalCourses}</div>
              <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {stats.activeCourses} currently active
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-600">
                <FileText className="w-5 h-5 text-orange-700" />
                Course Materials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-700">{stats.totalMaterials}</div>
              <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +{stats.materialsThisMonth} uploaded this month
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest actions across the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {visibleActivity.length === 0 && (
                    <p className="text-sm text-gray-500">No activity yet.</p>
                  )}

                  {visibleActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-green-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{activity.action}</p>
                        <p className="text-sm text-gray-600">
                          {activity.user}
                          {activity.course !== '-' && activity.course && (
                            <>
                              <span className="mx-2">•</span>
                              <span className="text-green-600">{activity.course}</span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Courses by Department</CardTitle>
                <CardDescription>Distribution overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {coursesByDepartment.length === 0 && (
                    <p className="text-sm text-gray-500">No course data yet.</p>
                  )}

                  {coursesByDepartment.map((dept, index) => (
                    <div key={`${dept.department}-${index}`} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-sm">{dept.department}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <div className="text-xs">
                          <span className="text-gray-600">Courses:</span>
                          <span className="ml-1 font-semibold text-green-700">{dept.courses}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-gray-600">Students:</span>
                          <span className="ml-1 font-semibold text-blue-700">{dept.students}</span>
                        </div>
                      </div>
                      {index < coursesByDepartment.length - 1 && (
                        <div className="border-b border-gray-200 mt-3"></div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Quick Access</CardTitle>
                <CardDescription>Jump to data views</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <button className="w-full text-left p-3 rounded-lg hover:bg-green-50 transition-colors border border-gray-200 flex items-center gap-3">
                  <GraduationCap className="w-5 h-5 text-green-700" />
                  <div>
                    <p className="font-medium text-sm">All Students</p>
                    <p className="text-xs text-gray-600">{stats.totalStudents} total</p>
                  </div>
                </button>
                <button className="w-full text-left p-3 rounded-lg hover:bg-blue-50 transition-colors border border-gray-200 flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-blue-700" />
                  <div>
                    <p className="font-medium text-sm">All Courses</p>
                    <p className="text-xs text-gray-600">{stats.totalCourses} total</p>
                  </div>
                </button>
                <button className="w-full text-left p-3 rounded-lg hover:bg-orange-50 transition-colors border border-gray-200 flex items-center gap-3">
                  <FolderOpen className="w-5 h-5 text-orange-700" />
                  <div>
                    <p className="font-medium text-sm">Materials Library</p>
                    <p className="text-xs text-gray-600">{stats.totalMaterials} files</p>
                  </div>
                </button>
                <button className="w-full text-left p-3 rounded-lg hover:bg-purple-50 transition-colors border border-gray-200 flex items-center gap-3">
                  <UserCheck className="w-5 h-5 text-purple-700" />
                  <div>
                    <p className="font-medium text-sm">Faculty Members</p>
                    <p className="text-xs text-gray-600">{stats.totalFaculty} total</p>
                  </div>
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
