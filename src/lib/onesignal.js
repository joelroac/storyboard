import OneSignal from 'react-onesignal'

const APP_ID  = import.meta.env.VITE_ONESIGNAL_APP_ID
const API_KEY = import.meta.env.VITE_ONESIGNAL_API_KEY

let initialized = false

/**
 * Call once at app start (main.jsx).
 * Registers the service worker and prompts the user for notification permission.
 */
export async function initOneSignal() {
  if (initialized || !APP_ID) return
  initialized = true
  try {
    await OneSignal.init({
      appId: APP_ID,
      serviceWorkerPath: '/OneSignalSDKWorker.js',
      notifyButton: { enable: false },   // we use our own UI prompt
      allowLocalhostAsSecureOrigin: true, // lets it work during local dev
    })
  } catch (err) {
    console.warn('[OneSignal] init error:', err)
  }
}

/**
 * Tag the logged-in user so their device is reachable.
 * Call after a successful login.
 * @param {string} userId  – the Supabase user row id
 * @param {string} role    – e.g. 'editor', 'social_manager'
 */
export async function identifyUser(userId, role) {
  if (!APP_ID) return
  try {
    await OneSignal.login(userId)           // links this browser to the user id
    await OneSignal.User.addTag('role', role)
    await OneSignal.Notifications.requestPermission()
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
    await OneSignal.logout()
  } catch (err) {
    console.warn('[OneSignal] logout error:', err)
  }
}

/**
 * Send a push notification to a specific user via the OneSignal REST API.
 * This runs client-side; for production you'd move this to a Supabase Edge Function.
 *
 * @param {string}   targetUserId   – Supabase user-row id of the recipient
 * @param {string}   title          – notification title
 * @param {string}   body           – notification body text
 * @param {string}  [url]           – optional deep-link URL
 */
export async function sendPushToUser(targetUserId, title, body, url) {
  if (!APP_ID || !API_KEY) return
  try {
    const payload = {
      app_id:             APP_ID,
      include_aliases:    { external_id: [targetUserId] },
      target_channel:     'push',
      headings:           { en: title },
      contents:           { en: body },
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('[OneSignal] send failed:', err)
    }
  } catch (err) {
    console.warn('[OneSignal] sendPushToUser error:', err)
  }
}
