import React, { useState, useRef, useEffect } from 'react'
import { Plus, Lightbulb, Trash2, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { useApp } from '../../context/AppContext'
import { CONTENT_TYPES } from '../../data/seedData'
import { PlatformIcon } from '../shared/Icons'
import AddProjectModal from './AddProjectModal'

export default function IdeasBoard() {
  const { ideas, addIdea, deleteIdea } = useApp()
  const [newTitle, setNewTitle]           = useState('')
  const [convertingIdea, setConvertingIdea] = useState(null)

  function handleQuickAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    addIdea({ title: newTitle.trim() })
    setNewTitle('')
  }

  // Sort newest first
  const sorted = [...ideas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-editorial text-3xl font-semibold text-white">Ideas</h1>
        <p className="text-zinc-500 text-sm mt-1">Capture ideas and turn them into projects</p>
      </div>

      {/* Quick-add */}
      <form onSubmit={handleQuickAdd} className="mb-8 flex gap-3">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Write a new idea…"
          className="flex-1 text-sm text-white rounded-xl px-4 py-3 outline-none"
          style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}
          autoFocus
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="btn-amber px-4 py-3 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} /> Add
        </button>
      </form>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl py-20 text-center" style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
          <Lightbulb size={30} style={{ color: '#3f3f46', margin: '0 auto 12px' }} />
          <p className="text-zinc-600 text-sm">No ideas yet — type one above and hit Add</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onDelete={() => deleteIdea(idea.id)}
              onConvert={() => setConvertingIdea(idea)}
            />
          ))}
        </div>
      )}

      {/* Convert modal */}
      {convertingIdea && (
        <AddProjectModal
          onClose={() => setConvertingIdea(null)}
          initialTitle={convertingIdea.title}
          initialType={convertingIdea.type}
        />
      )}
    </div>
  )
}

// ── Idea card ──────────────────────────────────────────────────────────────────

function IdeaCard({ idea, onDelete, onConvert }) {
  const { updateIdea } = useApp()
  const [titleDraft, setTitleDraft]   = useState(idea.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const notesRef = useRef(null)

  // Keep local title in sync if idea changes externally
  useEffect(() => { if (!editingTitle) setTitleDraft(idea.title) }, [idea.title, editingTitle])

  function commitTitle() {
    const next = titleDraft.trim() || idea.title
    setTitleDraft(next)
    setEditingTitle(false)
    if (next !== idea.title) updateIdea(idea.id, { title: next })
  }

  function handleNoteChange(e) {
    updateIdea(idea.id, { notes: e.target.value })
    // auto-resize
    const el = notesRef.current
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }

  const ct = idea.type ? CONTENT_TYPES[idea.type] : null

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-in"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="p-5">

        {/* Title row */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <Lightbulb size={13} style={{ color: '#f59e0b' }} />
          </div>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitle()
                  if (e.key === 'Escape') { setTitleDraft(idea.title); setEditingTitle(false) }
                }}
                className="w-full text-sm font-semibold text-white bg-transparent outline-none"
                style={{ borderBottom: '1px solid rgba(245,158,11,0.4)' }}
                autoFocus
              />
            ) : (
              <button
                onClick={() => { setTitleDraft(idea.title); setEditingTitle(true) }}
                className="text-sm font-semibold text-white text-left hover:text-amber-300 transition-colors w-full truncate"
                title="Click to edit"
              >
                {idea.title}
              </button>
            )}
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {format(new Date(idea.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        {/* Notes */}
        <textarea
          ref={notesRef}
          value={idea.notes}
          onChange={handleNoteChange}
          placeholder="Add notes, details, or inspiration…"
          className="w-full text-sm text-zinc-400 placeholder-zinc-700 bg-transparent outline-none leading-relaxed resize-none"
          style={{ minHeight: 40 }}
          rows={idea.notes ? undefined : 2}
          onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
        />

        {/* Content type tag */}
        <div className="flex items-center gap-2 mt-3">
          <select
            value={idea.type || ''}
            onChange={(e) => updateIdea(idea.id, { type: e.target.value || null })}
            className="text-xs bg-transparent outline-none cursor-pointer"
            style={{ color: ct ? ct.color : '#52525b', border: 'none' }}
          >
            <option value="">Tag a content type…</option>
            {Object.values(CONTENT_TYPES).map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {ct && (
            <div className="flex items-center gap-1">
              <PlatformIcon type={idea.type} size={11} />
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-xs text-zinc-700 hover:text-red-400 transition-colors"
        >
          <Trash2 size={11} /> Delete
        </button>

        <button
          onClick={onConvert}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          Turn into Project <ArrowRight size={11} />
        </button>
      </div>
    </div>
  )
}
