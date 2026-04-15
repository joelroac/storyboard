import { addDays, endOfMonth, format, formatDistanceToNow } from 'date-fns'

// Human-readable platform labels
export const TYPE_LABELS = {
  youtube:    'YouTube',
  instagram:  'Instagram',
  tiktok:     'TikTok',
  newsletter: 'Newsletter',
}

/**
 * Returns a color hex string for a given workflow status.
 */
export function getStatusColor(status) {
  const map = {
    'Filming':             '#a78bfa',
    'Raw Footage Ready':   '#818cf8',
    'Drafting':            '#a78bfa',
    'In Review':           '#fbbf24',
    'Editing in Progress': '#60a5fa',
    'Edit Review':         '#f59e0b',
    'Revision Requested':  '#f87171',
    'Final Review':        '#f59e0b',
    'Caption Needed':      '#fb923c',
    'Caption In Review':   '#2dd4bf',
    'Ready to Post':       '#4ade80',
    'Ready to Send':       '#4ade80',
    'Scheduled':           '#facc15',
    'Posted':              '#9ca3af',
    'Sent':                '#9ca3af',
  }
  return map[status] || '#71717a'
}

/**
 * Format a YYYY-MM-DD string like "Jan 5, 2025".
 */
export function formatDateStr(str) {
  if (!str) return '—'
  try {
    const d = new Date(str + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch (_) {
    return str
  }
}

/**
 * Human-readable "X ago" from an ISO timestamp.
 */
export function timeAgo(iso) {
  if (!iso) return ''
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch (_) {
    return iso
  }
}

export const USERS = {
  joel: { id: 'joel', name: 'Joel', role: 'creator', pin: '1111', avatar: 'J' },
  anthony: { id: 'anthony', name: 'Anthony', role: 'editor', pin: '2222', avatar: 'A' },
  tiana: { id: 'tiana', name: 'Tiana', role: 'social', pin: '3333', avatar: 'T' },
}

export const CONTENT_TYPES = {
  youtube: { id: 'youtube', label: 'YouTube Video', icon: 'play', color: '#ef4444' },
  instagram: { id: 'instagram', label: 'Instagram Reel', icon: 'camera', color: '#a855f7' },
  tiktok: { id: 'tiktok', label: 'TikTok Video', icon: 'music', color: '#14b8a6' },
  newsletter: { id: 'newsletter', label: 'Newsletter', icon: 'mail', color: '#f59e0b' },
}

export const WORKFLOWS = {
  youtube: [
    'Filming',
    'Raw Footage Ready',
    'Editing in Progress',
    'Edit Review',
    'Revision Requested',
    'Final Review',
    'Caption Needed',
    'Caption In Review',
    'Ready to Post',
    'Scheduled',
    'Posted',
  ],
  instagram: [
    'Filming',
    'Editing in Progress',
    'Caption Needed',
    'Caption In Review',
    'Ready to Post',
    'Scheduled',
    'Posted',
  ],
  tiktok: [
    'Filming',
    'Editing in Progress',
    'Caption Needed',
    'Caption In Review',
    'Ready to Post',
    'Scheduled',
    'Posted',
  ],
  newsletter: ['Drafting', 'In Review', 'Ready to Send', 'Sent'],
}

export const STAGE_OWNER = {
  youtube: {
    Filming: 'joel',
    'Raw Footage Ready': 'joel',
    'Editing in Progress': 'anthony',
    'Edit Review': 'joel',
    'Revision Requested': 'anthony',
    'Final Review': 'joel',
    'Caption Needed': 'tiana',
    'Caption In Review': 'joel',
    'Ready to Post': 'joel',
    Scheduled: 'joel',
    Posted: 'joel',
  },
  instagram: {
    Filming: 'joel',
    'Editing in Progress': 'joel',
    'Caption Needed': 'tiana',
    'Caption In Review': 'joel',
    'Ready to Post': 'joel',
    Scheduled: 'joel',
    Posted: 'joel',
  },
  tiktok: {
    Filming: 'joel',
    'Editing in Progress': 'joel',
    'Caption Needed': 'tiana',
    'Caption In Review': 'joel',
    'Ready to Post': 'joel',
    Scheduled: 'joel',
    Posted: 'joel',
  },
  newsletter: {
    Drafting: 'joel',
    'In Review': 'joel',
    'Ready to Send': 'joel',
    Sent: 'joel',
  },
}

// Stages where Joel must take action
export const JOEL_REVIEW_STAGES = ['Edit Review', 'Final Review', 'Caption In Review']

// Stages where Anthony is active
export const ANTHONY_STAGES = ['Editing in Progress', 'Edit Review', 'Revision Requested']

// Stages where Tiana is active
export const TIANA_STAGES = ['Caption Needed', 'Caption In Review', 'Ready to Post', 'Scheduled']

function makeHistory(entries) {
  return entries.map(([status, changedBy, daysAgo, note]) => ({
    status,
    changedBy,
    timestamp: addDays(new Date(), -daysAgo).toISOString(),
    note: note || null,
  }))
}

export function createSeedData() {
  const today = new Date()

  return [
    {
      id: 'proj-1',
      title: 'Morning Routine 2025',
      type: 'youtube',
      brand: 'Organic',
      publishDate: format(addDays(today, 5), 'yyyy-MM-dd'),
      dropboxLink: 'https://dropbox.com/example1',
      status: 'Editing in Progress',
      notes: 'Filmed at the new studio. Make sure to include the coffee segment — really good energy there.',
      caption: '',
      scheduledTime: '',
      createdAt: addDays(today, -10).toISOString(),
      statusHistory: makeHistory([
        ['Filming', 'joel', 10],
        ['Raw Footage Ready', 'joel', 7],
        ['Editing in Progress', 'joel', 6],
      ]),
    },
    {
      id: 'proj-2',
      title: 'Nike x Joel Summer Campaign',
      type: 'instagram',
      brand: 'Nike',
      publishDate: format(addDays(today, 3), 'yyyy-MM-dd'),
      dropboxLink: 'https://dropbox.com/example2',
      status: 'Caption Needed',
      notes: 'Nike wants upbeat, energetic copy. Keep it under 150 chars for main caption. Include #JustDoIt and 3 fitness hashtags.',
      caption: '',
      scheduledTime: '',
      createdAt: addDays(today, -5).toISOString(),
      statusHistory: makeHistory([
        ['Filming', 'joel', 5],
        ['Editing in Progress', 'joel', 4],
        ['Caption Needed', 'joel', 1],
      ]),
    },
    {
      id: 'proj-3',
      title: 'Hot Takes: AI and Creativity',
      type: 'tiktok',
      brand: 'Organic',
      publishDate: format(addDays(today, 1), 'yyyy-MM-dd'),
      dropboxLink: '',
      status: 'Ready to Post',
      notes: 'Trending audio — make sure it\'s still trending before posting.',
      caption: '🤖 Hot take: AI won\'t replace creative people — it\'ll just expose who was never actually creative to begin with. Thoughts? 👇 #AICreativity #ContentCreator #HotTake #CreativeLife',
      scheduledTime: '',
      createdAt: addDays(today, -8).toISOString(),
      statusHistory: makeHistory([
        ['Filming', 'joel', 8],
        ['Editing in Progress', 'joel', 6],
        ['Caption Needed', 'joel', 4],
        ['Caption In Review', 'tiana', 3],
        ['Ready to Post', 'joel', 2],
      ]),
    },
    {
      id: 'proj-4',
      title: 'May Creator Newsletter',
      type: 'newsletter',
      brand: 'Organic',
      publishDate: format(endOfMonth(today), 'yyyy-MM-dd'),
      dropboxLink: '',
      status: 'Drafting',
      notes: 'Topics: spring content strategy, tool stack updates, behind the scenes of the Nike collab.',
      caption: '',
      scheduledTime: '',
      createdAt: addDays(today, -2).toISOString(),
      statusHistory: makeHistory([['Drafting', 'joel', 2]]),
    },
  ]
}

export function createSeedNotifications() {
  const today = new Date()
  return [
    {
      id: 'notif-1',
      type: 'edit_complete',
      message: 'Anthony marked "Morning Routine 2025" as done — ready for your review',
      projectId: 'proj-1',
      forUser: 'joel',
      read: false,
      timestamp: addDays(today, -1).toISOString(),
    },
    {
      id: 'notif-2',
      type: 'caption_submitted',
      message: 'Tiana submitted a caption for "Hot Takes: AI and Creativity"',
      projectId: 'proj-3',
      forUser: 'joel',
      read: false,
      timestamp: addDays(today, -2).toISOString(),
    },
    {
      id: 'notif-3',
      type: 'scheduled_tomorrow',
      message: '"Hot Takes: AI and Creativity" is scheduled to post tomorrow',
      projectId: 'proj-3',
      forUser: 'joel',
      read: false,
      timestamp: today.toISOString(),
    },
  ]
}
