import React from 'react'

const OPTIONS = [
  { id: 'due_date', label: 'Due Date' },
  { id: 'recent',   label: 'Recent'   },
  { id: 'brand',    label: 'Brand Deal' },
]

export function sortProjects(list, sortBy) {
  if (sortBy === 'due_date') {
    return [...list].sort((a, b) => {
      if (!a.publishDate && !b.publishDate) return 0
      if (!a.publishDate) return 1
      if (!b.publishDate) return -1
      return new Date(a.publishDate) - new Date(b.publishDate)
    })
  }
  if (sortBy === 'brand') {
    return [...list].sort((a, b) => {
      const aB = a.brand && a.brand !== 'Organic' ? 0 : 1
      const bB = b.brand && b.brand !== 'Organic' ? 0 : 1
      return aB - bB
    })
  }
  // 'recent': newest first by createdAt, fallback to publishDate desc
  return [...list].sort((a, b) => {
    const aT = a.createdAt || a.publishDate
    const bT = b.createdAt || b.publishDate
    if (!aT && !bT) return 0
    if (!aT) return 1
    if (!bT) return -1
    return new Date(bT) - new Date(aT)
  })
}

export default function SortBar({ sortBy, setSortBy }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest mr-1">Sort</span>
      {OPTIONS.map(opt => (
        <button
          key={opt.id}
          onClick={() => setSortBy(opt.id)}
          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
          style={
            sortBy === opt.id
              ? { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }
              : { background: 'rgba(255,255,255,0.03)', color: '#52525b', border: '1px solid rgba(255,255,255,0.07)' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
