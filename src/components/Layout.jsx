import React, { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, CalendarDays, Link2, LogOut, Settings, Clapperboard, Camera, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Notifications from './Notifications'
import SettingsModal from './SettingsModal'

export default function Layout({ children }) {
  const { currentUser, teamMembers, logout, activeTab, setActiveTab, updateTeamMember } = useApp()
  const [showSettings, setShowSettings] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaved, setNameSaved] = useState(false)
  const profilePhotoRef = useRef(null)
  useEffect(() => {
    if (currentUser?.name) setNameDraft(currentUser.name)
  }, [currentUser?.name])

  // Resolve avatar_url live from teamMembers so it updates without re-login
  const liveMember   = teamMembers.find((m) => m.id === currentUser?.id)
  const avatarUrl    = liveMember?.avatar_url || currentUser?.avatar_url || null
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'creator'

  function handleProfilePhoto(e) {
    const file = e.target.files?.[0]
    if (!file || !liveMember) return
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = async () => {
      const MAX = 300
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h / w) * MAX); w = MAX }
        else        { w = Math.round((w / h) * MAX); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const base64 = canvas.toDataURL('image/jpeg', 0.82)
      URL.revokeObjectURL(objectUrl)
      await updateTeamMember(liveMember.id, { avatar_url: base64 })
    }
    img.onerror = () => URL.revokeObjectURL(objectUrl)
    img.src = objectUrl
    e.target.value = ''
  }

  // All roles see calendar; editor (Anthony) sees YouTube-only calendar
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendar',  label: 'Calendar',  icon: CalendarDays },
    { id: 'links',     label: 'Links',     icon: Link2 },
  ]

  const roleColor = {
    admin:          { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Admin' },
    creator:        { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Creator' },
    editor:         { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', label: 'Editor' },
    social_manager: { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc', label: 'Social' },
    social:         { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc', label: 'Social' },
  }
  const rc = roleColor[currentUser?.role] || roleColor.admin

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0c0c0e' }}>
      {/* Top nav */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-3"
        style={{
          background: 'rgba(12,12,14,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Left: logo + tabs */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <Clapperboard size={14} style={{ color: '#f59e0b' }} />
            </div>
            <span className="font-editorial text-lg font-semibold text-white tracking-tight">
              The Storyboard
            </span>
          </div>

          {/* Tabs — dashboard always + calendar for all roles */}
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={
                      active
                        ? { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }
                        : { color: '#71717a', border: '1px solid transparent' }
                    }
                  >
                    <Icon size={13} />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
        </div>

        {/* Right: notifications + user */}
        <div className="flex items-center gap-3">
          {/* Settings — all roles */}
          <button
            onClick={() => isAdmin ? setShowSettings(true) : setShowProfileSettings(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: '#52525b', border: '1px solid rgba(255,255,255,0.07)' }}
            title="Settings"
          >
            <Settings size={13} />
          </button>

          <Notifications />

          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
              style={{
                background: avatarUrl ? 'transparent' : rc.bg,
                color: rc.color,
                border: `1px solid ${rc.color}40`,
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={currentUser?.name} className="w-full h-full object-cover" />
                : currentUser?.avatar}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-white leading-none">{currentUser?.name}</div>
              <div className="text-[10px] mt-0.5" style={{ color: rc.color }}>{rc.label}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#52525b', border: '1px solid rgba(255,255,255,0.07)' }}
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showProfileSettings && !isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowProfileSettings(false) }}
        >
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 className="text-base font-semibold text-white">Profile</h2>
              <button onClick={() => setShowProfileSettings(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: '#52525b' }}><X size={14} /></button>
            </div>
            <div className="p-5 flex flex-col items-center gap-4">
              <p className="text-xs text-zinc-500">Click your avatar to upload a new photo</p>
              <button type="button" onClick={() => profilePhotoRef.current?.click()} className="relative w-20 h-20 rounded-full overflow-hidden group" style={{ border: '1px solid rgba(255,255,255,0.12)' }} title="Upload photo">
                {avatarUrl
                  ? <img src={avatarUrl} alt={currentUser?.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>{currentUser?.avatar}</div>}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.55)' }}>
                  <Camera size={20} style={{ color: '#fff' }} />
                </div>
              </button>
              <input ref={profilePhotoRef} type="file" accept="image/*" onChange={handleProfilePhoto} style={{ display: 'none' }} />
              <div className="w-full flex flex-col gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full text-sm text-white text-center bg-transparent rounded-lg px-3 py-2 outline-none"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="Your name"
                />
                <button
                  onClick={async () => {
                    if (nameDraft.trim() && nameDraft.trim() !== currentUser?.name && liveMember) {
                      await updateTeamMember(liveMember.id, { name: nameDraft.trim() })
                      setNameSaved(true)
                      setTimeout(() => setNameSaved(false), 2000)
                    }
                  }}
                  className="w-full py-2 text-xs font-semibold rounded-lg transition-colors"
                  style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  {nameSaved ? 'Saved ✓' : 'Update Name'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
