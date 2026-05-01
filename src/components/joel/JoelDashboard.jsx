import React, { useState } from 'react'
import { Plus, AlertCircle, CheckCircle2, Trash2, ChevronDown, DollarSign, ExternalLink } from 'lucide-react'
import SortBar, { sortProjects } from '../shared/SortBar'
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns'
import { useApp } from '../../context/AppContext'
import { JOEL_REVIEW_STAGES, TYPE_LABELS, getStatusColor } from '../../data/seedData'
import StatusBadge from '../shared/StatusBadge'
import { PlatformIcon } from '../shared/Icons'
import AddProjectModal from './AddProjectModal'

const KANBAN_GROUPS = [
  { label: 'In Production',     statuses: ['Filming', 'Raw Footage Ready', 'Drafting'] },
  { label: 'Editing',           statuses: ['Editing in Progress', 'Edit Review', 'Revision Requested', 'Final Review', 'In Review'] },
{ label: 'Social Production', statuses: [], special: 'social' },
]

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

// Maps STAGE_OWNER key → DB role for teamMembers lookup
const OWNER_ROLE = { joel: 'admin', anthony: 'editor', tiana: 'social_manager' }

// Color per owner for the avatar chip
const OWNER_COLOR = {
  joel:    { bg: 'rgba(245,158,11,0.18)',  border: 'rgba(245,158,11,0.35)',  text: '#fbbf24' },
  anthony: { bg: 'rgba(96,165,250,0.18)',  border: 'rgba(96,165,250,0.35)',  text: '#60a5fa' },
  tiana:   { bg: 'rgba(192,132,252,0.18)', border: 'rgba(192,132,252,0.35)', text: '#c084fc' },
}

function ProjectMiniCard({ project, onClick, onDelete, showDelete, onToggleDelete, teamMembers, getWorkflow, getStageOwner, updateProject }) {
  const ownerKey    = getStageOwner ? getStageOwner(project.type, project.status) : null
  const ownerMember = teamMembers?.find(m => m.role === OWNER_ROLE[ownerKey])
  const days        = daysLabel(project.publishDate)
  const workflow    = getWorkflow ? getWorkflow(project.type) : []
  const isPosted    = ['Posted', 'Sent'].includes(project.status)
  const idx         = workflow.indexOf(project.status)
  const safeIdx     = Math.max(0, idx)
  const pct         = isPosted ? 100 : (workflow.length > 1 ? ((safeIdx + 1) / workflow.length) * 100 : 100)
  const [editingDate, setEditingDate] = useState(false)

  return (
    <div
      className="card card-hover relative flex flex-col gap-2 cursor-pointer animate-fade-in"
      style={{ padding: '10px 12px', paddingRight: 28 }}
      onClick={() => { if (!showDelete) onClick() }}
      draggable
      onDragStart={e => e.dataTransfer.setData('projectId', project.id)}
    >
      {/* Delete toggle */}
      <button
        onClick={e => { e.stopPropagation(); onToggleDelete() }}
        className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded opacity-40 hover:opacity-100 transition-opacity"
        style={{ color: '#71717a' }}>
        <Trash2 size={11} />
      </button>

      {/* Inline delete confirm */}
      {showDelete && (
        <div onClick={e => e.stopPropagation()}
          className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-2 z-10"
          style={{ background: '#1a1a20', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-xs text-red-400 text-center">Delete?</p>
          <div className="flex gap-2">
            <button onClick={e => { e.stopPropagation(); onDelete() }}
              className="text-xs px-2 py-1 rounded"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              Yes
            </button>
            <button onClick={e => { e.stopPropagation(); onToggleDelete() }}
              className="text-xs px-2 py-1 rounded"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)' }}>
              No
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 min-w-0">
        <PlatformIcon type={project.type} size={11} />
        <span className="text-[10px] text-zinc-500">{TYPE_LABELS[project.type]}</span>
      </div>
      <span className="text-xs font-medium text-white leading-snug">{project.title}</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusBadge status={project.status} />
        {project.status === 'Ready to Post' && project.brand && project.brand !== 'Organic' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
            Manual
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {ownerMember && (() => {
          const clr = OWNER_COLOR[ownerKey] || { bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.15)', text: '#9ca3af' }
          return (
            <>
              {ownerMember.avatar_url ? (
                <img
                  src={ownerMember.avatar_url}
                  alt={ownerMember.name}
                  className="w-4 h-4 rounded-full shrink-0 object-cover"
                  style={{ border: `1px solid ${clr.border}` }}
                />
              ) : (
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ background: clr.bg, border: `1px solid ${clr.border}`, color: clr.text }}>
                  {ownerMember.name?.[0]}
                </div>
              )}
              <span className="text-[10px] font-medium" style={{ color: clr.text }}>{ownerMember.name}</span>
            </>
          )
        })()}
        <div className="ml-auto" onClick={e => e.stopPropagation()}>
          {editingDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={project.publishDate || ''}
              onBlur={e => {
                updateProject(project.id, { publishDate: e.target.value || null })
                setEditingDate(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.target.blur() }
                if (e.key === 'Escape') { setEditingDate(false) }
              }}
              className="text-[10px] bg-transparent border-b outline-none w-24"
              style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' }}
            />
          ) : (
            <button
              onClick={() => setEditingDate(true)}
              className="text-[10px] font-medium hover:opacity-80 transition-opacity"
              style={{ color: days?.urgent ? '#f59e0b' : '#52525b' }}
              title="Click to change date"
            >
              {days ? days.label : (project.publishDate ? format(parseISO(project.publishDate), 'MMM d') : 'Set date')}
            </button>
          )}
        </div>
      </div>

      {/* Mini progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: isPosted ? '#4ade80' : getStatusColor(project.status), borderRadius: 1 }} />
      </div>
      {isPosted && (
        <span className="text-[9px] font-semibold tracking-wide" style={{ color: '#4ade80' }}>✓ POSTED</span>
      )}
    </div>
  )
}

function ReviewCard({ project, onClick, getTeamName }) {
  const history     = project.statusHistory || []
  const lastEntry   = [...history].reverse().find(h => h.status === project.status)
  const submitterName = lastEntry ? getTeamName(lastEntry.changedBy) : null
  const days        = daysLabel(project.publishDate)

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl flex items-center gap-4 transition-all cursor-pointer animate-fade-in card-hover"
      style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <AlertCircle size={18} className="text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <PlatformIcon type={project.type} size={13} />
          <span className="text-sm font-semibold text-white truncate">{project.title}</span>
          {project.brand && project.brand !== 'Organic' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#71717a' }}>
              {project.brand}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge status={project.status} />
          {submitterName && (
            <span className="text-xs text-zinc-500">from {submitterName}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {days && (
          <span className={`text-xs font-medium ${days.urgent ? 'text-amber-400' : 'text-zinc-500'}`}>
            {days.label}
          </span>
        )}
        <span className="text-xs text-amber-500 font-medium">Review →</span>
      </div>
    </button>
  )
}

export default function JoelDashboard() {
  const { projects, setSelectedProject, advanceStatus, deleteProject, updateProject, getTeamName, getWorkflow, getStageOwner, teamMembers, payments, markPaymentPaid, addBanner, analyticsLog, acknowledgeAnalytics } = useApp()
  const [showAdd, setShowAdd]           = useState(false)
  const [dragOverCol, setDragOverCol]   = useState(null)
  const [deletingId, setDeletingId]     = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [expandedCols, setExpandedCols] = useState({})
  const [sortBy, setSortBy]             = useState('due_date')

  const active         = projects.filter(p => !['Posted', 'Sent', 'Inactive'].includes(p.status))
  const inactiveProjects = projects.filter(p => p.status === 'Inactive')
  const reviewQueue    = active.filter(p => JOEL_REVIEW_STAGES.includes(p.status))
  const tianaProjects  = sortProjects(active.filter(p => getStageOwner(p.type, p.status) === 'tiana'), sortBy)
  const kanbanProjects = sortProjects(active.filter(
    p => !['Ready to Post', 'Scheduled', 'Ready to Send', 'Inactive'].includes(p.status)
       && getStageOwner(p.type, p.status) !== 'tiana'
  ), sortBy)
  const readyProjects  = projects
    .filter(p => ['Ready to Post', 'Ready to Send'].includes(p.status))
    .sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate))
  const scheduledProjects = projects
    .filter(p => p.status === 'Scheduled')
    .sort((a, b) => {
      const aT = a.scheduledTime ? new Date(a.scheduledTime) : (a.publishDate ? new Date(a.publishDate + 'T23:59') : new Date(9999, 0, 1))
      const bT = b.scheduledTime ? new Date(b.scheduledTime) : (b.publishDate ? new Date(b.publishDate + 'T23:59') : new Date(9999, 0, 1))
      return aT - bT
    })

  function handleKanbanDrop(e, group) {
    e.preventDefault()
    const projectId = e.dataTransfer.getData('projectId')
    if (!projectId) { setDragOverCol(null); return }
    const proj = projects.find(p => p.id === projectId)
    if (!proj) { setDragOverCol(null); return }
    const wf = getWorkflow(proj.type)
    let newStatus = null
    for (const gs of group.statuses) {
      if (wf.includes(gs)) { newStatus = gs; break }
    }
    if (newStatus && newStatus !== proj.status) {
      advanceStatus(projectId, newStatus, null) // null = system move
    }
    setDragOverCol(null)
  }

  function openProject(p) { setSelectedProject(p) }

  const countdownText = (proj) => {
    const target = proj.scheduledTime
      ? new Date(proj.scheduledTime)
      : (proj.publishDate ? new Date(proj.publishDate + 'T12:00:00') : null)
    if (!target) return null
    const diff = target.getTime() - Date.now()
    if (diff < 0) return { text: 'Should be live now', color: '#f59e0b' }
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return { text: 'Going live today', color: '#4ade80' }
    if (hours < 24) return { text: `Going live in ${hours}h`, color: '#4ade80' }
    const days = Math.floor(hours / 24)
    return { text: `Going live in ${days} day${days === 1 ? '' : 's'}`, color: '#4ade80' }
  }

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto">

      {/* Page title */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-white leading-tight">
              Good morning, Joel.
            </h1>
            <p className="text-zinc-500 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-amber flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-sm shrink-0"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
        <SortBar sortBy={sortBy} setSortBy={setSortBy} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Projects',   value: active.length,                                                              color: '#f59e0b' },
          { label: 'Ready to Post',     value: readyProjects.length,                                                       color: '#4ade80' },
          { label: 'Scheduled',         value: scheduledProjects.length,                                                   color: '#facc15' },
          { label: 'Awaiting Review',   value: projects.filter(p => JOEL_REVIEW_STAGES.includes(p.status)).length,         color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'Inter' }}>{s.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending Payments */}
      {payments.filter(p => p.status === 'pending').length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={14} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Pending Payments</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              {payments.filter(p => p.status === 'pending').length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {payments.filter(p => p.status === 'pending').map(payment => {
              const project = projects.find(p => p.id === payment.projectId)
              return (
                <div key={payment.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  {project && <PlatformIcon type={project.type} size={13} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{payment.projectTitle}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Requested by Anthony · {format(parseISO(payment.requestedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      markPaymentPaid(payment.id)
                      addBanner(`Payment marked as paid for "${payment.projectTitle}"`, 'success')
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all"
                    style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                    Mark as Paid
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Analytics Received */}
      {analyticsLog.filter(a => !a.acknowledged).length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={14} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Analytics Received</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
              {analyticsLog.filter(a => !a.acknowledged).length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {analyticsLog.filter(a => !a.acknowledged).map(entry => {
              const project = projects.find(p => p.id === entry.projectId)
              return (
                <div key={entry.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  {project && <PlatformIcon type={project.type} size={13} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{entry.projectTitle}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-[10px] text-zinc-500">
                        Submitted {format(parseISO(entry.submittedAt), 'MMM d, yyyy')}
                      </p>
                      {entry.notes && (
                        <p className="text-[10px] text-zinc-400 truncate max-w-[200px]">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.link && (
                      <a
                        href={entry.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                        style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}>
                        <ExternalLink size={11} />
                        View
                      </a>
                    )}
                    <button
                      onClick={() => acknowledgeAnalytics(entry.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#71717a' }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Review Queue */}
      {reviewQueue.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">My Review Queue</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}>
              {reviewQueue.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {reviewQueue.map(p => (
              <ReviewCard key={p.id} project={p} onClick={() => openProject(p)} getTeamName={getTeamName} />
            ))}
          </div>
        </section>
      )}

      {/* Kanban Board */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Active Projects</h2>
          <span className="text-xs text-zinc-600">{kanbanProjects.length} in progress</span>
        </div>
        <div className="kanban-scroll -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="grid gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(220px,1fr))', minWidth: 700 }}>
            {KANBAN_GROUPS.map((group, groupIdx) => {
              const isDragOver = dragOverCol === group.label

              const CAP = 5
              const colKey = group.special === 'social' ? 'Social Production' : group.label
              const isExpanded = !!expandedCols[colKey]
              const toggleExpand = () => setExpandedCols(prev => ({ ...prev, [colKey]: !prev[colKey] }))

              // Social Production column — render tianaProjects directly
              if (group.special === 'social') {
                const visible = isExpanded ? tianaProjects : tianaProjects.slice(0, CAP)
                const hidden  = tianaProjects.length - CAP
                return (
                  <div key="Social Production" className="rounded-xl p-3"
                    style={{ minHeight: 120, background: 'transparent', border: '1px solid transparent' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Social Production</p>
                      {tianaProjects.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                          {tianaProjects.length}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {tianaProjects.length === 0 ? (
                        <div className="rounded-xl py-8 flex items-center justify-center"
                          style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                          <span className="text-xs text-zinc-700">Empty</span>
                        </div>
                      ) : (
                        <>
                          {visible.map(p => (
                            <ProjectMiniCard key={p.id} project={p} onClick={() => openProject(p)}
                              onDelete={() => { deleteProject(p.id); setDeletingId(null) }}
                              showDelete={deletingId === p.id}
                              onToggleDelete={() => setDeletingId(deletingId === p.id ? null : p.id)}
                              teamMembers={teamMembers} getWorkflow={getWorkflow}
                              getStageOwner={getStageOwner} updateProject={updateProject} />
                          ))}
                          {!isExpanded && hidden > 0 && (
                            <button onClick={toggleExpand} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors text-left px-1 pt-1">
                              +{hidden} more
                            </button>
                          )}
                          {isExpanded && tianaProjects.length > CAP && (
                            <button onClick={toggleExpand} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors text-left px-1 pt-1">
                              Show less
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              }

              const allGroupedStatuses = KANBAN_GROUPS.filter(g => !g.special).flatMap(g => g.statuses)
              // In Production: real production stages first, then catch-all (Ideation etc.)
              const mainProjects     = groupIdx === 0 ? kanbanProjects.filter(p => group.statuses.includes(p.status)) : []
              const catchAllProjects = groupIdx === 0 ? kanbanProjects.filter(p => !allGroupedStatuses.includes(p.status)) : []
              const groupProjects    = groupIdx === 0
                ? [...mainProjects, ...catchAllProjects]
                : kanbanProjects.filter(p => group.statuses.includes(p.status))

              const visible = isExpanded ? groupProjects : groupProjects.slice(0, CAP)
              const hidden  = groupProjects.length - CAP

              return (
                <div
                  key={group.label}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(group.label) }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={e => handleKanbanDrop(e, group)}
                  className="rounded-xl p-3"
                  style={{
                    minHeight: 120,
                    background: isDragOver ? 'rgba(245,158,11,0.04)' : 'transparent',
                    border: isDragOver ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{group.label}</p>
                    {groupProjects.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                        {groupProjects.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {groupProjects.length === 0 ? (
                      <div className="rounded-xl py-8 flex items-center justify-center"
                        style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                        <span className="text-xs text-zinc-700">Empty</span>
                      </div>
                    ) : (
                      <>
                        {visible.map(p => (
                          <ProjectMiniCard key={p.id} project={p} onClick={() => openProject(p)}
                            onDelete={() => { deleteProject(p.id); setDeletingId(null) }}
                            showDelete={deletingId === p.id}
                            onToggleDelete={() => setDeletingId(deletingId === p.id ? null : p.id)}
                            teamMembers={teamMembers} getWorkflow={getWorkflow}
                            getStageOwner={getStageOwner} updateProject={updateProject} />
                        ))}
                        {!isExpanded && hidden > 0 && (
                          <button onClick={toggleExpand} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors text-left px-1 pt-1">
                            +{hidden} more
                          </button>
                        )}
                        {isExpanded && groupProjects.length > CAP && (
                          <button onClick={toggleExpand} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors text-left px-1 pt-1">
                            Show less
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Going Live column — right of Social Production */}
            {(() => {
              const goingLive = [...readyProjects, ...scheduledProjects]
              const CAP = 5
              const isExpanded = !!expandedCols['Going Live']
              const toggleExpand = () => setExpandedCols(prev => ({ ...prev, 'Going Live': !prev['Going Live'] }))
              const visible = isExpanded ? goingLive : goingLive.slice(0, CAP)
              const hidden  = goingLive.length - CAP
              return (
                <div className="rounded-xl p-3"
                  style={{ minHeight: 120, background: 'transparent', border: '1px solid transparent' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4ade80' }}>Going Live</p>
                    {goingLive.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                        {goingLive.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {goingLive.length === 0 ? (
                      <div className="rounded-xl py-8 flex items-center justify-center"
                        style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                        <span className="text-xs text-zinc-700">Empty</span>
                      </div>
                    ) : (
                      <>
                        {visible.map(p => (
                          <ProjectMiniCard key={p.id} project={p} onClick={() => openProject(p)}
                            onDelete={() => { deleteProject(p.id); setDeletingId(null) }}
                            showDelete={deletingId === p.id}
                            onToggleDelete={() => setDeletingId(deletingId === p.id ? null : p.id)}
                            teamMembers={teamMembers} getWorkflow={getWorkflow}
                            getStageOwner={getStageOwner} updateProject={updateProject} />
                        ))}
                        {!isExpanded && hidden > 0 && (
                          <button onClick={toggleExpand} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors text-left px-1 pt-1">
                            +{hidden} more
                          </button>
                        )}
                        {isExpanded && goingLive.length > CAP && (
                          <button onClick={toggleExpand} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors text-left px-1 pt-1">
                            Show less
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </section>

      {/* All Posted */}
      {(() => {
        const done = projects.filter(p => ['Posted', 'Sent'].includes(p.status))
        if (done.length === 0) return null
        return (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={15} className="text-zinc-600" />
              <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-widest">Completed</h2>
              <span className="text-xs text-zinc-700">{done.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {done.map(p => (
                <button key={p.id} onClick={() => openProject(p)}
                  className="w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-white/[0.03]"
                  style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                  <PlatformIcon type={p.type} size={14} />
                  <span className="text-sm text-zinc-500 flex-1 truncate">{p.title}</span>
                  <StatusBadge status={p.status} />
                </button>
              ))}
            </div>
          </section>
        )
      })()}

      {/* Inactive / On Hold */}
      {inactiveProjects.length > 0 && (
        <section className="mb-8">
          <button
            onClick={() => setShowInactive(v => !v)}
            className="flex items-center gap-2 mb-4 w-full text-left"
          >
            <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Inactive / On Hold</div>
            <span className="text-xs text-zinc-700">{inactiveProjects.length}</span>
            <ChevronDown size={13} className="text-zinc-700 ml-auto" style={{ transform: showInactive ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showInactive && (
            <div className="flex flex-col gap-2">
              {inactiveProjects.map(p => (
                <button key={p.id} onClick={() => openProject(p)}
                  className="w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-white/[0.03]"
                  style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                  <PlatformIcon type={p.type} size={14} />
                  <span className="text-sm text-zinc-500 flex-1 truncate">{p.title}</span>
                  <StatusBadge status={p.status} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {showAdd && <AddProjectModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
