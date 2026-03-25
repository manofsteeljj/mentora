import { Button } from './ui/button'
import { Brain, BookOpen, Shield, CheckCircle, Users, BarChart3, Zap } from 'lucide-react'

const imgTeacher = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=600&fit=crop'
const imgStudent = 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=600&fit=crop'
const imgMentoraLogo = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 60%22%3E%3Ctext x=%2210%22 y=%2245%22 font-size=%2236%22 font-weight=%22bold%22 fill=%22%23008236%22%3EMentora%3C/text%3E%3C/svg%3E'
const imgLeafLogo = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Cpath d=%22M50 10 Q70 30 70 50 Q70 80 50 90 Q30 80 30 50 Q30 30 50 10%22 fill=%22%23008236%22/%3E%3C/svg%3E'

const capabilityCards = [
  { icon: Brain, title: 'AI-Powered Lesson Planning' },
  { icon: CheckCircle, title: 'Intelligent Grading System' },
  { icon: BookOpen, title: 'Assessment Creation' },
  { icon: Users, title: 'Student Performance Tracking' },
  { icon: Shield, title: 'Academic Integrity Detection' },
  { icon: BarChart3, title: 'Course Analytics & Insights' },
]

const educatorPoints = [
  {
    title: 'Context-Aware AI',
    description: 'Understands your courses, materials, and teaching context for personalized assistance.',
  },
  {
    title: 'Multi-Course Management',
    description: 'Handle multiple subjects, sections, and grading systems seamlessly.',
  },
  {
    title: 'Role-Based Access',
    description: 'Faculty and admin roles with appropriate permissions and capabilities.',
  },
  {
    title: 'Comprehensive Analytics',
    description: 'Track performance, engagement, and learning outcomes with detailed insights.',
  },
]

export default function LandingPage() {
  const goToLogin = () => {
    window.location.href = '/login'
  }

  const goToFeatures = () => {
    const features = document.getElementById('features-section')
    if (features) {
      features.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-[#edf4f0] text-[#101828] overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-[#111827] bg-[rgba(255,255,255,0.82)] backdrop-blur-sm">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <img src={imgMentoraLogo} alt="Mentora" className="h-12 w-auto object-contain" />
          <Button
            onClick={goToLogin}
            className="h-9 rounded-full bg-[#008236] px-5 text-sm font-medium text-white hover:bg-[#006f2e]"
          >
            Sign In
          </Button>
        </div>
      </header>

      <main>
        <section className="relative bg-gradient-to-r from-[#d8f2e4] via-[#e9f7ef] to-[#ebf8f1]">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8 pt-12 pb-10 lg:pt-16 lg:pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-[560px_1fr] gap-8 lg:gap-4 items-center">
              <div className="z-10">
                <h1 className="text-[44px] leading-[1.02] font-bold sm:text-[56px] lg:text-[70px]">
                  <span className="text-[#111827]">Transform Your Teaching with </span>
                  <span className="text-[#008236]">AI Intelligence</span>
                </h1>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#dcfce7] px-4 py-2 text-sm font-medium text-[#016630]">
                  <Zap className="h-4 w-4" />
                  AI-Powered Teaching Assistant
                </div>

                <p className="mt-6 text-[17px] leading-[1.8] text-[#4a5565] lg:text-[20px] lg:leading-[1.65] max-w-[560px]">
                  Mentora is a context-aware AI teaching assistant designed for faculty members. Create lesson plans,
                  generate assessments, grade assignments, and track student performance all in one intelligent platform.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button
                    onClick={goToLogin}
                    className="h-12 rounded-md bg-[#008236] px-8 text-base font-medium text-white hover:bg-[#006f2e]"
                  >
                    Get Started
                  </Button>
                  <Button
                    variant="outline"
                    onClick={goToFeatures}
                    className="h-12 rounded-md border-[#008236] bg-white px-8 text-base font-medium text-[#008236] hover:bg-[#f1fcf5]"
                  >
                    Learn More
                  </Button>
                </div>
              </div>

              <div className="relative h-[320px] sm:h-[420px] lg:h-[560px]">
                <div className="absolute right-14 top-10 h-48 w-48 rounded-full border-[7px] border-[#155a36] bg-[#6fbb8f] sm:h-64 sm:w-64 lg:h-[300px] lg:w-[300px]" />
                <div className="absolute right-2 top-28 h-40 w-40 rounded-full border-[6px] border-[#155a36] bg-transparent sm:h-52 sm:w-52 lg:h-[265px] lg:w-[265px]" />
                <img
                  src={imgTeacher}
                  alt="Faculty member using laptop"
                  className="absolute bottom-0 right-0 h-full w-auto object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="features-section" className="relative bg-[#f4f4f4] pt-8">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-[500px_1fr] gap-6 items-end">
              <div className="relative min-h-[250px] sm:min-h-[330px] lg:min-h-[360px]">
                <img
                  src={imgStudent}
                  alt="Student with laptop"
                  className="absolute bottom-0 left-0 h-full w-auto object-contain"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {capabilityCards.map((card) => (
                  <article
                    key={card.title}
                    className="rounded-[14px] border border-[#e5e7eb] bg-[#efefef] px-4 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-[10px] bg-[#dcfce7] p-2 text-[#008236]">
                        <card.icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-[20px] leading-7 font-semibold text-[#111827]">{card.title}</h3>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 overflow-hidden">
            <div className="flex w-full h-full items-end justify-between">
              <div className="h-10 w-1/5 rounded-tr-[52px] bg-[#c8efd9]" />
              <div className="h-16 w-1/5 rounded-t-[90px] bg-[#c8efd9]" />
              <div className="h-11 w-1/5 rounded-tl-[55px] rounded-tr-[55px] bg-[#c8efd9]" />
              <div className="h-16 w-1/5 rounded-t-[90px] bg-[#c8efd9]" />
              <div className="h-10 w-1/5 rounded-tl-[52px] bg-[#c8efd9]" />
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-[#e9f6ef] to-[#e6f7ed] pt-10 pb-0">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              <div className="bg-[#d7e8de]/70 px-6 py-8 sm:px-8 lg:px-10 lg:py-12">
                <h2 className="text-[44px] leading-[1.08] font-bold text-[#101828]">Built for Modern Educators</h2>
                <p className="mt-5 text-[18px] leading-8 text-[#4a5565] max-w-[520px]">
                  Mentora understands the challenges you face. Our AI adapts to your teaching style, course materials,
                  and student needs.
                </p>

                <ul className="mt-7 space-y-5 max-w-[520px]">
                  {educatorPoints.map((item) => (
                    <li key={item.title} className="flex gap-3">
                      <CheckCircle className="mt-1 h-5 w-5 text-[#008236]" />
                      <div>
                        <h3 className="font-semibold text-[#101828]">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-[#4a5565]">{item.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#caedd8] px-8 py-12 text-center flex flex-col justify-center items-center min-h-[520px]">
                <img src={imgLeafLogo} alt="Mentora mark" className="h-40 w-auto object-contain" />
                <h3 className="mt-6 text-[36px] leading-[1.1] font-bold text-[#101828] max-w-[440px]">
                  Join Educators Who Trust Mentora
                </h3>
                <p className="mt-5 text-base leading-7 text-[#4a5565] max-w-[450px]">
                  Empowering faculty to focus on what matters most, teaching and inspiring students.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-[#008236] to-[#007a55] py-14 text-center text-white">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
            <h2 className="text-[50px] leading-[1.06] font-bold">Ready to Transform Your Teaching?</h2>
            <p className="mt-4 text-[20px] text-[#eafff3]">
              Join faculty members using Mentora to enhance their teaching and improve student outcomes.
            </p>
            <Button
              onClick={goToLogin}
              className="mt-8 h-12 rounded-md bg-white px-8 text-base font-medium text-[#008236] hover:bg-[#f3fff7]"
            >
              Get Started Now
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-[#edf4f0] py-8">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <img src={imgMentoraLogo} alt="Mentora" className="h-14 w-auto object-contain" />
          <p className="text-sm text-[#4a5565]">&copy; 2026 Mentora. AI Teaching Assistant Platform.</p>
        </div>
      </footer>
    </div>
  )
}