import React, { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, CalendarDays, Link2, LogOut, Settings, Clapperboard, Camera, X, KeyRound, ChevronRight, ShieldCheck, ShieldOff } from 'lucide-react'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { useApp } from '../context/AppContext'
import Notifications from './Notifications'
import SettingsModal from './SettingsModal'

export default function Layout({ children }) {
  const { currentUser, teamMembers, logout, activeTab, setActiveTab, updateTeamMember } = useApp()
  const [showSettings, setShowSettings] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaved, setNameSaved] = useState(false)
  // Passcode change state
  const [showPinSection, setShowPinSection] = useState(false)
  const [currentPin, setCurrentPin]         = useState('')
  const [newPin, setNewPin]                 = useState('')
  const [confirmPin, setConfirmPin]         = useState('')
  const [pinError, setPinError]             = useState('')
  const [pinSaved, setPinSaved]             = useState(false)
  // 2FA state
  const [twoFAStep, setTwoFAStep]               = useState('idle')  // 'idle'|'setup'|'disable'
  const [totpSetupSecret, setTotpSetupSecret]   = useState(null)
  const [totpSetupQR, setTotpSetupQR]           = useState('')
  const [totpSetupCode, setTotpSetupCode]       = useState('')
  const [totpDisableCode, setTotpDisableCode]   = useState('')
  const [twoFAError, setTwoFAError]             = useState('')
  const [twoFASaved, setTwoFASaved]             = useState(false)
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

  async function handlePinChange() {
    setPinError('')
    if (!currentPin) { setPinError('Enter your current passcode'); return }
    if (String(liveMember?.pin) !== String(currentPin)) { setPinError('Current passcode is incorrect'); return }
    if (!newPin) { setPinError('Enter a new passcode'); return }
    if (newPin.length < 4) { setPinError('Passcode must be at least 4 characters'); return }
    if (newPin !== confirmPin) { setPinError('New passcodes do not match'); return }
    const ok = await updateTeamMember(liveMember.id, { pin: newPin })
    if (ok) {
      setPinSaved(true)
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
      setTimeout(() => { setPinSaved(false); setShowPinSection(false) }, 2000)
    } else {
      setPinError('Failed to save — try again')
    }
  }

  // ── 2FA handlers ─────────────────────────────────────────────────────────
  async function handleEnable2FA() {
    setTwoFAError('')
    const secret = new OTPAuth.Secret({ size: 20 })
    const totp   = new OTPAuth.TOTP({
      issuer:    'The Storyboard',
      label:     currentUser?.name || 'User',
      algorithm: 'SHA1',
      digits:    6,
      period:    30,
      secret,
    })
    const qrUrl = await QRCode.toDataURL(totp.toString(), { width: 200, margin: 1 })
    setTotpSetupSecret(secret)
    setTotpSetupQR(qrUrl)
    setTotpSetupCode('')
    setTwoFAStep('setup')
  }

  async function handleConfirmEnable2FA() {
    setTwoFAError('')
    try {
      const totp  = new OTPAuth.TOTP({ secret: totpSetupSecret, algorithm: 'SHA1', digits: 6, period: 30 })
      const delta = totp.validate({ token: totpSetupCode.replace(/\s/g, ''), window: 1 })
      if (delta === null) { setTwoFAError('Code incorrect — check your app and try again'); return }
      await updateTeamMember(liveMember.id, { totp_secret: totpSetupSecret.base32 })
      setTwoFASaved(true)
      setTwoFAStep('idle')
      setTimeout(() => setTwoFASaved(false), 3000)
    } catch { setTwoFAError('Verification failed — try again') }
  }

  async function handleDisable2FA() {
    setTwoFAError('')
    try {
      const totp  = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(liveMember?.totp_secret), algorithm: 'SHA1', digits: 6, period: 30 })
      const delta = totp.validate({ token: totpDisableCode.replace(/\s/g, ''), window: 1 })
      if (delta === null) { setTwoFAError('Incorrect code'); return }
      await updateTeamMember(liveMember.id, { totp_secret: null })
      setTwoFAStep('idle')
      setTotpDisableCode('')
    } catch { setTwoFAError('Verification failed — try again') }
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
          {/* Profile / Settings — all roles */}
          <button
            onClick={() => setShowProfileSettings(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: '#52525b', border: '1px solid rgba(255,255,255,0.07)' }}
            title="Profile & Settings"
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

      {showProfileSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowProfileSettings(false)
              setShowPinSection(false)
              setCurrentPin(''); setNewPin(''); setConfirmPin(''); setPinError('')
              setTwoFAStep('idle'); setTotpSetupCode(''); setTotpDisableCode(''); setTwoFAError('')
            }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 className="text-base font-semibold text-white">Profile</h2>
              <button
                onClick={() => {
                  setShowProfileSettings(false)
                  setShowPinSection(false)
                  setCurrentPin(''); setNewPin(''); setConfirmPin(''); setPinError('')
                  setTwoFAStep('idle'); setTotpSetupCode(''); setTotpDisableCode(''); setTwoFAError('')
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10"
                style={{ color: '#52525b' }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">

              {/* Avatar + name */}
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => profilePhotoRef.current?.click()}
                  className="relative w-20 h-20 rounded-full overflow-hidden group"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                  title="Upload photo"
                >
                  {avatarUrl
                    ? <img src={avatarUrl} alt={currentUser?.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>{currentUser?.avatar}</div>}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.55)' }}>
                    <Camera size={20} style={{ color: '#fff' }} />
                  </div>
                </button>
                <p className="text-[10px] text-zinc-600">Click avatar to change photo</p>
                <input ref={profilePhotoRef} type="file" accept="image/*" onChange={handleProfilePhoto} style={{ display: 'none' }} />
                <div className="w-full flex gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="flex-1 text-sm text-white bg-transparent rounded-lg px-3 py-2 outline-none"
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
                    className="px-3 py-2 text-xs font-semibold rounded-lg transition-colors shrink-0"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
                  >
                    {nameSaved ? '✓' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Passcode section */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} className="pt-4">
                <button
                  onClick={() => { setShowPinSection(v => !v); setPinError('') }}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <KeyRound size={13} style={{ color: '#52525b' }} />
                    <span className="text-sm font-semibold text-zinc-400 group-hover:text-white transition-colors">
                      Change Passcode
                    </span>
                  </div>
                  <ChevronRight
                    size={13}
                    style={{
                      color: '#52525b',
                      transform: showPinSection ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 200ms ease',
                    }}
                  />
                </button>

                {showPinSection && (
                  <div className="flex flex-col gap-2 mt-3 animate-fade-in">
                    <input
                      type="password"
                      value={currentPin}
                      onChange={(e) => { setCurrentPin(e.target.value); setPinError('') }}
                      placeholder="Current passcode"
                      className="w-full text-sm text-white bg-transparent rounded-lg px-3 py-2 outline-none"
                      style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <input
                      type="password"
                      value={newPin}
                      onChange={(e) => { setNewPin(e.target.value); setPinError('') }}
                      placeholder="New passcode (min. 4 characters)"
                      className="w-full text-sm text-white bg-transparent rounded-lg px-3 py-2 outline-none"
                      style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => { setConfirmPin(e.target.value); setPinError('') }}
                      placeholder="Confirm new passcode"
                      className="w-full text-sm text-white bg-transparent rounded-lg px-3 py-2 outline-none"
                      style={{ border: `1px solid ${pinError ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.1)'}` }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handlePinChange() }}
                    />
                    {pinError && <p className="text-xs text-red-400">{pinError}</p>}
                    <button
                      onClick={handlePinChange}
                      className="w-full py-2 text-xs font-semibold rounded-lg transition-colors"
                      style={{ background: 'rgba(245,158,11,0.12)', color: pinSaved ? '#4ade80' : '#fbbf24', border: `1px solid ${pinSaved ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.2)'}` }}
                    >
                      {pinSaved ? 'Passcode Updated ✓' : 'Update Passcode'}
                    </button>
                  </div>
                )}
              </div>

              {/* 2FA section */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} className="pt-4">
                {twoFAStep === 'idle' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {liveMember?.totp_secret
                        ? <ShieldCheck size={13} style={{ color: '#4ade80' }} />
                        : <ShieldOff   size={13} style={{ color: '#52525b' }} />}
                      <span className="text-sm font-semibold text-zinc-400">Two-Factor Auth</span>
                      {liveMember?.totp_secret && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                          {twoFASaved ? 'Enabled ✓' : 'Enabled'}
                        </span>
                      )}
                    </div>
                    {liveMember?.totp_secret ? (
                      <button
                        onClick={() => { setTwoFAStep('disable'); setTotpDisableCode(''); setTwoFAError('') }}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={handleEnable2FA}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors"
                        style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
                      >
                        Enable
                      </button>
                    )}
                  </div>
                )}

                {/* Setup flow */}
                {twoFAStep === 'setup' && (
                  <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-white">Set Up 2FA</span>
                      <button onClick={() => setTwoFAStep('idle')} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Cancel</button>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3">
                      Scan this QR code with <strong className="text-zinc-400">Google Authenticator</strong>, <strong className="text-zinc-400">Authy</strong>, or any TOTP app.
                    </p>
                    {totpSetupQR && (
                      <div className="flex justify-center mb-3">
                        <img
                          src={totpSetupQR}
                          alt="2FA QR code"
                          className="rounded-lg"
                          style={{ width: 160, height: 160, imageRendering: 'pixelated', border: '4px solid #fff' }}
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-zinc-600 text-center mb-1">Can't scan? Enter this key manually:</p>
                    <p className="text-[10px] font-mono text-zinc-500 text-center mb-4 break-all">
                      {totpSetupSecret?.base32}
                    </p>
                    <p className="text-xs text-zinc-500 mb-2">Enter the 6-digit code from your app to confirm:</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={totpSetupCode}
                      onChange={(e) => { setTotpSetupCode(e.target.value.replace(/\D/g,'').slice(0,6)); setTwoFAError('') }}
                      onKeyDown={(e) => e.key === 'Enter' && handleConfirmEnable2FA()}
                      placeholder="000000"
                      className="w-full text-sm text-white text-center bg-transparent rounded-lg px-3 py-2 outline-none tracking-widest"
                      style={{ border: `1px solid ${twoFAError ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.1)'}` }}
                      autoFocus
                    />
                    {twoFAError && <p className="text-xs text-red-400 mt-1">{twoFAError}</p>}
                    <button
                      onClick={handleConfirmEnable2FA}
                      disabled={totpSetupCode.length < 6}
                      className="w-full mt-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-40"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      Activate 2FA
                    </button>
                  </div>
                )}

                {/* Disable flow */}
                {twoFAStep === 'disable' && (
                  <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-white">Disable 2FA</span>
                      <button onClick={() => setTwoFAStep('idle')} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Cancel</button>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3">Enter your current 2FA code to confirm:</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={totpDisableCode}
                      onChange={(e) => { setTotpDisableCode(e.target.value.replace(/\D/g,'').slice(0,6)); setTwoFAError('') }}
                      onKeyDown={(e) => e.key === 'Enter' && handleDisable2FA()}
                      placeholder="000000"
                      className="w-full text-sm text-white text-center bg-transparent rounded-lg px-3 py-2 outline-none tracking-widest"
                      style={{ border: `1px solid ${twoFAError ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.1)'}` }}
                      autoFocus
                    />
                    {twoFAError && <p className="text-xs text-red-400 mt-1">{twoFAError}</p>}
                    <button
                      onClick={handleDisable2FA}
                      disabled={totpDisableCode.length < 6}
                      className="w-full mt-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-40"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Disable 2FA
                    </button>
                  </div>
                )}
              </div>

              {/* Admin: shortcut to full settings */}
              {isAdmin && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} className="pt-4">
                  <button
                    onClick={() => { setShowProfileSettings(false); setShowSettings(true) }}
                    className="w-full flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <Settings size={13} style={{ color: '#52525b' }} />
                      <span className="text-sm font-semibold text-zinc-400 group-hover:text-white transition-colors">
                        Team & Workflow Settings
                      </span>
                    </div>
                    <ChevronRight size={13} style={{ color: '#52525b' }} />
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
