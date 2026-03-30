import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart3,
  Brain,
  Clock,
  Lock,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from './ui/button'

const logoImage =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 60%22%3E%3Ctext x=%2210%22 y=%2245%22 font-size=%2236%22 font-weight=%22bold%22 fill=%22%23008236%22%3EMentora%3C/text%3E%3C/svg%3E'

export default function LandingPage(props) {
  const { onGetStarted } = props || {}
  const [scrolled, setScrolled] = useState(false)

  const containerRef = useRef(null)
  const heroRef = useRef(null)
  const problemRef = useRef(null)
  const solutionRef = useRef(null)
  const featuresRef = useRef(null)
  const howItWorksRef = useRef(null)

  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })

  const { scrollYProgress: problemProgress } = useScroll({
    target: problemRef,
    offset: ['start end', 'end start'],
  })

  const { scrollYProgress: solutionProgress } = useScroll({
    target: solutionRef,
    offset: ['start end', 'end start'],
  })

  const { scrollYProgress: featuresProgress } = useScroll({
    target: featuresRef,
    offset: ['start end', 'end start'],
  })

  const goToLogin = () => {
    window.location.href = '/login'
  }

  const handleGetStarted = () => {
    if (typeof onGetStarted === 'function') {
      onGetStarted()
      return
    }
    goToLogin()
  }

  const scrollToRef = (ref) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Parallax transforms
  const heroY = useTransform(heroProgress, [0, 1], ['0%', '100%'])
  const heroScale = useTransform(heroProgress, [0, 1], [1, 1.2])
  const heroOpacity = useTransform(heroProgress, [0, 0.5, 1], [1, 0.5, 0])

  const layer1Y = useTransform(heroProgress, [0, 1], ['0%', '30%'])
  const layer2Y = useTransform(heroProgress, [0, 1], ['0%', '50%'])
  const layer3Y = useTransform(heroProgress, [0, 1], ['0%', '80%'])

  const problemY = useTransform(problemProgress, [0, 1], ['100px', '-100px'])
  const solutionY = useTransform(solutionProgress, [0, 1], ['50px', '-50px'])
  const featuresY = useTransform(featuresProgress, [0, 1], ['80px', '-80px'])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    {
      icon: Users,
      title: 'Faculty Dashboard',
      description:
        'Comprehensive control center for managing courses, students, and academic progress with real-time insights.',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: TrendingUp,
      title: 'Student Progress Tracking',
      description:
        'Advanced analytics and AI-powered insights to monitor performance, identify risks, and optimize outcomes.',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      icon: Sparkles,
      title: 'Smart Matching System',
      description:
        'Intelligent algorithms that pair faculty with students based on expertise, needs, and learning styles.',
      color: 'from-teal-500 to-green-600',
    },
  ]

  const keyFeatures = [
    {
      icon: Brain,
      title: 'AI-Powered Lesson Planning',
      description: 'Generate comprehensive, context-aware lesson plans tailored to your curriculum in seconds.',
    },
    {
      icon: Shield,
      title: 'Academic Integrity Detection',
      description: 'Advanced plagiarism and AI-content detection to maintain academic honesty.',
    },
    {
      icon: BarChart3,
      title: 'Performance Analytics',
      description: 'Deep insights into student performance with predictive analytics and trend analysis.',
    },
    {
      icon: Clock,
      title: 'Automated Grading',
      description: 'AI-assisted grading with intelligent feedback generation saves hours of work.',
    },
  ]

  const steps = [
    {
      number: '01',
      title: 'Upload Course Materials',
      description: 'Import syllabi, PDFs, and educational content. Our AI understands your teaching context.',
    },
    {
      number: '02',
      title: 'Define Learning Objectives',
      description: 'Set goals, grading criteria, and assessment standards. Mentora adapts to your methodology.',
    },
    {
      number: '03',
      title: 'Engage with AI Assistant',
      description: 'Get personalized help with lesson planning, assessments, and student management.',
    },
    {
      number: '04',
      title: 'Track & Optimize',
      description: 'Monitor progress, analyze performance, and continuously improve learning outcomes.',
    },
  ]

  return (
    <div ref={containerRef} className="relative min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* Sticky Navigation */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? 'bg-white/90 backdrop-blur-xl border-b border-gray-200 shadow-sm' : 'bg-transparent'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            <img src={logoImage} alt="Mentora" className="h-10" />
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-0 px-6 py-2 text-white"
            >
              Sign In
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </motion.header>

      {/* Hero Section - Fullscreen with Layered Parallax */}
      <section ref={heroRef} className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Layers */}
        <motion.div
          style={{ y: layer3Y }}
          className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-green-50"
        />

        <motion.div style={{ y: layer2Y, opacity: 0.4 }} className="absolute inset-0">
          <div className="absolute top-20 left-10 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        </motion.div>

        <motion.div
          style={{ y: layer1Y }}
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-white"
        />

        {/* Hero Content */}
        <motion.div
          style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}
          className="relative z-10 text-center px-4 max-w-6xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="mb-6"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200 text-sm">
              <Zap className="w-4 h-4 text-green-600" />
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent font-medium">
                AI-Powered Teaching Assistant
              </span>
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="text-7xl md:text-9xl font-bold mb-6 tracking-tight"
          >
            <span className="bg-gradient-to-r from-gray-900 via-green-700 to-emerald-700 bg-clip-text text-transparent">
              Mentora
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.7 }}
            className="text-2xl md:text-3xl text-gray-600 mb-12 font-light"
          >
            Empowering Academic Mentorship
            <br />
            Through Smart Digital Solutions
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-0 text-white text-lg px-10 py-7 shadow-2xl shadow-green-500/30"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="lg"
                onClick={() => scrollToRef(problemRef)}
                className="border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-lg px-10 py-7"
              >
                Learn More
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-gray-300 rounded-full flex items-start justify-center p-2"
          >
            <motion.div className="w-1 h-2 bg-gray-400 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Glassmorphism Feature Cards - Floating */}
      <section className="relative -mt-32 z-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 100 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
                <div className="relative bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl p-8 h-full hover:border-green-300 hover:shadow-xl transition-all duration-500">
                  <div
                    className={`w-14 h-14 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-6`}
                  >
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section ref={problemRef} className="relative py-32 px-4">
        <motion.div style={{ y: problemY }} className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-4 py-2 rounded-full bg-red-50 border border-red-200 text-red-600 text-sm font-medium mb-6">
              The Challenge
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-gray-900"
          >
            Teaching Is Getting{' '}
            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              More Complex
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto"
          >
            Faculty members juggle multiple courses, diverse student needs, grading backlogs, and administrative tasks.
            Traditional tools can&apos;t keep up with modern educational demands. You need intelligent, context-aware
            assistance.
          </motion.p>
        </motion.div>
      </section>

      {/* Solution Overview */}
      <section ref={solutionRef} className="relative py-32 px-4 bg-gradient-to-b from-white via-gray-50 to-white">
        <motion.div style={{ y: solutionY }} className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-4 py-2 rounded-full bg-green-50 border border-green-200 text-green-600 text-sm font-medium mb-6">
              The Solution
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-gray-900"
          >
            Meet Your{' '}
            <span className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
              AI Teaching Partner
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto mb-12"
          >
            Mentora is a context-aware AI assistant that understands your courses, students, and teaching style. It
            automates routine tasks, provides intelligent insights, and helps you focus on what matters most—inspiring
            students.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-3xl blur-3xl" />
            <div className="relative bg-white/80 backdrop-blur-xl border border-gray-200 rounded-3xl p-12 shadow-xl">
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.3 }}
                    className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  >
                    <Target className="w-8 h-8 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">Context-Aware</h3>
                  <p className="text-gray-600">Understands your unique teaching context</p>
                </div>

                <div className="text-center">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.3 }}
                    className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  >
                    <Zap className="w-8 h-8 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">Lightning Fast</h3>
                  <p className="text-gray-600">Get instant responses and insights</p>
                </div>

                <div className="text-center">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.3 }}
                    className="w-16 h-16 bg-gradient-to-r from-teal-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  >
                    <Lock className="w-8 h-8 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">Secure &amp; Private</h3>
                  <p className="text-gray-600">Your data is encrypted and protected</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Key Features */}
      <section ref={featuresRef} className="relative py-32 px-4">
        <motion.div style={{ y: featuresY }} className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900">
              Powerful{' '}
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Features
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Everything you need to excel in modern teaching</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {keyFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
                <div className="relative bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl p-8 hover:border-green-300 hover:shadow-xl transition-all duration-500">
                  <feature.icon className="w-12 h-12 text-green-600 mb-4" />
                  <h3 className="text-2xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section ref={howItWorksRef} className="relative py-32 px-4 bg-gradient-to-b from-white via-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900">
              How It{' '}
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Works
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get started in minutes and transform your teaching workflow
            </p>
          </motion.div>

          <div className="space-y-12">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className="relative"
              >
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0 w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg"
                  >
                    <span className="text-4xl font-bold text-white">{step.number}</span>
                  </motion.div>
                  <div className="flex-1 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl p-8 shadow-lg">
                    <h3 className="text-2xl font-bold mb-3 text-gray-900">{step.title}</h3>
                    <p className="text-gray-600 text-lg">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="relative py-32 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur-3xl" />
            <div className="relative bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-16 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
              <div className="relative z-10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <Award className="w-16 h-16 text-white mx-auto mb-6" />
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-4xl md:text-5xl font-bold mb-6 text-white"
                >
                  Ready to Transform Your Teaching?
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-xl text-white/90 mb-10 max-w-2xl mx-auto"
                >
                  Join forward-thinking educators who are using AI to enhance teaching and improve student outcomes.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      onClick={handleGetStarted}
                      size="lg"
                      className="bg-white text-green-600 hover:bg-gray-50 text-lg px-10 py-7 shadow-2xl"
                    >
                      Get Started Now
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-gray-200 bg-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Mentora" className="h-10" />
            </div>
            <p className="text-gray-500 text-sm">© 2026 Mentora. Empowering Academic Excellence Through AI.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}