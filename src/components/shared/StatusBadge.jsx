import React from 'react'

const STATUS_COLORS = {
  // Yellow/amber — in motion
  'Filming': { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  'Raw Footage Ready': { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  'Drafting': { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },

  // Blue — editing / in progress
  'Editing in Progress': { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  'In Review': { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },

  // Purple — review waiting
  'Edit Review': { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.3)' },
  'Final Review': { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.3)' },
  'Caption In Review': { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.3)' },

  // Orange — needs action/revision
  'Revision Requested': { bg: 'rgba(249,115,22,0.15)', color: '#fb923c', border: 'rgba(249,115,22,0.3)' },
  'Caption Needed': { bg: 'rgba(249,115,22,0.15)', color: '#fb923c', border: 'rgba(249,115,22,0.3)' },

  // Green — ready / done
  'Ready to Post': { bg: 'rgba(34,197,94,0.15)', color: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  'Ready to Send': { bg: 'rgba(34,197,94,0.15)', color: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  'Scheduled': { bg: 'rgba(34,197,94,0.12)', color: '#86efac', border: 'rgba(34,197,94,0.25)' },

  // Gray — complete
  'Posted': { bg: 'rgba(255,255,255,0.08)', color: '#9ca3af', border: 'rgba(255,255,255,0.12)' },
  'Sent': { bg: 'rgba(255,255,255,0.08)', color: '#9ca3af', border: 'rgba(255,255,255,0.12)' },
}

export default function StatusBadge({ status, className = '' }) {
  const style = STATUS_COLORS[status] || {
    bg: 'rgba(255,255,255,0.08)',
    color: '#9ca3af',
    border: 'rgba(255,255,255,0.12)',
  }

  return (
    <span
      className={`status-badge ${className}`}
      style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {status}
    </span>
  )
}
