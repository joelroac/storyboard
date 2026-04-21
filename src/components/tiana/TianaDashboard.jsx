import React, { useState } from 'react'
import { CheckCircle2, ChevronDown, Clock, Plus, ExternalLink } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, isToday, isTomorrow } from 'date-fns'
import { useApp } from '../../context/AppContext'
import StatusBadge from '../shared/StatusBadge'
import { PlatformIcon } from '../shared/Icons'
import AddProjectModal from '../joel/AddProjectModal'

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

function ProjectCard({ project, onClick, highlight }) {
  const days = daysLabel(project.publishDate)
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl flex items-center gap-4 transition-all cursor-pointer animate-fade-in card-hover"
      style={
        highlight
          ? { background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }
          : { background: '#141418', border: '1px solid rgba(255,255,255,0.08)' }
      }
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: highlight ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.06)',
          border: highlight ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.1)',
        }}>
        <PlatformIcon type={project.type} size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">{project.title}</span>
          {project.brand && project.brand !== 'Organic' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#71717a' }}>
              {project.brand}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <StatusBadge status={project.status} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-zinc-500">Publish</p>
        <p className="text-sm font-semibold text-white mt-0.5">
          {project.publishDate ? format(parseISO(project.publishDate), 'MMM d') : '—'}
        </p>
        {days && (
          <p className={`text-xs mt-0.5 ${days.urgent ? 'text-amber-400' : 'text-zinc-500'}`}>
            {days.label}
          </p>
        )}
      </div>
    </button>
  )
}

export default function TianaDashboard() {
  const { projects, setSelectedProject, advanceStatus, addNotification, addBanner, currentUser, getMemberByRole, getTeamName, getStageOwner, getWorkflow } = useApp()
  const [showAdd, setShowAdd]             = useState(false)
  const [showAllProjects, setShowAllProjects] = useState(false)
  const now = new Date()

  const TERMINAL_STATUSES = ['Ready to Post', 'Ready to Send', 'Scheduled', 'Posted', 'Sent']

  // Projects where Tiana owns the current stage (excluding terminal/publish-ready stages)
  const needsCaption = projects.filter(p =>
    getStageOwner(p.type, p.status) === 'tiana' &&
    !TERMINAL_STATUSES.includes(p.status)
  )
  // Projects where Joel owns the current stage and the previous stage was Tiana's (she submitted)
  const awaitingApproval = projects.filter(p => {
    if (getStageOwner(p.type, p.status) !== 'joel') return false
    const wf = getWorkflow(p.type)
    const idx = wf.indexOf(p.status)
    return idx > 0 && getStageOwner(p.type, wf[idx - 1]) === 'tiana'
  })
  const readyToPost = projects.filter(p => p.status === 'Ready to Post' || p.status === 'Ready to Send')
  const scheduled   = projects.filter(p => p.status === 'Scheduled')
  const postedThisMonth  = projects.filter(p => {
    if (!['Posted', 'Sent'].includes(p.status)) return false
    const history = p.statusHistory || []
    const postedEntry = [...history].reverse().find(h => ['Posted', 'Sent'].includes(h.status))
    if (!postedEntry) return false
    return isWithinInterval(new Date(postedEntry.timestamp), {
      start: startOfMonth(now),
      end:   endOfMonth(now),
    })
  })

  function handleMarkPublished(p) {
    const newStatus = p.status === 'Ready to Send' ? 'Sent' : 'Posted'
    advanceStatus(p.id, newStatus, currentUser.id)
    const joelId = getMemberByRole('admin')?.id
    const msg = `${getTeamName(currentUser.id)} published "${p.title}"`
    addNotification({ message: msg, projectId: p.id, forUser: joelId })
    addBanner(msg, 'success')
  }

  function open(p) { setSelectedProject(p) }

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-white">Social Queue</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {format(now, 'EEEE, MMMM d')} · Here's your content queue
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-amber flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <Plus size={15} />
          New Project
        </button>
      </div>

      {showAdd && (
        <AddProjectModal
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Needs Caption',     count: needsCaption.length,     color: '#fb923c' },
          { label: 'Awaiting Joel',     count: awaitingApproval.length, color: '#c084fc' },
          { label: 'Ready to Post',     count: readyToPost.length,      color: '#4ade80' },
          { label: 'Posted This Month', count: postedThisMonth.length,  color: '#9ca3af' },
        ].map(stat => (
          <div key={stat.label} className="card rounded-xl p-3 text-center">
            <p className="text-2xl font-bold" style={{ color: stat.color, fontFamily: 'Inter' }}>
              {stat.count}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-medium">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Needs My Attention — Caption Needed */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Needs Caption</h2>
          {needsCaption.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c' }}>
              {needsCaption.length}
            </span>
          )}
        </div>
        {needsCaption.length === 0 ? (
          <div className="rounded-xl py-10 text-center"
            style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
            <p className="text-zinc-600 text-sm">Nothing needs a caption right now</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {needsCaption.map(p => (
              <button key={p.id} onClick={() => open(p)}
                className="w-full text-left rounded-2xl overflow-hidden transition-all card-hover animate-fade-in"
                style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <div className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
                    <PlatformIcon type={p.type} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{p.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {p.brand && p.brand !== 'Organic' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(255,255,255,0.07)', color: '#71717a' }}>
                          {p.brand}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500">
                        {p.publishDate ? format(parseISO(p.publishDate), 'MMM d') : ''}
                      </span>
                      {p.asanaLink && (
                        <a href={p.asanaLink} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-amber-400 transition-colors">
                          <ExternalLink size={10} /> Asana
                        </a>
                      )}
                      {p.dropboxLink && (
                        <a href={p.dropboxLink} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-blue-400 transition-colors">
                          <ExternalLink size={10} /> {p.type === 'instagram' || p.type === 'tiktok' ? 'Drive' : 'Dropbox'}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-orange-400 shrink-0">Write Caption →</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Awaiting Joel's Approval */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={13} className="text-purple-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Awaiting Joel's Approval</h2>
        </div>
        {awaitingApproval.length === 0 ? (
          <div className="rounded-xl py-8 text-center"
            style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
            <p className="text-zinc-600 text-sm">No captions pending review</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {awaitingApproval.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => open(p)} highlight />
            ))}
          </div>
        )}
      </section>

      {/* Ready to Post — with Mark as Published button */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Ready to Publish</h2>
        </div>
        {readyToPost.length === 0 ? (
          <div className="rounded-xl py-8 text-center"
            style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
            <p className="text-zinc-600 text-sm">Nothing ready yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {readyToPost.map(p => (
              <div key={p.id}
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => open(p)}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <PlatformIcon type={p.type} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <button
                  onClick={() => handleMarkPublished(p)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                  Mark as Published
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Scheduled</h2>
          </div>
          <div className="flex flex-col gap-3">
            {scheduled.map(p => (
              <div key={p.id}
                className="rounded-xl p-4 flex items-center gap-3 cursor-pointer card-hover"
                style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={() => open(p)}>
                <PlatformIcon type={p.type} size={14} />
                <span className="text-sm font-semibold text-white flex-1 truncate">{p.title}</span>
                <span className="text-xs text-zinc-500">
                  {p.scheduledTime
                    ? new Date(p.scheduledTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : p.publishDate ? format(parseISO(p.publishDate), 'MMM d') : ''}
                </span>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Posted This Month */}
      {postedThisMonth.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={13} className="text-zinc-600" />
            <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-widest">
              Posted This Month
            </h2>
            <span className="text-xs text-zinc-700">{postedThisMonth.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {postedThisMonth.map(p => (
              <button key={p.id} onClick={() => open(p)}
                className="w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-white/[0.03]"
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <PlatformIcon type={p.type} size={13} />
                <span className="text-sm text-zinc-500 flex-1 truncate">{p.title}</span>
                <StatusBadge status={p.status} />
              </button>
            ))}
          </div>
        </section>
      )}

      {needsCaption.length === 0 && awaitingApproval.length === 0 && readyToPost.length === 0 && scheduled.length === 0 && postedThisMonth.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-3">✓</div>
          <p className="text-base font-semibold text-white mb-2">All caught up!</p>
          <p className="text-sm text-zinc-500">No items in your queue right now.</p>
        </div>
      )}

      {/* All Projects — collapsible overview */}
      <section className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => setShowAllProjects(v => !v)}
          className="w-full flex items-center justify-between py-1 group"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-widest group-hover:text-zinc-400 transition-colors">
              All Projects
            </h2>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-semibold"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#52525b' }}
            >
              {projects.length}
            </span>
          </div>
          <ChevronDown
            size={14}
            className="text-zinc-600 group-hover:text-zinc-400 transition-all"
            style={{ transform: showAllProjects ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
          />
        </button>

        {showAllProjects && (
          <div className="flex flex-col gap-1.5 mt-3 animate-fade-in">
            {[...projects]
              .sort((a, b) => (a.publishDate || '9999').localeCompare(b.publishDate || '9999'))
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => open(p)}
                  className="w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-white/[0.03]"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <PlatformIcon type={p.type} size={13} />
                  <span className="text-sm text-zinc-400 flex-1 truncate">{p.title}</span>
                  {p.brand && p.brand !== 'Organic' && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      B
                    </span>
                  )}
                  {p.publishDate && (
                    <span className="text-[10px] text-zinc-600 shrink-0">
                      {format(parseISO(p.publishDate), 'MMM d')}
                    </span>
                  )}
                  <StatusBadge status={p.status} />
                </button>
              ))
            }
          </div>
        )}
      </section>

    </div>
  )
}
