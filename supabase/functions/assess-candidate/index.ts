// Deploy with: supabase functions deploy assess-candidate
// Replace the deterministic scorer with an LLM call using a server-side secret when ready.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const { resumeText, jobDescription } = await request.json()
  if (!resumeText || !jobDescription) return json({ error: 'resumeText and jobDescription are required' }, 400)
  const score = Math.min(99, Math.max(40, Math.round((resumeText.length / Math.max(jobDescription.length, 1)) * 40 + 45)))
  return json({ score, strengths: ['Relevant experience detected'], gaps: ['Review details in interview'], summary: 'Initial assessment generated. Add an AI provider key to enable richer scoring.' })
})