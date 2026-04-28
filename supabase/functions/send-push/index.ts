import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? ''
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { targetUserId, title, body, url } = await req.json()

    if (!targetUserId || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload: Record<string, unknown> = {
      app_id:                        ONESIGNAL_APP_ID,
      include_external_user_ids:     [targetUserId],
      channel_for_external_user_ids: 'push',
      headings:                      { en: title },
      contents:                      { en: body },
    }
    if (url) payload.url = url

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    return new Response(JSON.stringify(json), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
