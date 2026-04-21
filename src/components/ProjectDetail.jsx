import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, ExternalLink, ChevronRight, AlertCircle, Trash2, Upload, Download, Maximize2, Minimize2, Copy, Check } from 'lucide-react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { useApp } from '../context/AppContext'
import { CONTENT_TYPES, TYPE_LABELS } from '../data/seedData'
import StatusBadge from './shared/StatusBadge'
import { PlatformIcon } from './shared/Icons'

// Mapping: stage-owner key → DB role
const OWNER_ROLE = { joel: 'admin', anthony: 'editor', tiana: 'social_manager' }

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ stages, status }) {
  const currentIdx = stages.indexOf(status)
  const safeIdx    = Math.max(0, currentIdx)
  const pct        = stages.length > 1 ? ((safeIdx + 1) / stages.length) * 100 : 100

  return (
    <div>
      <div className="flex gap-1 items-center mb-2">
        {stages.map((stage, i) => (
          <div
            key={stage}
            title={stage}
            className={`progress-stage ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : ''}`}
          />
        ))}
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#f59e0b', borderRadius: 2, transition: 'width 400ms ease' }} />
      </div>
    </div>
  )
}

// ── Timeline Entry ─────────────────────────────────────────────────────────────

function TimelineEntry({ entry, getTeamName }) {
  const name    = getTeamName(entry.changedBy)
  const initial = name ? name[0].toUpperCase() : '?'

  return (
    <div className="flex gap-3 items-start">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
        style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-white">{name}</span>
          <ChevronRight size={10} className="text-zinc-600" />
          <StatusBadge status={entry.status} />
        </div>
        {entry.note && <p className="text-xs text-zinc-500 mt-1 italic">"{entry.note}"</p>}
        <p className="text-xs text-zinc-600 mt-0.5">
          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}

// ── Local project meta (localStorage) ────────────────────────────────────────

const PROJ_META_KEY = (id) => `storyboard_proj_meta_${id}`

function getLocalProjMeta(id) {
  try { return JSON.parse(localStorage.getItem(PROJ_META_KEY(id))) || {} }
  catch { return {} }
}

function saveLocalProjMeta(id, updates) {
  const current = getLocalProjMeta(id)
  localStorage.setItem(PROJ_META_KEY(id), JSON.stringify({ ...current, ...updates }))
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const {
    selectedProject, setSelectedProject,
    currentUser, updateProject, advanceStatus, overrideStatus, changePlatform,
    addNotification, deleteProject, addBanner,
    projects, teamMembers, getTeamName, getMemberByRole, getWorkflow, getStageOwner,
    permissions,
  } = useApp()

  const [proj, setProj]                           = useState(null)
  const [editTitle, setEditTitle]                 = useState('')
  const [editBrand, setEditBrand]                 = useState('')
  const [editBrandType, setEditBrandType]         = useState('Organic')
  const [editBrandName, setEditBrandName]         = useState('')
  const [editDate, setEditDate]                   = useState('')
  const [editDropbox, setEditDropbox]             = useState('')
  const [editAsana, setEditAsana]                 = useState('')
  const [editVideoBreakdown, setEditVideoBreakdown] = useState('')
  const [editCaption, setEditCaption]             = useState('')
  const [captionSaved, setCaptionSaved]           = useState(false)
  const [captionCopied, setCaptionCopied]         = useState(false)
  // Script as structured blocks (Feature 8)
  const [scriptBlocks, setScriptBlocks]           = useState([])
  const [scriptUnsaved, setScriptUnsaved]         = useState(false)
  const [scriptSavedAt, setScriptSavedAt]         = useState(null)
  // Shot list with debounce (Feature 7)
  const [shotListDraft, setShotListDraft]         = useState([])
  const [shotListSavedAt, setShotListSavedAt]     = useState(null)
  const [revisionNote, setRevisionNote]           = useState('')
  const [showRevisionInput, setShowRevisionInput] = useState(false)
  const [scheduledTime, setScheduledTime]         = useState('')
  const [showScheduleInput, setShowScheduleInput] = useState(false)
  const [confirmDelete, setConfirmDelete]         = useState(false)
  const [titleError, setTitleError]               = useState('')
  // Override stage
  const [overrideStage, setOverrideStage]         = useState('')
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false)
  // Change content type (Feature 6)
  const [editType, setEditType]                   = useState('')
  const [showTypeConfirm, setShowTypeConfirm]     = useState(false)
  // Expand to fullscreen
  const [expanded, setExpanded]                   = useState(false)
  // Relevant Notes
  const [editRelevantNotes, setEditRelevantNotes] = useState('')
  // Brand deal links
  const [brandLinks, setBrandLinks]               = useState([])
  // Script hide toggle
  const [hideScript, setHideScript]               = useState(false)
  // Asana hide toggle
  const [hideAsana, setHideAsana]                 = useState(false)

  const captionTimerRef    = useRef(null)
  const scriptTimerRef     = useRef(null)
  const shotTimerRef       = useRef(null)
  const thumbInputRef      = useRef(null)
  const loadedProjectIdRef = useRef(null)  // tracks which project is currently loaded
  const scriptDirtyRef     = useRef(false) // true while user has unsaved script changes
  const shotDirtyRef       = useRef(false) // true while user has unsaved shot list changes

  // Parse legacy plain-text script or JSON blocks (Feature 8 backward compat)
  function parseScriptBlocks(notesStr) {
    if (!notesStr) return [{ id: 'b_' + Date.now(), scriptLine: '', shotNote: '' }]
    try {
      const parsed = JSON.parse(notesStr)
      if (Array.isArray(parsed) && parsed.length > 0 && 'scriptLine' in parsed[0]) return parsed
    } catch (_) {}
    // Legacy plain text → single row
    return [{ id: 'b_' + Date.now(), scriptLine: notesStr, shotNote: '' }]
  }

  // Sync local state when selectedProject changes
  useEffect(() => {
    if (!selectedProject) return
    const fresh = projects.find((p) => p.id === selectedProject.id) || selectedProject
    setProj(fresh)

    const isNewProject = loadedProjectIdRef.current !== fresh.id
    if (isNewProject) {
      // Full reset — new project opened
      loadedProjectIdRef.current = fresh.id
      scriptDirtyRef.current = false
      shotDirtyRef.current   = false
      setEditTitle(fresh.title)
      setEditType(fresh.type)
      setShowTypeConfirm(false)
      if (!fresh.brand || fresh.brand === 'Organic') {
        setEditBrandType('Organic')
        setEditBrandName('')
      } else {
        setEditBrandType('Brand Deal')
        setEditBrandName(fresh.brand)
      }
      setEditDate(fresh.publishDate || '')
      setEditDropbox(fresh.dropboxLink || '')
      setEditAsana(fresh.asanaLink || '')
      setEditVideoBreakdown(fresh.videoBreakdown || '')
      setEditCaption(fresh.caption || '')
      setScriptBlocks(parseScriptBlocks(fresh.notes))
      setScriptSavedAt(null)
      setScriptUnsaved(false)
      setShotListDraft(fresh.shotList || [])
      setShotListSavedAt(null)
      setScheduledTime(fresh.scheduledTime || '')
      setOverrideStage(fresh.status)
      setShowRevisionInput(false)
      setShowScheduleInput(false)
      setShowOverrideConfirm(false)
      setRevisionNote('')
      setConfirmDelete(false)
      setCaptionSaved(false)
      setTitleError('')
      const meta = getLocalProjMeta(fresh.id)
      setEditRelevantNotes(meta.relevantNotes || '')
      setBrandLinks(meta.brandLinks || [])
      setHideScript(meta.hideScript || false)
      setHideAsana(meta.hideAsana || false)
    } else {
      // Same project updated (e.g. title/date save) — only sync non-editing fields
      setEditTitle(fresh.title)
      setOverrideStage(fresh.status)
      // Only reset script/shot if the user has no pending edits
      if (!scriptDirtyRef.current) {
        setScriptBlocks(parseScriptBlocks(fresh.notes))
        setScriptSavedAt(null)
        setScriptUnsaved(false)
      }
      if (!shotDirtyRef.current) {
        setShotListDraft(fresh.shotList || [])
        setShotListSavedAt(null)
      }
    }
  }, [selectedProject, projects])

  if (!selectedProject || !proj) return null

  const isJoel    = currentUser?.role === 'admin' || currentUser?.role === 'creator'
  const isAnthony = currentUser?.role === 'editor'
  const isTiana   = currentUser?.role === 'social_manager' || currentUser?.role === 'social'

  const workflow        = getWorkflow(proj.type)
  const stageOwnerKey   = getStageOwner(proj.type, proj.status)
  const ownerMember     = teamMembers.find((m) => m.role === OWNER_ROLE[stageOwnerKey])

  // Parallel stages — if activeStages has more than one entry, show all their owners
  const activeStages    = (proj.activeStages?.length > 1) ? proj.activeStages : [proj.status]
  const parallelOwners  = activeStages.map((stage) => {
    const ownerKey = getStageOwner(proj.type, stage)
    const member   = teamMembers.find((m) => m.role === OWNER_ROLE[ownerKey])
    return { stage, member }
  }).filter((x) => x.member)

  // Dropbox or Google Drive label
  const storageLabel       = (proj.type === 'instagram' || proj.type === 'tiktok') ? 'Google Drive Link'      : proj.type === 'newsletter' ? null : 'Dropbox Link'
  const storagePlaceholder = (proj.type === 'instagram' || proj.type === 'tiktok') ? 'https://drive.google.com/…' : 'https://dropbox.com/…'

  // Derived brand string for saving
  const brandValue = editBrandType === 'Brand Deal' ? (editBrandName.trim() || 'Brand Deal') : 'Organic'

  // ── Save helpers ────────────────────────────────────────────────────────────

  function saveEdits(extra = {}) {
    updateProject(proj.id, {
      title:      editTitle,
      brand:      brandValue,
      publishDate: editDate,
      dropboxLink: editDropbox,
      asanaLink:  editAsana,
      ...extra,
    })
  }

  function handleTitleBlur() {
    const titleLower = editTitle.trim().toLowerCase()
    const isDupe = projects.some(
      (p) => p.id !== proj.id && p.type === proj.type && p.title.trim().toLowerCase() === titleLower
    )
    if (isDupe) {
      setTitleError(`A ${TYPE_LABELS[proj.type]} project with this name already exists.`)
      setEditTitle(proj.title) // revert
      return
    }
    setTitleError('')
    saveEdits()
  }

  function saveCaption() {
    updateProject(proj.id, { caption: editCaption })
    setCaptionSaved(true)
    if (captionTimerRef.current) clearTimeout(captionTimerRef.current)
    captionTimerRef.current = setTimeout(() => setCaptionSaved(false), 2000)
  }

  // Script blocks auto-save with 800ms debounce
  function handleScriptBlocksChange(newBlocks) {
    setScriptBlocks(newBlocks)
    setScriptUnsaved(true)
    scriptDirtyRef.current = true
    if (scriptTimerRef.current) clearTimeout(scriptTimerRef.current)
    scriptTimerRef.current = setTimeout(() => {
      updateProject(proj.id, { notes: JSON.stringify(newBlocks) })
      setScriptSavedAt(new Date().toISOString())
      setScriptUnsaved(false)
      scriptDirtyRef.current = false
    }, 800)
  }

  // Shot list debounced save
  function handleShotListChange(newList) {
    setShotListDraft(newList)
    shotDirtyRef.current = true
    if (shotTimerRef.current) clearTimeout(shotTimerRef.current)
    shotTimerRef.current = setTimeout(() => {
      updateProject(proj.id, { shotList: newList })
      setShotListSavedAt(new Date().toISOString())
      shotDirtyRef.current = false
    }, 800)
  }

  function saveVideoBreakdown() {
    updateProject(proj.id, { videoBreakdown: editVideoBreakdown })
  }

  // ── Advance / notifications ─────────────────────────────────────────────────

  function handleAdvance(toStatus, note = null) {
    if (!toStatus) return
    advanceStatus(proj.id, toStatus, currentUser.id, note)

    const joelId    = getMemberByRole('admin')?.id
    const anthonyId = getMemberByRole('editor')?.id
    const tianaId   = getMemberByRole('social_manager')?.id

    // Known stage-specific messages (preserve existing wording)
    if (toStatus === 'Edit Review') {
      const msg = `${getTeamName(currentUser.id)} marked "${proj.title}" as done — ready for your review`
      addNotification({ message: msg, projectId: proj.id, forUser: joelId })
      addBanner(msg, 'info')
      return
    }
    if (toStatus === 'Caption In Review') {
      const msg = `${getTeamName(currentUser.id)} submitted a caption for "${proj.title}"`
      addNotification({ message: msg, projectId: proj.id, forUser: joelId })
      addBanner(msg, 'info')
      return
    }
    if (toStatus === 'Revision Requested') {
      const msg = `Joel requested revisions on "${proj.title}"`
      addNotification({ message: msg, projectId: proj.id, forUser: anthonyId })
      addBanner(msg, 'warning')
      return
    }
    if (toStatus === 'Caption Needed') {
      const msg = `"${proj.title}" is ready for a caption`
      addNotification({ message: msg, projectId: proj.id, forUser: tianaId })
      addBanner(msg, 'info')
      return
    }
    if (toStatus === 'Ready to Post') {
      const msg = `Joel approved the caption for "${proj.title}" — ready to post`
      addNotification({ message: msg, projectId: proj.id, forUser: tianaId })
      addBanner(msg, 'success')
      return
    }
    if (toStatus === 'Posted' || toStatus === 'Sent') {
      const msg = `${getTeamName(currentUser.id)} published "${proj.title}"`
      addNotification({ message: msg, projectId: proj.id, forUser: joelId })
      addBanner(msg, 'success')
      return
    }

    // Generic routing for custom/renamed stages: notify whoever owns the new stage
    const newOwner = getStageOwner(proj.type, toStatus)
    const notifyId = newOwner === 'joel'    ? joelId
                   : newOwner === 'anthony' ? anthonyId
                   : newOwner === 'tiana'   ? tianaId
                   : null
    if (notifyId && notifyId !== currentUser.id) {
      const msg = `"${proj.title}" moved to ${toStatus}`
      addNotification({ message: msg, projectId: proj.id, forUser: notifyId })
      addBanner(msg, 'info')
    }
  }

  function handleSchedule() {
    advanceStatus(proj.id, 'Scheduled', currentUser.id)
    updateProject(proj.id, { scheduledTime })
    setShowScheduleInput(false)
  }

  function handleRevision() {
    advanceStatus(proj.id, 'Revision Requested', currentUser.id, revisionNote)
    const anthonyId = getMemberByRole('editor')?.id
    addNotification({
      message:   `Joel requested revisions on "${proj.title}"${revisionNote ? ': ' + revisionNote : ''}`,
      projectId: proj.id,
      forUser:   anthonyId,
    })
    setShowRevisionInput(false)
    setRevisionNote('')
  }

  function handleDelete() {
    deleteProject(proj.id)
    setSelectedProject(null)
  }

  function handleOverrideConfirm() {
    overrideStatus(proj.id, overrideStage, 'Stage overridden by Joel', currentUser.id)
    setShowOverrideConfirm(false)
  }

  // Recall submission — return to the previous stage the recalling user owns
  function handleRecall() {
    const myOwnerKey  = isAnthony ? 'anthony' : 'tiana'
    const currentIdx  = workflow.indexOf(proj.status)
    // Walk backwards through the workflow to find the last stage this user owns
    const myPrevStage = [...workflow.slice(0, currentIdx)].reverse()
      .find((stage) => getStageOwner(proj.type, stage) === myOwnerKey)
    // Hardcoded fallbacks for safety if the workflow has changed
    const fallback    = isAnthony ? 'Editing in Progress' : 'Caption Needed'
    const prevStatus  = myPrevStage || fallback
    const note        = `${getTeamName(currentUser.id)} recalled submission`
    advanceStatus(proj.id, prevStatus, currentUser.id, note)
    addBanner(note, 'info')
  }

  // Change content type (Feature 6)
  function handleTypeChange() {
    if (editType === proj.type) return
    changePlatform(proj.id, editType, currentUser.id)
    addBanner(`Platform changed to ${TYPE_LABELS[editType] || editType} — workflow reset`, 'info')
    setShowTypeConfirm(false)
  }

  // ── Thumbnails ─────────────────────────────────────────────────────────────

  function handleThumbnailUpload(e) {
    const files = Array.from(e.target.files)
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const newThumb = { id: `t${Date.now()}_${Math.random().toString(36).slice(2)}`, label: file.name, data: ev.target.result }
        const updated  = [...(proj.thumbnails || []), newThumb]
        updateProject(proj.id, { thumbnails: updated })
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function removeThumbnail(id) {
    const updated = (proj.thumbnails || []).filter((t) => t.id !== id)
    updateProject(proj.id, { thumbnails: updated })
  }

  function updateThumbnailLabel(id, label) {
    const updated = (proj.thumbnails || []).map((t) => t.id === id ? { ...t, label } : t)
    updateProject(proj.id, { thumbnails: updated })
  }

  // ── PDF Export ─────────────────────────────────────────────────────────────

  async function handlePDFExport() {
    try {
      // Ensure jsPDF is loaded (CDN in index.html)
      const { jsPDF } = window.jspdf || {}
      if (!jsPDF) { alert('PDF library not loaded. Please refresh.'); return }

      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const W   = doc.internal.pageSize.getWidth()
      let y     = 40

      // Title block
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text(proj.title, 40, y); y += 28

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(100)
      const meta = [
        `Platform: ${TYPE_LABELS[proj.type] || proj.type}`,
        proj.brand && proj.brand !== 'Organic' ? `Brand: ${proj.brand}` : null,
        proj.publishDate ? `Publish: ${format(parseISO(proj.publishDate), 'MMMM d, yyyy')}` : null,
        `Status: ${proj.status}`,
      ].filter(Boolean).join('   ·   ')
      doc.text(meta, 40, y); y += 20
      doc.setTextColor(0)

      // Divider
      doc.setDrawColor(200)
      doc.line(40, y, W - 40, y); y += 16

      // Relevant Notes
      if (editRelevantNotes && editRelevantNotes.trim()) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text('Notes', 40, y); y += 16
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        const noteLines = doc.splitTextToSize(editRelevantNotes.trim(), W - 80)
        doc.text(noteLines, 40, y); y += noteLines.length * 13 + 16
        doc.setDrawColor(220)
        doc.line(40, y, W - 40, y); y += 16
      }

      // Script (handle JSON blocks or plain text)
      if (proj.notes) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text('Script / Notes', 40, y); y += 16

        try {
          const parsed = JSON.parse(proj.notes)
          if (Array.isArray(parsed) && parsed.length > 0 && 'scriptLine' in parsed[0]) {
            // Structured blocks → two-column table
            const hasShots = parsed.some((b) => b.shotNote)
            doc.autoTable({
              startY: y,
              margin: { left: 40, right: 40 },
              head: [hasShots ? ['Script Line', 'Shot / Visual'] : ['Script Line']],
              body: parsed.map((b) => hasShots ? [b.scriptLine || '', b.shotNote || ''] : [b.scriptLine || '']),
              styles: { fontSize: 9, cellPadding: 4 },
              headStyles: { fillColor: [40, 40, 48], textColor: [180, 180, 180] },
              columnStyles: hasShots ? { 0: { cellWidth: 250 }, 1: { cellWidth: 'auto', fontStyle: 'italic' } } : {},
            })
            y = doc.lastAutoTable.finalY + 16
          } else {
            throw new Error('not blocks')
          }
        } catch (_) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          const lines = doc.splitTextToSize(proj.notes, W - 80)
          doc.text(lines, 40, y); y += lines.length * 13 + 10
        }
      }

      // Shot list
      if ((proj.shotList || []).length > 0) {
        if (y > 700) { doc.addPage(); y = 40 }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text('Shot List', 40, y); y += 10

        doc.autoTable({
          startY:    y,
          margin:    { left: 40, right: 40 },
          head:      [['#', 'Description', 'Type', 'Notes']],
          body:      (proj.shotList || []).map((s, i) => [i + 1, s.desc, s.type, s.notes]),
          styles:    { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0] },
        })
        y = doc.lastAutoTable.finalY + 16
      }

      // Caption
      if (proj.caption) {
        if (y > 700) { doc.addPage(); y = 40 }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text('Caption', 40, y); y += 16
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        const lines = doc.splitTextToSize(proj.caption, W - 80)
        doc.text(lines, 40, y); y += lines.length * 13 + 10
      }

      // Thumbnails
      if ((proj.thumbnails || []).length > 0) {
        if (y > 600) { doc.addPage(); y = 40 }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text('Thumbnails', 40, y); y += 16

        let x = 40
        for (const thumb of proj.thumbnails) {
          try {
            const imgW = 150, imgH = 90
            if (x + imgW > W - 40) { x = 40; y += imgH + 24 }
            if (y + imgH > 760) { doc.addPage(); y = 40; x = 40 }
            doc.addImage(thumb.data, 'JPEG', x, y, imgW, imgH)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            doc.text(thumb.label || '', x, y + imgH + 12, { maxWidth: imgW })
            x += imgW + 16
          } catch (_) {}
        }
        y += 110
      }

      const slug = proj.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)
      doc.save(`${slug}_script.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('PDF export failed. Check console for details.')
    }
  }

  // ── Action button ───────────────────────────────────────────────────────────

  function renderActionButton() {
    const s          = proj.status
    const currentIdx = workflow.indexOf(s)
    const nextStage  = (currentIdx >= 0 && currentIdx < workflow.length - 1)
      ? workflow[currentIdx + 1]
      : null
    const currentOwner = getStageOwner(proj.type, s)

    if (isJoel) {
      if (s === 'Filming') {
        const label = workflow.includes('Raw Footage Ready') ? 'Mark Raw Footage Ready' : `Advance → ${nextStage || 'Next Stage'}`
        return <ActionBtn color="amber" onClick={() => handleAdvance(nextStage || 'Raw Footage Ready')}>{label}</ActionBtn>
      }
      if (s === 'Raw Footage Ready') {
        const hasEditing = workflow.includes('Editing in Progress')
        const label = hasEditing ? 'Send to Editing' : `Advance → ${nextStage || 'Next Stage'}`
        return <ActionBtn color="amber" onClick={() => handleAdvance(nextStage || 'Editing in Progress')}>{label}</ActionBtn>
      }
      if (s === 'Edit Review') return (
        <div className="flex flex-col gap-2">
          <ActionBtn color="amber" onClick={() => handleAdvance(nextStage || 'Final Review')}>Approve Edit → Final Review</ActionBtn>
          <button className="btn-ghost px-4 py-2.5 text-sm w-full" onClick={() => setShowRevisionInput((v) => !v)}>
            Request Revision ↩
          </button>
          {showRevisionInput && (
            <div className="animate-fade-in">
              <textarea
                className="w-full rounded-lg text-sm p-3 text-white placeholder-zinc-600 mt-1"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                placeholder="Describe what needs to change…"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                rows={3}
              />
              <ActionBtn color="orange" onClick={handleRevision} className="mt-2">Send Revision Note to Anthony</ActionBtn>
            </div>
          )}
        </div>
      )
      if (s === 'Final Review')
        return <ActionBtn color="amber" onClick={() => handleAdvance(nextStage || 'Caption Needed')}>Approve → Assign Caption</ActionBtn>
      if (s === 'Caption In Review')
        return <ActionBtn color="amber" onClick={() => handleAdvance(nextStage || 'Ready to Post')}>Approve Caption → Ready to Post</ActionBtn>
      if (s === 'Ready to Post') return (
        <div className="flex flex-col gap-2">
          <ActionBtn color="amber" onClick={() => setShowScheduleInput((v) => !v)}>Schedule Post</ActionBtn>
          {showScheduleInput && (
            <div className="animate-fade-in flex flex-col gap-2">
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-lg text-sm p-2.5 text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              <ActionBtn color="amber" onClick={handleSchedule}>Confirm Schedule</ActionBtn>
            </div>
          )}
          <ActionBtn color="green" onClick={() => handleAdvance(nextStage || 'Posted')}>Mark as Posted</ActionBtn>
        </div>
      )
      if (s === 'Scheduled')
        return <ActionBtn color="green" onClick={() => handleAdvance(nextStage || 'Posted')}>Mark as Posted</ActionBtn>
      if (s === 'Drafting')
        return <ActionBtn color="amber" onClick={() => handleAdvance(nextStage || 'In Review')}>Move to In Review</ActionBtn>
      if (s === 'In Review')
        return <ActionBtn color="amber" onClick={() => handleAdvance(nextStage || 'Ready to Send')}>Mark Ready to Send</ActionBtn>
      if (s === 'Ready to Send')
        return <ActionBtn color="green" onClick={() => handleAdvance(nextStage || 'Sent')}>Mark as Sent</ActionBtn>
      if (s === 'Editing in Progress' && (proj.type === 'instagram' || proj.type === 'tiktok'))
        return <ActionBtn color="amber" onClick={() => handleAdvance(nextStage || 'Caption Needed')}>Editing Done → Send to Tiana</ActionBtn>
      // Fallback for any custom stage Joel owns
      if (nextStage && (currentOwner === 'joel' || !currentOwner))
        return <ActionBtn color="amber" onClick={() => handleAdvance(nextStage)}>Advance to Next Stage</ActionBtn>
      return null
    }

    if (isAnthony) {
      if (currentOwner === 'anthony' && nextStage) {
        // Check if this is a "waiting for review" stage (next stage is Joel's)
        const nextOwner = getStageOwner(proj.type, nextStage)
        if (nextOwner === 'joel') {
          return (
            <ActionBtn color="blue" onClick={() => handleAdvance(nextStage)}>
              Mark as Done — Send to Joel for Review
            </ActionBtn>
          )
        }
        return <ActionBtn color="blue" onClick={() => handleAdvance(nextStage)}>Mark as Done</ActionBtn>
      }
      // Waiting for Joel's review (Anthony submitted, now in Joel's stage)
      const prevOwner = currentIdx > 0 ? getStageOwner(proj.type, workflow[currentIdx - 1]) : null
      if (prevOwner === 'anthony') {
        return (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-zinc-500 text-center">Waiting for Joel's review…</p>
            <button onClick={handleRecall} className="btn-ghost w-full text-sm py-2.5">
              ↩ Recall Submission
            </button>
          </div>
        )
      }
    }

    if (isTiana) {
      if (currentOwner === 'tiana' && nextStage) {
        const nextOwner = getStageOwner(proj.type, nextStage)
        if (nextOwner === 'joel') {
          return (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-zinc-500">Write your caption above, then submit for Joel's review.</p>
              <ActionBtn color="purple" onClick={() => { saveCaption(); handleAdvance(nextStage) }}>
                Submit Caption for Review
              </ActionBtn>
            </div>
          )
        }
        return <ActionBtn color="purple" onClick={() => handleAdvance(nextStage)}>Mark as Published</ActionBtn>
      }
      // Waiting for Joel's review (Tiana submitted)
      const prevOwner = currentIdx > 0 ? getStageOwner(proj.type, workflow[currentIdx - 1]) : null
      if (prevOwner === 'tiana') {
        return (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-zinc-500 text-center">Caption submitted — waiting for Joel's review</p>
            <button onClick={handleRecall} className="btn-ghost w-full text-sm py-2.5">
              ↩ Recall Submission
            </button>
          </div>
        )
      }
    }

    return null
  }

  const canEditCaption = isTiana && (proj.status === 'Caption Needed' || permissions?.socialManager?.canAddCaptions)
  const canEditLinks   = isJoel || (isTiana && permissions?.socialManager?.canEditLinks)
  const canEditScript  = isJoel

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end modal-backdrop"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setSelectedProject(null) }}
    >
      <div
        className={`modal-panel h-full w-full ${expanded ? 'max-w-full' : 'max-w-2xl'} overflow-y-auto flex flex-col`}
        style={{ background: '#111115', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* ── Header ── */}
        <div
          className="sticky top-0 z-10 flex items-start justify-between px-6 py-4"
          style={{ background: 'rgba(17,17,21,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <PlatformIcon type={proj.type} size={18} />
            <div className="flex-1 min-w-0">
              {isJoel ? (
                <>
                  <input
                    className="font-editorial text-xl font-semibold text-white bg-transparent border-none outline-none w-full"
                    value={editTitle}
                    onChange={(e) => { setEditTitle(e.target.value); setTitleError('') }}
                    onBlur={handleTitleBlur}
                  />
                  {titleError && <p className="text-red-400 text-xs mt-0.5">{titleError}</p>}
                </>
              ) : (
                <h2 className="font-editorial text-xl font-semibold text-white truncate">{proj.title}</h2>
              )}
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={proj.status} />
                {proj.brand && proj.brand !== 'Organic' && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>
                    {proj.brand}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="ml-4 flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: '#52525b' }}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={() => setSelectedProject(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: '#52525b' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-5 flex flex-col gap-6">

          {/* ── Progress bar ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Workflow Progress</p>
            <ProgressBar stages={workflow} status={proj.status} />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-zinc-500">{workflow[0]}</span>
              <span className="text-xs text-zinc-500">{workflow[workflow.length - 1]}</span>
            </div>
          </div>

          {/* ── Stage owner(s) — supports parallel stages ── */}
          {parallelOwners.length > 0 && (
            <div className="flex flex-col gap-2">
              {parallelOwners.length > 1 && (
                <p className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  {parallelOwners.length} parallel stages active
                </p>
              )}
              {parallelOwners.map(({ stage, member }) => (
                <div
                  key={stage}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                    style={{
                      background: member.avatar_url ? 'transparent' : 'rgba(245,158,11,0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245,158,11,0.3)',
                    }}
                  >
                    {member.avatar_url
                      ? <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                      : (member.avatar || member.name?.[0])}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Currently with</p>
                    <p className="text-sm font-semibold text-white">{member.name}</p>
                  </div>
                  <div className="ml-auto">
                    <StatusBadge status={stage} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Admin Override Stage (Joel only) ── */}
          {isJoel && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Admin Stage Override</p>
              <div className="flex items-center gap-2">
                <select
                  value={overrideStage}
                  onChange={(e) => { setOverrideStage(e.target.value); setShowOverrideConfirm(false) }}
                  className="flex-1 text-sm rounded-lg px-3 py-2 text-white"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }}
                >
                  {workflow.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {overrideStage !== proj.status && (
                  <button
                    onClick={() => setShowOverrideConfirm(true)}
                    className="text-xs px-3 py-2 rounded-lg font-semibold"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}
                  >
                    Override Stage
                  </button>
                )}
              </div>
              {showOverrideConfirm && (
                <div
                  className="mt-2 rounded-lg p-3 flex items-center justify-between gap-3 animate-fade-in"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <p className="text-xs text-amber-300">Force-set to <strong>{overrideStage}</strong>?</p>
                  <div className="flex gap-2">
                    <button onClick={handleOverrideConfirm}
                      className="text-xs px-3 py-1.5 rounded font-semibold"
                      style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                      Confirm
                    </button>
                    <button onClick={() => { setShowOverrideConfirm(false); setOverrideStage(proj.status) }}
                      className="btn-ghost text-xs px-3 py-1.5">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Revision note (if present) ── */}
          {proj.status === 'Revision Requested' && proj.statusHistory && (() => {
            const rev = [...proj.statusHistory].reverse().find((h) => h.status === 'Revision Requested')
            return rev?.note ? (
              <div className="rounded-xl p-3 flex gap-2"
                style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <AlertCircle size={14} className="text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-orange-400 mb-1">Revision Note from Joel</p>
                  <p className="text-sm text-zinc-300">{rev.note}</p>
                </div>
              </div>
            ) : null
          })()}

          {/* ── Project details grid ── */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publish Date">
              {isJoel ? (
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} onBlur={() => saveEdits()}
                  className="text-sm text-white bg-transparent border-none outline-none w-full"
                  style={{ colorScheme: 'dark' }} />
              ) : (
                <span className="text-sm text-white">{proj.publishDate ? format(parseISO(proj.publishDate), 'MMMM d, yyyy') : '—'}</span>
              )}
            </Field>

            <Field label="Brand / Sponsor">
              {isJoel ? (
                <div className="flex flex-col gap-1">
                  <select
                    value={editBrandType}
                    onChange={(e) => setEditBrandType(e.target.value)}
                    onBlur={() => saveEdits()}
                    style={{ background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: 13, padding: 0, outline: 'none' }}
                  >
                    <option value="Organic">Organic</option>
                    <option value="Brand Deal">Brand Deal</option>
                  </select>
                  {editBrandType === 'Brand Deal' && (
                    <input
                      value={editBrandName}
                      onChange={(e) => setEditBrandName(e.target.value)}
                      onBlur={() => saveEdits()}
                      placeholder="Brand name…"
                      className="text-sm text-white bg-transparent border-none outline-none w-full placeholder-zinc-700"
                    />
                  )}
                </div>
              ) : (
                <span className="text-sm text-white">{proj.brand || '—'}</span>
              )}
            </Field>

            <Field label="Content Type" className={proj.type === 'instagram' ? 'col-span-1' : 'col-span-2'}>
              {isJoel ? (
                <div>
                  <div className="flex items-center gap-2">
                    <PlatformIcon type={editType || proj.type} size={14} />
                    <select
                      value={editType}
                      onChange={(e) => { setEditType(e.target.value); setShowTypeConfirm(e.target.value !== proj.type) }}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                    >
                      {Object.entries(CONTENT_TYPES).map(([t, meta]) => (
                        <option key={t} value={t}>{meta.label}</option>
                      ))}
                    </select>
                  </div>
                  {showTypeConfirm && (
                    <div
                      className="mt-2 rounded-lg p-3 animate-fade-in"
                      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      <p className="text-xs text-red-400 mb-2">
                        Changing the platform will reset the workflow stages. Continue?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleTypeChange}
                          className="text-xs px-3 py-1.5 rounded font-semibold"
                          style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                        >
                          Yes, Change Platform
                        </button>
                        <button
                          onClick={() => { setEditType(proj.type); setShowTypeConfirm(false) }}
                          className="btn-ghost text-xs px-3 py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <PlatformIcon type={proj.type} size={14} />
                  <span className="text-sm text-white">{CONTENT_TYPES[proj.type]?.label}</span>
                </div>
              )}
            </Field>
            {/* Instagram Account */}
            {proj.type === 'instagram' && (
              <Field label="Instagram Account">
                {isJoel ? (
                  <select
                    value={editVideoBreakdown}
                    onChange={(e) => { setEditVideoBreakdown(e.target.value); updateProject(proj.id, { videoBreakdown: e.target.value }) }}
                    style={{ background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: 13, outline: 'none' }}
                  >
                    <option value="">Select account</option>
                    <option value="joelroac">joelroac</option>
                    <option value="joelleroa">joelleroa</option>
                  </select>
                ) : (
                  <span className="text-sm text-white">{proj.videoBreakdown || '—'}</span>
                )}
              </Field>
            )}

            {/* Substack Account */}
            {proj.type === 'newsletter' && (
              <Field label="Substack Account" className="col-span-2">
                {isJoel ? (
                  <select
                    value={editVideoBreakdown}
                    onChange={(e) => { setEditVideoBreakdown(e.target.value); updateProject(proj.id, { videoBreakdown: e.target.value }) }}
                    style={{ background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: 13, outline: 'none' }}
                  >
                    <option value="">Select account</option>
                    <option value="joelroac">joelroac</option>
                    <option value="Creative Minds">Creative Minds</option>
                  </select>
                ) : (
                  <span className="text-sm text-white">{proj.videoBreakdown || '—'}</span>
                )}
              </Field>
            )}
          </div>

          {/* ── Storage link + Asana (side by side when both visible) ── */}
          <div className={storageLabel && proj.type !== 'youtube' ? 'grid grid-cols-2 gap-4' : ''}>
            {/* Storage link */}
            {storageLabel && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">{storageLabel}</p>
                {canEditLinks ? (
                  <div>
                    <input
                      value={editDropbox}
                      onChange={(e) => setEditDropbox(e.target.value)}
                      onBlur={() => saveEdits()}
                      placeholder={storagePlaceholder}
                      className="w-full text-sm rounded-lg px-3 py-2 text-zinc-300 placeholder-zinc-700"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                    {editDropbox && (
                      <a href={editDropbox} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 mt-1 transition-colors">
                        <ExternalLink size={11} /> Open link
                      </a>
                    )}
                  </div>
                ) : proj.dropboxLink ? (
                  <a href={proj.dropboxLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors">
                    <ExternalLink size={13} /> {proj.dropboxLink}
                  </a>
                ) : (
                  <span className="text-sm text-zinc-600">No link added</span>
                )}
              </div>
            )}

            {/* Asana link */}
            {proj.type !== 'youtube' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Asana Task</p>
                  {isJoel && (
                    <button onClick={() => { const v = !hideAsana; setHideAsana(v); saveLocalProjMeta(proj.id, { hideAsana: v }) }}
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors ml-2">
                      {hideAsana ? 'Show' : 'Hide'}
                    </button>
                  )}
                </div>
                {!hideAsana && (
                  canEditLinks ? (
                    <div>
                      <input
                        value={editAsana}
                        onChange={(e) => setEditAsana(e.target.value)}
                        onBlur={() => saveEdits()}
                        placeholder="https://app.asana.com/…"
                        className="w-full text-sm rounded-lg px-3 py-2 text-zinc-300 placeholder-zinc-700"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      />
                      {editAsana && (
                        <a href={editAsana} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-amber-500 hover:text-amber-400 mt-1 transition-colors flex items-center gap-1">
                          <ExternalLink size={11} /> Open
                        </a>
                      )}
                    </div>
                  ) : proj.asanaLink ? (
                    <a href={proj.asanaLink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors">
                      <ExternalLink size={13} /> {proj.asanaLink}
                    </a>
                  ) : (
                    <span className="text-sm text-zinc-600">No link added</span>
                  )
                )}
              </div>
            )}
          </div>

          {/* ── Brand Deal Links ── */}
          {editBrandType === 'Brand Deal' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Brand Deal Links</p>
              <div className="flex flex-col gap-2">
                {brandLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={link.label}
                      onChange={(e) => {
                        const updated = brandLinks.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l)
                        setBrandLinks(updated)
                        saveLocalProjMeta(proj.id, { brandLinks: updated })
                      }}
                      placeholder="Label (e.g. Brief, Assets)"
                      className="text-sm rounded-lg px-3 py-2 text-zinc-300 placeholder-zinc-700 w-28"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                    <input
                      value={link.url}
                      onChange={(e) => {
                        const updated = brandLinks.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l)
                        setBrandLinks(updated)
                        saveLocalProjMeta(proj.id, { brandLinks: updated })
                      }}
                      placeholder="https://…"
                      className="flex-1 text-sm rounded-lg px-3 py-2 text-zinc-300 placeholder-zinc-700"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                    {link.url && <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-500 hover:text-amber-400"><ExternalLink size={11} /></a>}
                    {isJoel && (
                      <button onClick={() => {
                        const updated = brandLinks.filter((_, idx) => idx !== i)
                        setBrandLinks(updated)
                        saveLocalProjMeta(proj.id, { brandLinks: updated })
                      }} style={{ color: '#52525b', background: 'none', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
                    )}
                  </div>
                ))}
                {isJoel && (
                  <button onClick={() => {
                    const updated = [...brandLinks, { label: '', url: '' }]
                    setBrandLinks(updated)
                    saveLocalProjMeta(proj.id, { brandLinks: updated })
                  }} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                    + Add Link
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Video Breakdown (YouTube only) ── */}
          {proj.type === 'youtube' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Video Breakdown</p>
              {isJoel || isAnthony ? (
                <textarea
                  value={editVideoBreakdown}
                  onChange={(e) => setEditVideoBreakdown(e.target.value)}
                  onBlur={saveVideoBreakdown}
                  placeholder="Scene timestamps, sections, talking points…"
                  className="w-full text-sm rounded-lg px-3 py-2.5 text-zinc-300 placeholder-zinc-700"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                  rows={4}
                  readOnly={isAnthony}
                />
              ) : (
                proj.videoBreakdown
                  ? <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{proj.videoBreakdown}</p>
                  : <span className="text-sm text-zinc-600">No breakdown added</span>
              )}
            </div>
          )}

          {/* ── Relevant Notes (Joel internal notes) ── */}
          {(isJoel || editRelevantNotes) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Relevant Notes</p>
            {isJoel ? (
              <textarea
                value={editRelevantNotes}
                onChange={(e) => {
                  setEditRelevantNotes(e.target.value)
                  saveLocalProjMeta(proj.id, { relevantNotes: e.target.value })
                }}
                placeholder="Internal notes, context, production details…"
                className="w-full text-sm rounded-lg px-3 py-2.5 text-zinc-300 placeholder-zinc-700"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                rows={3}
              />
            ) : (
              editRelevantNotes && <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{editRelevantNotes}</p>
            )}
          </div>
          )}

          {/* ── Script / Notes (Feature 8: structured two-column template) ── */}
          {proj.type !== 'youtube' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
                  {proj.type === 'newsletter' ? 'Draft' : 'Script / Notes'}
                </p>
                {canEditScript && scriptUnsaved && <span className="text-xs text-zinc-600">Saving…</span>}
                {canEditScript && !scriptUnsaved && scriptSavedAt && (
                  <span className="text-xs text-zinc-600">
                    Saved {formatDistanceToNow(new Date(scriptSavedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isJoel && (
                  <button
                    onClick={() => { const v = !hideScript; setHideScript(v); saveLocalProjMeta(proj.id, { hideScript: v }) }}
                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    title={hideScript ? 'Show script' : 'Hide script'}
                  >
                    {hideScript ? 'Show' : 'Hide'}
                  </button>
                )}
                {isJoel && (
                  <button
                    onClick={handlePDFExport}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}
                  >
                    <Download size={11} /> Export PDF
                  </button>
                )}
              </div>
            </div>

            {hideScript ? null : canEditScript ? (
              /* Joel: editable script blocks (Script Line | Shot Note) */
              <div>
                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 24px', gap: 8, marginBottom: 4 }}>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                    {proj.type === 'newsletter' ? 'Content' : 'Script Line'}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                    {proj.type === 'newsletter' ? 'Section Note' : 'Shot / Visual'}
                  </span>
                  <span />
                </div>
                <div className="flex flex-col gap-2">
                  {scriptBlocks.map((block) => (
                    <div key={block.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 24px', gap: 8, alignItems: 'start' }}>
                      <textarea
                        value={block.scriptLine}
                        onChange={(e) => {
                          const updated = scriptBlocks.map((b) => b.id === block.id ? { ...b, scriptLine: e.target.value } : b)
                          handleScriptBlocksChange(updated)
                        }}
                        rows={2}
                        placeholder={proj.type === 'newsletter' ? 'Content…' : 'Script line or dialogue…'}
                        className="text-sm text-zinc-300 placeholder-zinc-700 rounded-lg px-3 py-2 w-full"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', resize: 'vertical' }}
                      />
                      <textarea
                        value={block.shotNote}
                        onChange={(e) => {
                          const updated = scriptBlocks.map((b) => b.id === block.id ? { ...b, shotNote: e.target.value } : b)
                          handleScriptBlocksChange(updated)
                        }}
                        rows={2}
                        placeholder={proj.type === 'newsletter' ? 'Section note…' : 'Shot / visual description…'}
                        className="text-sm text-zinc-400 placeholder-zinc-700 rounded-lg px-3 py-2"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginTop: 1, resize: 'vertical' }}
                      />
                      <button
                        onClick={() => handleScriptBlocksChange(scriptBlocks.filter((b) => b.id !== block.id))}
                        style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', paddingTop: 6 }}
                        title="Remove row"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleScriptBlocksChange([...scriptBlocks, { id: 'b_' + Date.now(), scriptLine: '', shotNote: '' }])}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-2"
                >
                  + Add Row
                </button>
              </div>
            ) : (
              /* Non-Joel: read-only view of script blocks */
              <div>
                {scriptBlocks.length > 0 && scriptBlocks.some((b) => b.scriptLine || b.shotNote) ? (
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                    {scriptBlocks.filter((b) => b.scriptLine || b.shotNote).map((block, i) => (
                      <div
                        key={block.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 12,
                          padding: '10px 12px',
                          borderBottom: i < scriptBlocks.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                        }}
                      >
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                          {block.scriptLine || <span className="text-zinc-700">—</span>}
                        </p>
                        <p className="text-xs text-zinc-500 italic leading-relaxed">
                          {block.shotNote || ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-zinc-600">No script added</span>
                )}
              </div>
            )}
          </div>
          )}

          {/* ── Caption ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Caption</p>
              <div className="flex items-center gap-2">
                {/* Copy button — visible to everyone when there's caption content */}
                {(editCaption || proj.caption) && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(editCaption || proj.caption || '')
                      setCaptionCopied(true)
                      setTimeout(() => setCaptionCopied(false), 2000)
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all"
                    style={
                      captionCopied
                        ? { background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }
                        : { background: 'rgba(255,255,255,0.05)', color: '#71717a', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                    title="Copy caption to clipboard"
                  >
                    {captionCopied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                  </button>
                )}
                {(canEditCaption || isJoel) && (
                  <>
                    {captionSaved && <span className="text-xs" style={{ color: '#4ade80' }}>Saved ✓</span>}
                    <button
                      onClick={saveCaption}
                      className="text-xs px-2 py-1 rounded"
                      style={
                        canEditCaption
                          ? { background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }
                          : { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }
                      }
                    >
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>
            {canEditCaption || isJoel ? (
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Write the caption here…"
                className="w-full text-sm rounded-lg px-3 py-2.5 text-zinc-200 placeholder-zinc-700"
                style={{
                  background: canEditCaption ? 'rgba(168,85,247,0.05)' : 'rgba(255,255,255,0.03)',
                  border:     canEditCaption ? '1px solid rgba(168,85,247,0.2)' : '1px solid rgba(255,255,255,0.07)',
                }}
                rows={5}
              />
            ) : proj.caption ? (
              <div className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 whitespace-pre-wrap"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {proj.caption}
              </div>
            ) : (
              <span className="text-sm text-zinc-600">No caption yet</span>
            )}
          </div>

          {/* ── Thumbnails (YouTube only, Joel can upload) ── */}
          {proj.type === 'youtube' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Thumbnails</p>
                {isJoel && (
                  <>
                    <button
                      onClick={() => thumbInputRef.current?.click()}
                      className="text-xs px-2 py-1 rounded flex items-center gap-1"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}
                    >
                      <Upload size={11} /> Upload
                    </button>
                    <input
                      ref={thumbInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleThumbnailUpload}
                      style={{ display: 'none' }}
                    />
                  </>
                )}
              </div>
              {(proj.thumbnails || []).length === 0 ? (
                <p className="text-sm text-zinc-600 py-2">No thumbnails yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(proj.thumbnails || []).map((thumb) => (
                    <div key={thumb.id} className="relative rounded-lg overflow-hidden"
                      style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                      <img
                        src={thumb.data}
                        alt={thumb.label}
                        className="w-full object-cover"
                        style={{ height: 100 }}
                      />
                      <div className="p-1.5 flex items-center gap-1">
                        {isJoel ? (
                          <input
                            value={thumb.label}
                            onChange={(e) => updateThumbnailLabel(thumb.id, e.target.value)}
                            className="flex-1 text-xs bg-transparent text-zinc-400 border-none outline-none"
                            style={{ minWidth: 0 }}
                          />
                        ) : (
                          <span className="flex-1 text-xs text-zinc-500 truncate">{thumb.label}</span>
                        )}
                        {isJoel && (
                          <button onClick={() => removeThumbnail(thumb.id)}
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', flexShrink: 0 }}>
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Action button ── */}
          <div>
            {renderActionButton()}
          </div>

          {/* ── Timeline ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Activity Log</p>
            <div className="flex flex-col gap-3">
              {[...(proj.statusHistory || [])].reverse().map((entry, i) => (
                <TimelineEntry key={i} entry={entry} getTeamName={getTeamName} />
              ))}
            </div>
          </div>

          {/* ── Delete / Inactive (Joel only) ── */}
          {isJoel && (
            <div className="mt-2 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {!confirmDelete ? (
                <div className="flex gap-2">
                  {proj.status !== 'Inactive' ? (
                    <button
                      onClick={() => { overrideStatus(proj.id, 'Inactive', 'Marked inactive', currentUser.id); setSelectedProject(null) }}
                      className="flex-1 py-2 text-sm rounded-lg flex items-center justify-center gap-2"
                      style={{ background: 'rgba(82,82,91,0.15)', color: '#a1a1aa', border: '1px solid rgba(82,82,91,0.3)' }}
                    >
                      Mark Inactive
                    </button>
                  ) : (
                    <button
                      onClick={() => overrideStatus(proj.id, getWorkflow(proj.type)[0], 'Reactivated', currentUser.id)}
                      className="flex-1 py-2 text-sm rounded-lg flex items-center justify-center gap-2"
                      style={{ background: 'rgba(82,82,91,0.15)', color: '#a1a1aa', border: '1px solid rgba(82,82,91,0.3)' }}
                    >
                      Reactivate
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex-1 py-2 text-sm rounded-lg flex items-center justify-center gap-2"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <Trash2 size={13} /> Delete Project
                  </button>
                </div>
              ) : (
                <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-xs text-red-400 mb-3">This will permanently delete this project.</p>
                  <div className="flex gap-2">
                    <button onClick={handleDelete}
                      className="flex-1 py-2 text-sm rounded"
                      style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                      Confirm Delete
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1 text-sm py-2">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children, className = '' }) {
  return (
    <div
      className={`rounded-lg px-3 py-2.5 ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
      {children}
    </div>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({ children, onClick, color = 'amber', className = '' }) {
  const styles = {
    amber:  'btn-amber',
    blue:   'bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg transition-colors',
    green:  'bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-lg transition-colors',
    purple: 'bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-lg transition-colors',
    orange: 'bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg transition-colors',
  }
  return (
    <button onClick={onClick} className={`w-full px-4 py-2.5 text-sm ${styles[color]} ${className}`}>
      {children}
    </button>
  )
}
