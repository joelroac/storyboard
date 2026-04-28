import OneSignal from 'react-onesignal'

const APP_ID  = import.meta.env.VITE_ONESIGNAL_APP_ID
const API_KEY = import.meta.env.VITE_ONESIGNAL_API_KEY

// Holds the init promise so every caller can await it — even if called before init resolves
let initPromise = null

/**
 * Call once at app start (main.jsx).
 */
export function initOneSignal() {
  if (!APP_ID) { console.warn('[OneSignal] No APP_ID — skipping init'); return Promise.resolve() }
  if (initPromise) return initPromise
  initPromise = OneSignal.init({
    appId: APP_ID,
    serviceWorkerPath: '/OneSignalSDKWorker.js',
    notifyButton: { enable: false },
    allowLocalhostAsSecureOrigin: true,
  })
    .then(() => { console.log('[OneSignal] init OK') })
    .catch((err) => { console.warn('[OneSignal] init error:', err) })
  return initPromise
}

/**
 * Tag the logged-in user so their device is reachable.
 */
export async function identifyUser(userId, role) {
  if (!APP_ID) return
  try {
    await (initPromise || initOneSignal())
    console.log('[OneSignal] logging in user:', userId, role)
    await OneSignal.login(userId)
    await OneSignal.User.addTag('role', role)
    const permission = await OneSignal.Notifications.requestPermission()
    console.log('[OneSignal] notification permission:', permission)
    // Log the current subscription state so we can verify in the console
    const isPushEnabled = OneSignal.Notifications.permission
    console.log('[OneSignal] push enabled:', isPushEnabled)
  } catch (err) {
    console.warn('[OneSignal] identifyUser error:', err)
  }
}

/**
 * Unlink user from this device on logout.
 */
export async function unidentifyUser() {
  if (!APP_ID) return
  try {
    await (initPromise || Promise.resolve())
    await OneSignal.logout()
    console.log('[OneSignal] logged out')
  } catch (err) {
    console.warn('[OneSignal] logout error:', err)
  }
}

/**
 * Send a push notification to a specific user via the OneSignal REST API.
 */
export async function sendPushToUser(targetUserId, title, body, url) {
  if (!APP_ID || !API_KEY || !targetUserId) {
    console.warn('[OneSignal] sendPushToUser skipped — missing config', { APP_ID: !!APP_ID, API_KEY: !!API_KEY, targetUserId })
    return
  }
  try {
    console.log('[OneSignal] sending push to:', targetUserId, '|', title, '|', body)

    // include_external_user_ids is the battle-tested v1 format for targeting
    // by external ID — more reliable than include_aliases for the v1 endpoint
    const payload = {
      app_id:                         APP_ID,
      include_external_user_ids:      [targetUserId],
      channel_for_external_user_ids:  'push',
      headings:                        { en: title },
      contents:                        { en: body },
    }
    if (url) payload.url = url

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Key ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.errors) {
      console.warn('[OneSignal] send failed — status:', res.status, 'body:', json)
    } else {
      console.log('[OneSignal] send OK — id:', json.id, 'recipients:', json.recipients)
    }
  } catch (err) {
    console.warn('[OneSignal] sendPushToUser error:', err)
  }
}
