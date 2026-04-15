import React, { useState } from 'react'
import { LayoutDashboard, CalendarDays, LogOut, Settings, Clapperboard } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Notifications from './Notifications'
import SettingsModal from './SettingsModal'

export default function Layout({ children }) {
  const { currentUser, teamMembers, logout, activeTab, setActiveTab } = useApp()
  const [showSettings, setShowSettings] = useState(false)
  // Resolve avatar_url live from teamMembers so it updates without re-login
  const liveMember   = teamMembers.find((m) => m.id === currentUser?.id)
  const avatarUrl    = liveMember?.avatar_url || currentUser?.avatar_url || null
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'creator'

  // All roles see calendar; editor (Anthony) sees YouTube-only calendar
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendar',  label: 'Calendar',  icon: CalendarDays },
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
          {/* Settings — Joel only */}
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: '#52525b', border: '1px solid rgba(255,255,255,0.07)' }}
              title="Settings"
            >
              <Settings size={13} />
            </button>
          )}

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
    </div>
  )
}
