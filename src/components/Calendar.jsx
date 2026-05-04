import React, { useState } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import StatusBadge from './shared/StatusBadge'
import { PlatformIcon, PlatformDot } from './shared/Icons'

// ── Goals Panel (right sidebar) ───────────────────────────────────────────────

function GoalsPanel({ weeks, projects, goals }) {
  const activePlatforms = Object.entries(goals).filter(([, g]) => g > 0)
  if (activePlatforms.length === 0) return null

  // Only count posts where the final workflow step is complete
  const COMPLETED_STATUSES = ['Posted', 'Sent']

  return (
    <div
      className="w-48 shrink-0 sticky top-24 self-start rounded-2xl overflow-hidden"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-xs font-semibold text-white uppercase tracking-widest">Posting Goals</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">per week</p>
      </div>
      <div className="p-3 flex flex-col gap-3">
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

export default function Calendar() {
  const { projects, setSelectedProject, updateProject, currentUser, permissions, postingGoals, previewRole } = useApp()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [view, setView]                 = useState('month') // 'month' | 'week'
  const [selectedDay, setSelectedDay]   = useState(null)
  const [draggedId, setDraggedId]       = useState(null)
  const [dragOverDate, setDragOverDate] = useState(null)

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
  function handleChipDragStart(e, projectId) {
    if (!canReschedule) return
    setDraggedId(projectId)
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
    updateProject(draggedId, { publishDate: newDate })
    setDraggedId(null)
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
        }}
        onClick={() => setSelectedDay(date)}
        onDragOver={(e) => handleDayCellDragOver(e, date)}
        onDrop={(e)     => handleDayCellDrop(e, date)}
        onDragLeave={()  => setDragOverDate(null)}
      >
        <div
          className={`text-xs font-semibold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${today ? 'text-zinc-900' : 'text-zinc-500'}`}
          style={today ? { background: '#f59e0b' } : {}}
        >
          {format(date, 'd')}
        </div>
        <div className="flex flex-col gap-1">
          {dayProjects.slice(0, 3).map((p) => (
            <button
              key={p.id}
              draggable={canReschedule}
              onDragStart={(e) => { handleChipDragStart(e, p.id) }}
              onDragEnd={handleDragEnd}
              onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
              className="flex items-center gap-1 text-left w-full rounded px-1 py-0.5 transition-opacity hover:opacity-80"
              style={{
                background: `${PLATFORM_COLORS[p.type] || '#9ca3af'}18`,
                border:     `1px solid ${PLATFORM_COLORS[p.type] || '#9ca3af'}30`,
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
              <span className="text-[9px] font-medium truncate" style={{ color: PLATFORM_COLORS[p.type] || '#9ca3af' }}>
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
          {/* WIP chips — dashed outline, shows title + stage being worked on */}
          {projectsWorkingOnDay(date).map((p) => (
            <button
              key={`wip-${p.id}`}
              onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
              className="flex items-center gap-1 text-left w-full rounded px-1 py-0.5 transition-opacity hover:opacity-80"
              style={{ background: 'transparent', border: `1px dashed ${PLATFORM_COLORS[p.type] || '#9ca3af'}60`, cursor: 'pointer' }}
            >
              <PlatformDot type={p.type} size={5} />
              <span className="text-[9px] font-medium truncate" style={{ color: `${PLATFORM_COLORS[p.type] || '#9ca3af'}aa` }}>
                {p.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto">

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

      <div className="flex gap-6">
        {/* Calendar grid — takes full width on mobile, shares space on desktop */}
        <div className="flex-1 min-w-0 w-full">
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
                    onDragOver={(e) => handleDayCellDragOver(e, day)}
                    onDrop={(e)     => handleDayCellDrop(e, day)}
                    onDragLeave={()  => setDragOverDate(null)}
                  >
                    {/* Day header */}
                    <div className="px-2 py-2 text-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: today ? 'rgba(245,158,11,0.08)' : undefined }}>
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: today ? '#f59e0b' : '#52525b' }}>
                        {format(day, 'EEE')}
                      </div>
                      <div
                        className="text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full mx-auto"
                        style={today ? { background: '#f59e0b', color: '#111' } : { color: '#e4e4e7' }}
                      >
                        {format(day, 'd')}
                      </div>
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
                          className="w-full text-left rounded-lg px-2 py-1.5 transition-opacity hover:opacity-80 flex flex-col gap-1"
                          style={{
                            background: `${PLATFORM_COLORS[p.type] || '#9ca3af'}15`,
                            border:     `1px solid ${PLATFORM_COLORS[p.type] || '#9ca3af'}35`,
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
                          <span className="text-[10px] font-medium leading-tight" style={{ color: PLATFORM_COLORS[p.type] || '#9ca3af' }}>
                            {p.title}
                          </span>
                          <span className="text-[9px] text-zinc-600">{p.status}</span>
                        </button>
                      ))}
                      {/* WIP chips — dashed, shows active work stage */}
                      {projectsWorkingOnDay(day).map((p) => (
                        <button
                          key={`wip-${p.id}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedProject(p) }}
                          className="w-full text-left rounded-lg px-2 py-1.5 transition-opacity hover:opacity-80 flex flex-col gap-1"
                          style={{ background: 'transparent', border: `1px dashed ${PLATFORM_COLORS[p.type] || '#9ca3af'}55`, cursor: 'pointer' }}
                        >
                          <PlatformDot type={p.type} size={5} />
                          <span className="text-[10px] font-medium leading-tight" style={{ color: `${PLATFORM_COLORS[p.type] || '#9ca3af'}bb` }}>
                            {p.title}
                          </span>
                          <span className="text-[9px] text-zinc-600">{p.status} · WIP</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {Object.entries(PLATFORM_COLORS).map(([platform, color]) => (
              <div key={platform} className="flex items-center gap-1.5">
                <PlatformDot type={platform} size={8} />
                <span className="text-xs text-zinc-500 capitalize">
                  {platform === 'newsletter' ? 'Newsletter' : platform.charAt(0).toUpperCase() + platform.slice(1)}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-2 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#fbbf24' }}>B</span>
              <span className="text-xs text-zinc-500">Brand Deal</span>
            </div>
            <div className="flex items-center gap-1.5 ml-2 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ display: 'inline-block', width: 16, height: 10, borderRadius: 2, border: '1px dashed rgba(156,163,175,0.5)', background: 'transparent' }} />
              <span className="text-xs text-zinc-500">Work Day</span>
            </div>
          </div>

          {/* Weekly Agenda */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-white uppercase tracking-widest mb-4">
              This Week's Agenda
              <span className="text-zinc-600 ml-2 text-xs normal-case font-normal">
                {format(agendaStart, 'MMM d')} – {format(agendaEnd, 'MMM d')}
              </span>
            </h3>
            <div className="flex flex-col gap-1">
              {agendaDays.map((day) => {
                const dayProjects = projectsOnDay(day)
                const today = isToday(day)
                return (
                  <div
                    key={day.toISOString()}
                    className="flex gap-4 items-start py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div className={`w-16 shrink-0 text-right ${today ? 'text-amber-400' : 'text-zinc-600'}`}>
                      <p className="text-xs font-semibold uppercase tracking-widest">{format(day, 'EEE')}</p>
                      <p className="text-sm font-bold">{format(day, 'd')}</p>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      {dayProjects.length === 0 ? (
                        <p className="text-xs text-zinc-700 py-1">—</p>
                      ) : (
                        dayProjects.map((p) => (
                          <button
                            key={p.id}
                            draggable={canReschedule}
                            onDragStart={(e) => handleChipDragStart(e, p.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedProject(p)}
                            className="flex items-center gap-2 text-left w-full rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
                            style={{ border: '1px solid rgba(255,255,255,0.07)', cursor: canReschedule ? 'grab' : 'pointer' }}
                          >
                            <div className="flex items-center gap-1 shrink-0">
                              <PlatformIcon type={p.type} size={13} />
                              {p.crossPostTo && <PlatformIcon type={p.crossPostTo} size={13} />}
                            </div>
                            <span className="text-sm text-white font-medium flex-1 truncate">{p.title}</span>
                            {p.brand && p.brand !== 'Organic' && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                                style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
                              >
                                {p.brand}
                              </span>
                            )}
                            <StatusBadge status={p.status} />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Goals panel — hidden on mobile, shown on desktop */}
        <div className="hidden sm:block">
          {(() => {
            const weeks = view === 'month'
              ? (() => { const w = []; for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7)); return w })()
              : [weekDays]
            return <GoalsPanel weeks={weeks} projects={projects} goals={postingGoals} />
          })()}
        </div>

        {/* Side panel — hidden on mobile (shown as bottom sheet below instead) */}
        {selectedDay && (
          <div className="hidden sm:block w-72 shrink-0 animate-fade-in">
            <div
              className="sticky top-24 rounded-2xl overflow-hidden"
              style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div>
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
                    {format(selectedDay, 'EEE, MMM d')}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {projectsOnDay(selectedDay).length === 0
                      ? 'No projects'
                      : `${projectsOnDay(selectedDay).length} project${projectsOnDay(selectedDay).length > 1 ? 's' : ''}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10"
                  style={{ color: '#52525b' }}
                >
                  <X size={12} />
                </button>
              </div>

              <div className="p-3 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                {projectsOnDay(selectedDay).length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-6">Nothing scheduled for this day</p>
                ) : (
                  projectsOnDay(selectedDay).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProject(p); setSelectedDay(null) }}
                      className="w-full text-left rounded-xl p-3 transition-colors hover:bg-white/[0.03]"
                      style={{ border: `1px solid ${PLATFORM_COLORS[p.type] || '#9ca3af'}25`, background: `${PLATFORM_COLORS[p.type] || '#9ca3af'}08` }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <PlatformIcon type={p.type} size={13} />
                        <span className="text-sm font-semibold text-white truncate flex-1">{p.title}</span>
                        {p.brand && p.brand !== 'Organic' && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}
                          >
                            Brand Deal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={p.status} />
                        {p.brand && p.brand !== 'Organic' && (
                          <span className="text-[10px] text-zinc-500">{p.brand}</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile-only: selected day bottom sheet */}
      {selectedDay && (
        <div className="sm:hidden mt-4 rounded-2xl overflow-hidden animate-fade-in"
          style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
              {format(selectedDay, 'EEE, MMM d')} · {projectsOnDay(selectedDay).length === 0 ? 'Nothing scheduled' : `${projectsOnDay(selectedDay).length} project${projectsOnDay(selectedDay).length > 1 ? 's' : ''}`}
            </p>
            <button onClick={() => setSelectedDay(null)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10" style={{ color: '#52525b' }}>
              <X size={12} />
            </button>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {projectsOnDay(selectedDay).length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">Nothing scheduled for this day</p>
            ) : (
              projectsOnDay(selectedDay).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProject(p); setSelectedDay(null) }}
                  className="w-full text-left rounded-xl p-3 transition-colors"
                  style={{ border: `1px solid ${PLATFORM_COLORS[p.type] || '#9ca3af'}25`, background: `${PLATFORM_COLORS[p.type] || '#9ca3af'}08` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <PlatformIcon type={p.type} size={13} />
                    <span className="text-sm font-semibold text-white truncate flex-1">{p.title}</span>
                  </div>
                  <StatusBadge status={p.status} />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
