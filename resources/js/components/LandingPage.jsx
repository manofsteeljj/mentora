import { Button } from './ui/button'
import { GraduationCap, BookOpen, Brain, CheckCircle, Users, BarChart3, Shield, Zap } from 'lucide-react'

export default function LandingPage() {
  function goToLogin() {
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-green-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">Mentora</span>
          </div>
          <Button
            onClick={goToLogin}
            className="bg-green-700 hover:bg-green-800"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full mb-6">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">AI-Powered Teaching Assistant</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Transform Your Teaching with{' '}
            <span className="text-green-700">AI Intelligence</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Mentora is a context-aware AI teaching assistant designed for faculty members.
            Create lesson plans, generate assessments, grade assignments, and track student performance—all in one intelligent platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={goToLogin}
              className="bg-green-700 hover:bg-green-800 text-lg px-8 py-6 h-auto"
            >
              Get Started
            </Button>
            <button
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-lg font-medium border border-green-700 text-green-700 hover:bg-green-50 px-8 py-6 h-auto transition-colors"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Excel in Teaching
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Powerful features designed specifically for educators to save time and enhance learning outcomes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Brain className="w-6 h-6 text-green-700" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              AI-Powered Lesson Planning
            </h3>
            <p className="text-gray-600">
              Generate comprehensive lesson plans with learning objectives, activities, and assessments tailored to your curriculum.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-green-700" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Assessment Creation
            </h3>
            <p className="text-gray-600">
              Create quizzes, exams, and assignments with auto-generated questions aligned to your course objectives and difficulty levels.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-green-700" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Academic Integrity Detection
            </h3>
            <p className="text-gray-600">
              Detect plagiarism and AI-generated content with advanced algorithms. Maintain academic honesty with confidence.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-700" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Intelligent Grading System
            </h3>
            <p className="text-gray-600">
              AI-assisted grading with automated feedback generation. Save hours while providing personalized student feedback.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-green-700" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Student Performance Tracking
            </h3>
            <p className="text-gray-600">
              Monitor individual and class-wide performance with detailed analytics. Identify at-risk students early.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-green-700" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Course Analytics & Insights
            </h3>
            <p className="text-gray-600">
              Comprehensive dashboards showing course progress, grade distributions, and learning outcome achievement.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Built for Modern Educators
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Mentora understands the challenges you face. Our AI adapts to your teaching style, course materials, and student needs.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Context-Aware AI</h4>
                    <p className="text-gray-600">Understands your courses, materials, and teaching context for personalized assistance.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Multi-Course Management</h4>
                    <p className="text-gray-600">Handle multiple subjects, sections, and grading systems seamlessly.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Role-Based Access</h4>
                    <p className="text-gray-600">Faculty and admin roles with appropriate permissions and capabilities.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Comprehensive Analytics</h4>
                    <p className="text-gray-600">Track performance, engagement, and learning outcomes with detailed insights.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl p-8 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <GraduationCap className="w-20 h-20 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Join Educators Who Trust Mentora
                </h3>
                <p className="text-gray-600">
                  Empowering faculty to focus on what matters most—teaching and inspiring students.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-green-700 to-emerald-700 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Teaching?
          </h2>
          <p className="text-xl mb-8 text-green-50">
            Join faculty members using Mentora to enhance their teaching and improve student outcomes.
          </p>
          <button
            onClick={goToLogin}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-lg font-medium bg-white text-green-700 hover:bg-gray-100 px-8 py-6 h-auto transition-colors"
          >
            Get Started Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">Mentora</span>
            </div>
            <p className="text-gray-600 text-sm">
              © 2026 Mentora. AI Teaching Assistant Platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
