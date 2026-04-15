import React, { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatDistanceToNow } from 'date-fns'

export default function Notifications() {
  const { notifications, currentUser, unreadCount, markNotificationsRead, setSelectedProject, projects } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const myNotifs = notifications.filter(
    (n) => n.forUser === currentUser?.id || n.forUser === 'all'
  )
  const count = unreadCount(currentUser?.id)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen() {
    setOpen((v) => !v)
    if (!open) markNotificationsRead(currentUser?.id)
  }

  function handleNotifClick(notif) {
    const proj = projects.find((p) => p.id === notif.projectId)
    if (proj) setSelectedProject(proj)
    setOpen(false)
  }

  const notifIcon = (type) => {
    if (type === 'edit_complete') return '✂️'
    if (type === 'caption_submitted') return '✍️'
    if (type === 'scheduled_tomorrow') return '📅'
    if (type === 'revision_requested') return '↩️'
    if (type === 'caption_approved') return '✅'
    return '🔔'
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
        style={{ background: open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <Bell size={16} className="text-zinc-400" />
        {count > 0 && <span className="notif-dot" />}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 z-50 w-80 rounded-xl overflow-hidden shadow-2xl animate-fade-in"
          style={{ background: '#1a1a22', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="font-semibold text-sm text-white">Notifications</span>
            {count > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                {count} new
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {myNotifs.length === 0 ? (
              <div className="py-10 text-center text-zinc-600 text-sm">
                No notifications yet
              </div>
            ) : (
              myNotifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className="w-full text-left px-4 py-3 flex gap-3 items-start transition-colors hover:bg-white/5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span className="text-base shrink-0 mt-0.5">{notifIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 leading-relaxed">{n.message}</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
