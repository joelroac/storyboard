import OneSignal from 'react-onesignal'

const APP_ID       = import.meta.env.VITE_ONESIGNAL_APP_ID
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

// Holds the init promise + whether init actually succeeded
let initPromise = null
let initSucceeded = false

export function initOneSignal() {
  if (!APP_ID) { console.warn('[OneSignal] No APP_ID — skipping init'); return Promise.resolve() }
  if (initPromise) return initPromise
  initPromise = OneSignal.init({
    appId: APP_ID,
    serviceWorkerPath: '/OneSignalSDKWorker.js',
    notifyButton: { enable: false },
    allowLocalhostAsSecureOrigin: true,
  })
    .then(() => { initSucceeded = true; console.log('[OneSignal] init OK') })
    .catch((err) => { initSucceeded = false; console.warn('[OneSignal] init error (domain mismatch on localhost is expected):', err.message) })
  return initPromise
}

export async function identifyUser(userId, role) {
  if (!APP_ID) return
  await (initPromise || initOneSignal())
  // If init failed (e.g. wrong domain on localhost) skip SDK calls — push sending still works via edge fn
  if (!initSucceeded) return
  try {
    await OneSignal.login(userId)
    await OneSignal.User.addTag('role', role)
    await OneSignal.Notifications.requestPermission()
    console.log('[OneSignal] user identified:', userId, '| push enabled:', OneSignal.Notifications.permission)
  } catch (err) {
    console.warn('[OneSignal] identifyUser error:', err)
  }
}

export async function unidentifyUser() {
  if (!APP_ID || !initSucceeded) return
  try {
    await OneSignal.logout()
  } catch (err) {
    console.warn('[OneSignal] logout error:', err)
  }
}

/**
 * Send a push via the Supabase Edge Function — runs server-side, no CORS issues.
 */
export async function sendPushToUser(targetUserId, title, body, url) {
  if (!SUPABASE_URL || !ANON_KEY || !targetUserId) {
    console.warn('[OneSignal] sendPushToUser skipped — missing config')
    return
  }
  try {
    console.log('[OneSignal] sending push to:', targetUserId, '|', body)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        ANON_KEY,       // required by Supabase edge function gateway
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ targetUserId, title, body, url }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.errors) {
      console.warn('[OneSignal] edge fn send failed — status:', res.status, json)
    } else {
      console.log('[OneSignal] send OK — recipients:', json.recipients)
    }
  } catch (err) {
    console.warn('[OneSignal] sendPushToUser error:', err)
  }
}
