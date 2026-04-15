import React, { useState } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO, startOfWeek as sowFn,
  endOfWeek as eowFn, eachWeekOfInterval,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import StatusBadge from './shared/StatusBadge'
import { PlatformIcon, PlatformDot } from './shared/Icons'

const PLATFORM_COLORS = {
  youtube: '#ef4444',
  instagram: '#a855f7',
  tiktok: '#14b8a6',
  newsletter: '#f59e0b',
}

export default function Calendar() {
  const { projects, setSelectedProject } = useApp()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [view, setView] = useState('month') // 'month' | 'week'
  const [sideProject, setSideProject] = useState(null)

  // Projects with a publish date (exclude posted/sent for clutter)
  const activeProjects = projects.filter(p => p.publishDate)

  function projectsOnDay(date) {
    return activeProjects.filter(p => {
      try {
        return isSameDay(parseISO(p.publishDate), date)
      } catch {
        return false
      }
    })
  }

  // Month view
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Week view
  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentMonth, { weekStartsOn: 0 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Weekly agenda (current week)
  const agendaStart = startOfWeek(new Date(), { weekStartsOn: 0 })
  const agendaEnd = endOfWeek(new Date(), { weekStartsOn: 0 })
  const agendaDays = eachDayOfInterval({ start: agendaStart, end: agendaEnd })

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  function DayCell({ date }) {
    const dayProjects = projectsOnDay(date)
    const inMonth = isSameMonth(date, currentMonth)
    const today = isToday(date)

    return (
      <div className={`cal-day ${today ? 'today' : ''}`}
        style={{ opacity: inMonth ? 1 : 0.3 }}>
        <div className={`text-xs font-semibold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${today ? 'text-zinc-900' : 'text-zinc-500'}`}
          style={today ? { background: '#f59e0b' } : {}}>
          {format(date, 'd')}
        </div>
        <div className="flex flex-col gap-1">
          {dayProjects.slice(0, 3).map(p => (
            <button
              key={p.id}
              onClick={() => setSideProject(p)}
              className="flex items-center gap-1 text-left w-full rounded px-1 py-0.5 transition-opacity hover:opacity-80"
              style={{
                background: `${PLATFORM_COLORS[p.type]}18`,
                border: `1px solid ${PLATFORM_COLORS[p.type]}30`,
              }}
            >
              <PlatformDot type={p.type} size={5} />
              <span className="text-[9px] font-medium truncate" style={{ color: PLATFORM_COLORS[p.type] }}>
                {p.title}
              </span>
            </button>
          ))}
          {dayProjects.length > 3 && (
            <span className="text-[9px] text-zinc-600 pl-1">+{dayProjects.length - 3} more</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-white">Content Calendar</h1>
          <p className="text-zinc-500 text-sm mt-1">{format(currentMonth, 'MMMM yyyy')}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {['month', 'week'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-4 py-2 text-xs font-semibold capitalize transition-all"
                style={view === v
                  ? { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }
                  : { background: 'transparent', color: '#71717a' }}>
                {v}
              </button>
            ))}
          </div>

          {/* Month nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ color: '#71717a', border: '1px solid rgba(255,255,255,0.1)' }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors hover:bg-white/10"
              style={{ color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
              Today
            </button>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ color: '#71717a', border: '1px solid rgba(255,255,255,0.1)' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-600 py-2">
                {d}
              </div>
            ))}
          </div>

          {view === 'month' ? (
            <div className="grid grid-cols-7 gap-1">
              {days.map(day => (
                <DayCell key={day.toISOString()} date={day} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(day => (
                <DayCell key={day.toISOString()} date={day} />
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {Object.entries(PLATFORM_COLORS).map(([platform, color]) => (
              <div key={platform} className="flex items-center gap-1.5">
                <PlatformDot type={platform} size={8} />
                <span className="text-xs text-zinc-500 capitalize">{platform === 'newsletter' ? 'Newsletter' : platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
              </div>
            ))}
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
              {agendaDays.map(day => {
                const dayProjects = projectsOnDay(day)
                const today = isToday(day)
                return (
                  <div key={day.toISOString()}
                    className="flex gap-4 items-start py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className={`w-16 shrink-0 text-right ${today ? 'text-amber-400' : 'text-zinc-600'}`}>
                      <p className="text-xs font-semibold uppercase tracking-widest">{format(day, 'EEE')}</p>
                      <p className="text-sm font-bold">{format(day, 'd')}</p>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      {dayProjects.length === 0 ? (
                        <p className="text-xs text-zinc-700 py-1">—</p>
                      ) : (
                        dayProjects.map(p => (
                          <button key={p.id} onClick={() => setSideProject(p)}
                            className="flex items-center gap-2 text-left w-full rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
                            style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                            <PlatformIcon type={p.type} size={13} />
                            <span className="text-sm text-white font-medium flex-1 truncate">{p.title}</span>
                            {p.brand && (
                              <span className="text-[10px] text-zinc-600">{p.brand}</span>
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

        {/* Side panel */}
        {sideProject && (
          <div className="w-72 shrink-0 animate-fade-in">
            <div className="sticky top-24 rounded-2xl overflow-hidden"
              style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2">
                  <PlatformIcon type={sideProject.type} size={14} />
                  <span className="text-sm font-semibold text-white truncate">{sideProject.title}</span>
                </div>
                <button onClick={() => setSideProject(null)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10"
                  style={{ color: '#52525b' }}>
                  <X size={12} />
                </button>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <StatusBadge status={sideProject.status} />
                {sideProject.brand && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-0.5">Brand</p>
                    <p className="text-sm text-white">{sideProject.brand}</p>
                  </div>
                )}
                {sideProject.publishDate && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-0.5">Publish Date</p>
                    <p className="text-sm text-white">{format(parseISO(sideProject.publishDate), 'MMMM d, yyyy')}</p>
                  </div>
                )}
                {sideProject.notes && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-0.5">Notes</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{sideProject.notes}</p>
                  </div>
                )}
                <button
                  onClick={() => { setSelectedProject(sideProject); setSideProject(null) }}
                  className="btn-amber w-full py-2 text-xs mt-1"
                >
                  Open Project →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
