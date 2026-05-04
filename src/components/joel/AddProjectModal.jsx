import React, { useState } from 'react'
import { X } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { useApp } from '../../context/AppContext'
import { CONTENT_TYPES, TYPE_LABELS } from '../../data/seedData'
import { PlatformIcon } from '../shared/Icons'

export default function AddProjectModal({ onClose, limitTypes = null, initialTitle = '', initialType = null, initialDate = null }) {
  const { addProject, currentUser, projects } = useApp()

  const allTypes = Object.values(CONTENT_TYPES)
  const types    = limitTypes ? allTypes.filter((t) => limitTypes.includes(t.id)) : allTypes

  const [form, setForm] = useState({
    title:       initialTitle,
    type:        (initialType && allTypes.find(t => t.id === initialType)) ? initialType : (types[0]?.id || 'youtube'),
    crossPostTo: null,
    brand:       'Organic',
    brandName:   '',
    publishDate: initialDate || format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    dropboxLink: '',
  })

  // Only Instagram ↔ TikTok can be cross-posted
  function canCrossPost(a, b) {
    return (a === 'instagram' && b === 'tiktok') || (a === 'tiktok' && b === 'instagram')
  }

  function handleTypeClick(id) {
    setTitleError('')
    setError('')
    if (id === form.type) return // already primary — no-op
    if (id === form.crossPostTo) {
      // deselect cross-post
      setForm((f) => ({ ...f, crossPostTo: null }))
      return
    }
    if (canCrossPost(form.type, id)) {
      // add as cross-post target
      setForm((f) => ({ ...f, crossPostTo: id }))
    } else {
      // new primary — clear crossPostTo
      setForm((f) => ({ ...f, type: id, crossPostTo: null }))
    }
  }
  const [titleError, setTitleError] = useState('')
  const [error, setError]           = useState('')

  // Drive vs Dropbox label depending on type
  const isSocialType = form.type === 'instagram' || form.type === 'tiktok'
  const storageLabel       = isSocialType ? 'Google Drive Link' : form.type === 'newsletter' ? null : 'Dropbox Link'
  const storagePlaceholder = isSocialType ? 'https://drive.google.com/…' : 'https://dropbox.com/…'

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setTitleError('')
    setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()

    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.publishDate)  { setError('Publish date is required'); return }

    // Duplicate check within same platform
    const titleLower = form.title.trim().toLowerCase()
    const isDupe = projects.some(
      (p) => p.type === form.type && p.title.trim().toLowerCase() === titleLower
    )
    if (isDupe) {
      setTitleError(`A ${TYPE_LABELS[form.type]} project named "${form.title.trim()}" already exists.`)
      return
    }

    // Brand value: "Organic" or the brandName from the secondary input
    const brandVal = form.brand === 'Brand Deal' ? (form.brandName.trim() || 'Brand Deal') : 'Organic'

    addProject({ ...form, brand: brandVal, crossPostTo: form.crossPostTo || null }, currentUser.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-panel w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div>
            <h2 className="font-editorial text-xl font-semibold text-white">New Project</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Add to The Storyboard</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: '#52525b' }}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">

          {/* Title */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">
              Project Title *
            </label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Summer Vlog 2025"
              className="w-full text-sm rounded-lg px-3 py-2.5 text-white placeholder-zinc-600"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${titleError ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'}`,
                outline: 'none',
              }}
              autoFocus
            />
            {titleError && <p className="text-red-400 text-xs mt-1">{titleError}</p>}
          </div>

          {/* Content type */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">
              Content Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {types.map((ct) => {
                const isPrimary     = form.type === ct.id
                const isCrossPost   = form.crossPostTo === ct.id
                const isEligible    = !isPrimary && canCrossPost(form.type, ct.id)
                return (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => handleTypeClick(ct.id)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-all relative"
                    style={
                      isPrimary
                        ? { background: `${ct.color}22`, border: `1px solid ${ct.color}55`, color: ct.color }
                        : isCrossPost
                          ? { background: `${ct.color}12`, border: `1px dashed ${ct.color}55`, color: ct.color }
                          : isEligible
                            ? { background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.2)', color: '#9ca3af' }
                            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }
                    }
                  >
                    <PlatformIcon type={ct.id} size={14} />
                    <span className="font-medium text-xs flex-1">{ct.label}</span>
                    {isPrimary && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: `${ct.color}22`, color: ct.color }}>
                        Primary
                      </span>
                    )}
                    {isCrossPost && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: `${ct.color}15`, color: ct.color, border: `1px dashed ${ct.color}40` }}>
                        + Cross
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {form.crossPostTo && (
              <p className="text-[10px] text-zinc-500 mt-1.5">
                Will post to <span style={{ color: types.find(t => t.id === form.type)?.color }}>{types.find(t => t.id === form.type)?.label}</span> (primary) and <span style={{ color: types.find(t => t.id === form.crossPostTo)?.color }}>{types.find(t => t.id === form.crossPostTo)?.label}</span>
              </p>
            )}
          </div>

          {/* Brand dropdown + conditional name input */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">
              Brand / Sponsor
            </label>
            <select
              value={form.brand}
              onChange={(e) => set('brand', e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2.5 text-white"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
            >
              <option value="Organic">Organic</option>
              <option value="Brand Deal">Brand Deal</option>
            </select>
            {form.brand === 'Brand Deal' && (
              <input
                value={form.brandName}
                onChange={(e) => set('brandName', e.target.value)}
                placeholder="Brand name (e.g. Nike)"
                className="w-full text-sm rounded-lg px-3 py-2.5 text-white placeholder-zinc-600 mt-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
              />
            )}
          </div>

          {/* Publish Date */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">
              Publish Date *
            </label>
            <input
              type="date"
              value={form.publishDate}
              onChange={(e) => set('publishDate', e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2.5 text-white"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', colorScheme: 'dark' }}
            />
          </div>

          {/* Storage link — hidden for newsletter */}
          {storageLabel && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">
                {storageLabel}
              </label>
              <input
                value={form.dropboxLink}
                onChange={(e) => set('dropboxLink', e.target.value)}
                placeholder={storagePlaceholder}
                className="w-full text-sm rounded-lg px-3 py-2.5 text-white placeholder-zinc-600"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
              />
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 py-2.5 text-sm">
              Cancel
            </button>
            <button type="submit" className="btn-amber flex-1 py-2.5 text-sm">
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
