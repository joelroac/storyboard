import React, { useState, useEffect } from 'react'
import { X, ExternalLink, Clock, User, ChevronRight, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useApp } from '../context/AppContext'
import { WORKFLOWS, STAGE_OWNER, JOEL_REVIEW_STAGES, USERS, CONTENT_TYPES } from '../data/seedData'
import StatusBadge from './shared/StatusBadge'
import { PlatformIcon } from './shared/Icons'

function ProgressBar({ type, status }) {
  const stages = WORKFLOWS[type] || []
  const currentIdx = stages.indexOf(status)

  return (
    <div className="flex gap-1 items-center">
      {stages.map((stage, i) => (
        <div
          key={stage}
          title={stage}
          className={`progress-stage ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : ''}`}
        />
      ))}
    </div>
  )
}

function TimelineEntry({ entry }) {
  const user = USERS[entry.changedBy]
  return (
    <div className="flex gap-3 items-start">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
        style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
        {user?.avatar || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-white">{user?.name || entry.changedBy}</span>
          <ChevronRight size={10} className="text-zinc-600" />
          <StatusBadge status={entry.status} />
        </div>
        {entry.note && (
          <p className="text-xs text-zinc-500 mt-1 italic">"{entry.note}"</p>
        )}
        <p className="text-xs text-zinc-600 mt-0.5">
          {format(new Date(entry.timestamp), 'MMM d, yyyy · h:mm a')}
        </p>
      </div>
    </div>
  )
}

export default function ProjectDetail() {
  const { selectedProject, setSelectedProject, currentUser, updateProject, advanceStatus, addNotification, projects } = useApp()

  const [proj, setProj] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDropbox, setEditDropbox] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [revisionNote, setRevisionNote] = useState('')
  const [showRevisionInput, setShowRevisionInput] = useState(false)
  const [scheduledTime, setScheduledTime] = useState('')
  const [showScheduleInput, setShowScheduleInput] = useState(false)
  const [saving, setSaving] = useState(false)

  // Sync local state when selectedProject changes
  useEffect(() => {
    if (!selectedProject) return
    // Get fresh data from projects list
    const fresh = projects.find((p) => p.id === selectedProject.id) || selectedProject
    setProj(fresh)
    setEditTitle(fresh.title)
    setEditBrand(fresh.brand || '')
    setEditDate(fresh.publishDate || '')
    setEditDropbox(fresh.dropboxLink || '')
    setEditNotes(fresh.notes || '')
    setEditCaption(fresh.caption || '')
    setScheduledTime(fresh.scheduledTime || '')
    setShowRevisionInput(false)
    setShowScheduleInput(false)
    setRevisionNote('')
  }, [selectedProject, projects])

  if (!selectedProject || !proj) return null

  const isJoel = currentUser?.role === 'admin' || currentUser?.role === 'creator'
  const isAnthony = currentUser?.role === 'editor'
  const isTiana = currentUser?.role === 'social_manager' || currentUser?.role === 'social'

  const workflow = WORKFLOWS[proj.type] || []
  const currentStageIdx = workflow.indexOf(proj.status)
  const stageOwner = STAGE_OWNER[proj.type]?.[proj.status]
  const ownerUser = USERS[stageOwner]

  function saveEdits() {
    setSaving(true)
    updateProject(proj.id, {
      title: editTitle,
      brand: editBrand,
      publishDate: editDate,
      dropboxLink: editDropbox,
      notes: editNotes,
    })
    setTimeout(() => setSaving(false), 400)
  }

  function saveCaption() {
    updateProject(proj.id, { caption: editCaption })
  }

  function handleAdvance(toStatus, note = null) {
    advanceStatus(proj.id, toStatus, currentUser.id, note)

    // Fire notifications
    if (toStatus === 'Edit Review') {
      addNotification({
        type: 'edit_complete',
        message: `Anthony marked "${proj.title}" as done — ready for your review`,
        projectId: proj.id,
        forUser: 'joel',
      })
    }
    if (toStatus === 'Caption In Review') {
      addNotification({
        type: 'caption_submitted',
        message: `Tiana submitted a caption for "${proj.title}"`,
        projectId: proj.id,
        forUser: 'joel',
      })
    }
    if (toStatus === 'Revision Requested') {
      addNotification({
        type: 'revision_requested',
        message: `Joel requested revisions on "${proj.title}"`,
        projectId: proj.id,
        forUser: 'anthony',
      })
    }
    if (toStatus === 'Caption Needed' || toStatus === 'Caption Needed') {
      addNotification({
        type: 'caption_needed',
        message: `"${proj.title}" is ready for a caption`,
        projectId: proj.id,
        forUser: 'tiana',
      })
    }
    if (toStatus === 'Ready to Post') {
      addNotification({
        type: 'caption_approved',
        message: `Joel approved the caption for "${proj.title}" — ready to post`,
        projectId: proj.id,
        forUser: 'tiana',
      })
    }
  }

  function handleSchedule() {
    advanceStatus(proj.id, 'Scheduled', currentUser.id)
    updateProject(proj.id, { scheduledTime })
    setShowScheduleInput(false)
  }

  function handleRevision() {
    advanceStatus(proj.id, 'Revision Requested', currentUser.id, revisionNote)
    addNotification({
      type: 'revision_requested',
      message: `Joel requested revisions on "${proj.title}"${revisionNote ? ': ' + revisionNote : ''}`,
      projectId: proj.id,
      forUser: 'anthony',
    })
    setShowRevisionInput(false)
    setRevisionNote('')
  }

  // Determine what action button to show
  function renderActionButton() {
    const s = proj.status

    if (isJoel) {
      if (s === 'Filming') return <ActionBtn color="amber" onClick={() => handleAdvance('Raw Footage Ready')}>Mark Raw Footage Ready</ActionBtn>
      if (s === 'Raw Footage Ready') return <ActionBtn color="amber" onClick={() => handleAdvance('Editing in Progress')}>Send to Anthony for Editing</ActionBtn>
      if (s === 'Edit Review') return (
        <div className="flex flex-col gap-2">
          <ActionBtn color="amber" onClick={() => handleAdvance('Final Review')}>Approve Edit → Final Review</ActionBtn>
          <button className="btn-ghost px-4 py-2.5 text-sm w-full" onClick={() => setShowRevisionInput((v) => !v)}>
            Request Revision ↩
          </button>
          {showRevisionInput && (
            <div className="animate-fade-in">
              <textarea
                className="w-full rounded-lg text-sm p-3 text-white placeholder-zinc-600 mt-1"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                placeholder="Describe what needs to change…"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                rows={3}
              />
              <ActionBtn color="orange" onClick={handleRevision} className="mt-2">Send Revision Note to Anthony</ActionBtn>
            </div>
          )}
        </div>
      )
      if (s === 'Final Review') {
        const next = proj.type === 'youtube' ? 'Caption Needed' : 'Caption Needed'
        return <ActionBtn color="amber" onClick={() => handleAdvance(next)}>Approve → Assign Caption to Tiana</ActionBtn>
      }
      if (s === 'Caption In Review') return (
        <div className="flex flex-col gap-2">
          <ActionBtn color="amber" onClick={() => handleAdvance('Ready to Post')}>Approve Caption → Ready to Post</ActionBtn>
        </div>
      )
      if (s === 'Ready to Post') return (
        <div className="flex flex-col gap-2">
          <ActionBtn color="amber" onClick={() => setShowScheduleInput((v) => !v)}>Schedule Post</ActionBtn>
          {showScheduleInput && (
            <div className="animate-fade-in flex flex-col gap-2">
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-lg text-sm p-2.5 text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              <ActionBtn color="amber" onClick={handleSchedule}>Confirm Schedule</ActionBtn>
            </div>
          )}
          <ActionBtn color="green" onClick={() => handleAdvance('Posted')}>Mark as Posted</ActionBtn>
        </div>
      )
      if (s === 'Scheduled') return <ActionBtn color="green" onClick={() => handleAdvance('Posted')}>Mark as Posted</ActionBtn>
      if (s === 'Editing in Progress' && proj.type === 'youtube') return null // Anthony's stage
      if (s === 'Drafting') return <ActionBtn color="amber" onClick={() => handleAdvance('In Review')}>Move to In Review</ActionBtn>
      if (s === 'In Review') return <ActionBtn color="amber" onClick={() => handleAdvance('Ready to Send')}>Mark Ready to Send</ActionBtn>
      if (s === 'Ready to Send') return <ActionBtn color="green" onClick={() => handleAdvance('Sent')}>Mark as Sent</ActionBtn>
      // Instagram/TikTok joel editing
      if (s === 'Editing in Progress' && (proj.type === 'instagram' || proj.type === 'tiktok')) {
        return <ActionBtn color="amber" onClick={() => handleAdvance('Caption Needed')}>Editing Done → Send to Tiana</ActionBtn>
      }
    }

    if (isAnthony && proj.type === 'youtube') {
      if (s === 'Editing in Progress' || s === 'Revision Requested') {
        return (
          <ActionBtn color="blue" onClick={() => handleAdvance('Edit Review')}>
            Mark as Done — Send to Joel for Review
          </ActionBtn>
        )
      }
    }

    if (isTiana) {
      if (s === 'Caption Needed') {
        return (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-zinc-500">Write your caption above, then submit for Joel's review.</p>
            <ActionBtn color="purple" onClick={() => {
              saveCaption()
              handleAdvance('Caption In Review')
            }}>
              Submit Caption for Review
            </ActionBtn>
          </div>
        )
      }
    }

    return null
  }

  const canEditCaption = isTiana && proj.status === 'Caption Needed'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end modal-backdrop"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setSelectedProject(null) }}>

      <div
        className="modal-panel h-full w-full max-w-2xl overflow-y-auto flex flex-col"
        style={{ background: '#111115', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between px-6 py-4"
          style={{ background: 'rgba(17,17,21,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <PlatformIcon type={proj.type} size={18} />
            <div className="flex-1 min-w-0">
              {isJoel ? (
                <input
                  className="font-editorial text-xl font-semibold text-white bg-transparent border-none outline-none w-full"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={saveEdits}
                />
              ) : (
                <h2 className="font-editorial text-xl font-semibold text-white truncate">{proj.title}</h2>
              )}
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={proj.status} />
                {proj.brand && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>
                    {proj.brand}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedProject(null)}
            className="ml-4 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-white/10"
            style={{ color: '#52525b' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 flex flex-col gap-6">

          {/* Progress bar */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Workflow Progress</p>
            <ProgressBar type={proj.type} status={proj.status} />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-zinc-500">{workflow[0]}</span>
              <span className="text-xs text-zinc-500">{workflow[workflow.length - 1]}</span>
            </div>
          </div>

          {/* Current owner */}
          {ownerUser && (
            <div className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                {ownerUser.avatar}
              </div>
              <div>
                <p className="text-xs text-zinc-500">Currently with</p>
                <p className="text-sm font-semibold text-white">{ownerUser.name}</p>
              </div>
              <div className="ml-auto">
                <StatusBadge status={proj.status} />
              </div>
            </div>
          )}

          {/* Revision note if present */}
          {proj.status === 'Revision Requested' && proj.statusHistory && (() => {
            const rev = [...proj.statusHistory].reverse().find(h => h.status === 'Revision Requested')
            return rev?.note ? (
              <div className="rounded-xl p-3 flex gap-2"
                style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <AlertCircle size={14} className="text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-orange-400 mb-1">Revision Note from Joel</p>
                  <p className="text-sm text-zinc-300">{rev.note}</p>
                </div>
              </div>
            ) : null
          })()}

          {/* Project details */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publish Date">
              {isJoel ? (
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} onBlur={saveEdits}
                  className="text-sm text-white bg-transparent border-none outline-none w-full" />
              ) : (
                <span className="text-sm text-white">{proj.publishDate ? format(parseISO(proj.publishDate), 'MMMM d, yyyy') : '—'}</span>
              )}
            </Field>
            <Field label="Brand / Client">
              {isJoel ? (
                <input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} onBlur={saveEdits}
                  placeholder="e.g. Nike"
                  className="text-sm text-white bg-transparent border-none outline-none w-full placeholder-zinc-700" />
              ) : (
                <span className="text-sm text-white">{proj.brand || '—'}</span>
              )}
            </Field>
            <Field label="Content Type" className="col-span-2">
              <div className="flex items-center gap-2">
                <PlatformIcon type={proj.type} size={14} />
                <span className="text-sm text-white">{CONTENT_TYPES[proj.type]?.label}</span>
              </div>
            </Field>
          </div>

          {/* Dropbox link */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Dropbox Link</p>
            {isJoel ? (
              <input
                value={editDropbox}
                onChange={(e) => setEditDropbox(e.target.value)}
                onBlur={saveEdits}
                placeholder="https://dropbox.com/…"
                className="w-full text-sm rounded-lg px-3 py-2 text-zinc-300 placeholder-zinc-700"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            ) : proj.dropboxLink ? (
              <a href={proj.dropboxLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors">
                <ExternalLink size={13} />
                {proj.dropboxLink}
              </a>
            ) : (
              <span className="text-sm text-zinc-600">No Dropbox link added</span>
            )}
            {isJoel && editDropbox && (
              <a href={editDropbox} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 mt-1 transition-colors">
                <ExternalLink size={11} /> Open link
              </a>
            )}
          </div>

          {/* Caption field */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Caption</p>
            {canEditCaption ? (
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Write the caption here…"
                className="w-full text-sm rounded-lg px-3 py-2.5 text-zinc-200 placeholder-zinc-700"
                style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}
                rows={5}
              />
            ) : proj.caption ? (
              <div className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 whitespace-pre-wrap"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {proj.caption}
              </div>
            ) : (
              <span className="text-sm text-zinc-600">No caption yet</span>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Notes</p>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              onBlur={() => updateProject(proj.id, { notes: editNotes })}
              placeholder="Add notes visible to the whole team…"
              className="w-full text-sm rounded-lg px-3 py-2.5 text-zinc-300 placeholder-zinc-700"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              rows={4}
            />
          </div>

          {/* Action button */}
          <div>
            {renderActionButton()}
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Activity Log</p>
            <div className="flex flex-col gap-3">
              {[...(proj.statusHistory || [])].reverse().map((entry, i) => (
                <TimelineEntry key={i} entry={entry} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
      {children}
    </div>
  )
}

function ActionBtn({ children, onClick, color = 'amber', className = '' }) {
  const styles = {
    amber: 'btn-amber',
    blue: 'bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg transition-colors',
    green: 'bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-lg transition-colors',
    purple: 'bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-lg transition-colors',
    orange: 'bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg transition-colors',
  }
  return (
    <button onClick={onClick} className={`w-full px-4 py-2.5 text-sm ${styles[color]} ${className}`}>
      {children}
    </button>
  )
}
