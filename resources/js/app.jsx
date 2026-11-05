import React from 'react'
import { createRoot } from 'react-dom/client'
import LoginCard from './components/LoginCard'
import RegisterCard from './components/RegisterCard'
import LandingPage from './components/LandingPage'
import DashboardLayout from './components/DashboardLayout'
import PendingApprovalPage from './components/PendingApprovalPage'
import RecoveryPasswordCard from './components/RecoveryPasswordCard'

function mountComponent(elementId, Component) {
  const el = document.getElementById(elementId)
  if (!el) return
  const props = el.dataset.props ? JSON.parse(el.dataset.props) : {}
  const root = createRoot(el)
  root.render(<Component {...props} />)
}

document.addEventListener('DOMContentLoaded', () => {
  mountComponent('react-login-root', LoginCard)
  mountComponent('react-register-root', RegisterCard)
  mountComponent('react-recovery-password-root', RecoveryPasswordCard)
  mountComponent('react-landing-root', LandingPage)
  mountComponent('react-dashboard-root', DashboardLayout)
  mountComponent('react-pending-approval-root', PendingApprovalPage)
})
