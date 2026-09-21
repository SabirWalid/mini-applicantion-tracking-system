import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to deployed Edge
  // Functions by Supabase. Do not use frontend environment variables here.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Supabase server configuration is incomplete' }, 500)

  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Authorization required' }, 401)
  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data: authData, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)

  const { data: membership } = await adminClient.from('memberships').select('organization_id, role').eq('user_id', authData.user.id).eq('role', 'admin').limit(1).maybeSingle()
  if (!membership) return json({ error: 'Only workspace admins can create accounts' }, 403)
  let body: { email?: string; fullName?: string; role?: 'admin' | 'customer' }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400)
  }
  const email = body.email?.trim().toLowerCase()
  const fullName = body.fullName?.trim()
  const role = body.role
  if (!email || !fullName || !['admin', 'customer'].includes(role ?? '')) return json({ error: 'email, fullName, and a valid role are required' }, 400)

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } })
  if (inviteError || !invited.user) return json({ error: inviteError?.message ?? 'Unable to invite user' }, 400)
  const { error: profileError } = await adminClient.from('profiles').update({ full_name: fullName, role }).eq('id', invited.user.id)
  if (profileError) return json({ error: profileError.message }, 500)
  const organizationId = membership.organization_id
  const { error: membershipError } = await adminClient.from('memberships').insert({ organization_id: organizationId, user_id: invited.user.id, role })
  if (membershipError) return json({ error: membershipError.message }, 500)
  return json({ id: invited.user.id, email, role })
})
