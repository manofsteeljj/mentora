import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import { Badge } from './ui/badge'
import {
  Shield,
  Database,
  Bell,
  Users,
  BookOpen,
  FileText,
  Settings as SettingsIcon,
  AlertTriangle,
} from 'lucide-react'

export default function AdminSettings() {
  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">System Administration Settings</h1>
          <p className="text-gray-500">Manage system-wide configurations and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-700" />
              Administrator Profile
            </CardTitle>
            <CardDescription>Your admin account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" defaultValue="Admin" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" defaultValue="User" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue="admin@lorma.edu" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminId">Admin ID</Label>
              <Input id="adminId" defaultValue="ADMIN-001" disabled />
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-700 text-white">Super Administrator</Badge>
              <Badge variant="outline">Full System Access</Badge>
            </div>
            <Button className="bg-green-700 hover:bg-green-800">Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-blue-700" />
              System Configuration
            </CardTitle>
            <CardDescription>Configure system-wide settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Faculty Self-Registration</Label>
                <p className="text-sm text-gray-500">
                  Enable faculty members to create their own accounts
                </p>
              </div>
              <Switch />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Approve Course Creation</Label>
                <p className="text-sm text-gray-500">
                  Automatically approve new courses created by faculty
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Student Enrollment Limit</Label>
                <p className="text-sm text-gray-500">
                  Maximum students per course section
                </p>
              </div>
              <Input type="number" defaultValue="50" className="w-24" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-medium">Academic Year</h3>
                <p className="text-sm text-gray-500">
                  Current academic year setting
                </p>
              </div>
              <div className="relative">
                <Select defaultValue="2025-2026">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                    <SelectItem value="2026-2027">2026-2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-medium">Current Semester</h3>
                <p className="text-sm text-gray-500">
                  Active semester for the system
                </p>
              </div>
              <div className="relative">
                <Select defaultValue="spring">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fall">Fall Semester</SelectItem>
                    <SelectItem value="spring">Spring Semester</SelectItem>
                    <SelectItem value="summer">Summer Semester</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-700" />
              User Management
            </CardTitle>
            <CardDescription>Configure user access and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Email Verification</Label>
                <p className="text-sm text-gray-500">
                  Users must verify email before accessing system
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-gray-500">
                  Require 2FA for admin accounts
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Session Timeout</Label>
                <p className="text-sm text-gray-500">
                  Auto-logout inactive users after (minutes)
                </p>
              </div>
              <Input type="number" defaultValue="30" className="w-24" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Password Expiration</Label>
                <p className="text-sm text-gray-500">
                  Require password change every (days)
                </p>
              </div>
              <Input type="number" defaultValue="90" className="w-24" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-700" />
              Data Management
            </CardTitle>
            <CardDescription>Database and storage settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Automatic Backups</Label>
                <p className="text-sm text-gray-500">
                  Enable scheduled database backups
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-medium">Backup Frequency</h3>
                <p className="text-sm text-gray-500">
                  How often to backup system data
                </p>
              </div>
              <div className="relative">
                <Select defaultValue="daily">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Every Hour</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Storage Limit per Course</Label>
                <p className="text-sm text-gray-500">
                  Maximum storage allowed per course (GB)
                </p>
              </div>
              <Input type="number" defaultValue="5" className="w-24" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Export Full Database</Label>
                <p className="text-sm text-gray-500">
                  Download complete system database backup
                </p>
              </div>
              <Button variant="outline" className="bg-blue-50">
                <Database className="w-4 h-4 mr-2" />
                Export Database
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-green-700" />
              Admin Notifications
            </CardTitle>
            <CardDescription>Configure system alerts and notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>New Faculty Registration</Label>
                <p className="text-sm text-gray-500">
                  Alert when new faculty members register
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Course Creation Alerts</Label>
                <p className="text-sm text-gray-500">
                  Notify when new courses are created
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>System Error Alerts</Label>
                <p className="text-sm text-gray-500">
                  Get notified about system errors immediately
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Storage Warnings</Label>
                <p className="text-sm text-gray-500">
                  Alert when storage reaches 80% capacity
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-700" />
              Content Moderation
            </CardTitle>
            <CardDescription>Manage content and material policies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Review Uploaded Materials</Label>
                <p className="text-sm text-gray-500">
                  Require admin approval for uploaded materials
                </p>
              </div>
              <Switch />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maximum File Size</Label>
                <p className="text-sm text-gray-500">
                  Maximum allowed file upload size (MB)
                </p>
              </div>
              <Input type="number" defaultValue="100" className="w-24" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-medium">Allowed File Types</h3>
                <p className="text-sm text-gray-500">
                  Permitted file formats for upload
                </p>
              </div>
              <Button variant="outline" size="sm">
                Configure Types
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security & Privacy</CardTitle>
            <CardDescription>Admin account security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Activity Logging</Label>
                <p className="text-sm text-gray-500">
                  Track all admin actions in system logs
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Change Admin Password</Label>
              <div className="space-y-2">
                <Input type="password" placeholder="Current password" />
                <Input type="password" placeholder="New password" />
                <Input type="password" placeholder="Confirm new password" />
                <Button variant="outline">Update Password</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Critical system operations - use with caution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Reset All Faculty Passwords</Label>
                <p className="text-sm text-gray-500">
                  Force password reset for all faculty accounts
                </p>
              </div>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                Reset Passwords
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Clear All System Logs</Label>
                <p className="text-sm text-gray-500">
                  Permanently delete all activity logs
                </p>
              </div>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                Clear Logs
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Archive Completed Courses</Label>
                <p className="text-sm text-gray-500">
                  Move all completed courses to archive
                </p>
              </div>
              <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50">
                Archive Courses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
