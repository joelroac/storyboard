import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WORKFLOWS, STAGE_OWNER, TYPE_LABELS } from '../data/seedData'
import { identifyUser, unidentifyUser, sendPushToUser } from '../lib/onesignal'

const AppContext = createContext(null)

// ── DB ↔ Frontend mappers ──────────────────────────────────────────────────────

const PLATFORM_TO_DB = {
  youtube:    'YouTube',
  instagram:  'Instagram',
  tiktok:     'TikTok',
  newsletter: 'Newsletter',
  patreon:    'Patreon',
}
const PLATFORM_FROM_DB = {
  YouTube:    'youtube',
  Instagram:  'instagram',
  TikTok:     'tiktok',
  Newsletter: 'newsletter',
  Patreon:    'patreon',
}

// Maps between DB assignedRole values and frontend owner keys
const ROLE_TO_OWNER = { admin: 'joel', editor: 'anthony', social_manager: 'tiana' }
const OWNER_TO_ROLE = { joel: 'admin', anthony: 'editor', tiana: 'social_manager' }

// Parse a workflow_settings DB row into the frontend shape { type, stages[], owners{} }
function parseWfRow(row) {
  const frontendType = PLATFORM_FROM_DB[row.platform]
  if (!frontendType) return null
  // stages in DB are objects: { name, assignedRole, ... }
  const stages = (row.stages || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean)
  const owners = {}
  for (const s of (row.stages || [])) {
    const name = typeof s === 'string' ? s : s.name
    const role = typeof s === 'object' ? s.assignedRole : null
    if (name && role) owners[name] = ROLE_TO_OWNER[role] || 'joel'
  }
  return { type: frontendType, stages, owners }
}

function brandFromDb(row) {
  if (!row.brand_type || row.brand_type === 'Organic') return 'Organic'
  return row.brand_name || row.brand_type || ''
}

function brandToDb(brand) {
  if (!brand || brand === 'Organic') {
    return { brand_type: 'Organic', brand_name: null }
  }
  return { brand_type: 'Brand Deal', brand_name: brand }
}

function dbToProject(row) {
  return {
    id:             row.id,
    title:          row.title,
    type:           PLATFORM_FROM_DB[row.platform] || row.platform || '',
    brand:          brandFromDb(row),
    publishDate:    row.publish_date || '',
    workDate:       row.work_date || '',
    dropboxLink:    row.dropbox_link || '',
    asanaLink:      row.asana_link || '',
    status:         row.status,
    notes:          row.script || '',
    caption:        row.caption || '',
    scheduledTime:  row.publish_time || '',
    shotList:       row.shot_list || [],
    thumbnails:     row.thumbnails || [],
    videoBreakdown: row.video_breakdown || '',
    activeStages:   row.active_stages || [],
    crossPostTo:    row.cross_post_to || null,
    finalLink:      row.final_link || '',
    createdAt:      row.created_at,
    statusHistory:  [],
  }
}

function dbToHistoryEntry(row) {
  let note = null
  if (row.details) {
    try {
      const parsed = typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      note = parsed?.note ?? null
    } catch (_) {}
  }
  return {
    status:    row.action,
    changedBy: row.user_id,
    timestamp: row.created_at,
    note,
  }
}

function dbToNotif(row) {
  return {
    id:        row.id,
    type:      'info',
    message:   row.message,
    projectId: row.project_id,
    forUser:   row.user_id,
    read:      row.read ?? false,
    timestamp: row.created_at,
  }
}

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

// ── Default permissions ────────────────────────────────────────────────────────
const DEFAULT_PERMISSIONS = {
  socialManager: {
    canEditCalendar: false,
    canAddCaptions:  false,
    canEditLinks:    false,
  },
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser]         = useState(null)
  const [projects, setProjects]               = useState([])
  const [notifications, setNotifications]     = useState([])
  const [teamMembers, setTeamMembers]         = useState([])
  const [banners, setBanners]                 = useState([])
  const [workflowSettings, setWorkflowSettings] = useState({})
  const [selectedProject, setSelectedProject] = useState(null)
  const VALID_TABS = ['dashboard', 'calendar', 'links', 'ideas']
  const [activeTab, setActiveTab]             = useState(() => {
    const hash = window.location.hash.slice(1)
    return VALID_TABS.includes(hash) ? hash : 'dashboard'
  })
  const [loading, setLoading]                 = useState(true)
  const [permissions, setPermissions]         = useState(DEFAULT_PERMISSIONS)
  const [previewRole, setPreviewRole]         = useState(null)   // null | 'editor' | 'social_manager'

  // ── Persist active tab in URL hash ────────────────────────────────────────
  useEffect(() => {
    window.location.hash = activeTab
  }, [activeTab])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1)
      if (VALID_TABS.includes(hash)) setActiveTab(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        const [
          { data: projectRows, error: projErr },
          { data: logRows,     error: logErr },
          { data: notifRows,   error: notifErr },
          { data: wfRows,      error: wfErr },
          { data: memberRows,  error: memberErr },
          { data: settingsRows, error: settingsErr },
        ] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('activity_log').select('*').order('created_at', { ascending: true }),
          supabase.from('notifications').select('*').order('created_at', { ascending: false }),
          supabase.from('workflow_settings').select('*'),
          supabase.from('team_members').select('id, name, role, avatar_url'),
          supabase.from('app_settings').select('*'),
        ])

        if (projErr)     console.error('Projects fetch error:', projErr)
        if (logErr)      console.error('Activity log fetch error:', logErr)
        if (notifErr)    console.error('Notifications fetch error:', notifErr)
        if (wfErr)       console.error('Workflow settings fetch error:', wfErr)
        if (memberErr)   console.error('Team members fetch error:', memberErr)
        if (settingsErr) console.error('App settings fetch error:', settingsErr)

        const frontendProjects = attachHistory(
          (projectRows || []).map(dbToProject),
          logRows || []
        )
        setProjects(frontendProjects)
        setNotifications((notifRows || []).map(dbToNotif))
        setTeamMembers(memberRows || [])

        // Restore session from localStorage (with expiry check)
        const rawSession = localStorage.getItem('storyboard_session_user')
        if (rawSession && memberRows) {
          try {
            const { userId, expiresAt } = JSON.parse(rawSession)
            if (userId && expiresAt && Date.now() < expiresAt) {
              const saved = memberRows.find(m => m.id === userId)
              if (saved) {
                setCurrentUser({
                  id:         saved.id,
                  name:       saved.name,
                  role:       saved.role,
                  avatar:     saved.name ? saved.name[0] : saved.id[0].toUpperCase(),
                  avatar_url: saved.avatar_url || null,
                })
                // Re-identify the user with OneSignal on every page load so their
                // device stays linked — this is the fix for "session restore never
                // registers the device" (init promise is awaited inside identifyUser)
                identifyUser(saved.id, saved.role)
              } else {
                localStorage.removeItem('storyboard_session_user')
              }
            } else {
              localStorage.removeItem('storyboard_session_user') // expired
            }
          } catch {
            localStorage.removeItem('storyboard_session_user') // malformed
          }
        }

        // Parse workflow_settings: DB uses 'platform' column with stage objects
        if (wfRows && wfRows.length > 0) {
          const wfMap = {}
          for (const row of wfRows) {
            const parsed = parseWfRow(row)
            if (parsed) wfMap[parsed.type] = parsed
          }
          setWorkflowSettings(wfMap)
        }

        // Load app settings (relevant links + permissions + ideas) from Supabase
        if (settingsRows && settingsRows.length > 0) {
          const linksRow = settingsRows.find(r => r.key === 'relevant_links')
          if (linksRow?.value) setRelevantLinks(linksRow.value)

          const permsRow = settingsRows.find(r => r.key === 'permissions')
          if (permsRow?.value) setPermissions(permsRow.value)

          const ideasRow = settingsRows.find(r => r.key === 'ideas')
          if (ideasRow?.value) setIdeas(ideasRow.value)

          const goalsRow = settingsRows.find(r => r.key === 'posting_goals')
          if (goalsRow?.value) setPostingGoals(goalsRow.value)

          const paymentsRow = settingsRows.find(r => r.key === 'payments')
          if (paymentsRow?.value) setPayments(paymentsRow.value)

          const analyticsRow = settingsRows.find(r => r.key === 'analytics_log')
          if (analyticsRow?.value) setAnalyticsLog(analyticsRow.value)
        }
      } catch (err) {
        console.error('Error loading initial data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  // ── Auto-post scheduled projects when their date has passed ───────────────
  useEffect(() => {
    if (!projects.length) return

    const now = new Date()
    const overdue = projects.filter((p) => {
      if (p.status !== 'Scheduled') return false
      const target = p.scheduledTime
        ? new Date(p.scheduledTime)
        : p.publishDate
          ? new Date(p.publishDate + 'T23:59:59')
          : null
      return target && target < now
    })

    for (const p of overdue) {
      const newStatus = (p.type === 'newsletter') ? 'Sent' : 'Posted'
      // Fire-and-forget; don't pass a changedBy user (system action)
      supabase.from('projects').update({ status: newStatus }).eq('id', p.id).then(() => {})
      supabase.from('activity_log').insert({
        project_id: p.id,
        action:     newStatus,
        user_id:    null,
        details:    { note: 'Auto-posted by system — scheduled time passed' },
      }).then(() => {})
      setProjects((prev) => prev.map((proj) => proj.id === p.id ? { ...proj, status: newStatus } : proj))
    }
  }, [projects.length]) // Run once when projects first load (length changes from 0)

  // ── Real-time subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const projectsCh = supabase
      .channel('rt-projects')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects' }, ({ new: row }) => {
        const proj = dbToProject(row)
        setProjects((prev) => prev.some((p) => p.id === proj.id) ? prev : [proj, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, ({ new: row }) => {
        const merge = (p) => ({
          ...p,
          title:          row.title,
          brand:          brandFromDb(row),
          status:         row.status,
          // Use ?? so a realtime event that didn't change the script column
          // (row.script === null) never overwrites existing notes in local state.
          notes:          row.script ?? p.notes,
          caption:        row.caption ?? p.caption,
          publishDate:    row.publish_date || '',
          dropboxLink:    row.dropbox_link || '',
          asanaLink:      row.asana_link || '',
          scheduledTime:  row.publish_time || '',
          shotList:       row.shot_list || [],
          thumbnails:     row.thumbnails || [],
          videoBreakdown: row.video_breakdown || '',
          activeStages:   row.active_stages || [],
          crossPostTo:    row.cross_post_to || null,
          workDate:       row.work_date || '',
          finalLink:      row.final_link || '',
        })
        setProjects((prev) => prev.map((p) => p.id === row.id ? merge(p) : p))
        setSelectedProject((prev) => prev?.id === row.id ? merge(prev) : prev)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'projects' }, ({ old: row }) => {
        setProjects((prev) => prev.filter((p) => p.id !== row.id))
        setSelectedProject((prev) => prev?.id === row.id ? null : prev)
      })
      .subscribe()

    const notifsCh = supabase
      .channel('rt-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, ({ new: row }) => {
        setNotifications((prev) => prev.some((n) => n.id === row.id) ? prev : [dbToNotif(row), ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, ({ new: row }) => {
        setNotifications((prev) => prev.map((n) => n.id === row.id ? dbToNotif(row) : n))
      })
      .subscribe()

    const activityCh = supabase
      .channel('rt-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, ({ new: row }) => {
        const entry = dbToHistoryEntry(row)
        const appendEntry = (p) => {
          if (p.id !== row.project_id) return p
          const exists = (p.statusHistory || []).some(
            (h) => h.timestamp === entry.timestamp && h.changedBy === entry.changedBy && h.status === entry.status
          )
          if (exists) return p
          return { ...p, statusHistory: [...(p.statusHistory || []), entry] }
        }
        setProjects((prev) => prev.map(appendEntry))
        setSelectedProject((prev) => prev ? appendEntry(prev) : prev)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(projectsCh)
      supabase.removeChannel(notifsCh)
      supabase.removeChannel(activityCh)
    }
  }, [])

  // ── Auth ───────────────────────────────────────────────────────────────────

  // completeLogin — called after PIN (no 2FA) or after TOTP success
  // strips internal-only flags before persisting the user
  const completeLogin = useCallback((user) => {
    // eslint-disable-next-line no-unused-vars
    const { requires2FA, _totpSecret, ...cleanUser } = user
    setCurrentUser(cleanUser)
    localStorage.setItem('storyboard_session_user', JSON.stringify({
      userId:    cleanUser.id,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }))
    // Link this device to the user so OneSignal can target them
    identifyUser(cleanUser.id, cleanUser.role)
  }, [])

  const login = useCallback(async (userId, pin) => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) { console.error('Login error:', error); return null }
    if (!data)  { console.warn('No team_member found with id:', userId); return null }

    // Each user must authenticate with their own PIN only
    if (String(data.pin) !== String(pin)) return null

    const user = {
      id:         data.id,
      name:       data.name,
      role:       data.role,
      pin:        data.pin,
      avatar:     data.name ? data.name[0] : userId[0].toUpperCase(),
      avatar_url: data.avatar_url || null,
    }

    // Respect 2FA if configured on this account
    if (data.totp_secret) {
      return { ...user, requires2FA: true, _totpSecret: data.totp_secret }
    }

    completeLogin(user)
    return user
  }, [completeLogin])

  // Verify a user's PIN against the DB — used by Profile Settings passcode change.
  // PIN is intentionally not stored in frontend state, so we fetch fresh.
  const verifyPin = useCallback(async (userId, pin) => {
    const { data } = await supabase
      .from('team_members')
      .select('pin')
      .eq('id', userId)
      .maybeSingle()
    return data && String(data.pin) === String(pin)
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    setSelectedProject(null)
    localStorage.removeItem('storyboard_session_user')
    unidentifyUser()
  }, [])

  // ── Team helpers ───────────────────────────────────────────────────────────

  const getTeamName = useCallback((userId) => {
    if (!userId) return 'Unknown'
    const member = teamMembers.find((m) => m.id === userId)
    return member?.name || userId
  }, [teamMembers])

  // role: 'admin' | 'editor' | 'social_manager'
  const getMemberByRole = useCallback((role) => {
    return teamMembers.find((m) => m.role === role) || null
  }, [teamMembers])

  // Use saved custom workflow if one exists, otherwise fall back to seed defaults
  const getWorkflow = useCallback((type) => {
    const custom = workflowSettings[type]
    if (custom?.stages?.length > 0) return custom.stages
    return WORKFLOWS[type] || []
  }, [workflowSettings])

  // Use saved custom owner if one exists, otherwise fall back to seed defaults
  const getStageOwner = useCallback((type, status) => {
    const custom = workflowSettings[type]
    if (custom?.owners && status in custom.owners) return custom.owners[status]
    return STAGE_OWNER[type]?.[status] || null
  }, [workflowSettings])

  // ── Banner system ──────────────────────────────────────────────────────────

  const addBanner = useCallback((message, type = 'info') => {
    const id = Date.now()
    setBanners((prev) => [...prev, { id, message, type }])
    setTimeout(() => setBanners((prev) => prev.filter((b) => b.id !== id)), 4000)
  }, [])

  // ── Notifications ──────────────────────────────────────────────────────────

  const addNotification = useCallback(async (notif) => {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id:    (!notif.forUser || notif.forUser === 'all') ? null : notif.forUser,
        project_id: notif.projectId || null,
        message:    notif.message,
        read:       false,
      })
      .select()
      .single()

    if (error) { console.error('Error saving notification:', error); return }

    setNotifications((prev) => {
      if (prev.some((n) => n.id === data.id)) return prev
      return [dbToNotif(data), ...prev]
    })

    // Send a push notification to the target user's device(s)
    if (notif.forUser && notif.forUser !== 'all') {
      sendPushToUser(notif.forUser, 'The Storyboard', notif.message)
    }
  }, [])

  const markNotificationsRead = useCallback(async (userId) => {
    setNotifications((prev) =>
      prev.map((n) => n.forUser === userId || n.forUser === null ? { ...n, read: true } : n)
    )
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq('read', false)
    if (error) console.error('Error marking notifications read:', error)
  }, [])

  const unreadCount = useCallback(
    (userId) => notifications.filter((n) => !n.read && (n.forUser === userId || n.forUser === null)).length,
    [notifications]
  )

  // ── Projects ───────────────────────────────────────────────────────────────

  const addProject = useCallback(async (data, createdBy) => {
    // Use saved custom workflow so new projects start at the correct first stage
    const customWf = workflowSettings[data.type]
    const workflow  = (customWf?.stages?.length > 0) ? customWf.stages : (WORKFLOWS[data.type] || [])
    const firstStatus = workflow[0]

    const { data: inserted, error: projErr } = await supabase
      .from('projects')
      .insert({
        title:         data.title,
        platform:      PLATFORM_TO_DB[data.type] || data.type,
        ...brandToDb(data.brand),
        publish_date:  data.publishDate || null,
        dropbox_link:  data.dropboxLink || null,
        asana_link:    null,
        status:        firstStatus,
        script:        null,
        caption:       null,
        publish_time:  null,
        shot_list:     [],
        thumbnails:    [],
        video_breakdown: null,
        active_stages: [firstStatus],
        created_by:    createdBy,
      })
      .select()
      .single()

    if (projErr) { console.error('Error creating project:', projErr); return null }

    const newProject = { ...dbToProject(inserted), statusHistory: [] }

    setProjects((prev) => {
      if (prev.some((p) => p.id === newProject.id)) return prev
      return [newProject, ...prev]
    })

    const { error: logErr } = await supabase.from('activity_log').insert({
      project_id: inserted.id,
      action:     firstStatus,
      user_id:    createdBy,
      details:    null,
    })
    if (logErr) console.error('Error creating initial activity log entry:', logErr)

    return newProject
  }, [workflowSettings])

  const updateProject = useCallback(async (projectId, updates) => {
    // Optimistic
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, ...updates } : p))
    setSelectedProject((prev) => prev?.id === projectId ? { ...prev, ...updates } : prev)

    const fieldMap = {
      title:          'title',
      notes:          'script',
      caption:        'caption',
      status:         'status',
      publishDate:    'publish_date',
      workDate:       'work_date',
      dropboxLink:    'dropbox_link',
      asanaLink:      'asana_link',
      scheduledTime:  'publish_time',
      shotList:       'shot_list',
      thumbnails:     'thumbnails',
      videoBreakdown: 'video_breakdown',
      activeStages:   'active_stages',
      crossPostTo:    'cross_post_to',
      finalLink:      'final_link',
    }

    const dbUpdates = {}
    for (const [frontendKey, dbKey] of Object.entries(fieldMap)) {
      if (frontendKey in updates) {
        dbUpdates[dbKey] = (!updates[frontendKey] && (dbKey === 'publish_time' || dbKey === 'publish_date' || dbKey === 'work_date')) ? null : updates[frontendKey]
      }
    }

    if ('brand' in updates) {
      Object.assign(dbUpdates, brandToDb(updates.brand))
    }

    if (Object.keys(dbUpdates).length === 0) return

    const { error } = await supabase.from('projects').update(dbUpdates).eq('id', projectId)
    if (error) console.error('Error updating project:', error)
  }, [])

  const advanceStatus = useCallback(async (projectId, newStatus, changedBy, note = null) => {
    const entry = {
      status:    newStatus,
      changedBy,
      timestamp: new Date().toISOString(),
      note,
    }

    const applyAdvance = (p) => {
      if (p.id !== projectId) return p
      return {
        ...p,
        status: newStatus,
        statusHistory: [...(p.statusHistory || []), entry],
      }
    }
    setProjects((prev) => prev.map(applyAdvance))
    setSelectedProject((prev) => prev ? applyAdvance(prev) : prev)

    const [{ error: projErr }, { error: logErr }] = await Promise.all([
      supabase.from('projects').update({ status: newStatus }).eq('id', projectId),
      supabase.from('activity_log').insert({
        project_id: projectId,
        action:     newStatus,
        user_id:    changedBy,
        details:    note ? { note } : null,
      }),
    ])

    if (projErr) console.error('Error advancing project status:', projErr)
    if (logErr)  console.error('Error inserting activity_log entry:', logErr)
  }, [])

  const overrideStatus = useCallback(async (projectId, newStatus, note, changedBy) => {
    return advanceStatus(projectId, newStatus, changedBy, note)
  }, [advanceStatus])

  const deleteProject = useCallback(async (projectId) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    setSelectedProject((prev) => prev?.id === projectId ? null : prev)

    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) console.error('Error deleting project:', error)
  }, [])

  // ── Team member updates ────────────────────────────────────────────────────

  const updateTeamMember = useCallback(async (memberId, updates) => {
    const { error } = await supabase.from('team_members').update(updates).eq('id', memberId)
    if (error) { console.error('Error updating team member:', error); return false }

    // Re-fetch the full team_members table from Supabase so local state
    // always reflects what is actually stored — not just an optimistic patch.
    // Note: the DB has no 'avatar' column — do not include it in the select.
    const { data: freshMembers, error: fetchErr } = await supabase
      .from('team_members')
      .select('id, name, role, avatar_url')
    if (fetchErr) {
      console.error('Error re-fetching team members:', fetchErr)
      // Fall back to optimistic patch if re-fetch fails
      setTeamMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, ...updates } : m))
      setCurrentUser((prev) => prev?.id === memberId ? { ...prev, ...updates } : prev)
    } else {
      setTeamMembers(freshMembers || [])
      // Sync currentUser from the fresh DB row (name, avatar_url up-to-date)
      setCurrentUser((prev) => {
        if (!prev) return prev
        const fresh = (freshMembers || []).find((m) => m.id === prev.id)
        if (!fresh) return prev
        return {
          ...prev,
          name:       fresh.name,
          avatar_url: fresh.avatar_url ?? null,
          avatar:     fresh.name ? fresh.name[0] : prev.avatar,
        }
      })
    }
    return true
  }, [])

  // ── Platform / content-type change ────────────────────────────────────────

  const changePlatform = useCallback(async (projectId, newType, changedBy) => {
    // Use saved custom workflow so the reset lands on the correct first stage
    const customWf      = workflowSettings[newType]
    const newWorkflow   = (customWf?.stages?.length > 0) ? customWf.stages : (WORKFLOWS[newType] || [])
    const newFirstStage = newWorkflow[0] || 'Filming'
    const dbPlatform    = PLATFORM_TO_DB[newType] || newType

    const apply = (p) =>
      p.id !== projectId
        ? p
        : { ...p, type: newType, status: newFirstStage, activeStages: [newFirstStage] }

    setProjects((prev) => prev.map(apply))
    setSelectedProject((prev) => (prev ? apply(prev) : prev))

    const [{ error: projErr }, { error: logErr }] = await Promise.all([
      supabase.from('projects').update({
        platform:      dbPlatform,
        status:        newFirstStage,
        active_stages: [newFirstStage],
      }).eq('id', projectId),
      supabase.from('activity_log').insert({
        project_id: projectId,
        action:     newFirstStage,
        user_id:    changedBy,
        details:    { note: `Platform changed to ${TYPE_LABELS[newType] || newType} — workflow reset` },
      }),
    ])

    if (projErr) console.error('Error changing platform:', projErr)
    if (logErr)  console.error('Error logging platform change:', logErr)
  }, [workflowSettings])

  // ── Workflow settings save ─────────────────────────────────────────────────

  const saveWorkflowSettings = useCallback(async (type, wfData) => {
    // The DB column is 'platform' (Title Case), not 'type'.
    // Stages must be stored as objects: { name, assignedRole } — not plain strings.
    // There is no 'owners' column — ownership is encoded inside the stage objects.
    const platform = PLATFORM_TO_DB[type]
    if (!platform) { console.error('Unknown workflow type:', type); return false }

    const dbStages = (wfData.stages || []).map((stageName) => ({
      name:         stageName,
      parallel:     false,
      assignedRole: OWNER_TO_ROLE[wfData.owners?.[stageName]] || 'admin',
    }))

    // Check whether a row already exists for this platform
    const { data: existing } = await supabase
      .from('workflow_settings')
      .select('id')
      .eq('platform', platform)
      .maybeSingle()

    const { error } = existing
      ? await supabase
          .from('workflow_settings')
          .update({ stages: dbStages, updated_at: new Date().toISOString() })
          .eq('platform', platform)
      : await supabase
          .from('workflow_settings')
          .insert({ platform, stages: dbStages, updated_at: new Date().toISOString() })

    if (error) { console.error('Error saving workflow settings:', error); return false }

    // Re-fetch the full table so local state exactly mirrors the DB.
    const { data: freshWf, error: fetchErr } = await supabase
      .from('workflow_settings')
      .select('*')
    if (fetchErr) {
      console.error('Error re-fetching workflow settings:', fetchErr)
      // Optimistic fallback
      setWorkflowSettings((prev) => ({ ...prev, [type]: { type, stages: wfData.stages, owners: wfData.owners } }))
    } else {
      const wfMap = {}
      for (const row of freshWf || []) {
        const parsed = parseWfRow(row)
        if (parsed) wfMap[parsed.type] = parsed
      }
      setWorkflowSettings(wfMap)
    }
    return true
  }, [])

  // ── Permissions ───────────────────────────────────────────────────────────
  const updatePermissions = useCallback((group, updates) => {
    setPermissions((prev) => {
      const next = { ...prev, [group]: { ...prev[group], ...updates } }
      supabase.from('app_settings').upsert({ key: 'permissions', value: next }, { onConflict: 'key' }).then(({ error }) => {
        if (error) console.error('Error saving permissions:', error)
      })
      return next
    })
  }, [])

  // ── Posting Goals ─────────────────────────────────────────────────────────
  const [postingGoals, setPostingGoals] = useState({})

  const updatePostingGoals = useCallback(async (goals) => {
    setPostingGoals(goals)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'posting_goals', value: goals }, { onConflict: 'key' })
    if (error) console.error('Failed to save posting goals:', error)
  }, [])

  // ── Analytics ─────────────────────────────────────────────────────────────
  const [analyticsLog, setAnalyticsLog] = useState([])

  function _saveAnalytics(next) {
    supabase.from('app_settings').upsert({ key: 'analytics_log', value: next }, { onConflict: 'key' }).then(({ error }) => {
      if (error) console.error('Error saving analytics log:', error)
    })
  }

  const submitAnalytics = useCallback((project, { link, notes }) => {
    setAnalyticsLog(prev => {
      const existing = prev.find(a => a.projectId === project.id)
      let next
      if (existing) {
        next = prev.map(a => a.projectId === project.id
          ? { ...a, link, notes, submittedAt: new Date().toISOString(), acknowledged: false }
          : a
        )
      } else {
        next = [...prev, {
          id:           Date.now().toString(),
          projectId:    project.id,
          projectTitle: project.title,
          projectType:  project.type,
          link,
          notes,
          submittedAt:  new Date().toISOString(),
          acknowledged: false,
        }]
      }
      _saveAnalytics(next)
      return next
    })
  }, [])

  const acknowledgeAnalytics = useCallback((analyticsId) => {
    setAnalyticsLog(prev => {
      const next = prev.map(a => a.id === analyticsId ? { ...a, acknowledged: true } : a)
      _saveAnalytics(next)
      return next
    })
  }, [])

  // ── Payments ──────────────────────────────────────────────────────────────
  const [payments, setPayments] = useState([])

  function _savePayments(next) {
    supabase.from('app_settings').upsert({ key: 'payments', value: next }, { onConflict: 'key' }).then(({ error }) => {
      if (error) console.error('Error saving payments:', error)
    })
  }

  const requestPayment = useCallback((project) => {
    setPayments(prev => {
      if (prev.some(p => p.projectId === project.id && p.status !== 'paid')) return prev
      const entry = {
        id:           Date.now().toString(),
        projectId:    project.id,
        projectTitle: project.title,
        projectType:  project.type,
        requestedAt:  new Date().toISOString(),
        status:       'pending',
        paidAt:       null,
      }
      const next = [...prev, entry]
      _savePayments(next)
      return next
    })
  }, [])

  const markPaymentPaid = useCallback((paymentId) => {
    setPayments(prev => {
      const next = prev.map(p => p.id === paymentId
        ? { ...p, status: 'paid', paidAt: new Date().toISOString() }
        : p
      )
      _savePayments(next)
      return next
    })
  }, [])

  // ── Ideas ─────────────────────────────────────────────────────────────────
  const [ideas, setIdeas] = useState([])

  function _saveIdeas(next) {
    supabase.from('app_settings').upsert({ key: 'ideas', value: next }, { onConflict: 'key' }).then(({ error }) => {
      if (error) console.error('Error saving ideas:', error)
    })
  }

  const addIdea = useCallback((fields) => {
    const idea = {
      id:        Date.now().toString(),
      title:     fields.title || 'Untitled Idea',
      notes:     fields.notes || '',
      type:      fields.type  || null,
      createdAt: new Date().toISOString(),
    }
    setIdeas((prev) => {
      const next = [...prev, idea]
      _saveIdeas(next)
      return next
    })
  }, [])

  const updateIdea = useCallback((id, updates) => {
    setIdeas((prev) => {
      const next = prev.map((idea) => idea.id === id ? { ...idea, ...updates } : idea)
      _saveIdeas(next)
      return next
    })
  }, [])

  const deleteIdea = useCallback((id) => {
    setIdeas((prev) => {
      const next = prev.filter((idea) => idea.id !== id)
      _saveIdeas(next)
      return next
    })
  }, [])

  // ── Relevant Links ────────────────────────────────────────────────────────
  const [relevantLinks, setRelevantLinks] = useState({ editor: [], socialManager: [], editorPasswords: [], socialManagerPasswords: [], admin: [], adminPasswords: [] })

  const updateRelevantLinks = useCallback(async (role, links) => {
    setRelevantLinks((prev) => {
      const next = { ...prev, [role]: links }
      supabase.from('app_settings').upsert({ key: 'relevant_links', value: next }, { onConflict: 'key' }).then(({ error }) => {
        if (error) console.error('Error saving relevant links:', error)
      })
      return next
    })
  }, [])

  // ── Clear Notifications ───────────────────────────────────────────────────
  const clearNotifications = useCallback(async (userId) => {
    setNotifications((prev) => prev.filter((n) => n.forUser !== userId && n.forUser !== null))
    await supabase.from('notifications').delete().eq('user_id', userId)
  }, [])

  // ── Context value ──────────────────────────────────────────────────────────

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        verifyPin,
        completeLogin,
        logout,
        projects,
        setProjects,
        notifications,
        addNotification,
        markNotificationsRead,
        unreadCount,
        updateProject,
        advanceStatus,
        overrideStatus,
        addProject,
        deleteProject,
        selectedProject,
        setSelectedProject,
        activeTab,
        setActiveTab,
        loading,
        workflowSettings,
        teamMembers,
        getTeamName,
        getMemberByRole,
        getWorkflow,
        getStageOwner,
        banners,
        addBanner,
        updateTeamMember,
        changePlatform,
        saveWorkflowSettings,
        permissions,
        updatePermissions,
        previewRole,
        setPreviewRole,
        postingGoals,
        updatePostingGoals,
        ideas,
        addIdea,
        updateIdea,
        deleteIdea,
        relevantLinks,
        updateRelevantLinks,
        clearNotifications,
        payments,
        requestPayment,
        markPaymentPaid,
        analyticsLog,
        submitAnalytics,
        acknowledgeAnalytics,
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
