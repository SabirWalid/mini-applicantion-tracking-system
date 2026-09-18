import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!supabaseUrl || !serviceKey || !token) return json({ error: 'Server configuration or authentication is missing' }, 401)

  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data, error } = await adminClient.auth.getUser(token)
  if (error || !data.user) return json({ error: 'Invalid session' }, 401)
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.user.id)
  if (deleteError) return json({ error: deleteError.message }, 500)
  return json({ deleted: true })
})
