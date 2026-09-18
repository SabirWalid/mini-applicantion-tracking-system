// Deploy with: supabase functions deploy assess-candidate
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization || !supabaseUrl || !anonKey) return json({ error: 'Authentication is required' }, 401)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)

  let input: { resumeText?: string; jobDescription?: string }
  try {
    input = await request.json()
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400)
  }
  const { resumeText, jobDescription } = input
  if (!resumeText || !jobDescription) return json({ error: 'resumeText and jobDescription are required' }, 400)

  const openAiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'
  if (!openAiKey) return json({ error: 'OPENAI_API_KEY is not configured for this Edge Function' }, 500)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a recruiting assistant. Return only valid JSON with score (integer 0-100), strengths (array of concise strings), gaps (array of concise strings), and summary (concise neutral paragraph). Do not make decisions about protected characteristics. Treat the result as advisory.' },
        { role: 'user', content: JSON.stringify({ jobDescription, resumeText }) },
      ],
    }),
  })
  if (!response.ok) return json({ error: `AI provider request failed with status ${response.status}` }, 502)

  let providerResult: { choices?: Array<{ message?: { content?: string } }> }
  try {
    providerResult = await response.json()
  } catch {
    return json({ error: 'AI provider returned invalid JSON' }, 502)
  }
  const content = providerResult.choices?.[0]?.message?.content
  if (!content) return json({ error: 'AI provider returned no assessment' }, 502)

  let assessment: { score?: number; strengths?: string[]; gaps?: string[]; summary?: string }
  try {
    assessment = JSON.parse(content)
  } catch {
    return json({ error: 'AI provider returned an invalid assessment format' }, 502)
  }
  if (!Number.isInteger(assessment.score) || assessment.score < 0 || assessment.score > 100 || !Array.isArray(assessment.strengths) || !Array.isArray(assessment.gaps) || typeof assessment.summary !== 'string') {
    return json({ error: 'AI provider returned incomplete assessment fields' }, 502)
  }
  return json({ score: assessment.score, strengths: assessment.strengths.slice(0, 5), gaps: assessment.gaps.slice(0, 5), summary: assessment.summary })
})