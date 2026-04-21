import React from 'react'
import { Clapperboard, ExternalLink } from 'lucide-react'
import { useApp } from './context/AppContext'
import Login from './components/Login'
import Layout from './components/Layout'
import JoelDashboard from './components/joel/JoelDashboard'
import AnthonyDashboard from './components/anthony/AnthonyDashboard'
import TianaDashboard from './components/tiana/TianaDashboard'
import Calendar from './components/Calendar'
import ProjectDetail from './components/ProjectDetail'
import IdeasBoard from './components/joel/IdeasBoard'

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

function LinksPage() {
  const { currentUser, relevantLinks } = useApp()
  const [showPasswords, setShowPasswords] = React.useState({})
  const isAdmin   = currentUser?.role === 'admin' || currentUser?.role === 'creator'
  const isSocial  = currentUser?.role === 'social_manager' || currentUser?.role === 'social'
  const isEditor  = currentUser?.role === 'editor'

  const sections = []
  if (isAdmin || isSocial) sections.push({ title: 'Social Media', links: relevantLinks?.socialManager || [], passwords: relevantLinks?.socialManagerPasswords || [] })
  if (isAdmin || isEditor) sections.push({ title: 'Video Editor', links: relevantLinks?.editor || [], passwords: relevantLinks?.editorPasswords || [] })

  const hasLinks = sections.some(s => s.links.length > 0 || s.passwords.length > 0)

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-editorial text-3xl font-semibold text-white">Links & Resources</h1>
        <p className="text-zinc-500 text-sm mt-1">Quick access to tools and references for your team</p>
      </div>
      {!hasLinks ? (
        <div className="rounded-2xl py-20 text-center" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
          <p className="text-zinc-600 text-sm">No links added yet — admins can add them in Settings → Team Links</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {sections.map(section => (section.links.length > 0 || section.passwords.length > 0) && (
            <div key={section.title}>
              {isAdmin && (
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-4">{section.title}</p>
              )}
              {section.links.length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
                  {section.links.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 rounded-xl transition-colors hover:bg-white/[0.03] group"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <ExternalLink size={13} style={{ color: '#f59e0b' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                          {link.label || link.url}
                        </p>
                        <p className="text-xs text-zinc-600 truncate mt-0.5">{link.url}</p>
                      </div>
                      <ExternalLink size={12} className="text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              )}
              {section.passwords.length > 0 && (
                <div className="flex flex-col gap-2">
                  {section.passwords.map((entry, pwIdx) => {
                    const key = `${section.title}-${pwIdx}`
                    return (
                      <div key={key} className="flex items-center gap-4 p-4 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{entry.label}</p>
                          {entry.username && <p className="text-xs text-zinc-500 mt-0.5">{entry.username}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono" style={{ color: '#a1a1aa', letterSpacing: showPasswords[key] ? 'normal' : '0.15em' }}>
                            {showPasswords[key] ? entry.password : '••••••••'}
                          </span>
                          <button onClick={() => setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))}
                            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                            {showPasswords[key] ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DashboardRouter() {
  const { currentUser, activeTab, previewRole } = useApp()

  if (activeTab === 'calendar') return <Calendar />
  if (activeTab === 'links')    return <LinksPage />
  if (activeTab === 'ideas')    return <IdeasBoard />

  // Admin preview mode — render another user's dashboard without switching accounts
  if (previewRole === 'editor')         return <AnthonyDashboard />
  if (previewRole === 'social_manager') return <TianaDashboard />

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
