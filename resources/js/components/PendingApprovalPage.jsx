import { useEffect, useRef, useState } from 'react'

const POLL_INTERVAL = 3000  // check every 3 seconds

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

// ─── Animated spinner ring ────────────────────────────────────────────────────
function SpinnerRing() {
  return (
    <div className="relative w-24 h-24">
      {/* Outer pulse */}
      <div className="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-40" />
      {/* Spinning ring */}
      <div className="absolute inset-0 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin" />
      {/* Inner icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>
  )
}

// ─── Approved animation ───────────────────────────────────────────────────────
function ApprovedIcon() {
  return (
    <div className="relative w-24 h-24">
      <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-30" />
      <div className="absolute inset-0 rounded-full bg-green-100 flex items-center justify-center">
        <svg
          className="w-12 h-12 text-green-600 animate-[scale-in_0.3s_ease-out]"
          style={{ animation: 'scaleIn 0.4s ease-out forwards' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
  )
}

// ─── Rejected icon ────────────────────────────────────────────────────────────
function RejectedIcon() {
  return (
    <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center">
      <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  )
}

// ─── Dot loader ───────────────────────────────────────────────────────────────
function DotLoader() {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-2">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-amber-400"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PendingApprovalPage() {
  // status: 'pending' | 'active' | 'rejected' | 'unknown'
  const [status, setStatus]           = useState('pending')
  const [userName, setUserName]       = useState('')
  const [lastChecked, setLastChecked] = useState(null)
  const [countdown, setCountdown]     = useState(3)
  const intervalRef  = useRef(null)
  const countdownRef = useRef(null)

  const poll = async () => {
    try {
      const res = await fetch('/api/auth/approval-status', {
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      if (!res.ok) return
      const data = await res.json()
      setLastChecked(new Date())
      setCountdown(3)

      if (data.status === 'active') {
        setUserName(data.name || '')
        setStatus('active')
        clearInterval(intervalRef.current)
        clearInterval(countdownRef.current)
        // Auto-redirect to login after 4 seconds so they can log in
        setTimeout(() => { window.location.href = '/login' }, 4000)
      } else if (data.status === 'rejected') {
        setUserName(data.name || '')
        setStatus('rejected')
        clearInterval(intervalRef.current)
        clearInterval(countdownRef.current)
      } else if (data.status === 'unknown') {
        setStatus('unknown')
        clearInterval(intervalRef.current)
        clearInterval(countdownRef.current)
      }
      // else still pending — keep polling
    } catch {
      // network error — keep trying
    }
  }

  useEffect(() => {
    // Immediate first check
    poll()

    // Poll every 3 seconds
    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    // Visual countdown every second
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? 3 : c - 1))
    }, 1000)

    return () => {
      clearInterval(intervalRef.current)
      clearInterval(countdownRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── APPROVED ──────────────────────────────────────────────────────────────
  if (status === 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Logo />
          <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-8 text-center animate-[fadeIn_0.4s_ease-out]">
            <div className="flex justify-center mb-5">
              <ApprovedIcon />
            </div>
            <h2 className="text-2xl font-semibold text-green-700 mb-2">
              You're Approved{userName ? `, ${userName.split(' ')[0]}` : ''}! 🎉
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Your account has been approved by the administrator.
              You can now log in and start using Mentora.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 text-xs text-green-700">
              Redirecting you to the login page in a few seconds…
            </div>
            <a
              href="/login"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Log In Now
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── REJECTED ──────────────────────────────────────────────────────────────
  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Logo />
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
            <div className="flex justify-center mb-5">
              <RejectedIcon />
            </div>
            <h2 className="text-xl font-semibold text-red-700 mb-2">Registration Not Approved</h2>
            <p className="text-gray-500 text-sm mb-6">
              Unfortunately your registration was not approved by the administrator.
              Please contact your school admin for more information.
            </p>
            <a
              href="/login"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── UNKNOWN (session expired) ─────────────────────────────────────────────
  if (status === 'unknown') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Logo />
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Session Expired</h2>
            <p className="text-gray-500 text-sm mb-6">
              We couldn't find your registration. Your session may have expired.
              Try logging in — if your account was approved you'll get in directly.
            </p>
            <a
              href="/login"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── PENDING (default) ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Logo />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">

          {/* Animated waiting spinner */}
          <div className="flex justify-center mb-5">
            <SpinnerRing />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-1">Waiting for Approval</h2>
          <p className="text-gray-500 text-sm mb-1">
            Your account is pending administrator review.
          </p>
          <p className="text-gray-400 text-xs mb-6">
            This page updates automatically — no need to refresh.
          </p>

          {/* Animated dots + checking status */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-sm text-amber-700 font-medium mb-1">
              <span>Checking status</span>
              <DotLoader />
            </div>
            <p className="text-xs text-amber-500">
              Next check in {countdown}s
              {lastChecked && (
                <> · Last checked {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>
              )}
            </p>
          </div>

          {/* Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-6">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">What happens next?</p>
            <ul className="space-y-2 text-sm text-blue-700">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">1</span>
                The administrator reviews your registration.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">2</span>
                This page will instantly show when you're approved.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">3</span>
                You'll be redirected to login automatically.
              </li>
            </ul>
          </div>

          <a
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            Back to Login
          </a>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Questions? Contact your school administrator.
        </p>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes scaleIn {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Brand logo ───────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="text-center mb-6">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-green-700 rounded-2xl mb-3">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422A12.083 12.083 0 0121 13.5c0 2.485-4.03 4.5-9 4.5S3 15.985 3 13.5c0-.67.109-1.314.84-2.078L12 14z"/>
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-gray-900">Mentora</h1>
    </div>
  )
}
