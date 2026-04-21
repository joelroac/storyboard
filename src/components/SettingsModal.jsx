import React, { useState, useEffect, useRef } from 'react'
import { X, GripVertical, RotateCcw, Camera } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { WORKFLOWS, STAGE_OWNER } from '../data/seedData'
import { PlatformIcon } from './shared/Icons'

// Maps legacy owner key → DB role
const OWNER_ROLE = { joel: 'admin', anthony: 'editor', tiana: 'social_manager' }
const OWNER_KEYS = ['joel', 'anthony', 'tiana']
const TYPE_LABELS = {
  youtube:    'YouTube',
  instagram:  'Instagram',
  tiktok:     'TikTok',
  newsletter: 'Newsletter',
  patreon:    'Patreon',
}

export default function SettingsModal({ onClose }) {
  const {
    teamMembers, updateTeamMember,
    workflowSettings, saveWorkflowSettings,
    permissions, updatePermissions,
    relevantLinks, updateRelevantLinks,
    postingGoals, updatePostingGoals,
  } = useApp()

  const [tab, setTab] = useState('team')

  // ── Posting Goals ─────────────────────────────────────────────────────────
  const [goalDraft, setGoalDraft]   = useState({})
  const [goalsSaved, setGoalsSaved] = useState(false)

  useEffect(() => {
    setGoalDraft(
      Object.fromEntries(
        Object.keys(TYPE_LABELS).map((p) => [p, postingGoals[p] ?? 0])
      )
    )
  }, [postingGoals])

  async function handleSaveGoals() {
    const clean = Object.fromEntries(
      Object.entries(goalDraft).filter(([, v]) => v > 0)
    )
    await updatePostingGoals(clean)
    setGoalsSaved(true)
    setTimeout(() => setGoalsSaved(false), 2000)
  }

  const PERMISSION_TOGGLES = [
    { key: 'canEditCalendar', label: 'Adjust Calendar & Dates',  desc: 'Can drag projects to reschedule and change publish dates on the calendar' },
    { key: 'canAddCaptions',  label: 'Write & Edit Captions',    desc: 'Can add and edit captions on any project at any stage' },
    { key: 'canEditLinks',    label: 'Edit Project Links',        desc: 'Can add and edit Dropbox, Google Drive, and Asana links' },
  ]

  // ── Team names + passcodes + photos ───────────────────────────────────────
  const [names, setNames]         = useState({})
  const [passcodes, setPasscodes] = useState({})
  const [namesSaved, setNamesSaved] = useState(false)
  const photoInputRefs = useRef({})

  function handlePhotoUpload(key, e) {
    const file = e.target.files?.[0]
    if (!file) return

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = async () => {
      // Resize to max 300px on longest side, encode as JPEG 0.82 quality
      // keeps payload well under 100 KB — safe for Supabase REST limits
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
      const member = teamMembers.find((m) => m.role === OWNER_ROLE[key])
      if (member) await updateTeamMember(member.id, { avatar_url: base64 })
    }
    img.onerror = () => URL.revokeObjectURL(objectUrl)
    img.src = objectUrl
    e.target.value = ''
  }

  useEffect(() => {
    const n = {}
    for (const key of OWNER_KEYS) {
      const member = teamMembers.find((m) => m.role === OWNER_ROLE[key])
      if (member) n[key] = member.name || ''
    }
    setNames(n)
  }, [teamMembers])

  async function handleSaveNames() {
    for (const key of OWNER_KEYS) {
      const member = teamMembers.find((m) => m.role === OWNER_ROLE[key])
      if (!member) continue
      const updates = {}
      if (names[key] && names[key] !== member.name) updates.name = names[key]
      if (passcodes[key] && passcodes[key].trim()) updates.pin = passcodes[key].trim()
      if (Object.keys(updates).length > 0) await updateTeamMember(member.id, updates)
    }
    setPasscodes({})
    setNamesSaved(true)
    setTimeout(() => setNamesSaved(false), 2000)
  }

  function getOwnerLabel(key) {
    const member = teamMembers.find((m) => m.role === OWNER_ROLE[key])
    return member?.name || key
  }

  // ── Team Links ────────────────────────────────────────────────────────────
  const [localLinks, setLocalLinks] = useState({ editor: [], socialManager: [], editorPasswords: [], socialManagerPasswords: [] })
  const [linksSaved, setLinksSaved] = useState(false)

  useEffect(() => {
    setLocalLinks({
      editor:                 [...(relevantLinks?.editor                 || [])],
      socialManager:          [...(relevantLinks?.socialManager          || [])],
      editorPasswords:        [...(relevantLinks?.editorPasswords        || [])],
      socialManagerPasswords: [...(relevantLinks?.socialManagerPasswords || [])],
    })
  }, [relevantLinks])

  function addLink(role) {
    setLocalLinks(prev => ({ ...prev, [role]: [...(prev[role] || []), { label: '', url: '' }] }))
  }
  function removeLink(role, i) {
    setLocalLinks(prev => ({ ...prev, [role]: prev[role].filter((_, idx) => idx !== i) }))
  }
  function updateLocalLink(role, i, field, val) {
    setLocalLinks(prev => ({ ...prev, [role]: prev[role].map((l, idx) => idx === i ? { ...l, [field]: val } : l) }))
  }
  function addPassword(pwKey) {
    setLocalLinks(prev => ({ ...prev, [pwKey]: [...(prev[pwKey] || []), { label: '', username: '', password: '' }] }))
  }
  function removePassword(pwKey, i) {
    setLocalLinks(prev => ({ ...prev, [pwKey]: prev[pwKey].filter((_, idx) => idx !== i) }))
  }
  function updateLocalPassword(pwKey, i, field, val) {
    setLocalLinks(prev => ({ ...prev, [pwKey]: prev[pwKey].map((p, idx) => idx === i ? { ...p, [field]: val } : p) }))
  }
  function handleSaveLinks() {
    updateRelevantLinks('editor', localLinks.editor)
    updateRelevantLinks('socialManager', localLinks.socialManager)
    updateRelevantLinks('editorPasswords', localLinks.editorPasswords)
    updateRelevantLinks('socialManagerPasswords', localLinks.socialManagerPasswords)
    setLinksSaved(true)
    setTimeout(() => setLinksSaved(false), 2000)
  }

  // ── Workflow editor ────────────────────────────────────────────────────────
  const [wfType, setWfType]           = useState('youtube')
  const [wfStages, setWfStages]       = useState([])
  const [wfOwners, setWfOwners]       = useState({})
  const [dragIdx, setDragIdx]         = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [wfSaved, setWfSaved]         = useState(false)

  useEffect(() => {
    const custom = workflowSettings?.[wfType]
    if (custom && custom.stages) {
      setWfStages([...custom.stages])
      setWfOwners({ ...(custom.owners || {}) })
    } else {
      setWfStages([...(WORKFLOWS[wfType] || [])])
      setWfOwners({ ...(STAGE_OWNER[wfType] || {}) })
    }
    setWfSaved(false)
  }, [wfType, workflowSettings])

  async function handleSaveWorkflow() {
    const ok = await saveWorkflowSettings(wfType, {
      stages: wfStages,
      owners: wfOwners,
    })
    if (ok !== false) {
      setWfSaved(true)
      setTimeout(() => setWfSaved(false), 2000)
    }
  }

  function resetWorkflow() {
    setWfStages([...(WORKFLOWS[wfType] || [])])
    setWfOwners({ ...(STAGE_OWNER[wfType] || {}) })
  }

  function addStage() {
    setWfStages((s) => [...s, 'New Stage'])
  }

  function removeStage(i) {
    const removed = wfStages[i]
    setWfStages((s) => s.filter((_, idx) => idx !== i))
    setWfOwners((o) => { const n = { ...o }; delete n[removed]; return n })
  }

  function renameStage(i, val) {
    const old = wfStages[i]
    setWfStages((s) => s.map((x, idx) => (idx === i ? val : x)))
    setWfOwners((o) => {
      const n = { ...o }
      n[val] = n[old]
      delete n[old]
      return n
    })
  }

  // Drag handlers
  const handleWfDragStart = (e, i) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move' }
  const handleWfDragOver  = (e, i) => { e.preventDefault(); setDragOverIdx(i) }
  const handleWfDragLeave = ()     => setDragOverIdx(null)
  const handleWfDragEnd   = ()     => { setDragIdx(null); setDragOverIdx(null) }
  const handleWfDrop      = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return }
    const arr = [...wfStages]
    const [removed] = arr.splice(dragIdx, 1)
    arr.splice(i, 0, removed)
    setWfStages(arr)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden"
        style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-editorial text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: '#52525b' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {[['team', 'Team Members'], ['workflow', 'Workflow Editor'], ['permissions', 'Permissions'], ['links', 'Team Links'], ['goals', 'Posting Goals']].map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-3 text-sm font-medium transition-colors"
              style={{
                color:        tab === t ? '#f59e0b' : '#71717a',
                background:   'none',
                border:       'none',
                borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent',
                cursor:       'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">

          {/* ── Team Names ── */}
          {tab === 'team' && (
            <div>
              <p className="text-xs text-zinc-500 mb-5">
                Edit display names for each team member. Changes take effect immediately across the app.
              </p>
              <div className="flex flex-col gap-4">
                {OWNER_KEYS.map((key) => {
                  const member = teamMembers.find((m) => m.role === OWNER_ROLE[key])
                  return (
                    <div key={key} className="flex items-start gap-3">
                      {/* Avatar — click to upload photo */}
                      <button
                        type="button"
                        onClick={() => photoInputRefs.current[key]?.click()}
                        className="relative w-10 h-10 rounded-full shrink-0 mt-5 overflow-hidden group"
                        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                        title="Upload photo"
                      >
                        {(() => {
                          const member = teamMembers.find((m) => m.role === OWNER_ROLE[key])
                          return member?.avatar_url
                            ? <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                            : (
                              <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                                style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                                {(names[key] || key)[0]?.toUpperCase()}
                              </div>
                            )
                        })()}
                        {/* Camera overlay on hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(0,0,0,0.55)' }}>
                          <Camera size={13} style={{ color: '#fff' }} />
                        </div>
                      </button>
                      <input
                        ref={(el) => { photoInputRefs.current[key] = el }}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(key, e)}
                        style={{ display: 'none' }}
                      />
                      <div className="flex-1 flex flex-col gap-2">
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                            {OWNER_ROLE[key]} · Display Name
                          </p>
                          <input
                            value={names[key] || ''}
                            onChange={(e) => setNames((n) => ({ ...n, [key]: e.target.value }))}
                            placeholder={member?.name || key}
                            className="w-full text-sm rounded-lg px-3 py-2 text-white"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                            New Passcode <span className="text-zinc-700 normal-case">(leave blank to keep current)</span>
                          </p>
                          <input
                            type="password"
                            value={passcodes[key] || ''}
                            onChange={(e) => setPasscodes((p) => ({ ...p, [key]: e.target.value }))}
                            placeholder="New passcode (alphanumeric)…"
                            maxLength={20}
                            className="w-full text-sm rounded-lg px-3 py-2 text-white"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }}
                          />
                        </div>
                        {/* 2FA recovery — visible only when that member has 2FA enabled */}
                        {member?.totp_secret && (
                          <div className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)' }}>
                            <span className="text-xs text-emerald-400 font-semibold">2FA Enabled</span>
                            <button
                              type="button"
                              onClick={() => updateTeamMember(member.id, { totp_secret: null })}
                              className="text-xs px-2 py-1 rounded font-semibold transition-colors"
                              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                            >
                              Disable 2FA
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={handleSaveNames}
                className="btn-amber mt-5 px-5 py-2.5 text-sm"
              >
                {namesSaved ? 'Saved ✓' : 'Save Names'}
              </button>
            </div>
          )}

          {/* ── Workflow Editor ── */}
          {tab === 'workflow' && (
            <div>
              {/* Type selector */}
              <div className="flex gap-2 mb-5 flex-wrap">
                {Object.entries(TYPE_LABELS).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setWfType(t)}
                    className="px-3 py-1.5 text-xs rounded-lg font-medium transition-all"
                    style={
                      wfType === t
                        ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }
                        : { background: 'transparent', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-zinc-500 mb-3">
                Drag rows to reorder. Assign an owner to each stage.
              </p>

              <div className="flex flex-col gap-2 mb-3">
                {wfStages.map((stage, i) => {
                  const isDragging  = dragIdx === i
                  const isTarget    = dragOverIdx === i && dragIdx !== null && dragIdx !== i
                  const targetAbove = isTarget && (dragIdx > i)
                  const targetBelow = isTarget && (dragIdx < i)

                  return (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => handleWfDragStart(e, i)}
                      onDragOver={(e)  => handleWfDragOver(e, i)}
                      onDragLeave={handleWfDragLeave}
                      onDragEnd={handleWfDragEnd}
                      onDrop={(e)      => handleWfDrop(e, i)}
                      className={[
                        'wf-row flex items-center gap-2 px-2.5 py-2 rounded-lg',
                        isDragging  ? 'dragging-source'  : '',
                        targetAbove ? 'drag-target-above' : '',
                        targetBelow ? 'drag-target-below' : '',
                      ].join(' ')}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <GripVertical size={13} style={{ color: '#52525b', cursor: 'grab', flexShrink: 0 }} />

                      <input
                        value={stage}
                        onChange={(e) => renameStage(i, e.target.value)}
                        className="flex-1 text-sm text-white bg-transparent border-none outline-none"
                        style={{ padding: '2px 4px', minWidth: 0 }}
                      />

                      <select
                        value={wfOwners[stage] || 'joel'}
                        onChange={(e) => setWfOwners((o) => ({ ...o, [stage]: e.target.value }))}
                        style={{ width: 90, fontSize: 11, padding: '3px 6px' }}
                      >
                        {OWNER_KEYS.map((k) => (
                          <option key={k} value={k}>{getOwnerLabel(k)}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => removeStage(i)}
                        style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 16, lineHeight: 1, padding: '0 4px', cursor: 'pointer', flexShrink: 0 }}
                        title="Remove stage"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={addStage}
                className="w-full py-2 text-sm rounded-lg mb-4 transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', color: '#a1a1aa' }}
              >
                + Add Stage
              </button>

              <div className="flex gap-3">
                <button onClick={handleSaveWorkflow} className="btn-amber px-5 py-2.5 text-sm">
                  {wfSaved ? 'Saved ✓' : 'Save Workflow'}
                </button>
                <button
                  onClick={resetWorkflow}
                  className="btn-ghost px-4 py-2.5 text-sm flex items-center gap-1.5"
                >
                  <RotateCcw size={12} /> Reset to Default
                </button>
              </div>

              <p className="text-xs text-zinc-600 mt-3">
                Editing workflows won't change the status of existing projects.
              </p>
            </div>
          )}

          {/* ── Permissions ── */}
          {tab === 'permissions' && (
            <div>
              <p className="text-xs text-zinc-500 mb-5">
                Control what the Social Media Manager can do across the app.
              </p>

              <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-3">
                Social Media Manager
              </p>

              <div className="flex flex-col gap-3">
                {PERMISSION_TOGGLES.map(({ key, label, desc }) => {
                  const enabled = permissions?.socialManager?.[key] ?? false
                  return (
                    <div key={key}
                      className="flex items-start gap-4 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{label}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                      </div>
                      {/* Toggle */}
                      <button
                        onClick={() => updatePermissions('socialManager', { [key]: !enabled })}
                        className="shrink-0 mt-0.5 w-10 h-5 rounded-full relative transition-all"
                        style={{
                          background: enabled ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                          border: enabled ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.15)',
                        }}
                      >
                        <span
                          className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                          style={{
                            left:       enabled ? '1.25rem' : '0.125rem',
                            background: enabled ? '#0c0c0e' : '#52525b',
                          }}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Posting Goals ── */}
          {tab === 'goals' && (
            <div>
              <p className="text-xs text-zinc-500 mb-6">
                Set how many times you want to post on each platform per week.
                The calendar will track progress and highlight when you hit your target.
              </p>
              <div className="flex flex-col gap-3">
                {Object.entries(TYPE_LABELS).map(([platform, label]) => {
                  const val = goalDraft[platform] || 0
                  return (
                    <div key={platform}
                      className="flex items-center justify-between rounded-xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="flex items-center gap-3">
                        <PlatformIcon type={platform} size={14} />
                        <span className="text-sm font-medium text-white">{label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setGoalDraft((d) => ({ ...d, [platform]: Math.max(0, (d[platform] || 0) - 1) }))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-lg leading-none transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}
                        >−</button>
                        <span className="text-sm font-semibold text-white w-5 text-center tabular-nums">{val}</span>
                        <button
                          onClick={() => setGoalDraft((d) => ({ ...d, [platform]: Math.min(14, (d[platform] || 0) + 1) }))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-lg leading-none transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}
                        >+</button>
                        <span className="text-[10px] w-14 text-right" style={{ color: val === 0 ? '#3f3f46' : '#71717a' }}>
                          {val === 0 ? 'No goal' : 'per week'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                {goalsSaved && <span className="text-xs text-emerald-400">Saved!</span>}
                <button onClick={handleSaveGoals} className="btn-amber px-5 py-2.5 text-sm">
                  Save Goals
                </button>
              </div>
            </div>
          )}

          {/* ── Team Links ── */}
          {tab === 'links' && (
            <div>
              <p className="text-xs text-zinc-500 mb-5">Add links visible to your editor and social media manager in their dashboards.</p>

              {[
                { role: 'editor',        pwKey: 'editorPasswords',        label: 'For Editor' },
                { role: 'socialManager', pwKey: 'socialManagerPasswords',  label: 'For Social Manager' },
              ].map(({ role, pwKey, label }) => (
                <div key={role} className="mb-8">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-3">{label}</p>

                  {/* Links */}
                  <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">Links</p>
                  <div className="flex flex-col gap-2 mb-2">
                    {(localLinks[role] || []).map((link, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={link.label} onChange={(e) => updateLocalLink(role, i, 'label', e.target.value)}
                          placeholder="Label" className="text-sm rounded-lg px-3 py-2 text-zinc-300 w-28"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
                        <input value={link.url} onChange={(e) => updateLocalLink(role, i, 'url', e.target.value)}
                          placeholder="https://…" className="flex-1 text-sm rounded-lg px-3 py-2 text-zinc-300"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
                        <button onClick={() => removeLink(role, i)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addLink(role)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-4">+ Add Link</button>

                  {/* Passwords */}
                  <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2 mt-3">Passwords</p>
                  <div className="flex flex-col gap-2 mb-2">
                    {(localLinks[pwKey] || []).map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={entry.label} onChange={(e) => updateLocalPassword(pwKey, i, 'label', e.target.value)}
                          placeholder="Label" className="text-sm rounded-lg px-3 py-2 text-zinc-300 w-28"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
                        <input value={entry.username} onChange={(e) => updateLocalPassword(pwKey, i, 'username', e.target.value)}
                          placeholder="Username / email" className="flex-1 text-sm rounded-lg px-3 py-2 text-zinc-300"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
                        <input value={entry.password} onChange={(e) => updateLocalPassword(pwKey, i, 'password', e.target.value)}
                          placeholder="Password" className="flex-1 text-sm rounded-lg px-3 py-2 text-zinc-300"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
                        <button onClick={() => removePassword(pwKey, i)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addPassword(pwKey)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">+ Add Password</button>
                </div>
              ))}

              <button onClick={handleSaveLinks} className="btn-amber px-5 py-2.5 text-sm mt-2">
                {linksSaved ? 'Saved ✓' : 'Save Links'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
