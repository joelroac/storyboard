import React, { useState } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X, CheckCircle2, Check, Pencil, Plus, Search } from 'lucide-react'
import { useApp, setDragInProgress } from '../context/AppContext'
import StatusBadge from './shared/StatusBadge'
import { PlatformIcon, PlatformDot } from './shared/Icons'
import AddProjectModal from './joel/AddProjectModal'

// ── Goals Panel (right sidebar) ───────────────────────────────────────────────

function GoalsPanel({ weeks, projects, goals }) {
  const activePlatforms = Object.entries(goals).filter(([, g]) => g > 0)
  if (activePlatforms.length === 0) return null

  const COMPLETED_STATUSES = ['Posted', 'Sent']

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-xs font-semibold text-white uppercase tracking-widest">
          Posting Goals
          <span className="text-zinc-600 font-normal normal-case text-[10px] ml-1">per week</span>
        </p>
      </div>
      <div className="p-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week, wi) => {
          const weekStart = week[0]
          const weekEnd   = week[week.length - 1]
          const label     = format(weekStart, 'MMM d') + ' – ' + format(weekEnd, 'd')

          // completed = Posted/Sent;  scheduled = has a publish date in this week but not yet complete
          const completed = {}
          const scheduled = {}
          for (const p of projects) {
            if (!p.publishDate) continue
            const d = new Date(p.publishDate + 'T00:00:00')
            if (d < weekStart || d > weekEnd) continue
            const platforms = [p.type, ...(p.crossPostTo ? [p.crossPostTo] : [])]
            for (const pl of platforms) {
              if (COMPLETED_STATUSES.includes(p.status)) {
                completed[pl] = (completed[pl] || 0) + 1
              } else {
                scheduled[pl] = (scheduled[pl] || 0) + 1
              }
            }
          }

          const allMet = activePlatforms.every(([pl, goal]) => (completed[pl] || 0) >= goal)

          return (
            <div key={wi} className="rounded-xl p-2.5"
              style={{
                background: allMet ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.02)',
                border: allMet ? '1px solid rgba(74,222,128,0.15)' : '1px solid rgba(255,255,255,0.05)',
              }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-zinc-500 font-medium">{label}</p>
                {allMet && <CheckCircle2 size={10} style={{ color: '#4ade80' }} />}
              </div>
              <div className="flex flex-col gap-1.5">
                {activePlatforms.map(([platform, goal]) => {
                  const done      = completed[platform] || 0
                  const sched     = scheduled[platform] || 0
                  const total     = done + sched            // combined toward goal
                  const met       = done >= goal
                  const onTrack   = !met && total >= goal   // will hit goal if all scheduled post
                  const color     = PLATFORM_COLORS[platform] || '#9ca3af'

                  const donePct  = Math.min(done  / goal, 1)
                  const schedPct = Math.min(total / goal, 1) - donePct  // extra beyond done

                  return (
                    <div key={platform}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                          <span className="text-[10px] text-zinc-500 capitalize">{platform}</span>
                        </div>
                        <span className="text-[10px] font-semibold tabular-nums"
                          style={{ color: met ? '#4ade80' : '#52525b' }}>
                          {goal}
                        </span>
                      </div>
                      {/* Two-layer bar: solid = completed, dim = scheduled */}
                      <div className="rounded-full relative overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                        {/* Scheduled layer (behind, dimmer) */}
                        {schedPct > 0 && (
                          <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{
                              width: `${(donePct + schedPct) * 100}%`,
                              background: met ? '#4ade80' : color,
                              opacity: 0.2,
                            }} />
                        )}
                        {/* Completed layer (in front, solid) */}
                        <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                          style={{
                            width: `${donePct * 100}%`,
                            background: met ? '#4ade80' : color,
                            opacity: met ? 1 : 0.75,
                          }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PLATFORM_COLORS = {
  youtube:    '#ef4444',
  instagram:  '#a855f7',
  tiktok:     '#14b8a6',
  newsletter: '#f59e0b',
  patreon:    '#ff424d',
}

// joelleroa gets a distinct pink so you can tell the two IG accounts apart on the calendar
const INSTAGRAM_ACCOUNT_COLORS = {
  joelroac:  '#a855f7', // standard purple
  joelleroa: '#ec4899', // hot pink
}

// Returns the display color for a project, accounting for Instagram account variants
function projectColor(p) {
  if (p.type === 'instagram' && p.videoBreakdown && INSTAGRAM_ACCOUNT_COLORS[p.videoBreakdown]) {
    return INSTAGRAM_ACCOUNT_COLORS[p.videoBreakdown]
  }
  return PLATFORM_COLORS[p.type] || '#9ca3af'
}

export default function Calendar() {
  const { projects, setSelectedProject, updateProject, currentUser, permissions, postingGoals, previewRole, getWorkflow } = useApp()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [view, setView]                 = useState('month') // 'month' | 'week'
  const [selectedDay, setSelectedDay]   = useState(null)
  const [draggedId, setDraggedId]         = useState(null)
  const [draggedIsWip, setDraggedIsWip]   = useState(false)
  const [draggedWipDate, setDraggedWipDate] = useState(null) // which specific work date is being moved
  const [altHeld, setAltHeld]             = useState(false)
  const [dragOverDate, setDragOverDate]   = useState(null)
  const [contextMenu, setContextMenu]   = useState(null) // { x, y, project, date }
  const [addForDate, setAddForDate]     = useState(null) // date string to pre-fill in new project modal
  const [hoveredDate, setHoveredDate]   = useState(null)
  const [search, setSearch]             = useState('')
  const [filterType, setFilterType]     = useState(null) // null = all platforms

  const searchQ = search.trim().toLowerCase()
  function matchesSearch(p) {
    if (!searchQ) return true
    return (
      p.title?.toLowerCase().includes(searchQ) ||
      p.type?.toLowerCase().includes(searchQ) ||
      p.brand?.toLowerCase().includes(searchQ) ||
      p.status?.toLowerCase().includes(searchQ)
    )
  }

  const POSTED_STATUSES = ['Posted', 'Sent']
  // Statuses that mean "production is done, just needs to go live"
  const READY_STATUSES  = ['Ready to Post', 'Scheduled', 'Ready to Send']

  // True when the project has been published/sent
  function isPosted(p) {
    return POSTED_STATUSES.includes(p.status)
  }

  // True when the project is fully produced and waiting to publish.
  // First checks known ready-status names directly (reliable across custom workflows),
  // then falls back to workflow-position check as a safety net.
  function isReadyToPost(p) {
    if (isPosted(p)) return false
    if (READY_STATUSES.includes(p.status)) return true
    // Fallback: last 2 stages before Posted/Sent in the configured workflow
    const workflow = getWorkflow(p.type)
    if (!workflow || workflow.length < 2) return false
    const postIdx   = workflow.findIndex((s) => POSTED_STATUSES.includes(s))
    if (postIdx <= 0) return false
    const statusIdx = workflow.indexOf(p.status)
    return statusIdx >= 0 && statusIdx >= postIdx - 2 && statusIdx < postIdx
  }

  // When Joel is previewing another user, use that role for filtering/permissions
  const effectiveRole = previewRole || currentUser?.role

  const isAdmin      = effectiveRole === 'admin' || effectiveRole === 'creator'
  const isTiana      = effectiveRole === 'social_manager' || effectiveRole === 'social'
  const canReschedule = isAdmin || (isTiana && permissions?.socialManager?.canEditCalendar)

  // Projects with a publish date; editor (Anthony) sees YouTube only
  const isEditor = effectiveRole === 'editor'
  const activeProjects = projects.filter((p) => {
    if (!p.publishDate) return false
    if (isEditor && p.type !== 'youtube') return false
    if (filterType && p.type !== filterType && p.crossPostTo !== filterType) return false
    return true
  })

  // Track Option/Alt key globally so it can be pressed/released mid-drag
  React.useEffect(() => {
    function onKeyDown(e) { if (e.key === 'Alt') setAltHeld(true) }
    function onKeyUp(e)   { if (e.key === 'Alt') setAltHeld(false) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [])

  // Whether this drag is acting as a WIP drag — either started as one, or Option is currently held
  const isWipDrag = draggedIsWip || altHeld

  function projectsOnDay(date) {
    return activeProjects.filter((p) => {
      try { return isSameDay(parseISO(p.publishDate), date) }
      catch { return false }
    })
  }

  function projectsWorkingOnDay(date) {
    return projects.filter((p) => {
      const dates = p.workDates || []
      if (dates.length === 0) return false
      if (isEditor && p.type !== 'youtube') return false
      if (filterType && p.type !== filterType) return false
      return dates.some((d) => { try { return isSameDay(parseISO(d), date) } catch { return false } })
    })
  }

  // Month grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Week view
  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 0 })
  const weekEnd   = endOfWeek(currentMonth, { weekStartsOn: 0 })
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Weekly agenda (always current week)
  const agendaStart = startOfWeek(new Date(), { weekStartsOn: 0 })
  const agendaEnd   = endOfWeek(new Date(), { weekStartsOn: 0 })
  const agendaDays  = eachDayOfInterval({ start: agendaStart, end: agendaEnd })

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // ── Drag-to-reschedule ────────────────────────────────────────────────────
  function handleChipDragStart(e, projectId, isWip = false, wipDate = null) {
    if (!canReschedule) return
    const wipMode = isWip || e.altKey  // hold ⌥ Option to drag as work date
    setDraggedId(projectId)
    setDraggedIsWip(wipMode)
    setDraggedWipDate(wipDate)  // which specific work date is being moved (null = adding new)
    setDragInProgress(true)
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
  }

  function handleDayCellDragOver(e, date) {
    if (!canReschedule || !draggedId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(date.toISOString())
  }

  function handleDayCellDrop(e, date) {
    e.preventDefault()
    if (!draggedId) return
    const newDate = format(date, 'yyyy-MM-dd')
    if (isWipDrag) {
      const project = projects.find((p) => p.id === draggedId)
      const existing = project?.workDates || []
      if (draggedWipDate) {
        // Move: remove old date, add new date (no dupes)
        const updated = [...existing.filter((d) => d !== draggedWipDate)]
        if (!updated.includes(newDate)) updated.push(newDate)
        updateProject(draggedId, { workDates: updated })
      } else {
        // Add new work date (⌥ drag from publish chip)
        if (!existing.includes(newDate)) {
          updateProject(draggedId, { workDates: [...existing, newDate] })
        }
      }
    } else {
      updateProject(draggedId, { publishDate: newDate })
    }
    setDraggedId(null)
    setDraggedIsWip(false)
    setDraggedWipDate(null)
    setDragOverDate(null)
    setAltHeld(false)       // browser eats the keyup during drag — reset manually
    setDragInProgress(false)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDraggedIsWip(false)
    setDraggedWipDate(null)
    setDragOverDate(null)
    setAltHeld(false)       // reset in case keyup was swallowed mid-drag
    setDragInProgress(false)
  }

  // ── Day cell ──────────────────────────────────────────────────────────────
  function DayCell({ date }) {
    const dayProjects = projectsOnDay(date)
    const inMonth     = isSameMonth(date, currentMonth)
    const today       = isToday(date)
    const isDragOver  = dragOverDate === date.toISOString()
    const isSelected  = selectedDay && isSameDay(date, selectedDay)

    const isHovered = hoveredDate === date.toISOString()

    return (
      <div
        className={`cal-day ${today ? 'today' : ''}`}
        style={{
          opacity:     inMonth ? 1 : 0.3,
          background:  isSelected
            ? 'rgba(245,158,11,0.06)'
            : isDragOver
              ? isWipDrag ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)'
              : undefined,
          borderColor: isSelected
            ? 'rgba(245,158,11,0.35)'
            : isDragOver
              ? isWipDrag ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.25)'
              : undefined,
          borderStyle: isDragOver && isWipDrag ? 'dashed' : undefined,
          transition:  'background 0.1s ease, border-color 0.1s ease',
          cursor:      'pointer',
          position:    'relative',
        }}
        onClick={() => setSelectedDay(date)}
        onContextMenu={(e) => handleDayContextMenu(e, date)}
        onMouseEnter={() => setHoveredDate(date.toISOString())}
        onMouseLeave={() => setHoveredDate(null)}
        onDragOver={(e) => handleDayCellDragOver(e, date)}
        onDrop={(e)     => handleDayCellDrop(e, date)}
        onDragLeave={()  => setDragOverDate(null)}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div
            className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${today ? 'text-zinc-900' : 'text-zinc-500'}`}
            style={today ? { background: '#f59e0b' } : {}}
          >
            {format(date, 'd')}
          </div>
          {isAdmin && isHovered && (
            <button
              onClick={(e) => { e.stopPropagation(); setAddForDate(format(date, 'yyyy-MM-dd')) }}
              className="w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-amber-400/20"
              style={{ color: '#f59e0b' }}
              title={`Add project on ${format(date, 'MMM d')}`}
            >
              <Plus size={10} />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {dayProjects.slice(0, 3).map((p) => {
            const hit    = matchesSearch(p)
            const posted = isPosted(p)
            const ready  = isReadyToPost(p)
            const col    = projectColor(p)
            return (
            <button
              key={p.id}
              draggable={canReschedule}
              onDragStart={(e) => { handleChipDragStart(e, p.id) }}
              onDragEnd={handleDragEnd}
              onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
              onContextMenu={(e) => handleChipContextMenu(e, p, date)}
              className="flex items-center gap-1 text-left w-full rounded px-1 py-0.5 transition-all hover:opacity-80"
              style={{
                background: posted ? 'rgba(74,222,128,0.10)' : `${col}${ready ? '28' : '18'}`,
                border:     posted ? '1px solid rgba(74,222,128,0.4)'
                          : ready  ? `1px solid ${col}cc`
                          : `1px solid ${searchQ && hit ? col : `${col}30`}`,
                cursor:     isAdmin ? 'grab' : 'pointer',
                opacity:    searchQ && !hit ? 0.2 : 1,
                boxShadow:  posted ? 'none'
                          : ready  ? `0 0 0 1px ${col}40`
                          : searchQ && hit ? `0 0 0 1px ${col}50` : 'none',
              }}
            >
              <PlatformDot type={p.type} size={5} />
              {p.crossPostTo && <PlatformDot type={p.crossPostTo} size={5} />}
              {p.brand && p.brand !== 'Organic' && (
                <span title={`Brand Deal: ${p.brand}`} style={{ fontSize: 7, fontWeight: 800, color: '#fbbf24', lineHeight: 1, flexShrink: 0 }}>B</span>
              )}
              <span className="text-[9px] font-medium truncate" style={{ color: posted ? '#4ade80' : col }}>
                {p.title}
              </span>
              {posted && <Check size={7} style={{ color: '#4ade80', flexShrink: 0, marginLeft: 'auto' }} />}
              {ready  && <span style={{ fontSize: 7, fontWeight: 900, color: col, flexShrink: 0, marginLeft: 'auto', lineHeight: 1 }}>↑</span>}
            </button>
          )})}
          {dayProjects.length > 3 && (
            <span
              className="text-[9px] text-zinc-600 pl-1 cursor-pointer hover:text-zinc-400 transition-colors"
              onClick={(e) => { e.stopPropagation(); setSelectedDay(date) }}
            >
              +{dayProjects.length - 3} more
            </span>
          )}
          {/* WIP chips — platform color tint + dashed border to distinguish from publish chips */}
          {projectsWorkingOnDay(date).map((p) => {
            const col      = projectColor(p)
            const dateStr  = format(date, 'yyyy-MM-dd')
            const hit      = matchesSearch(p)
            const done     = (p.completedWorkDates || []).includes(dateStr)
            function toggleDone(e) {
              e.stopPropagation()
              const prev = p.completedWorkDates || []
              updateProject(p.id, {
                completedWorkDates: done ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
              })
            }
            return (
              <div
                key={`wip-${p.id}`}
                draggable={!done && canReschedule}
                onDragStart={(e) => !done && handleChipDragStart(e, p.id, true, dateStr)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1 w-full rounded px-1 py-0.5 group/wip transition-all"
                style={{
                  background: done ? `${col}07` : `${col}0e`,
                  border: done ? `1px solid ${col}30` : `1px dashed ${searchQ && hit ? col : `${col}55`}`,
                  cursor: done ? 'default' : canReschedule ? 'grab' : 'default',
                  opacity: done ? 0.6 : searchQ && !hit ? 0.2 : 1,
                  boxShadow: !done && searchQ && hit ? `0 0 0 1px ${col}40` : 'none',
                }}
              >
                <button
                  onClick={toggleDone}
                  className="flex-shrink-0 transition-opacity"
                  style={{ lineHeight: 1, color: done ? '#4ade80' : `${col}70` }}
                  title={done ? 'Mark incomplete' : 'Mark done for today'}
                >
                  {done
                    ? <CheckCircle2 size={8} />
                    : <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: `1px solid ${col}70`, flexShrink: 0 }} />
                  }
                </button>
                <span
                  className="text-[9px] font-medium truncate flex-1 text-left cursor-pointer hover:opacity-80"
                  style={{ color: done ? `${col}55` : `${col}99`, textDecoration: done ? 'line-through' : 'none' }}
                  onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
                >
                  {p.title}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); updateProject(p.id, { workDates: (p.workDates || []).filter(d => d !== dateStr), completedWorkDates: (p.completedWorkDates || []).filter(d => d !== dateStr) }) }}
                  className="opacity-0 group-hover/wip:opacity-100 transition-opacity flex-shrink-0 hover:text-white"
                  style={{ color: '#71717a', lineHeight: 1 }}
                  title="Remove this work date"
                >
                  <X size={8} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function handleChipContextMenu(e, project, date) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, project, date })
  }

  function handleDayContextMenu(e, date) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, project: null, date })
  }

  function closeContextMenu() { setContextMenu(null) }

  function handleSetWorkDate() {
    const newDate  = format(contextMenu.date, 'yyyy-MM-dd')
    const existing = contextMenu.project.workDates || []
    if (!existing.includes(newDate)) {
      updateProject(contextMenu.project.id, { workDates: [...existing, newDate] })
    }
    closeContextMenu()
  }

  function handleClearWorkDate() {
    // Remove just this date from the array
    const dateStr  = format(contextMenu.date, 'yyyy-MM-dd')
    const existing = contextMenu.project.workDates || []
    updateProject(contextMenu.project.id, { workDates: existing.filter(d => d !== dateStr) })
    closeContextMenu()
  }

  return (
    <div className="px-3 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto" onClick={closeContextMenu}>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-[999] rounded-xl overflow-hidden shadow-2xl"
          style={{
            top: contextMenu.y, left: contextMenu.x,
            background: '#1c1c22', border: '1px solid rgba(255,255,255,0.12)',
            minWidth: 200,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {contextMenu.project
              ? <p className="text-xs font-semibold text-white truncate">{contextMenu.project.title}</p>
              : <p className="text-xs font-semibold text-white">{format(contextMenu.date, 'EEEE')}</p>
            }
            <p className="text-[10px] text-zinc-500 mt-0.5">{format(contextMenu.date, 'MMMM d, yyyy')}</p>
          </div>
          <div className="py-1">
            {/* Add project — always available */}
            {isAdmin && (
              <button
                onClick={() => { setAddForDate(format(contextMenu.date, 'yyyy-MM-dd')); closeContextMenu() }}
                className="w-full text-left px-3 py-2 text-xs text-amber-400 hover:bg-white/[0.04] transition-colors flex items-center gap-2 font-semibold"
              >
                <Plus size={11} style={{ flexShrink: 0 }} />
                Add Project on {format(contextMenu.date, 'MMM d')}
              </button>
            )}
            {/* Project-specific actions */}
            {contextMenu.project && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />
                <button
                  onClick={handleSetWorkDate}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04] transition-colors flex items-center gap-2"
                >
                  <span style={{ display: 'inline-block', width: 10, height: 8, borderRadius: 2, border: '1px dashed rgba(245,158,11,0.5)', flexShrink: 0 }} />
                  Set Work Date to {format(contextMenu.date, 'MMM d')}
                </button>
                {(contextMenu.project.workDates || []).includes(format(contextMenu.date, 'yyyy-MM-dd')) && (
                  <button onClick={handleClearWorkDate} className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors">
                    Remove Work Date on {format(contextMenu.date, 'MMM d')}
                  </button>
                )}
                <button
                  onClick={() => { setSelectedProject(contextMenu.project); closeContextMenu() }}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04] transition-colors"
                >
                  Open Project
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="shrink-0">
          <h1 className="font-editorial text-3xl font-semibold text-white">Content Calendar</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {format(currentMonth, 'MMMM yyyy')}
            {canReschedule && <span className="ml-2 text-zinc-600 text-xs">· Drag to reschedule · <span className="text-zinc-700">⌥ drag to set work date</span></span>}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {['month', 'week'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-4 py-2 text-xs font-semibold capitalize transition-all"
                style={
                  view === v
                    ? { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }
                    : { background: 'transparent', color: '#71717a' }
                }
              >
                {v}
              </button>
            ))}
          </div>

          {/* Month nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth(view === 'week' ? subWeeks(currentMonth, 1) : subMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ color: '#71717a', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors hover:bg-white/10"
              style={{ color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(view === 'week' ? addWeeks(currentMonth, 1) : addMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ color: '#71717a', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Platform filter pills + search bar */}
      {!isEditor && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setFilterType(null)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={
              filterType === null
                ? { background: 'rgba(255,255,255,0.12)', color: '#e4e4e7', border: '1px solid rgba(255,255,255,0.2)' }
                : { background: 'transparent', color: '#52525b', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            All
          </button>
          {Object.entries(PLATFORM_COLORS).map(([platform, color]) => {
            const active = filterType === platform
            return (
              <button
                key={platform}
                onClick={() => setFilterType(active ? null : platform)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={
                  active
                    ? { background: `${color}22`, color: color, border: `1px solid ${color}55` }
                    : { background: 'transparent', color: '#52525b', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                <PlatformDot type={platform} size={6} />
                <span className="capitalize">{platform === 'newsletter' ? 'Newsletter' : platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
              </button>
            )
          })}
          {/* Search — pushed to the right */}
          <div className="relative ml-auto" style={{ minWidth: 180 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#52525b' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full text-xs rounded-full pl-8 pr-7 py-1.5 text-white placeholder-zinc-600"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${searchQ ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`, outline: 'none', transition: 'border-color 0.15s' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:text-white transition-colors"
                style={{ color: '#52525b' }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="w-full">
          {/* Day labels — month view only */}
          {view === 'month' && (
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-600 py-2">
                  {d}
                </div>
              ))}
            </div>
          )}

          {view === 'month' ? (
            (() => {
              const weeks = []
              for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
              return weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((day) => <DayCell key={day.toISOString()} date={day} />)}
                </div>
              ))
            })()
          ) : (
            <div className="grid grid-cols-7 gap-2" style={{ minHeight: 520 }}>
              {weekDays.map((day) => {
                const dayProjects = projectsOnDay(day)
                const today       = isToday(day)
                const isSelected  = selectedDay && isSameDay(day, selectedDay)
                const isDragOver  = dragOverDate === day.toISOString()
                return (
                  <div
                    key={day.toISOString()}
                    className="flex flex-col rounded-xl overflow-hidden"
                    style={{
                      background: isSelected ? 'rgba(245,158,11,0.05)' : isDragOver ? 'rgba(245,158,11,0.03)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid rgba(245,158,11,0.3)' : isDragOver ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.07)',
                      transition: 'background 0.1s ease, border-color 0.1s ease',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedDay(day)}
                    onContextMenu={(e) => handleDayContextMenu(e, day)}
                    onDragOver={(e) => handleDayCellDragOver(e, day)}
                    onDrop={(e)     => handleDayCellDrop(e, day)}
                    onDragLeave={()  => setDragOverDate(null)}
                  >
                    {/* Day header */}
                    <div className="px-2 py-2 text-center relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: today ? 'rgba(245,158,11,0.08)' : undefined }}>
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: today ? '#f59e0b' : '#52525b' }}>
                        {format(day, 'EEE')}
                      </div>
                      <div
                        className="text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full mx-auto"
                        style={today ? { background: '#f59e0b', color: '#111' } : { color: '#e4e4e7' }}
                      >
                        {format(day, 'd')}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setAddForDate(format(day, 'yyyy-MM-dd')) }}
                          className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100 hover:bg-amber-400/20"
                          style={{ color: '#f59e0b' }}
                          title={`Add project on ${format(day, 'MMM d')}`}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0' }}
                        >
                          <Plus size={10} />
                        </button>
                      )}
                    </div>
                    {/* Projects */}
                    <div className="flex flex-col gap-1.5 p-1.5 flex-1">
                      {dayProjects.length === 0 && (
                        <div className="flex-1 flex items-center justify-center">
                          <span className="text-[9px] text-zinc-700">—</span>
                        </div>
                      )}
                      {dayProjects.map((p) => {
                        const hit    = matchesSearch(p)
                        const posted = isPosted(p)
                        const ready  = isReadyToPost(p)
                        const col    = projectColor(p)
                        return (
                          <button
                            key={p.id}
                            draggable={canReschedule}
                            onDragStart={(e) => { handleChipDragStart(e, p.id) }}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
                            onContextMenu={(e) => handleChipContextMenu(e, p, day)}
                            className="w-full text-left rounded-lg px-2 py-1.5 transition-all hover:opacity-80 flex flex-col gap-1"
                            style={{
                              background: posted ? 'rgba(74,222,128,0.10)' : `${col}${ready ? '28' : '15'}`,
                              border:     posted ? '1px solid rgba(74,222,128,0.4)'
                                        : ready  ? `1px solid ${col}cc`
                                        : `1px solid ${searchQ && hit ? col : `${col}35`}`,
                              boxShadow:  posted ? 'none'
                                        : ready  ? `0 0 0 1px ${col}40`
                                        : searchQ && hit ? `0 0 0 1px ${col}50` : 'none',
                              opacity:    searchQ && !hit ? 0.2 : 1,
                              cursor:     isAdmin ? 'grab' : 'pointer',
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <PlatformDot type={p.type} size={5} />
                              {p.crossPostTo && <PlatformDot type={p.crossPostTo} size={5} />}
                              {p.brand && p.brand !== 'Organic' && (
                                <span style={{ fontSize: 7, fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>B</span>
                              )}
                              {posted && <Check size={9} style={{ color: '#4ade80', marginLeft: 'auto', flexShrink: 0 }} />}
                              {ready  && <span style={{ fontSize: 9, fontWeight: 900, color: col, marginLeft: 'auto', flexShrink: 0, lineHeight: 1 }}>↑</span>}
                            </div>
                            <span className="text-[10px] font-medium leading-tight w-full truncate block" style={{ color: posted ? '#4ade80' : col }}>
                              {p.title}
                            </span>
                            <span className="text-[9px]" style={{ color: posted ? '#4ade8080' : ready ? `${col}99` : '#52525b' }}>
                              {posted ? '✓ Posted' : ready ? '↑ ' + p.status : p.status}
                            </span>
                          </button>
                        )
                      })}
                      {/* WIP chips — platform color tint + dashed border */}
                      {projectsWorkingOnDay(day).map((p) => {
                        const col     = projectColor(p)
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const hit     = matchesSearch(p)
                        const done    = (p.completedWorkDates || []).includes(dateStr)
                        function toggleDone(e) {
                          e.stopPropagation()
                          const prev = p.completedWorkDates || []
                          updateProject(p.id, {
                            completedWorkDates: done ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
                          })
                        }
                        return (
                          <div
                            key={`wip-${p.id}`}
                            draggable={!done && canReschedule}
                            onDragStart={(e) => !done && handleChipDragStart(e, p.id, true, dateStr)}
                            onDragEnd={handleDragEnd}
                            className="w-full rounded-lg px-2 py-1.5 flex flex-col gap-1 group/wip"
                            style={{
                              background: done ? `${col}07` : `${col}0e`,
                              border:     done ? `1px solid ${col}30` : `1px dashed ${searchQ && hit ? col : `${col}55`}`,
                              boxShadow:  !done && searchQ && hit ? `0 0 0 1px ${col}40` : 'none',
                              opacity:    done ? 0.65 : searchQ && !hit ? 0.2 : 1,
                              cursor:     done ? 'default' : canReschedule ? 'grab' : 'default',
                            }}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={toggleDone}
                                  className="flex-shrink-0 transition-colors"
                                  style={{ lineHeight: 1, color: done ? '#4ade80' : `${col}70` }}
                                  title={done ? 'Mark incomplete' : 'Mark done for today'}
                                >
                                  {done
                                    ? <CheckCircle2 size={10} />
                                    : <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${col}60`, flexShrink: 0 }} />
                                  }
                                </button>
                                <PlatformDot type={p.type} size={5} />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); updateProject(p.id, { workDates: (p.workDates || []).filter(d => d !== dateStr), completedWorkDates: (p.completedWorkDates || []).filter(d => d !== dateStr) }) }}
                                className="opacity-0 group-hover/wip:opacity-100 transition-opacity hover:text-white"
                                style={{ color: '#71717a' }}
                                title="Remove this work date"
                              >
                                <X size={9} />
                              </button>
                            </div>
                            <span
                              className="text-[10px] font-medium leading-tight w-full truncate block cursor-pointer hover:opacity-80"
                              style={{ color: done ? `${col}55` : `${col}99`, textDecoration: done ? 'line-through' : 'none' }}
                              onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
                            >
                              {p.title}
                            </span>
                            <span className="text-[9px]" style={{ color: `${col}55` }}>{done ? '✓ done' : p.status}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {Object.entries(PLATFORM_COLORS).map(([platform, color]) => {
              // Instagram gets expanded into two account entries
              if (platform === 'instagram') {
                return (
                  <React.Fragment key={platform}>
                    <div className="flex items-center gap-1.5">
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: INSTAGRAM_ACCOUNT_COLORS.joelroac, display: 'inline-block', flexShrink: 0 }} />
                      <span className="text-xs text-zinc-500">Instagram · joelroac</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: INSTAGRAM_ACCOUNT_COLORS.joelleroa, display: 'inline-block', flexShrink: 0 }} />
                      <span className="text-xs text-zinc-500">Instagram · joelleroa</span>
                    </div>
                  </React.Fragment>
                )
              }
              return (
                <div key={platform} className="flex items-center gap-1.5">
                  <PlatformDot type={platform} size={8} />
                  <span className="text-xs text-zinc-500 capitalize">
                    {platform === 'newsletter' ? 'Newsletter' : platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </span>
                </div>
              )
            })}
            <div className="flex items-center gap-1.5 ml-2 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#fbbf24' }}>B</span>
              <span className="text-xs text-zinc-500">Brand Deal</span>
            </div>
            <div className="flex items-center gap-1.5 ml-2 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              <Pencil size={9} style={{ color: '#71717a' }} />
              <span className="text-xs text-zinc-500">Work Day</span>
            </div>
            <div className="flex items-center gap-1.5 ml-2 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, display: 'inline-block' }} />
              <span className="text-xs text-zinc-500">Ready to post</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={9} style={{ color: '#4ade80' }} />
              <span className="text-xs text-zinc-500">Posted</span>
            </div>
          </div>

        </div>

      </div>

      {/* Goals panel — below calendar, full width on mobile, shown on desktop */}
      <div className="hidden sm:block mt-4">
        {(() => {
          const weeks = view === 'month'
            ? (() => { const w = []; for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7)); return w })()
            : [weekDays]
          return <GoalsPanel weeks={weeks} projects={projects} goals={postingGoals} />
        })()}
      </div>

      {/* Add Project Modal — opened from calendar day hover + or right-click */}
      {addForDate && (
        <AddProjectModal
          initialDate={addForDate}
          onClose={() => setAddForDate(null)}
        />
      )}

      {/* Day breakdown — full width below calendar on all screen sizes */}
      {selectedDay && (
        <div className="mt-4 rounded-2xl overflow-hidden animate-fade-in" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">{format(selectedDay, 'EEE, MMM d')}</p>
            <button onClick={() => setSelectedDay(null)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10" style={{ color: '#52525b' }}>
              <X size={12} />
            </button>
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {projectsOnDay(selectedDay).map((p) => (
              <button key={p.id} onClick={() => { setSelectedProject(p); setSelectedDay(null) }}
                className="w-full text-left rounded-xl p-3 transition-colors hover:bg-white/[0.03]"
                style={{ border: `1px solid ${projectColor(p)}25`, background: `${projectColor(p)}08` }}>
                <div className="flex items-center gap-2 mb-1.5 min-w-0">
                  <PlatformIcon type={p.type} size={13} />
                  <span className="text-sm font-semibold text-white truncate flex-1">{p.title}</span>
                </div>
                <StatusBadge status={p.status} />
              </button>
            ))}
            {projectsWorkingOnDay(selectedDay).map((p) => {
              const col     = projectColor(p)
              const dateStr = format(selectedDay, 'yyyy-MM-dd')
              return (
                <div key={`wip-${p.id}`}
                  className="w-full text-left rounded-xl p-3 group/wip relative"
                  style={{ background: `${col}0a`, border: `1px dashed ${col}45` }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateProject(p.id, { workDates: (p.workDates || []).filter(d => d !== dateStr) }) }}
                    className="absolute top-2 right-2 opacity-0 group-hover/wip:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-white/10"
                    style={{ color: '#71717a' }}
                    title="Remove this work date"
                  >
                    <X size={10} />
                  </button>
                  <div
                    className="flex items-center gap-2 mb-1.5 min-w-0 cursor-pointer hover:opacity-80"
                    onClick={() => { setSelectedProject(p); setSelectedDay(null) }}
                  >
                    <Pencil size={11} style={{ color: col, opacity: 0.7, flexShrink: 0 }} />
                    <PlatformIcon type={p.type} size={13} />
                    <span className="text-sm font-semibold truncate flex-1" style={{ color: `${col}cc` }}>{p.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: `${col}15`, color: col, border: `1px solid ${col}30` }}>
                      In Progress
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              )
            })}
            {projectsOnDay(selectedDay).length === 0 && projectsWorkingOnDay(selectedDay).length === 0 && (
              <p className="text-xs text-zinc-600 py-4 col-span-full text-center">Nothing scheduled for this day</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
