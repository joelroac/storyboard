import React, { useState } from 'react'
import { Clapperboard, ShieldCheck } from 'lucide-react'
import * as OTPAuth from 'otpauth'
import { useApp } from '../context/AppContext'

// ── Device token helpers (30-day remember-device) ──────────────────────────────
function hasValidDeviceToken(userId) {
  try {
    const raw = localStorage.getItem(`storyboard_device_${userId}`)
    if (!raw) return false
    const { expiresAt } = JSON.parse(raw)
    if (!expiresAt || Date.now() >= expiresAt) {
      localStorage.removeItem(`storyboard_device_${userId}`)
      return false
    }
    return true
  } catch { return false }
}

function saveDeviceToken(userId) {
  localStorage.setItem(`storyboard_device_${userId}`, JSON.stringify({
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }))
}

// ── Role display ───────────────────────────────────────────────────────────────
const ROLE_META = {
  admin:          { tagline: 'Creator & Owner',       gradient: 'from-amber-500/20 to-amber-600/5' },
  creator:        { tagline: 'Creator & Owner',       gradient: 'from-amber-500/20 to-amber-600/5' },
  editor:         { tagline: 'Video Editor',          gradient: 'from-blue-500/20 to-blue-600/5'  },
  social_manager: { tagline: 'Social Media Manager',  gradient: 'from-purple-500/20 to-purple-600/5' },
  social:         { tagline: 'Social Media Manager',  gradient: 'from-purple-500/20 to-purple-600/5' },
}

// Fallback if DB not loaded yet
const FALLBACK_USERS = [
  { id: '4e2b4bae-589f-4824-96d9-5f02e4d24535', name: 'Joel',    role: 'admin',          avatar: 'J' },
  { id: 'fca86249-c689-45f2-a294-3ed18d71669c', name: 'Anthony', role: 'editor',         avatar: 'A' },
  { id: 'a502a936-1deb-4eb9-b33f-e6ed50a4e0bd', name: 'Juliana', role: 'social_manager', avatar: 'J' },
]

export default function Login() {
  const { login, completeLogin, teamMembers } = useApp()

  // ── Step: 'user' → 'pin' → '2fa' ──────────────────────────────────────────
  const [step, setStep]     = useState('user')
  const [selected, setSelected] = useState(null)

  // PIN step
  const [pin, setPin]                   = useState('')
  const [error, setError]               = useState('')
  const [shaking, setShaking]           = useState(false)
  const [loggingIn, setLoggingIn]       = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutUntil, setLockoutUntil]     = useState(null)

  // 2FA step
  const [pendingUser, setPendingUser]   = useState(null)
  const [totpCode, setTotpCode]         = useState('')
  const [totpError, setTotpError]       = useState('')
  const [totpShaking, setTotpShaking]   = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [verifying, setVerifying]       = useState(false)

  const displayUsers = teamMembers.length > 0 ? teamMembers : FALLBACK_USERS
  const isLockedOut  = lockoutUntil && Date.now() < lockoutUntil

  // ── User selection ─────────────────────────────────────────────────────────
  function handleUserSelect(user) {
    setSelected(user)
    setPin('')
    setError('')
    setFailedAttempts(0)
    setLockoutUntil(null)
    setStep('pin')
  }

  // ── PIN step ───────────────────────────────────────────────────────────────
  function handlePinChange(e) {
    if (isLockedOut) return
    const val = e.target.value.slice(0, 20)
    setPin(val)
    setError('')
    if (/^\d{4}$/.test(val)) {
      setTimeout(() => attemptLogin(val), 80)
    }
  }

  async function attemptLogin(pinVal = pin) {
    if (!selected || loggingIn || isLockedOut) return
    setLoggingIn(true)
    const result = await login(selected.id, pinVal)
    setLoggingIn(false)

    if (!result) {
      // Wrong PIN
      const next = failedAttempts + 1
      setFailedAttempts(next)
      if (next >= 5) {
        setLockoutUntil(Date.now() + 30_000)
        setError('Too many attempts. Try again in 30 seconds.')
        setTimeout(() => { setLockoutUntil(null); setFailedAttempts(0); setError('') }, 30_000)
      } else {
        setError(`Incorrect PIN. ${5 - next} attempt${5 - next === 1 ? '' : 's'} remaining.`)
      }
      setPin('')
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      return
    }

    setFailedAttempts(0)
    setLockoutUntil(null)

    if (result.requires2FA) {
      // Check if this device is already trusted
      if (hasValidDeviceToken(result.id)) {
        completeLogin(result)   // skip 2FA, device remembered
      } else {
        setPendingUser(result)
        setTotpCode('')
        setTotpError('')
        setStep('2fa')
      }
    }
    // else: no 2FA — completeLogin was called inside login(), user is in
  }

  function handlePinKeyDown(e) {
    if (e.key === 'Enter') attemptLogin()
  }

  // ── 2FA step ───────────────────────────────────────────────────────────────
  function handleTotpChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setTotpCode(val)
    setTotpError('')
    if (val.length === 6) setTimeout(() => handleTOTPVerify(val), 80)
  }

  function handleTOTPVerify(codeVal = totpCode) {
    if (verifying || !pendingUser) return
    setVerifying(true)
    try {
      const totp  = new OTPAuth.TOTP({
        secret:    OTPAuth.Secret.fromBase32(pendingUser._totpSecret),
        algorithm: 'SHA1',
        digits:    6,
        period:    30,
      })
      const delta = totp.validate({ token: codeVal.replace(/\s/g, ''), window: 1 })
      if (delta === null) {
        setTotpError('Incorrect code — try again')
        setTotpCode('')
        setTotpShaking(true)
        setTimeout(() => setTotpShaking(false), 500)
      } else {
        if (rememberDevice) saveDeviceToken(pendingUser.id)
        completeLogin(pendingUser)
      }
    } catch {
      setTotpError('Invalid code format')
      setTotpCode('')
    }
    setVerifying(false)
  }

  function handleTotpKeyDown(e) {
    if (e.key === 'Enter') handleTOTPVerify()
  }

  function handleBack() {
    setStep('pin')
    setPin('')
    setError('')
    setPendingUser(null)
    setTotpCode('')
    setTotpError('')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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

        {/* ── Step: user selection ── */}
        {step === 'user' && (
          <div className="animate-fade-in">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-4 text-center">
              Who's logging in?
            </p>
            <div className="flex flex-col gap-3">
              {displayUsers.map((user) => {
                const meta    = ROLE_META[user.role] || ROLE_META.admin
                const initial = user.avatar || user.name?.[0]?.toUpperCase() || '?'
                return (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="w-full text-left rounded-xl p-4 flex items-center gap-4 transition-all duration-150 card card-hover cursor-pointer"
                  >
                    <div
                      className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold"
                      style={{
                        background: user.avatar_url ? 'transparent' : 'rgba(255,255,255,0.08)',
                        color:      '#9ca3af',
                        border:     '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {user.avatar_url
                        ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                        : initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm">{user.name}</div>
                      <div className="text-zinc-500 text-xs">{meta.tagline}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Step: PIN ── */}
        {step === 'pin' && selected && (
          <div className={`animate-fade-in ${shaking ? 'animate-bounce' : ''}`}>
            {/* Back to user select */}
            <button
              onClick={() => { setStep('user'); setSelected(null); setPin(''); setError('') }}
              className="flex items-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors text-xs mb-6"
            >
              ← Back
            </button>

            {/* Selected user display */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold"
                style={{
                  background: selected.avatar_url ? 'transparent' : 'rgba(245,158,11,0.2)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245,158,11,0.4)',
                }}
              >
                {selected.avatar_url
                  ? <img src={selected.avatar_url} alt={selected.name} className="w-full h-full object-cover" />
                  : (selected.avatar || selected.name?.[0]?.toUpperCase())}
              </div>
              <div>
                <div className="font-semibold text-white text-sm">{selected.name}</div>
                <div className="text-zinc-500 text-xs">{(ROLE_META[selected.role] || ROLE_META.admin).tagline}</div>
              </div>
            </div>

            <p className="text-zinc-600 text-[10px] font-medium uppercase tracking-widest mb-3 text-center">
              Enter passcode
            </p>
            {selected.role !== 'admin' && selected.role !== 'creator' && (
              <p className="text-zinc-700 text-[10px] text-center mb-3">
                Admins may use their own PIN
              </p>
            )}
            <input
              type="password"
              inputMode="text"
              maxLength={20}
              value={pin}
              onChange={handlePinChange}
              onKeyDown={handlePinKeyDown}
              placeholder="Enter passcode…"
              className="pin-input"
              autoFocus
              disabled={isLockedOut}
            />
            {error && <p className="text-red-400 text-xs text-center mt-2">{error}</p>}
            <button
              onClick={() => attemptLogin()}
              disabled={pin.length < 1 || loggingIn || isLockedOut}
              className="btn-amber w-full mt-4 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loggingIn ? 'Signing in…' : 'Enter Studio'}
            </button>
          </div>
        )}

        {/* ── Step: 2FA ── */}
        {step === '2fa' && pendingUser && (
          <div className={`animate-fade-in ${totpShaking ? 'animate-bounce' : ''}`}>
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors text-xs mb-6"
            >
              ← Back
            </button>

            <div className="flex flex-col items-center mb-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <ShieldCheck size={22} style={{ color: '#f59e0b' }} />
              </div>
              <h2 className="text-white font-semibold text-base">Two-Factor Authentication</h2>
              <p className="text-zinc-500 text-xs mt-1 text-center">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              value={totpCode}
              onChange={handleTotpChange}
              onKeyDown={handleTotpKeyDown}
              placeholder="000 000"
              maxLength={6}
              className="pin-input text-center text-xl tracking-[0.4em]"
              autoFocus
              disabled={verifying}
            />
            {totpError && <p className="text-red-400 text-xs text-center mt-2">{totpError}</p>}

            {/* Remember device */}
            <label className="flex items-center gap-2 mt-4 cursor-pointer group justify-center">
              <div
                onClick={() => setRememberDevice(v => !v)}
                className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                style={{
                  background:   rememberDevice ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.05)',
                  border:       `1px solid ${rememberDevice ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.15)'}`,
                }}
              >
                {rememberDevice && (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5l2 2L7.5 2" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors select-none">
                Remember this device for 30 days
              </span>
            </label>

            <button
              onClick={() => handleTOTPVerify()}
              disabled={totpCode.length < 6 || verifying}
              className="btn-amber w-full mt-4 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {verifying ? 'Verifying…' : 'Verify'}
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
