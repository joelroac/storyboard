import React, { useState } from 'react'
import { Plus, AlertCircle, CheckCircle2, Trash2, ChevronDown } from 'lucide-react'
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
  { label: 'Caption Stage',     statuses: ['Caption Needed', 'Caption In Review'] },
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

function ProjectMiniCard({ project, onClick, onDelete, showDelete, onToggleDelete, teamMembers, getWorkflow, getStageOwner, updateProject }) {
  const ownerKey    = getStageOwner ? getStageOwner(project.type, project.status) : null
  const ownerMember = teamMembers?.find(m => m.role === OWNER_ROLE[ownerKey])
  const days        = daysLabel(project.publishDate)
  const workflow    = getWorkflow ? getWorkflow(project.type) : []
  const idx         = workflow.indexOf(project.status)
  const safeIdx     = Math.max(0, idx)
  const pct         = workflow.length > 1 ? ((safeIdx + 1) / workflow.length) * 100 : 100
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
      <StatusBadge status={project.status} />

      <div className="flex items-center gap-1.5">
        {ownerMember && (
          <>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              {ownerMember.avatar || ownerMember.name?.[0]}
            </div>
            <span className="text-[10px] text-zinc-500">{ownerMember.name}</span>
          </>
        )}
        <div className="ml-auto" onClick={e => e.stopPropagation()}>
          {editingDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={project.publishDate || ''}
              onBlur={e => {
                if (e.target.value) updateProject(project.id, { publishDate: e.target.value })
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
        <div style={{ height: '100%', width: `${pct}%`, background: getStatusColor(project.status), borderRadius: 1 }} />
      </div>
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
  const { projects, setSelectedProject, advanceStatus, deleteProject, updateProject, getTeamName, getWorkflow, getStageOwner, teamMembers } = useApp()
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
    <div className="px-6 py-6 max-w-7xl mx-auto">

      {/* Page title */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-white">
            Good morning, Joel.
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <SortBar sortBy={sortBy} setSortBy={setSortBy} />
          <button
            onClick={() => setShowAdd(true)}
            className="btn-amber flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <Plus size={15} />
            New Project
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
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
        <div className="kanban-scroll">
          <div className="grid gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', minWidth: 800 }}>
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
          </div>
        </div>
      </section>

      {/* Going Live — horizontal bar */}
      {(readyProjects.length > 0 || scheduledProjects.length > 0) && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Going Live</h2>
            <span className="text-xs text-zinc-600">{readyProjects.length + scheduledProjects.length} projects</span>
          </div>
          <div className="kanban-scroll">
            <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
              {[...readyProjects, ...scheduledProjects].map(p => {
                const cd = countdownText(p)
                return (
                  <div key={p.id} onClick={() => openProject(p)}
                    className="cursor-pointer w-52 rounded-xl p-3 shrink-0"
                    style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <PlatformIcon type={p.type} size={11} />
                      <span className="text-[10px] text-zinc-500">{TYPE_LABELS[p.type]}</span>
                    </div>
                    <p className="text-xs font-medium text-white leading-snug mb-2">{p.title}</p>
                    <StatusBadge status={p.status} />
                    {cd && <p className="text-[10px] mt-2" style={{ color: cd.color }}>{cd.text}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

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
