import React, { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, addDays, isSameMonth, isSameDay,
  isToday, format,
} from 'date-fns'

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/**
 * DateTimePicker
 *
 * Props:
 *   value       – ISO datetime string or ''
 *   onChange    – called with a new ISO datetime string when confirmed
 *   onClose     – called when the picker should be dismissed
 */
export default function DateTimePicker({ value, onChange, onClose }) {
  const ref = useRef(null)

  // Parse initial value
  const initial = value ? new Date(value) : new Date()
  const [viewMonth, setViewMonth] = useState(startOfMonth(initial))
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null)

  // Time state
  const initHour = value ? (new Date(value).getHours() % 12 || 12) : 12
  const initMin  = value ? new Date(value).getMinutes() : 0
  const initAmPm = value ? (new Date(value).getHours() >= 12 ? 'PM' : 'AM') : 'AM'
  const [hour,  setHour]  = useState(initHour)
  const [minute, setMinute] = useState(initMin)
  const [ampm,  setAmpm]  = useState(initAmPm)

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [onClose])

  // Build calendar grid — 6 rows of 7 days
  function buildDays() {
    const start = startOfWeek(startOfMonth(viewMonth))
    const end   = endOfWeek(endOfMonth(viewMonth))
    const days  = []
    let cur = start
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1) }
    return days
  }

  function handleConfirm() {
    if (!selectedDate) return
    let h = hour % 12
    if (ampm === 'PM') h += 12
    const dt = new Date(selectedDate)
    dt.setHours(h, minute, 0, 0)
    onChange(dt.toISOString())
    onClose()
  }

  const days = buildDays()

  return (
    <div
      ref={ref}
      className="animate-fade-in"
      style={{
        background:   '#18181c',
        border:       '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        boxShadow:    '0 24px 48px rgba(0,0,0,0.5)',
        width:        280,
        overflow:     'hidden',
        userSelect:   'none',
      }}
    >
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={() => setViewMonth(m => subMonths(m, 1))}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ color: '#71717a' }}>
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-white">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewMonth(m => addMonths(m, 1))}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ color: '#71717a' }}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3 pt-3 pb-1">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: '#52525b' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-3">
        {days.map((day, i) => {
          const inMonth  = isSameMonth(day, viewMonth)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const todayDay = isToday(day)
          const isPast   = day < new Date(new Date().setHours(0,0,0,0))

          return (
            <button
              key={i}
              disabled={isPast && !isSelected}
              onClick={() => setSelectedDate(day)}
              className="flex items-center justify-center rounded-lg transition-all"
              style={{
                height: 32,
                fontSize: 12,
                fontWeight: isSelected ? 700 : todayDay ? 600 : 400,
                background: isSelected
                  ? 'rgba(96,165,250,0.25)'
                  : todayDay && !isSelected
                    ? 'rgba(255,255,255,0.06)'
                    : 'transparent',
                border: isSelected
                  ? '1px solid rgba(96,165,250,0.5)'
                  : todayDay && !isSelected
                    ? '1px solid rgba(255,255,255,0.1)'
                    : '1px solid transparent',
                color: isSelected
                  ? '#93c5fd'
                  : !inMonth || (isPast && !isSelected)
                    ? '#3f3f46'
                    : todayDay
                      ? '#e4e4e7'
                      : '#a1a1aa',
                cursor: isPast && !isSelected ? 'default' : 'pointer',
              }}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {/* Time picker */}
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest mr-1">Time</span>

        {/* Hour */}
        <input
          type="number"
          min={1} max={12}
          value={hour}
          onChange={e => setHour(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
          className="text-sm font-semibold text-white text-center rounded-lg"
          style={{
            width: 40, padding: '4px 0',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            outline: 'none',
          }}
        />
        <span className="text-zinc-500 font-bold text-sm">:</span>

        {/* Minute */}
        <input
          type="number"
          min={0} max={59}
          value={String(minute).padStart(2, '0')}
          onChange={e => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
          className="text-sm font-semibold text-white text-center rounded-lg"
          style={{
            width: 40, padding: '4px 0',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            outline: 'none',
          }}
        />

        {/* AM / PM toggle */}
        <div className="flex rounded-lg overflow-hidden ml-1"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {['AM', 'PM'].map(p => (
            <button
              key={p}
              onClick={() => setAmpm(p)}
              className="text-xs font-semibold px-2.5 py-1 transition-colors"
              style={{
                background: ampm === p ? 'rgba(96,165,250,0.2)' : 'transparent',
                color:      ampm === p ? '#93c5fd' : '#52525b',
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          disabled={!selectedDate}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: selectedDate ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
            border:     selectedDate ? '1px solid rgba(96,165,250,0.3)' : '1px solid rgba(255,255,255,0.08)',
            color:      selectedDate ? '#60a5fa' : '#3f3f46',
            cursor:     selectedDate ? 'pointer' : 'default',
          }}>
          Confirm
        </button>
      </div>
    </div>
  )
}
