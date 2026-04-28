import OneSignal from 'react-onesignal'

const APP_ID      = import.meta.env.VITE_ONESIGNAL_APP_ID
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL  // already in .env

// Holds the init promise so every caller can await it
let initPromise = null

export function initOneSignal() {
  if (!APP_ID) { console.warn('[OneSignal] No APP_ID — skipping init'); return Promise.resolve() }
  if (initPromise) return initPromise
  initPromise = OneSignal.init({
    appId: APP_ID,
    serviceWorkerPath: '/OneSignalSDKWorker.js',
    notifyButton: { enable: false },
    allowLocalhostAsSecureOrigin: true,
  })
    .then(() => console.log('[OneSignal] init OK'))
    .catch((err) => console.warn('[OneSignal] init error:', err))
  return initPromise
}

export async function identifyUser(userId, role) {
  if (!APP_ID) return
  try {
    await (initPromise || initOneSignal())
    console.log('[OneSignal] logging in user:', userId, role)
    await OneSignal.login(userId)
    await OneSignal.User.addTag('role', role)
    await OneSignal.Notifications.requestPermission()
    console.log('[OneSignal] push enabled:', OneSignal.Notifications.permission)
  } catch (err) {
    console.warn('[OneSignal] identifyUser error:', err)
  }
}

export async function unidentifyUser() {
  if (!APP_ID) return
  try {
    await (initPromise || Promise.resolve())
    await OneSignal.logout()
  } catch (err) {
    console.warn('[OneSignal] logout error:', err)
  }
}

/**
 * Send a push via the Supabase Edge Function (server-side → no CORS issues).
 */
export async function sendPushToUser(targetUserId, title, body, url) {
  if (!SUPABASE_URL || !targetUserId) {
    console.warn('[OneSignal] sendPushToUser skipped — missing config')
    return
  }
  try {
    console.log('[OneSignal] sending push to:', targetUserId, '|', body)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, title, body, url }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.errors) {
      console.warn('[OneSignal] edge fn send failed:', json)
    } else {
      console.log('[OneSignal] send OK — recipients:', json.recipients)
    }
  } catch (err) {
    console.warn('[OneSignal] sendPushToUser error:', err)
  }
}
