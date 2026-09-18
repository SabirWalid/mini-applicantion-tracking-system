import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type RequestBody = { action?: 'list' | 'members' | 'approve'; userId?: string; role?: 'admin' | 'customer' }

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Supabase server configuration is incomplete' }, 500)

  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Authorization required' }, 401)
  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data: authData, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)

  const { data: adminMembership } = await adminClient.from('memberships').select('organization_id, role').eq('user_id', authData.user.id).eq('role', 'admin').limit(1).maybeSingle()
  if (!adminMembership) return json({ error: 'Only workspace admins can manage access' }, 403)

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400)
  }

  if (body.action === 'list') {
    const { data: users, error: usersError } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) return json({ error: usersError.message }, 500)
    const { data: memberships, error: membershipsError } = await adminClient.from('memberships').select('user_id').eq('organization_id', adminMembership.organization_id)
    if (membershipsError) return json({ error: membershipsError.message }, 500)
    const memberIds = new Set((memberships ?? []).map(member => member.user_id))
    const pending = users.users.filter(user => user.email_confirmed_at && !memberIds.has(user.id)).map(user => ({ id: user.id, email: user.email ?? '', fullName: user.user_metadata?.full_name ?? user.email ?? 'Unnamed user', confirmedAt: user.email_confirmed_at }))
    return json({ users: pending })
  }

  if (body.action === 'members') {
    const { data: memberships, error: membershipsError } = await adminClient.from('memberships').select('user_id, role, organization_id').eq('organization_id', adminMembership.organization_id)
    if (membershipsError) return json({ error: membershipsError.message }, 500)
    const { data: users, error: usersError } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) return json({ error: usersError.message }, 500)
    const userById = new Map(users.users.map(user => [user.id, user]))
    const members = (memberships ?? []).map(member => {
      const user = userById.get(member.user_id)
      return { id: member.user_id, email: user?.email ?? '', fullName: user?.user_metadata?.full_name ?? user?.email ?? 'Unnamed user', role: member.role, confirmedAt: user?.email_confirmed_at ?? null }
    })
    return json({ members })
  }

  if (body.action === 'approve') {
    if (!body.userId || !['admin', 'customer'].includes(body.role ?? '')) return json({ error: 'userId and a valid role are required' }, 400)
    const { error: membershipError } = await adminClient.from('memberships').upsert({ organization_id: adminMembership.organization_id, user_id: body.userId, role: body.role }, { onConflict: 'organization_id,user_id' })
    if (membershipError) return json({ error: membershipError.message }, 500)
    const { error: profileError } = await adminClient.from('profiles').update({ role: body.role, access_granted_at: new Date().toISOString(), access_granted_by: authData.user.id }).eq('id', body.userId)
    if (profileError) return json({ error: profileError.message }, 500)
    return json({ userId: body.userId, role: body.role, organizationId: adminMembership.organization_id })
  }

  return json({ error: 'action must be list, members, or approve' }, 400)
})
