import React, { useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { useApp } from '../context/AppContext'

// Fallback if DB not loaded yet
const FALLBACK_USERS = [
  { id: '4e2b4bae-589f-4824-96d9-5f02e4d24535', name: 'Joel',    role: 'admin',          avatar: 'J' },
  { id: 'fca86249-c689-45f2-a294-3ed18d71669c', name: 'Anthony', role: 'editor',         avatar: 'A' },
  { id: 'a502a936-1deb-4eb9-b33f-e6ed50a4e0bd', name: 'Juliana', role: 'social_manager', avatar: 'J' },
]

const ROLE_META = {
  admin:          { tagline: 'Creator & Owner',       gradient: 'from-amber-500/20 to-amber-600/5' },
  creator:        { tagline: 'Creator & Owner',       gradient: 'from-amber-500/20 to-amber-600/5' },
  editor:         { tagline: 'Video Editor',          gradient: 'from-blue-500/20 to-blue-600/5'  },
  social_manager: { tagline: 'Social Media Manager',  gradient: 'from-purple-500/20 to-purple-600/5' },
  social:         { tagline: 'Social Media Manager',  gradient: 'from-purple-500/20 to-purple-600/5' },
}

export default function Login() {
  const { login, teamMembers } = useApp()
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  // Prefer DB team members; fall back to hardcoded list if DB hasn't loaded
  const displayUsers = teamMembers.length > 0 ? teamMembers : FALLBACK_USERS

  function handleUserSelect(user) {
    setSelected(user)
    setPin('')
    setError('')
  }

  function handlePinChange(e) {
    const val = e.target.value.slice(0, 20)
    setPin(val)
    setError('')
    // Auto-submit only for exactly 4 numeric digits (backward compat with numeric PINs)
    if (/^\d{4}$/.test(val)) {
      setTimeout(() => attemptLogin(val), 80)
    }
  }

  async function attemptLogin(pinVal = pin) {
    if (!selected || loggingIn) return
    setLoggingIn(true)
    const user = await login(selected.id, pinVal)
    setLoggingIn(false)
    if (!user) {
      setError('Incorrect PIN. Try again.')
      setPin('')
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') attemptLogin()
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.06) 0%, #0c0c0e 60%)' }}
    >
      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <Clapperboard size={16} style={{ color: '#f59e0b' }} />
          </div>
          <h1 className="font-editorial text-3xl font-semibold text-white tracking-tight">
            The Storyboard
          </h1>
        </div>
        <p className="text-zinc-500 text-sm tracking-widest uppercase font-medium">
          Content Management
        </p>
      </div>

      <div className="w-full max-w-sm">

        {/* Step 1: Select user */}
        <div className="mb-8">
          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-4 text-center">
            Who's logging in?
          </p>
          <div className="flex flex-col gap-3">
            {displayUsers.map((user) => {
              const meta    = ROLE_META[user.role] || ROLE_META.admin
              const initial = user.avatar || user.name?.[0]?.toUpperCase() || '?'
              const active  = selected?.id === user.id

              return (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className={`w-full text-left rounded-xl p-4 flex items-center gap-4 transition-all duration-150 ${
                    active ? 'border border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-transparent' : 'card card-hover cursor-pointer'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{
                      background: active ? 'rgba(245,158,11,0.2)'  : 'rgba(255,255,255,0.08)',
                      color:      active ? '#fbbf24'                : '#9ca3af',
                      border:     active ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{user.name}</div>
                    <div className="text-zinc-500 text-xs">{meta.tagline}</div>
                  </div>
                  {active && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.5)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 2.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2: PIN entry */}
        {selected && (
          <div className={`animate-fade-in ${shaking ? 'animate-bounce' : ''}`}>
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3 text-center">
              Enter PIN for {selected.name}
            </p>
            <input
              type="password"
              inputMode="text"
              maxLength={20}
              value={pin}
              onChange={handlePinChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter passcode…"
              className="pin-input"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-xs text-center mt-2">{error}</p>
            )}
            <button
              onClick={() => attemptLogin()}
              disabled={pin.length < 1 || loggingIn}
              className="btn-amber w-full mt-4 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loggingIn ? 'Signing in…' : 'Enter Studio'}
            </button>
          </div>
        )}
      </div>

      <p className="mt-16 text-zinc-700 text-xs text-center">
        Built for Joel &amp; team · The Storyboard v1
      </p>
    </div>
  )
}
