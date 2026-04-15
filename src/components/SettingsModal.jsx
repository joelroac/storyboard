import React, { useState, useEffect, useRef } from 'react'
import { X, GripVertical, RotateCcw, Camera } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { WORKFLOWS, STAGE_OWNER } from '../data/seedData'

// Maps legacy owner key → DB role
const OWNER_ROLE = { joel: 'admin', anthony: 'editor', tiana: 'social_manager' }
const OWNER_KEYS = ['joel', 'anthony', 'tiana']
const TYPE_LABELS = {
  youtube:    'YouTube',
  instagram:  'Instagram',
  tiktok:     'TikTok',
  newsletter: 'Newsletter',
}

export default function SettingsModal({ onClose }) {
  const {
    teamMembers, updateTeamMember,
    workflowSettings, saveWorkflowSettings,
  } = useApp()

  const [tab, setTab] = useState('team')

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
          {[['team', 'Team Members'], ['workflow', 'Workflow Editor']].map(([t, label]) => (
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

        </div>
      </div>
    </div>
  )
}
