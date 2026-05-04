import React, { useState } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X, CheckCircle2, Pencil, Plus } from 'lucide-react'
import { useApp } from '../context/AppContext'
import StatusBadge from './shared/StatusBadge'
import { PlatformIcon, PlatformDot } from './shared/Icons'
import AddProjectModal from './joel/AddProjectModal'

// ── Goals Panel (right sidebar) ───────────────────────────────────────────────

function GoalsPanel({ weeks, projects, goals }) {
  const activePlatforms = Object.entries(goals).filter(([, g]) => g > 0)
  if (activePlatforms.length === 0) return null

  // Only count posts where the final workflow step is complete
  const COMPLETED_STATUSES = ['Posted', 'Sent']

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-xs font-semibold text-white uppercase tracking-widest">Posting Goals <span className="text-zinc-600 font-normal normal-case text-[10px] ml-1">per week</span></p>
      </div>
      <div className="p-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week, wi) => {
          const weekStart = week[0]
          const weekEnd   = week[week.length - 1]
          const label     = format(weekStart, 'MMM d') + ' – ' + format(weekEnd, 'd')

          // Count only fully-completed posts (Posted or Sent) in this week.
          // Cross-posted projects count toward both platforms.
          const counts = {}
          for (const p of projects) {
            if (!p.publishDate) continue
            if (!COMPLETED_STATUSES.includes(p.status)) continue
            const d = new Date(p.publishDate + 'T00:00:00')
            if (d >= weekStart && d <= weekEnd) {
              counts[p.type] = (counts[p.type] || 0) + 1
              if (p.crossPostTo) counts[p.crossPostTo] = (counts[p.crossPostTo] || 0) + 1
            }
          }

          const allMet = activePlatforms.every(([platform, goal]) => (counts[platform] || 0) >= goal)

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
                  const count = counts[platform] || 0
                  const met   = count >= goal
                  const pct   = Math.min(count / goal, 1)
                  return (
                    <div key={platform}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: PLATFORM_COLORS[platform] || '#9ca3af' }} />
                          <span className="text-[10px] text-zinc-500 capitalize">{platform}</span>
                        </div>
                        <span className="text-[10px] font-semibold tabular-nums"
                          style={{ color: met ? '#4ade80' : '#52525b' }}>
                          {count}/{goal}
                        </span>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct * 100}%`,
                            background: met ? '#4ade80' : (PLATFORM_COLORS[platform] || '#9ca3af'),
                            opacity: met ? 1 : 0.5,
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
  const { projects, setSelectedProject, updateProject, currentUser, permissions, postingGoals, previewRole } = useApp()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [view, setView]                 = useState('month') // 'month' | 'week'
  const [selectedDay, setSelectedDay]   = useState(null)
  const [draggedId, setDraggedId]       = useState(null)
  const [draggedIsWip, setDraggedIsWip] = useState(false)
  const [dragOverDate, setDragOverDate] = useState(null)
  const [contextMenu, setContextMenu]   = useState(null) // { x, y, project, date }
  const [addForDate, setAddForDate]     = useState(null) // date string to pre-fill in new project modal
  const [hoveredDate, setHoveredDate]   = useState(null)

  // When Joel is previewing another user, use that role for filtering/permissions
  const effectiveRole = previewRole || currentUser?.role

  const isAdmin      = effectiveRole === 'admin' || effectiveRole === 'creator'
  const isTiana      = effectiveRole === 'social_manager' || effectiveRole === 'social'
  const canReschedule = isAdmin || (isTiana && permissions?.socialManager?.canEditCalendar)

  // Projects with a publish date; editor (Anthony) sees YouTube only
  const isEditor = effectiveRole === 'editor'
  const activeProjects = projects.filter((p) => p.publishDate && (isEditor ? p.type === 'youtube' : true))

  function projectsOnDay(date) {
    return activeProjects.filter((p) => {
      try { return isSameDay(parseISO(p.publishDate), date) }
      catch { return false }
    })
  }

  function projectsWorkingOnDay(date) {
    return projects.filter((p) => {
      if (!p.workDate) return false
      if (isEditor && p.type !== 'youtube') return false
      try { return isSameDay(parseISO(p.workDate), date) }
      catch { return false }
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
  function handleChipDragStart(e, projectId, isWip = false) {
    if (!canReschedule) return
    setDraggedId(projectId)
    setDraggedIsWip(isWip)
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
    updateProject(draggedId, draggedIsWip ? { workDate: newDate } : { publishDate: newDate })
    setDraggedId(null)
    setDraggedIsWip(false)
    setDragOverDate(null)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOverDate(null)
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
            : isDragOver ? 'rgba(245,158,11,0.04)' : undefined,
          borderColor: isSelected
            ? 'rgba(245,158,11,0.35)'
            : isDragOver ? 'rgba(245,158,11,0.4)' : undefined,
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
          {dayProjects.slice(0, 3).map((p) => (
            <button
              key={p.id}
              draggable={canReschedule}
              onDragStart={(e) => { handleChipDragStart(e, p.id) }}
              onDragEnd={handleDragEnd}
              onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
              onContextMenu={(e) => handleChipContextMenu(e, p, date)}
              className="flex items-center gap-1 text-left w-full rounded px-1 py-0.5 transition-opacity hover:opacity-80"
              style={{
                background: `${projectColor(p)}18`,
                border:     `1px solid ${projectColor(p)}30`,
                cursor:     isAdmin ? 'grab' : 'pointer',
              }}
            >
              <PlatformDot type={p.type} size={5} />
              {/* Cross-post indicator — second platform dot */}
              {p.crossPostTo && (
                <PlatformDot type={p.crossPostTo} size={5} />
              )}
              {p.brand && p.brand !== 'Organic' && (
                <span
                  title={`Brand Deal: ${p.brand}`}
                  style={{ fontSize: 7, fontWeight: 800, color: '#fbbf24', lineHeight: 1, flexShrink: 0 }}
                >B</span>
              )}
              <span className="text-[9px] font-medium truncate" style={{ color: projectColor(p) }}>
                {p.title}
              </span>
            </button>
          ))}
          {dayProjects.length > 3 && (
            <span
              className="text-[9px] text-zinc-600 pl-1 cursor-pointer hover:text-zinc-400 transition-colors"
              onClick={(e) => { e.stopPropagation(); setSelectedDay(date) }}
            >
              +{dayProjects.length - 3} more
            </span>
          )}
          {/* WIP chips — amber pencil, gray bg, clearly "in progress" */}
          {projectsWorkingOnDay(date).map((p) => (
            <div
              key={`wip-${p.id}`}
              draggable={canReschedule}
              onDragStart={(e) => handleChipDragStart(e, p.id, true)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-1 w-full rounded px-1 py-0.5 group/wip"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px dashed rgba(245,158,11,0.35)', cursor: canReschedule ? 'grab' : 'default' }}
            >
              <Pencil size={7} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span
                className="text-[9px] font-medium truncate flex-1 text-left cursor-pointer hover:opacity-80"
                style={{ color: '#a1a1aa' }}
                onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
              >
                {p.title}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); updateProject(p.id, { workDate: null }) }}
                className="opacity-0 group-hover/wip:opacity-100 transition-opacity flex-shrink-0 hover:text-white"
                style={{ color: '#71717a', lineHeight: 1 }}
                title="Dismiss work date"
              >
                <X size={8} />
              </button>
            </div>
          ))}
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
    const newDate = format(contextMenu.date, 'yyyy-MM-dd')
    updateProject(contextMenu.project.id, { workDate: newDate })
    closeContextMenu()
  }

  function handleClearWorkDate() {
    updateProject(contextMenu.project.id, { workDate: null })
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
                {contextMenu.project.workDate && (
                  <button onClick={handleClearWorkDate} className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors">
                    Clear Work Date
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-white">Content Calendar</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {format(currentMonth, 'MMMM yyyy')}
            {canReschedule && <span className="ml-2 text-zinc-600 text-xs">· Drag chips to reschedule</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
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
                      {dayProjects.map((p) => (
                        <button
                          key={p.id}
                          draggable={canReschedule}
                          onDragStart={(e) => { handleChipDragStart(e, p.id) }}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
                          onContextMenu={(e) => handleChipContextMenu(e, p, day)}
                          className="w-full text-left rounded-lg px-2 py-1.5 transition-opacity hover:opacity-80 flex flex-col gap-1"
                          style={{
                            background: `${projectColor(p)}15`,
                            border:     `1px solid ${projectColor(p)}35`,
                            cursor:     isAdmin ? 'grab' : 'pointer',
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <PlatformDot type={p.type} size={5} />
                            {p.crossPostTo && <PlatformDot type={p.crossPostTo} size={5} />}
                            {p.brand && p.brand !== 'Organic' && (
                              <span style={{ fontSize: 7, fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>B</span>
                            )}
                          </div>
                          <span className="text-[10px] font-medium leading-tight w-full truncate block" style={{ color: projectColor(p) }}>
                            {p.title}
                          </span>
                          <span className="text-[9px] text-zinc-600">{p.status}</span>
                        </button>
                      ))}
                      {/* WIP chips — amber pencil, clearly "in progress" */}
                      {projectsWorkingOnDay(day).map((p) => (
                        <div
                          key={`wip-${p.id}`}
                          draggable={canReschedule}
                          onDragStart={(e) => handleChipDragStart(e, p.id, true)}
                          onDragEnd={handleDragEnd}
                          className="w-full rounded-lg px-2 py-1.5 flex flex-col gap-1 group/wip"
                          style={{ background: 'rgba(245,158,11,0.07)', border: '1px dashed rgba(245,158,11,0.35)', cursor: canReschedule ? 'grab' : 'default' }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <Pencil size={8} style={{ color: '#f59e0b', flexShrink: 0 }} />
                              <PlatformDot type={p.type} size={5} />
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateProject(p.id, { workDate: null }) }}
                              className="opacity-0 group-hover/wip:opacity-100 transition-opacity hover:text-white"
                              style={{ color: '#71717a' }}
                              title="Dismiss work date"
                            >
                              <X size={9} />
                            </button>
                          </div>
                          <span
                            className="text-[10px] font-medium leading-tight w-full truncate block cursor-pointer hover:opacity-80"
                            style={{ color: '#a1a1aa' }}
                            onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
                          >
                            {p.title}
                          </span>
                          <span className="text-[9px] text-zinc-600">{p.status}</span>
                        </div>
                      ))}
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
              <span style={{ display: 'inline-block', width: 16, height: 10, borderRadius: 2, border: '1px dashed rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.07)' }} />
              <span className="text-xs text-zinc-500">Work Day</span>
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
            {projectsWorkingOnDay(selectedDay).map((p) => (
              <button key={`wip-${p.id}`} onClick={() => { setSelectedProject(p); setSelectedDay(null) }}
                className="w-full text-left rounded-xl p-3 transition-colors hover:bg-white/[0.03]"
                style={{ background: 'rgba(245,158,11,0.05)', border: '1px dashed rgba(245,158,11,0.3)' }}>
                <div className="flex items-center gap-2 mb-1.5 min-w-0">
                  <Pencil size={11} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <PlatformIcon type={p.type} size={13} />
                  <span className="text-sm font-semibold text-zinc-300 truncate flex-1">{p.title}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>In Progress</span>
                  <StatusBadge status={p.status} />
                </div>
              </button>
            ))}
            {projectsOnDay(selectedDay).length === 0 && projectsWorkingOnDay(selectedDay).length === 0 && (
              <p className="text-xs text-zinc-600 py-4 col-span-full text-center">Nothing scheduled for this day</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
