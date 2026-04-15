import React from 'react'
import { Clapperboard } from 'lucide-react'
import { useApp } from './context/AppContext'
import Login from './components/Login'
import Layout from './components/Layout'
import JoelDashboard from './components/joel/JoelDashboard'
import AnthonyDashboard from './components/anthony/AnthonyDashboard'
import TianaDashboard from './components/tiana/TianaDashboard'
import Calendar from './components/Calendar'
import ProjectDetail from './components/ProjectDetail'

function BannerContainer() {
  const { banners } = useApp()
  if (!banners || banners.length === 0) return null

  const bannerColors = {
    success: '#4ade80',
    error:   '#f87171',
    warning: '#f59e0b',
    info:    '#60a5fa',
  }

  return (
    <div style={{
      position:        'fixed',
      top:             16,
      left:            '50%',
      transform:       'translateX(-50%)',
      zIndex:          200,
      display:         'flex',
      flexDirection:   'column',
      gap:             8,
      alignItems:      'center',
      pointerEvents:   'none',
    }}>
      {banners.map(b => (
        <div key={b.id} style={{
          background:   '#1a1a1e',
          border:       `1px solid ${(bannerColors[b.type] || '#a1a1aa')}40`,
          borderLeft:   `3px solid ${bannerColors[b.type] || '#a1a1aa'}`,
          color:        '#f4f4f5',
          padding:      '10px 20px',
          borderRadius: 8,
          fontSize:     13,
          fontWeight:   500,
          boxShadow:    '0 8px 32px rgba(0,0,0,0.4)',
          whiteSpace:   'nowrap',
          animation:    'slideDown 0.3s ease',
        }}>
          {b.message}
        </div>
      ))}
    </div>
  )
}

function DashboardRouter() {
  const { currentUser, activeTab } = useApp()

  // Calendar is visible to all roles (editor sees YouTube-only, handled in Calendar component)
  if (activeTab === 'calendar') return <Calendar />

  if (currentUser.role === 'admin' || currentUser.role === 'creator') return <JoelDashboard />
  if (currentUser.role === 'editor')                                   return <AnthonyDashboard />
  if (currentUser.role === 'social_manager' || currentUser.role === 'social') return <TianaDashboard />
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
          <Clapperboard size={16} style={{ color: '#f59e0b' }} />
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
    <>
      <BannerContainer />
      <Layout>
        <DashboardRouter />
        {selectedProject && <ProjectDetail />}
      </Layout>
    </>
  )
}
