import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WORKFLOWS } from '../data/seedData'

const AppContext = createContext(null)

// ── DB ↔ Frontend mappers ──────────────────────────────────────────────────────

/**
 * DB platform CHECK constraint requires Title Case values.
 * Frontend uses lowercase keys throughout (workflows, stage owners, etc.).
 */
const PLATFORM_TO_DB = {
  youtube:    'YouTube',
  instagram:  'Instagram',
  tiktok:     'TikTok',
  newsletter: 'Newsletter',
}
const PLATFORM_FROM_DB = {
  YouTube:    'youtube',
  Instagram:  'instagram',
  TikTok:     'tiktok',
  Newsletter: 'newsletter',
}

/**
 * Reconstruct the single frontend `brand` string from the two DB columns.
 *   brand_type = 'Organic'    → brand = 'Organic'
 *   brand_type = 'Brand Deal' → brand = brand_name (e.g. 'Nike')
 */
function brandFromDb(row) {
  if (!row.brand_type || row.brand_type === 'Organic') return 'Organic'
  return row.brand_name || row.brand_type || ''
}

/**
 * Split the single frontend `brand` string into the two DB columns.
 *   'Organic' / '' / null → { brand_type: 'Organic', brand_name: null }
 *   anything else         → { brand_type: 'Brand Deal', brand_name: value }
 */
function brandToDb(brand) {
  if (!brand || brand === 'Organic') {
    return { brand_type: 'Organic', brand_name: null }
  }
  return { brand_type: 'Brand Deal', brand_name: brand }
}

/**
 * Convert a projects table row → frontend project shape.
 * Real DB columns: id, title, platform, brand_type, brand_name,
 *   publish_date, publish_time, status, dropbox_link, script,
 *   caption, created_by, created_at, updated_at
 * statusHistory is attached separately via attachHistory().
 */
function dbToProject(row) {
  return {
    id: row.id,
    title: row.title,
    type: PLATFORM_FROM_DB[row.platform] || row.platform || '', // DB: platform (Title Case → lowercase)
    brand: brandFromDb(row),
    publishDate: row.publish_date || '',
    dropboxLink: row.dropbox_link || '',
    status: row.status,
    notes: row.script || '',             // DB: script
    caption: row.caption || '',
    scheduledTime: row.publish_time || '', // DB: publish_time
    createdAt: row.created_at,
    statusHistory: [],                   // populated by attachHistory()
  }
}

/**
 * Convert an activity_log row → statusHistory entry shape.
 * Real DB columns: id, project_id, user_id, action, details, created_at
 *   action  = the status value (e.g. "Filming")
 *   user_id = UUID of who made the change
 *   details = optional jsonb (may contain { note: "..." })
 */
function dbToHistoryEntry(row) {
  let note = null
  if (row.details) {
    try {
      const parsed = typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      note = parsed?.note ?? null
    } catch (_) {}
  }
  return {
    status: row.action,
    changedBy: row.user_id,
    timestamp: row.created_at,
    note,
  }
}

/**
 * Convert a notifications row → frontend notification shape.
 * Real DB columns: id, user_id, project_id, message, read, created_at
 *   user_id = UUID of target user; null means broadcast to all
 */
function dbToNotif(row) {
  return {
    id: row.id,
    type: 'info',                        // no DB column; defaulted
    message: row.message,
    projectId: row.project_id,
    forUser: row.user_id,               // null → 'all' semantics
    read: row.read ?? false,
    timestamp: row.created_at,
  }
}

/**
 * Join activity_log rows onto the matching projects by project_id.
 * Returns a new projects array with statusHistory populated.
 */
function attachHistory(projects, activityLogs) {
  const byProject = {}
  for (const log of activityLogs) {
    if (!byProject[log.project_id]) byProject[log.project_id] = []
    byProject[log.project_id].push(dbToHistoryEntry(log))
  }
  return projects.map((p) => ({
    ...p,
    statusHistory: (byProject[p.id] || []).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    ),
  }))
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [projects, setProjects] = useState([])
  const [notifications, setNotifications] = useState([])
  const [workflowSettings, setWorkflowSettings] = useState({})
  const [selectedProject, setSelectedProject] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        const [
          { data: projectRows, error: projErr },
          { data: logRows, error: logErr },
          { data: notifRows, error: notifErr },
          { data: wfRows, error: wfErr },
        ] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('activity_log').select('*').order('created_at', { ascending: true }),
          supabase.from('notifications').select('*').order('created_at', { ascending: false }),
          supabase.from('workflow_settings').select('*'),
        ])

        if (projErr) console.error('Projects fetch error:', projErr)
        if (logErr) console.error('Activity log fetch error:', logErr)
        if (notifErr) console.error('Notifications fetch error:', notifErr)
        if (wfErr) console.error('Workflow settings fetch error:', wfErr)

        const frontendProjects = attachHistory(
          (projectRows || []).map(dbToProject),
          logRows || []
        )
        setProjects(frontendProjects)
        setNotifications((notifRows || []).map(dbToNotif))

        // Build workflow settings map keyed by content type
        if (wfRows && wfRows.length > 0) {
          const wfMap = {}
          for (const row of wfRows) {
            if (row.type) wfMap[row.type] = row
          }
          setWorkflowSettings(wfMap)
        }
      } catch (err) {
        console.error('Error loading initial data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  // ── Real-time subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    // Projects channel — scalar field updates only; statusHistory is kept intact
    const projectsCh = supabase
      .channel('rt-projects')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'projects' },
        ({ new: row }) => {
          const proj = dbToProject(row)
          setProjects((prev) => {
            if (prev.some((p) => p.id === proj.id)) return prev
            return [proj, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects' },
        ({ new: row }) => {
          // Merge DB scalars onto local state; preserve statusHistory
          const merge = (p) => ({
            ...p,
            title: row.title,
            brand: brandFromDb(row),
            status: row.status,
            notes: row.script || '',           // DB: script
            caption: row.caption || '',
            publishDate: row.publish_date || '',
            dropboxLink: row.dropbox_link || '',
            scheduledTime: row.publish_time || '', // DB: publish_time
          })
          setProjects((prev) =>
            prev.map((p) => (p.id === row.id ? merge(p) : p))
          )
          setSelectedProject((prev) =>
            prev?.id === row.id ? merge(prev) : prev
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'projects' },
        ({ old: row }) => {
          setProjects((prev) => prev.filter((p) => p.id !== row.id))
          setSelectedProject((prev) => (prev?.id === row.id ? null : prev))
        }
      )
      .subscribe()

    // Notifications channel
    const notifsCh = supabase
      .channel('rt-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        ({ new: row }) => {
          setNotifications((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev
            return [dbToNotif(row), ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        ({ new: row }) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === row.id ? dbToNotif(row) : n))
          )
        }
      )
      .subscribe()

    // Activity log channel — appends history entries to the right project
    const activityCh = supabase
      .channel('rt-activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        ({ new: row }) => {
          const entry = dbToHistoryEntry(row)

          const appendEntry = (p) => {
            if (p.id !== row.project_id) return p
            const exists = (p.statusHistory || []).some(
              (h) =>
                h.timestamp === entry.timestamp &&
                h.changedBy === entry.changedBy &&
                h.status === entry.status
            )
            if (exists) return p
            return { ...p, statusHistory: [...(p.statusHistory || []), entry] }
          }

          setProjects((prev) => prev.map(appendEntry))
          setSelectedProject((prev) => (prev ? appendEntry(prev) : prev))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(projectsCh)
      supabase.removeChannel(notifsCh)
      supabase.removeChannel(activityCh)
    }
  }, [])

  // ── Auth ───────────────────────────────────────────────────────────────────

  const login = useCallback(async (userId, pin) => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Login query error:', error)
      return null
    }

    if (!data) {
      console.warn('No team_member found with id:', userId)
      return null
    }

    if (String(data.pin) !== String(pin)) {
      console.warn('PIN mismatch for', userId)
      return null
    }

    const user = {
      id: data.id,
      name: data.name,
      role: data.role,
      pin: data.pin,
      avatar: data.avatar || (data.name ? data.name[0] : userId[0].toUpperCase()),
    }
    setCurrentUser(user)
    return user
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    setSelectedProject(null)
  }, [])

  // ── Notifications ──────────────────────────────────────────────────────────

  const addNotification = useCallback(async (notif) => {
    // Persist — let Supabase generate the UUID and created_at
    // Real columns: user_id, project_id, message, read
    // user_id = null means "for all users"
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: (!notif.forUser || notif.forUser === 'all') ? null : notif.forUser,
        project_id: notif.projectId || null,
        message: notif.message,
        read: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving notification:', error)
      return
    }

    // Add to local state using the real DB row (real UUID + created_at)
    setNotifications((prev) => {
      if (prev.some((n) => n.id === data.id)) return prev
      return [dbToNotif(data), ...prev]
    })
  }, [])

  const markNotificationsRead = useCallback(async (userId) => {
    // Optimistic — forUser is null for broadcasts, UUID for targeted
    setNotifications((prev) =>
      prev.map((n) =>
        n.forUser === userId || n.forUser === null ? { ...n, read: true } : n
      )
    )
    // Persist — user_id = userId OR user_id IS NULL (broadcast)
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq('read', false)
    if (error) console.error('Error marking notifications read:', error)
  }, [])

  const unreadCount = useCallback(
    (userId) =>
      notifications.filter(
        (n) => !n.read && (n.forUser === userId || n.forUser === null)
      ).length,
    [notifications]
  )

  // ── Projects ───────────────────────────────────────────────────────────────

  const addProject = useCallback(async (data, createdBy) => {
    const workflows = WORKFLOWS[data.type]
    const firstStatus = workflows[0]

    // Persist project row — no id: let Supabase generate the UUID
    // Real columns: title, platform, brand_type, brand_name, publish_date,
    //   dropbox_link, status, script, caption, publish_time, created_by, created_at
    const { data: inserted, error: projErr } = await supabase
      .from('projects')
      .insert({
        title: data.title,
        platform: PLATFORM_TO_DB[data.type] || data.type, // DB: platform (lowercase → Title Case)
        ...brandToDb(data.brand),
        publish_date: data.publishDate || null,
        dropbox_link: data.dropboxLink || null,
        status: firstStatus,
        script: null,                      // DB: script
        caption: null,
        publish_time: null,                // DB: publish_time
        created_by: createdBy,
      })
      .select()
      .single()

    if (projErr) {
      console.error('Error creating project:', projErr)
      return null
    }

    // Build frontend shape from the real inserted row (has the UUID)
    const newProject = {
      ...dbToProject(inserted),
      statusHistory: [],
    }

    // Add to local state (real-time INSERT will also fire; deduplication handles it)
    setProjects((prev) => {
      if (prev.some((p) => p.id === newProject.id)) return prev
      return [newProject, ...prev]
    })

    // Persist initial activity_log entry
    // Real columns: project_id, user_id, action, details
    const { error: logErr } = await supabase.from('activity_log').insert({
      project_id: inserted.id,
      action: firstStatus,               // DB: action (stores status value)
      user_id: createdBy,               // DB: user_id
      details: null,
    })
    if (logErr) console.error('Error creating initial activity log entry:', logErr)

    return newProject
  }, [])

  const updateProject = useCallback(async (projectId, updates) => {
    // Optimistic
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
    )
    setSelectedProject((prev) =>
      prev?.id === projectId ? { ...prev, ...updates } : prev
    )

    // Map frontend camelCase keys → DB snake_case columns
    // Real DB columns: title, script, caption, status, publish_date, dropbox_link, publish_time
    const fieldMap = {
      title:         'title',
      notes:         'script',           // DB: script
      caption:       'caption',
      status:        'status',
      publishDate:   'publish_date',
      dropboxLink:   'dropbox_link',
      scheduledTime: 'publish_time',     // DB: publish_time
    }

    const dbUpdates = {}
    for (const [frontendKey, dbKey] of Object.entries(fieldMap)) {
      if (frontendKey in updates) {
        dbUpdates[dbKey] =
          dbKey === 'publish_time' && !updates[frontendKey]
            ? null
            : updates[frontendKey]
      }
    }

    // brand → brand_type + brand_name
    if ('brand' in updates) {
      Object.assign(dbUpdates, brandToDb(updates.brand))
    }

    if (Object.keys(dbUpdates).length === 0) return

    const { error } = await supabase
      .from('projects')
      .update(dbUpdates)
      .eq('id', projectId)
    if (error) console.error('Error updating project:', error)
  }, [])

  const advanceStatus = useCallback(async (projectId, newStatus, changedBy, note = null) => {
    const entry = {
      status: newStatus,
      changedBy,
      timestamp: new Date().toISOString(), // optimistic timestamp; DB created_at may differ slightly
      note,
    }

    // Optimistic
    const applyAdvance = (p) => {
      if (p.id !== projectId) return p
      return {
        ...p,
        status: newStatus,
        statusHistory: [...(p.statusHistory || []), entry],
      }
    }
    setProjects((prev) => prev.map(applyAdvance))
    setSelectedProject((prev) => (prev ? applyAdvance(prev) : prev))

    // Persist status update + activity_log entry in parallel
    // activity_log real columns: project_id, action, user_id, details
    const [{ error: projErr }, { error: logErr }] = await Promise.all([
      supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId),
      supabase.from('activity_log').insert({
        project_id: projectId,
        action: newStatus,               // DB: action (stores status value)
        user_id: changedBy,             // DB: user_id
        details: note ? { note } : null,
      }),
    ])

    if (projErr) console.error('Error advancing project status:', projErr)
    if (logErr) console.error('Error inserting activity_log entry:', logErr)
  }, [])

  // ── Context value ──────────────────────────────────────────────────────────

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        projects,
        setProjects,
        notifications,
        addNotification,
        markNotificationsRead,
        unreadCount,
        updateProject,
        advanceStatus,
        addProject,
        selectedProject,
        setSelectedProject,
        activeTab,
        setActiveTab,
        loading,
        workflowSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
