import React, { useState } from 'react'
import { Plus, ExternalLink, Clock, AlertCircle, CheckCircle2, CalendarDays } from 'lucide-react'
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns'
import { useApp } from '../../context/AppContext'
import { JOEL_REVIEW_STAGES, CONTENT_TYPES, USERS, STAGE_OWNER } from '../../data/seedData'
import StatusBadge from '../shared/StatusBadge'
import { PlatformIcon, PlatformDot } from '../shared/Icons'
import AddProjectModal from './AddProjectModal'

const KANBAN_GROUPS = [
  { label: 'In Production', statuses: ['Filming', 'Raw Footage Ready', 'Drafting'] },
  { label: 'Editing', statuses: ['Editing in Progress', 'Edit Review', 'Revision Requested', 'Final Review', 'In Review'] },
  { label: 'Caption Stage', statuses: ['Caption Needed', 'Caption In Review'] },
  { label: 'Going Live', statuses: ['Ready to Post', 'Scheduled', 'Ready to Send'] },
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

function ProjectMiniCard({ project, onClick }) {
  const ownerKey = STAGE_OWNER[project.type]?.[project.status]
  const owner = USERS[ownerKey]
  const days = daysLabel(project.publishDate)

  return (
    <button
      onClick={onClick}
      className="card card-hover w-full text-left p-3 flex flex-col gap-2 cursor-pointer animate-fade-in"
      style={{ minWidth: 0 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <PlatformIcon type={project.type} size={13} />
          <span className="text-xs font-medium text-white truncate">{project.title}</span>
        </div>
        {project.brand && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#71717a' }}>
            {project.brand}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        {owner && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              {owner.avatar}
            </div>
            <span className="text-[10px] text-zinc-500">{owner.name}</span>
          </div>
        )}
        {days && (
          <span className={`text-[10px] font-medium ${days.urgent ? 'text-amber-400' : 'text-zinc-600'}`}>
            {days.label}
          </span>
        )}
      </div>
    </button>
  )
}

function ReviewCard({ project, onClick }) {
  const ownerKey = STAGE_OWNER[project.type]?.[project.status]
  const submitter = USERS[ownerKey === 'joel' ? (project.type === 'youtube' && project.status === 'Edit Review' ? 'anthony' : project.status === 'Caption In Review' ? 'tiana' : ownerKey) : ownerKey]
  // Determine who submitted for review
  const history = project.statusHistory || []
  const lastEntry = [...history].reverse().find(h => h.status === project.status)
  const submittedBy = lastEntry ? USERS[lastEntry.changedBy] : null

  const days = daysLabel(project.publishDate)

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
          {project.brand && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#71717a' }}>
              {project.brand}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge status={project.status} />
          {submittedBy && submittedBy.id !== 'joel' && (
            <span className="text-xs text-zinc-500">from {submittedBy.name}</span>
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
  const { projects, setSelectedProject } = useApp()
  const [showAdd, setShowAdd] = useState(false)

  const active = projects.filter(p => !['Posted', 'Sent'].includes(p.status))
  const reviewQueue = active.filter(p => JOEL_REVIEW_STAGES.includes(p.status))

  // Kanban: active projects that aren't done
  const kanbanProjects = active.filter(
    p => !['Ready to Post', 'Scheduled', 'Ready to Send'].includes(p.status)
  )

  // Ready / Scheduled
  const readyProjects = projects
    .filter(p => ['Ready to Post', 'Scheduled', 'Ready to Send'].includes(p.status))
    .sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate))

  function openProject(p) {
    setSelectedProject(p)
  }

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">

      {/* Page title */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-white">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-amber flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <Plus size={15} />
          New Project
        </button>
      </div>

      {/* Review Queue */}
      {reviewQueue.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={15} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">My Review Queue</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>
              {reviewQueue.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {reviewQueue.map(p => (
              <ReviewCard key={p.id} project={p} onClick={() => openProject(p)} />
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
          <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
            {KANBAN_GROUPS.map((group) => {
              const groupProjects = kanbanProjects.filter(p => group.statuses.includes(p.status))
              return (
                <div key={group.label} className="w-56 shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                      {group.label}
                    </p>
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
                      groupProjects.map(p => (
                        <ProjectMiniCard key={p.id} project={p} onClick={() => openProject(p)} />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Ready to Post / Scheduled */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={15} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Ready to Post & Scheduled</h2>
        </div>
        {readyProjects.length === 0 ? (
          <div className="rounded-xl py-10 text-center"
            style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
            <p className="text-zinc-600 text-sm">Nothing ready yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {readyProjects.map(p => {
              const days = daysLabel(p.publishDate)
              return (
                <button
                  key={p.id}
                  onClick={() => openProject(p)}
                  className="card card-hover w-full text-left p-4 flex items-center gap-4 cursor-pointer"
                >
                  <div className="shrink-0">
                    <PlatformIcon type={p.type} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">{p.title}</span>
                      {p.brand && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                          style={{ background: 'rgba(255,255,255,0.07)', color: '#71717a' }}>
                          {p.brand}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-white">
                      {p.publishDate ? format(parseISO(p.publishDate), 'MMM d') : '—'}
                    </p>
                    {days && (
                      <p className={`text-xs ${days.urgent ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {days.label}
                      </p>
                    )}
                    {p.scheduledTime && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {format(new Date(p.scheduledTime), 'h:mm a')}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
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

      {showAdd && <AddProjectModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
