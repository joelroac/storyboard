import React, { useState } from 'react'
import { ExternalLink, CheckCircle2 } from 'lucide-react'
import SortBar, { sortProjects } from '../shared/SortBar'

import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns'
import { useApp } from '../../context/AppContext'
import StatusBadge from '../shared/StatusBadge'
import { YoutubeIcon } from '../shared/Icons'

function daysLabel(dateStr) {
  if (!dateStr) return null
  const d = parseISO(dateStr)
  if (isToday(d)) return { label: 'Today', urgent: true }
  if (isTomorrow(d)) return { label: 'Tomorrow', urgent: true }
  const diff = differenceInDays(d, new Date())
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true }
  if (diff <= 3) return { label: `${diff}d left`, urgent: true }
  return { label: `${diff}d left`, urgent: false }
}

export default function AnthonyDashboard() {
  const { projects, setSelectedProject, advanceStatus, addNotification, addBanner, currentUser, getMemberByRole, getStageOwner, getWorkflow } = useApp()
  const [sortBy, setSortBy] = useState('due_date')

  // Active: Anthony owns current stage, OR he submitted it and Joel is reviewing
  const myActiveRaw = projects.filter(p => {
    const owner = getStageOwner(p.type, p.status)
    if (owner === 'anthony') return true
    if (owner === 'joel') {
      const wf = getWorkflow(p.type)
      const idx = wf.indexOf(p.status)
      return idx > 0 && getStageOwner(p.type, wf[idx - 1]) === 'anthony'
    }
    return false
  })
  const myActive = sortProjects(myActiveRaw, sortBy)

  // Done: projects that have passed through Anthony's stages
  const myDone = projects.filter(p => {
    if (getStageOwner(p.type, p.status) === 'anthony') return false
    const wf = getWorkflow(p.type)
    const idx = wf.indexOf(p.status)
    return idx > 0 && wf.slice(0, idx).some(stage => getStageOwner(p.type, stage) === 'anthony')
  })

  function handleMarkDone(project) {
    const wf = getWorkflow(project.type)
    const currentIdx = wf.indexOf(project.status)
    const nextStage  = currentIdx >= 0 ? wf[currentIdx + 1] : null
    const joelId     = getMemberByRole('admin')?.id
    advanceStatus(project.id, nextStage || 'Edit Review', currentUser.id)
    const msg = `Anthony marked "${project.title}" as done — ready for your review`
    addNotification({ message: msg, projectId: project.id, forUser: joelId })
    addBanner(msg, 'info')
  }

  // Can mark done when Anthony owns the stage and the next stage is Joel's
  const canMarkDone = (p) => {
    if (getStageOwner(p.type, p.status) !== 'anthony') return false
    const wf  = getWorkflow(p.type)
    const idx = wf.indexOf(p.status)
    const next = idx >= 0 ? wf[idx + 1] : null
    return next != null
  }

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-white">Hey, Anthony.</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {format(new Date(), 'EEEE, MMMM d')} · Here's what's in your editing queue
          </p>
        </div>
        <SortBar sortBy={sortBy} setSortBy={setSortBy} />
      </div>

      {/* Active queue */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <YoutubeIcon size={14} className="platform-youtube" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">My Editing Queue</h2>
          {myActive.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
              {myActive.length}
            </span>
          )}
        </div>

        {myActive.length === 0 ? (
          <div className="rounded-2xl py-16 text-center"
            style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
            <p className="text-zinc-500 text-sm">No active projects — you're all caught up 🎉</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {myActive.map(p => {
              const days = daysLabel(p.publishDate)
              const revisionNote = p.status === 'Revision Requested'
                ? [...(p.statusHistory || [])].reverse().find(h => h.status === 'Revision Requested')?.note
                : null
              const isReview = p.status === 'Edit Review'

              return (
                <div key={p.id}
                  className="rounded-2xl overflow-hidden animate-fade-in"
                  style={{
                    background: isReview ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.04)',
                    border: isReview
                      ? '1px solid rgba(255,255,255,0.08)'
                      : p.status === 'Revision Requested'
                        ? '1px solid rgba(249,115,22,0.25)'
                        : '1px solid rgba(59,130,246,0.2)',
                  }}>

                  {/* Card header */}
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <button onClick={() => setSelectedProject(p)} className="text-left">
                          <h3 className="font-editorial text-xl font-semibold text-white hover:text-amber-300 transition-colors">
                            {p.title}
                          </h3>
                        </button>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <StatusBadge status={p.status} />
                          {p.brand && p.brand !== 'Organic' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{ background: 'rgba(255,255,255,0.07)', color: '#71717a' }}>
                              {p.brand}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-zinc-500">Publish</p>
                        <p className="text-sm font-semibold text-white mt-0.5">
                          {p.publishDate ? format(parseISO(p.publishDate), 'MMM d') : '—'}
                        </p>
                        {days && (
                          <p className={`text-xs mt-0.5 ${days.urgent ? 'text-amber-400' : 'text-zinc-500'}`}>
                            {days.label}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Revision note */}
                  {revisionNote && (
                    <div className="mx-5 mb-3 rounded-xl p-3"
                      style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                      <p className="text-xs font-semibold text-orange-400 mb-1">Revision Note from Joel</p>
                      <p className="text-sm text-zinc-300">{revisionNote}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-5 py-4 flex flex-col gap-3"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

                    {/* Dropbox / Drive button */}
                    {p.dropboxLink ? (
                      <a
                        href={p.dropboxLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: 'rgba(0,100,255,0.12)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59,130,246,0.3)',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                        Open in Dropbox
                      </a>
                    ) : (
                      <div className="text-xs text-zinc-600 text-center py-1">No Dropbox link added yet</div>
                    )}

                    {/* Mark done button */}
                    {canMarkDone(p) && (
                      <button
                        onClick={() => handleMarkDone(p)}
                        className="w-full px-4 py-3 rounded-xl text-sm font-bold transition-all"
                        style={{
                          background: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0.1) 100%)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59,130,246,0.35)',
                        }}
                      >
                        ✓ Mark as Done — Send to Joel for Review
                      </button>
                    )}

                    {isReview && (
                      <div className="text-center text-sm text-zinc-500 py-1">
                        Waiting for Joel's review…
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Completed */}
      {myDone.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={14} className="text-zinc-600" />
            <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-widest">Completed</h2>
          </div>
          <div className="flex flex-col gap-2">
            {myDone.map(p => (
              <button key={p.id} onClick={() => setSelectedProject(p)}
                className="w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-white/[0.03]"
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <YoutubeIcon size={13} className="platform-youtube shrink-0" />
                <span className="text-sm text-zinc-500 flex-1 truncate">{p.title}</span>
                <StatusBadge status={p.status} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
