import React from 'react'
import { useApp } from './context/AppContext'
import Login from './components/Login'
import Layout from './components/Layout'
import JoelDashboard from './components/joel/JoelDashboard'
import AnthonyDashboard from './components/anthony/AnthonyDashboard'
import TianaDashboard from './components/tiana/TianaDashboard'
import Calendar from './components/Calendar'
import ProjectDetail from './components/ProjectDetail'

function DashboardRouter() {
  const { currentUser, activeTab } = useApp()

  if (currentUser.role === 'admin' || currentUser.role === 'creator') {
    return activeTab === 'calendar' ? <Calendar /> : <JoelDashboard />
  }
  if (currentUser.role === 'editor') {
    return <AnthonyDashboard />
  }
  if (currentUser.role === 'social_manager' || currentUser.role === 'social') {
    return <TianaDashboard />
  }
  return null
}

export default function App() {
  const { currentUser, selectedProject, loading } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.06) 0%, #0c0c0e 60%)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-6"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <span style={{ fontSize: 16 }}>🎬</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
            <path d="M8 2a6 6 0 0 1 6 6" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Loading…
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Login />
  }

  return (
    <Layout>
      <DashboardRouter />
      {selectedProject && <ProjectDetail />}
    </Layout>
  )
}
