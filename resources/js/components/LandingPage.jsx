import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, CheckCircle2, Sparkles, Brain, ClipboardCheck, BarChart3 } from 'lucide-react'
import { Button } from './ui/button'
import logoImage from '../../logo/MENTORA LOGO.png'
import leafLogoImage from '../../logo/LEAF LOGO MENTORA.png'
import teacherHeroImage from '../../logo/teacher-hero.svg'

export default function LandingPage(props) {
  const { onGetStarted } = props || {}
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false)
    }, 2500)

    return () => clearTimeout(splashTimer)
  }, [])

  const handleGetStarted = () => {
    if (typeof onGetStarted === 'function') {
      onGetStarted()
      return
    }
    window.location.href = '/login'
  }

  const features = [
    {
      title: 'AI-Powered Lesson Planning',
      description: 'Generate comprehensive lesson plans tailored to your curriculum and teaching style.',
      icon: Brain,
    },
    {
      title: 'Intelligent Grading System',
      description: 'Use AI-assisted grading with rubric-friendly feedback and quick review workflows.',
      icon: ClipboardCheck,
    },
    {
      title: 'Course Analytics & Insights',
      description: 'Track student engagement and performance trends with visual analytics.',
      icon: BarChart3,
    },
  ]

  const educatorPoints = [
    'Context-aware AI that adapts to your course materials and grading style.',
    'Multi-course workflows for planning, assessments, and student support.',
    'Role-based experience for faculty and administrators.',
    'Clear performance views to help you act early and improve outcomes.',
  ]

  return (
    <div className="relative min-h-screen bg-white text-gray-900 overflow-x-hidden">
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 flex items-center justify-center"
          >
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-1/4 left-1/4 w-80 h-80 bg-white rounded-full blur-3xl"
              />
              <motion.div
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white rounded-full blur-3xl"
              />
            </div>

            <motion.div
              initial={{ scale: 0, opacity: 0, rotate: -180 }}
              animate={{
                scale: [0, 1.3, 0.9, 1.1, 1],
                opacity: [0, 1, 1, 1, 1],
                rotate: [180, 0, -10, 10, 0],
              }}
              transition={{ duration: 1.5, times: [0, 0.4, 0.6, 0.8, 1], ease: [0.34, 1.56, 0.64, 1] }}
              className="relative z-10"
            >
              <motion.img
                src={logoImage}
                alt="Mentora"
                className="w-[280px] md:w-[360px] object-contain drop-shadow-2xl"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="absolute bottom-28 text-center"
            >
              <motion.h2
                className="text-4xl md:text-5xl font-bold text-white mb-6"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                Mentora
              </motion.h2>
              <div className="flex gap-1 justify-center">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-white rounded-full"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showSplash ? 0 : 1 }}
        transition={{ duration: 0.8 }}
        className="min-h-screen"
      >
        {!showSplash && (
          <>
            <motion.header
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-gray-200"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                <img src={logoImage} alt="Mentora" className="h-12 object-contain" />
                <Button className="bg-[#008236] hover:bg-[#006629]" onClick={handleGetStarted}>
                  Sign In
                </Button>
              </div>
            </motion.header>

            <section className="relative overflow-hidden bg-gradient-to-br from-[#dcfce7] via-[#ecfdf5] to-[#f0fdf4]">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-green-200/50 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-emerald-200/60 blur-3xl" />
              </div>

              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 grid lg:grid-cols-2 gap-10 items-center">
                <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7 }}>
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm text-green-800 font-medium mb-5">
                    <Sparkles className="w-4 h-4" />
                    AI-Powered Teaching Assistant
                  </div>
                  <h1 className="text-4xl md:text-6xl font-bold leading-tight text-gray-900">
                    Transform Your Teaching with <span className="text-[#008236]">AI Intelligence</span>
                  </h1>
                  <p className="mt-6 text-lg text-gray-600 max-w-xl">
                    Mentora helps faculty create lesson plans, generate assessments, support grading, and monitor student performance in one intelligent platform.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button className="bg-[#008236] hover:bg-[#006629]" onClick={handleGetStarted}>
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button variant="outline" onClick={handleGetStarted}>Learn More</Button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.15 }}
                  className="relative min-h-[520px]"
                >
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="absolute h-[220px] w-[260px] right-6 top-8 rounded-full bg-[#233829]" />
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} className="absolute h-[220px] w-[260px] right-10 top-12 rounded-full bg-[#63AD7B]" />
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="absolute h-[220px] w-[260px] right-28 top-24 rounded-full bg-[#63AD7B]" />
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }} className="absolute h-[220px] w-[260px] right-8 top-44 rounded-full bg-[#233829]" />
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, delay: 0.6 }} className="absolute h-[220px] w-[260px] right-14 top-44 rounded-full bg-[#63AD7B]" />

                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-x-0 bottom-0"
                  >
                    <img
                      src={teacherHeroImage}
                      alt="Teacher hero"
                      className="w-full max-h-[500px] object-contain drop-shadow-2xl"
                    />
                  </motion.div>
                </motion.div>
              </div>
            </section>

            <section className="py-16 md:py-20 bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid md:grid-cols-3 gap-6">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      initial={{ y: 24, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true, margin: '-80px' }}
                      transition={{ duration: 0.5, delay: index * 0.12 }}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="w-12 h-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                        <feature.icon className="w-6 h-6" />
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-gray-900">{feature.title}</h3>
                      <p className="mt-2 text-gray-600">{feature.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            <section className="py-16 md:py-20 bg-gradient-to-b from-white to-gray-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-start">
                <motion.div
                  initial={{ x: -24, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.6 }}
                >
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Built for Modern Educators</h2>
                  <p className="mt-4 text-lg text-gray-600">
                    Mentora adapts to your teaching style, course structure, and classroom needs.
                  </p>
                  <div className="mt-8 space-y-4">
                    {educatorPoints.map((point, idx) => (
                      <motion.div
                        key={point}
                        initial={{ x: -16, opacity: 0 }}
                        whileInView={{ x: 0, opacity: 1 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.45, delay: idx * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-700 mt-0.5" />
                        <p className="text-gray-700">{point}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ x: 24, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-8 shadow-lg"
                >
                  <img src={logoImage} alt="Mentora" className="h-20 object-contain mx-auto" />
                  <h3 className="mt-6 text-2xl font-bold text-center text-gray-900">Join Educators Who Trust Mentora</h3>
                  <p className="mt-4 text-center text-gray-600">
                    Empowering faculty to focus on what matters most: teaching and inspiring students.
                  </p>
                  <div className="mt-8 flex justify-center">
                    <Button className="bg-[#008236] hover:bg-[#006629]" onClick={handleGetStarted}>
                      Get Started Now
                    </Button>
                  </div>
                </motion.div>
              </div>
            </section>

            <section className="py-16 bg-gradient-to-r from-[#008236] to-[#007a55]">
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6 }}
                className="max-w-5xl mx-auto px-4 text-center"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-white">Ready to Transform Your Teaching?</h2>
                <p className="mt-4 text-lg text-green-50">
                  Join faculty members using Mentora to improve teaching flow and student outcomes.
                </p>
                <div className="mt-8">
                  <Button className="bg-white text-[#008236] hover:bg-gray-100" onClick={handleGetStarted}>
                    Get Started Now
                  </Button>
                </div>
              </motion.div>
            </section>

            <footer className="py-10 bg-white border-t border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <img src={logoImage} alt="Mentora" className="h-12 object-contain" />
                <p className="text-sm text-gray-500">© 2026 Mentora. AI Teaching Assistant Platform.</p>
              </div>
            </footer>
          </>
        )}
      </motion.div>
    </div>
  )
}
