import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { CONTENT_TYPES } from '../../data/seedData'
import { PlatformIcon } from '../shared/Icons'

export default function AddProjectModal({ onClose }) {
  const { addProject, currentUser } = useApp()
  const [form, setForm] = useState({
    title: '',
    type: 'youtube',
    brand: '',
    publishDate: '',
    dropboxLink: '',
  })
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return setError('Title is required')
    if (!form.publishDate) return setError('Publish date is required')
    addProject(form, currentUser.id)
    onClose()
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>

      <div className="modal-panel w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="font-editorial text-xl font-semibold text-white">New Project</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Add to The Storyboard</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: '#52525b' }}>
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
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
              autoFocus
            />
          </div>

          {/* Content type */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">
              Content Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(CONTENT_TYPES).map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => set('type', ct.id)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-all"
                  style={
                    form.type === ct.id
                      ? { background: `${ct.color}22`, border: `1px solid ${ct.color}55`, color: ct.color }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }
                  }
                >
                  <PlatformIcon type={ct.id} size={14} />
                  <span className="font-medium text-xs">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brand + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">
                Brand / Client
              </label>
              <input
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                placeholder="e.g. Nike"
                className="w-full text-sm rounded-lg px-3 py-2.5 text-white placeholder-zinc-600"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
              />
            </div>
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
          </div>

          {/* Dropbox */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">
              Dropbox Link
            </label>
            <input
              value={form.dropboxLink}
              onChange={(e) => set('dropboxLink', e.target.value)}
              placeholder="https://dropbox.com/…"
              className="w-full text-sm rounded-lg px-3 py-2.5 text-white placeholder-zinc-600"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
            />
          </div>

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
