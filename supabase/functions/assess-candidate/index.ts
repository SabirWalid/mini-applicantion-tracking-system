// Deploy with: supabase functions deploy assess-candidate
// The production version should call an LLM provider using a server-side secret.
// Keep resume text out of client-side code and store only the structured result.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const { resumeText, jobDescription } = await request.json()
  if (!resumeText || !jobDescription) return Response.json({ error: 'resumeText and jobDescription are required' }, { status: 400 })
  // Replace this deterministic placeholder with your chosen AI provider call.
  // Ask for JSON: { score: 0-100, strengths: string[], gaps: string[], summary: string }.
  const score = Math.min(99, Math.max(40, Math.round((resumeText.length / Math.max(jobDescription.length, 1)) * 40 + 45)))
  return Response.json({ score, strengths: ['Relevant experience detected'], gaps: ['Review details in interview'], summary: 'Initial assessment generated. Add an AI provider key to enable richer scoring.' })
})
