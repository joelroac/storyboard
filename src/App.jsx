import React from 'react'
import { Clapperboard, ExternalLink, Copy, Check } from 'lucide-react'
import { useApp } from './context/AppContext'
import Login from './components/Login'
import Layout from './components/Layout'
import JoelDashboard from './components/joel/JoelDashboard'
import AnthonyDashboard from './components/anthony/AnthonyDashboard'
import SocialMediaManagerDashboard from './components/tiana/SocialMediaManagerDashboard'
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
  const { currentUser, relevantLinks, previewRole } = useApp()
  const [showPasswords, setShowPasswords] = React.useState({})
  const [copiedKey, setCopiedKey]         = React.useState(null)
  // PIN re-auth state
  const [pendingAuthKey, setPendingAuthKey] = React.useState(null)
  const [pinInput, setPinInput]             = React.useState('')
  const [pinError, setPinError]             = React.useState(false)

  const effectiveRole = previewRole || currentUser?.role
  const isAdmin   = effectiveRole === 'admin' || effectiveRole === 'creator'
  // Real role (not preview) — used to decide PIN requirement
  const isSocial  = effectiveRole === 'social_manager' || effectiveRole === 'social'
  const isEditor  = effectiveRole === 'editor'
  // Everyone must re-auth to view passwords (not applicable in preview mode)
  const requiresPinForPasswords = !previewRole

  const sections = []
  // Admin-only section — only when actually logged in as admin (not in preview mode)
  if (isAdmin && !previewRole) sections.push({ title: 'Admin', links: relevantLinks?.admin || [], passwords: relevantLinks?.adminPasswords || [], adminOnly: true })
  if (isAdmin || isSocial) sections.push({ title: 'Social Media', links: relevantLinks?.socialManager || [], passwords: relevantLinks?.socialManagerPasswords || [] })
  if (isAdmin || isEditor) sections.push({ title: 'Video Editor', links: relevantLinks?.editor || [], passwords: relevantLinks?.editorPasswords || [] })

  const hasLinks = sections.some(s => s.links.length > 0 || s.passwords.length > 0)

  function handleShowPassword(key) {
    if (requiresPinForPasswords) {
      // Juliana must verify PIN first
      setPendingAuthKey(key)
      setPinInput('')
      setPinError(false)
    } else {
      setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))
    }
  }

  function handlePinSubmit(key) {
    if (String(pinInput) === String(currentUser?.pin)) {
      setShowPasswords(prev => ({ ...prev, [key]: true }))
      setPendingAuthKey(null)
      setPinInput('')
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  function handleCopy(key, password) {
    navigator.clipboard.writeText(password).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  function renderPasswordRow(entry, key) {
    const isRevealed = showPasswords[key]
    const isPending  = pendingAuthKey === key
    const isCopied   = copiedKey === key

    return (
      <div key={key} className="flex flex-col rounded-xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-4 p-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{entry.label}</p>
            {entry.username && <p className="text-xs text-zinc-500 mt-0.5">{entry.username}</p>}
          </div>
          <div className="flex items-center gap-2">
            {!isPending && (
              <span className="text-sm font-mono" style={{ color: '#a1a1aa', letterSpacing: isRevealed ? 'normal' : '0.15em' }}>
                {isRevealed ? entry.password : '••••••••'}
              </span>
            )}
            {isRevealed && (
              <button
                onClick={() => handleCopy(key, entry.password)}
                className="flex items-center justify-center w-6 h-6 rounded-md transition-all"
                style={{
                  background: isCopied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                  border: isCopied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  color: isCopied ? '#4ade80' : '#71717a',
                }}
                title="Copy password"
              >
                {isCopied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            )}
            {!isPending && (
              <button
                onClick={() => isRevealed
                  ? setShowPasswords(prev => ({ ...prev, [key]: false }))
                  : handleShowPassword(key)
                }
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {isRevealed ? 'Hide' : 'Show'}
              </button>
            )}
            {isPending && (
              <span className="text-xs text-zinc-500">Enter PIN to reveal</span>
            )}
          </div>
        </div>
        {/* Inline PIN prompt */}
        {isPending && (
          <div className="px-4 pb-4 flex items-center gap-2 animate-fade-in">
            <input
              type="password"
              maxLength={8}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false) }}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit(key)}
              autoFocus
              placeholder="PIN"
              className="w-20 text-sm rounded-lg px-3 py-1.5 text-white text-center font-mono tracking-widest"
              style={{
                background: pinError ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
                border: pinError ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.12)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handlePinSubmit(key)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              Confirm
            </button>
            <button
              onClick={() => { setPendingAuthKey(null); setPinInput(''); setPinError(false) }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Cancel
            </button>
            {pinError && <span className="text-xs text-red-400">Incorrect PIN</span>}
          </div>
        )}
      </div>
    )
  }

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
              {(isAdmin || section.adminOnly) && (
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-4"
                  style={{ color: section.adminOnly ? '#f59e0b' : '#52525b' }}>
                  {section.title}
                </p>
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
                    return renderPasswordRow(entry, key)
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
  if (previewRole === 'social_manager') return <SocialMediaManagerDashboard />

  if (currentUser.role === 'admin' || currentUser.role === 'creator') return <JoelDashboard />
  if (currentUser.role === 'editor')                                   return <AnthonyDashboard />
  if (currentUser.role === 'social_manager' || currentUser.role === 'social') return <SocialMediaManagerDashboard />
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
