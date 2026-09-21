import { useEffect, useState } from 'react'
import { BarChart3, BriefcaseBusiness, ChevronDown, ClipboardList, ExternalLink, Filter, Globe2, LogOut, Mail, Phone, Plus, Search, ShieldCheck, Sparkles, UserPlus, Users, X } from 'lucide-react'
import * as mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from './lib/supabase'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type Role = 'admin' | 'customer'
type Stage = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected'
type Session = { email: string; role: Role; userId?: string; organizationId?: string }
type Job = { id: string; title: string; location: string; description?: string; status: string }
type Candidate = { id: string; name: string; jobId: string; stage: Stage; location: string; initials: string; score: number; added: string; linkedin?: string; email?: string; phone?: string; summary?: string }
type PendingUser = { id: string; email: string; fullName: string; confirmedAt: string }
type WorkspaceMember = { id: string; email: string; fullName: string; role: Role; confirmedAt: string | null }
const stages: Stage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']
const stageTone: Record<Stage, string> = { Applied: 'blue', Screening: 'amber', Interview: 'violet', Offer: 'green', Hired: 'green', Rejected: 'muted' }
const locationSuggestions = ['Cape Town, South Africa', 'Johannesburg, South Africa', 'Pretoria, South Africa', 'Durban, South Africa', 'Gqeberha, South Africa', 'Nairobi, Kenya', 'Lagos, Nigeria', 'Accra, Ghana', 'Cairo, Egypt', 'London, United Kingdom', 'Manchester, United Kingdom', 'New York, United States', 'Austin, United States', 'San Francisco, United States', 'Toronto, Canada', 'Vancouver, Canada', 'Berlin, Germany', 'Amsterdam, Netherlands', 'Paris, France', 'Dubai, United Arab Emirates', 'Bengaluru, India', 'Mumbai, India', 'Singapore', 'Sydney, Australia', 'Remote']
const seedJobs: Job[] = [{ id: 'product', title: 'Senior Product Designer', location: 'Remote · US', status: 'Active' }, { id: 'engineer', title: 'Frontend Engineer', location: 'New York · Hybrid', status: 'Active' }, { id: 'growth', title: 'Growth Marketing Lead', location: 'Remote · US', status: 'Active' }]
const seedCandidates: Candidate[] = [{ id: '1', name: 'Avery Morgan', jobId: 'product', stage: 'Applied', location: 'Austin, TX', initials: 'AM', score: 91, added: '2h ago', linkedin: 'https://linkedin.com' }, { id: '2', name: 'Jamie Chen', jobId: 'product', stage: 'Screening', location: 'Seattle, WA', initials: 'JC', score: 86, added: 'Yesterday' }, { id: '3', name: 'Maya Patel', jobId: 'engineer', stage: 'Interview', location: 'Brooklyn, NY', initials: 'MP', score: 94, added: 'Yesterday' }, { id: '4', name: 'Jordan Bell', jobId: 'engineer', stage: 'Applied', location: 'Chicago, IL', initials: 'JB', score: 78, added: '2d ago' }, { id: '5', name: 'Noah Williams', jobId: 'growth', stage: 'Offer', location: 'Denver, CO', initials: 'NW', score: 89, added: '3d ago' }, { id: '6', name: 'Sam Rivera', jobId: 'growth', stage: 'Screening', location: 'Los Angeles, CA', initials: 'SR', score: 82, added: '4d ago' }]

async function extractCvText(file: File) {
  const extension = file.name.toLowerCase().split('.').pop()
  if (extension === 'txt' || extension === 'md' || extension === 'rtf') return file.text()
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
  }
  if (extension === 'pdf') {
    const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map(item => 'str' in item ? item.str : '').join(' '))
    }
    return pages.join('\n')
  }
  throw new Error('Unsupported file type. Upload a PDF, DOCX, TXT, Markdown, or RTF file.')
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [view, setView] = useState('Pipeline')
  const [jobFilter, setJobFilter] = useState('all')
  const [nameFilter, setNameFilter] = useState('')
  const [modal, setModal] = useState<'candidate' | 'job' | 'account' | null>(null)
  const [notice, setNotice] = useState('')
  const [assessmentBusy, setAssessmentBusy] = useState(false)
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([])

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setAuthError(''); setAuthNotice('')
    if (!supabase) { setAuthError('Supabase is not configured. Connect the database before signing in.'); return }
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error || !data.user) { setAuthError(error?.message ?? 'Unable to sign in'); return }
    const { data: membership, error: membershipError } = await supabase.from('memberships').select('organization_id, role').eq('user_id', data.user.id).limit(1).maybeSingle()
    if (membershipError) { await supabase.auth.signOut(); setAuthError(`Unable to load workspace access: ${membershipError.message}`); return }
    if (!membership) { await supabase.auth.signOut(); setAuthError('Your account exists, but it is not connected to a workspace yet. Ask an admin to add your membership.'); return }
    const nextSession = { email: data.user.email ?? email, role: membership.role as Role, userId: data.user.id, organizationId: membership.organization_id }
    setSession(nextSession)
    setView(nextSession.role === 'admin' ? 'Admin Dashboard' : 'Pipeline')
    const { data: profile } = await supabase.from('profiles').select('access_granted_at').eq('id', data.user.id).maybeSingle()
    if (profile?.access_granted_at) setNotice('Your workspace access has been approved. You can now use Talentflow.')
  }

  async function signUp(event: React.FormEvent) {
    event.preventDefault(); setAuthError(''); setAuthNotice('')
    if (!supabase) { setAuthError('Connect Supabase before creating a real account.'); return }
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin } })
    if (error) { setAuthError(error.message); return }
    if (data.session) {
      await supabase.auth.signOut()
      setAuthNotice('Account created. An admin must connect your account to a workspace before you can sign in.')
    } else {
      setAuthNotice('Account created. Check your email to confirm your account, then ask an admin to connect you to a workspace.')
    }
  }

  async function signInWithGoogle() {
    setAuthError(''); setAuthNotice('')
    if (!supabase) { setAuthError('Supabase is not configured. Connect the database before signing in.'); return }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setAuthError(error.message)
  }

  async function signOut() {
    window.location.hash = 'account'
    setModal('account')
  }

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    const restore = async () => {
      const { data } = await client.auth.getSession()
      if (!active || !data.session) return
      const { data: membership } = await client.from('memberships').select('organization_id, role').eq('user_id', data.session.user.id).limit(1).maybeSingle()
      if (active && membership) {
        const restoredSession = { email: data.session.user.email ?? '', role: membership.role as Role, userId: data.session.user.id, organizationId: membership.organization_id }
        setSession(restoredSession)
        setView(restoredSession.role === 'admin' ? 'Admin Dashboard' : 'Pipeline')
      }
    }
    void restore()
    const { data: listener } = client.auth.onAuthStateChange((_event, current) => { if (!current) setSession(null) })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.organizationId) return
    const client = supabase
    let active = true
    const loadWorkspace = async () => {
      const [{ data: jobRows, error: jobError }, { data: candidateRows, error: candidateError }] = await Promise.all([client.from('jobs').select('id,title,location,description,status').eq('organization_id', session.organizationId).order('created_at', { ascending: false }), client.from('candidates').select('id,full_name,job_id,stage,location,linkedin_url,email,phone,ai_score,ai_summary,created_at').eq('organization_id', session.organizationId).order('created_at', { ascending: false })])
      if (!active) return
      if (jobError || candidateError) { setNotice(jobError?.message ?? candidateError?.message ?? 'Unable to load workspace data'); return }
      if (jobRows) setJobs(jobRows)
      if (candidateRows) setCandidates(candidateRows.map(row => ({ id: row.id, name: row.full_name, jobId: row.job_id, stage: row.stage as Stage, location: row.location ?? 'Location not added', initials: row.full_name.split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(), score: row.ai_score ?? 0, added: new Date(row.created_at).toLocaleDateString(), linkedin: row.linkedin_url ?? undefined, email: row.email ?? undefined, phone: row.phone ?? undefined, summary: row.ai_summary ?? undefined })))
    }
    void loadWorkspace()
    const channel = client.channel(`workspace:${session.organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `organization_id=eq.${session.organizationId}` }, () => void loadWorkspace())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates', filter: `organization_id=eq.${session.organizationId}` }, () => void loadWorkspace())
      .subscribe()
    return () => { active = false; void client.removeChannel(channel) }
  }, [session?.organizationId])

  useEffect(() => {
    if (!supabase || session?.role !== 'admin') { setPendingUsers([]); setWorkspaceMembers([]); return }
    const client = supabase
    const loadAccessData = async () => {
      const [{ data: pendingData, error: pendingError }, { data: membersData, error: membersError }] = await Promise.all([client.functions.invoke('admin-manage-access', { body: { action: 'list' } }), client.functions.invoke('admin-manage-access', { body: { action: 'members' } })])
      if (pendingError || membersError) { setNotice(`Unable to load team access: ${pendingError?.message ?? membersError?.message}`); return }
      setPendingUsers((pendingData?.users ?? []) as PendingUser[])
      setWorkspaceMembers((membersData?.members ?? []) as WorkspaceMember[])
    }
    void loadAccessData()
    const refreshTimer = window.setInterval(() => void loadAccessData(), 15000)
    return () => window.clearInterval(refreshTimer)
  }, [session?.role, session?.organizationId])

  if (!session) return <Login email={email} password={password} fullName={fullName} setEmail={setEmail} setPassword={setPassword} setFullName={setFullName} signIn={signIn} signUp={signUp} signInWithGoogle={signInWithGoogle} error={authError} notice={authNotice} />
  const activeView = session.role === 'admin' || view !== 'Admin Dashboard' ? view : 'Pipeline'
  const filtered = candidates.filter(candidate => (jobFilter === 'all' || candidate.jobId === jobFilter) && candidate.name.toLowerCase().includes(nameFilter.toLowerCase()))
  const jobName = (id: string) => jobs.find(job => job.id === id)?.title ?? 'Unknown role'
  const moveCandidate = async (id: string, stage: Stage) => {
    const previousStage = candidates.find(candidate => candidate.id === id)?.stage
    setCandidates(current => current.map(candidate => candidate.id === id ? { ...candidate, stage } : candidate))
    if (!supabase || !session.organizationId) return
    const { error } = await supabase.from('candidates').update({ stage }).eq('id', id).eq('organization_id', session.organizationId)
    if (error) {
      setCandidates(current => current.map(candidate => candidate.id === id ? { ...candidate, stage: previousStage ?? candidate.stage } : candidate))
      setNotice(`Candidate stage could not be updated: ${error.message}`)
    }
  }
  const assess = async (candidateId: string, resumeText: string, jobDescription: string) => {
    if (!supabase) { setNotice('Assessment requires a Supabase connection.'); return null }
    setAssessmentBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('assess-candidate', { body: { resumeText, jobDescription } })
      if (error) {
        const details = error.context instanceof Response ? await error.context.text() : ''
        setNotice(details || `Assessment failed: ${error.message}`)
        return null
      }
      if (!Number.isInteger(data?.score) || !data?.summary) { setNotice('Assessment returned an incomplete result. Redeploy the assess-candidate function.'); return null }
      if (session.organizationId) {
        const { error: updateError } = await supabase.from('candidates').update({ ai_score: data.score, ai_summary: data.summary }).eq('id', candidateId).eq('organization_id', session.organizationId)
        if (updateError) { setNotice(`Assessment succeeded, but the note could not be saved: ${updateError.message}`); return null }
      }
      return data as { score: number; summary: string }
    } finally {
      setAssessmentBusy(false)
    }
  }
  const saveCandidate = async (candidate: Candidate, resumeText: string, jobDescription: string) => {
    let saved = candidate
    let assessmentGenerated = false
    if (supabase && session.organizationId && session.userId) {
      let jobId = candidate.jobId
      if (jobId.startsWith('new:')) {
        const title = jobId.slice(4).trim()
        const { data: job, error: jobError } = await supabase.from('jobs').insert({ organization_id: session.organizationId, title, location: candidate.location === 'Location not added' ? 'Remote' : candidate.location, created_by: session.userId }).select('id,title,location,description,status').single()
        if (jobError || !job) { setNotice(`The new role could not be created: ${jobError?.message ?? 'Unknown error'}`); return }
        jobId = job.id
        setJobs(current => [{ id: job.id, title: job.title, location: job.location, description: job.description ?? undefined, status: job.status }, ...current])
      }
      const { data, error } = await supabase.from('candidates').insert({ organization_id: session.organizationId, job_id: jobId, full_name: candidate.name, email: candidate.email, phone: candidate.phone, location: candidate.location, linkedin_url: candidate.linkedin, stage: candidate.stage, created_by: session.userId }).select('id').single()
      if (error) { setNotice(`Candidate could not be saved: ${error.message}`); return }
      saved = { ...candidate, id: data.id, jobId }
      if (resumeText.trim()) {
        const result = await assess(saved.id, resumeText, jobDescription || 'General candidate assessment')
        if (result) { saved = { ...saved, score: result.score, summary: result.summary }; assessmentGenerated = true }
      }
    }
    setCandidates(current => [...current, saved])
    setModal(null)
    if (resumeText.trim() && assessmentGenerated) setNotice('Candidate saved and AI note generated.')
  }
  const saveJob = async (job: Omit<Job, 'id' | 'status'>) => { let saved: Job = { ...job, id: crypto.randomUUID(), status: 'Active' }; if (supabase && session.organizationId && session.userId) { const { data, error } = await supabase.from('jobs').insert({ ...job, organization_id: session.organizationId, created_by: session.userId }).select('id,status').single(); if (error) { setNotice(error.message); return }; saved = { ...saved, id: data.id, status: data.status } }; setJobs(current => [...current, saved]); setModal(null) }
  const createAccount = async (account: { email: string; fullName: string; role: Role }) => { if (!supabase || !session.userId) return; const { error } = await supabase.functions.invoke('admin-create-user', { body: account }); setNotice(error ? error.message : `${account.email} was invited successfully.`); if (!error) setModal(null) }
  const approveUser = async (userId: string, role: Role) => { if (!supabase) return; const { error } = await supabase.functions.invoke('admin-manage-access', { body: { action: 'approve', userId, role } }); if (error) { setNotice(`Unable to approve access: ${error.message}`); return }; setPendingUsers(current => current.filter(user => user.id !== userId)); setNotice('Access approved. The customer can now sign in to the workspace.') }
  const deleteAccount = async () => { if (!supabase) return false; const { error } = await supabase.functions.invoke('delete-account', { body: {} }); if (error) { setNotice(`Unable to delete account: ${error.message}`); return false }; await supabase.auth.signOut(); setSession(null); return true }

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">T</div><span>talentflow</span><small>WORKSPACE</small></div><div className="workspace-switcher"><div className="workspace-avatar">AC</div><div><strong>Acme Co.</strong><span>{session.role === 'admin' ? 'Admin workspace' : 'Customer workspace'}</span></div><ChevronDown size={15} /></div><nav><p className="nav-label">Workspace</p>{['Pipeline', 'Jobs', 'Candidates'].map(item => <button key={item} className={activeView === item ? 'nav-item active' : 'nav-item'} onClick={() => setView(item)}>{item === 'Pipeline' ? <BarChart3 size={17} /> : item === 'Jobs' ? <BriefcaseBusiness size={17} /> : <Users size={17} />}{item}</button>)}{session.role === 'admin' && <><p className="nav-label admin-label">Admin</p><button className={activeView === 'Admin Dashboard' ? 'nav-item active admin-nav' : 'nav-item admin-nav'} onClick={() => setView('Admin Dashboard')}><ShieldCheck size={17} />Admin Dashboard{pendingUsers.length > 0 && <b className="request-count">{pendingUsers.length}</b>}</button><button className={activeView === 'Team' ? 'nav-item active' : 'nav-item'} onClick={() => setView('Team')}><UserPlus size={17} />Team & access</button></>}</nav><div className="sidebar-bottom"><div className="help-card"><Sparkles size={16} /><strong>AI candidate notes</strong><span>Score CVs faster with structured signals.</span></div><button className="user-row" onClick={() => void signOut()}><div className="avatar small">{session.email.slice(0, 2).toUpperCase()}</div><div><strong>{session.email.split('@')[0]}</strong><span>{session.role === 'admin' ? 'Admin' : 'Recruiter'}</span></div><LogOut size={15} /></button></div></aside><main className="main-content"><header className="topbar"><div><p className="eyebrow">{activeView === 'Pipeline' ? 'Hiring overview' : activeView === 'Admin Dashboard' ? 'Administration' : activeView}</p><h1>{activeView === 'Pipeline' ? 'Candidate pipeline' : activeView === 'Jobs' ? 'Your open roles' : activeView === 'Candidates' ? 'All candidates' : activeView === 'Admin Dashboard' ? 'Admin dashboard' : 'Team & access'}</h1></div><div className="top-actions"><span className="live-dot">Live workspace</span>{activeView === 'Admin Dashboard' || activeView === 'Team' ? <button className="button primary" onClick={() => setModal('account')}><UserPlus size={17} />Create account</button> : <button className="button primary" onClick={() => setModal(activeView === 'Jobs' ? 'job' : 'candidate')}><Plus size={17} />{activeView === 'Jobs' ? 'Post a job' : 'Add candidate'}</button>}</div></header>{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}{activeView === 'Admin Dashboard' && <AdminDashboard jobs={jobs} candidates={candidates} pendingUsers={pendingUsers} onApproveUser={approveUser} onNavigate={setView} onAddAccount={() => setModal('account')} onAddJob={() => setModal('job')} onAddCandidate={() => setModal('candidate')} />}{activeView === 'Pipeline' && <><section className="metrics"><Metric icon={<Users size={18} />} label="Total candidates" value={candidates.length.toString()} detail="Across all open roles" /><Metric icon={<BriefcaseBusiness size={18} />} label="Open roles" value={jobs.length.toString()} detail="All hiring plans active" /><Metric icon={<ClipboardList size={18} />} label="In interview" value={candidates.filter(c => c.stage === 'Interview').length.toString()} detail="Moving this week" /><Metric icon={<Sparkles size={18} />} label="Avg. CV score" value={candidates.length ? Math.round(candidates.reduce((sum, c) => sum + c.score, 0) / candidates.length).toString() : '0'} detail="AI-assisted signal" /></section><Pipeline filtered={filtered} jobs={jobs} jobFilter={jobFilter} setJobFilter={setJobFilter} nameFilter={nameFilter} setNameFilter={setNameFilter} jobName={jobName} moveCandidate={moveCandidate} onAdd={() => setModal('candidate')} /></>}{activeView === 'Jobs' && <Jobs jobs={jobs} candidates={candidates} onAdd={() => setModal('job')} />}{activeView === 'Candidates' && <section className="candidate-list">{filtered.map(candidate => <CandidateCard key={candidate.id} candidate={candidate} jobName={jobName(candidate.jobId)} moveCandidate={moveCandidate} />)}</section>}{activeView === 'Team' && <Team session={session} onAdd={() => setModal('account')} />}<footer>Talentflow ATS <span>·</span> Built for focused hiring <span>·</span> <a href="https://supabase.com" target="_blank" rel="noreferrer">Powered by Supabase <ExternalLink size={12} /></a></footer></main>{modal === 'candidate' && <CandidateModal jobs={jobs} onClose={() => setModal(null)} onSave={saveCandidate} assessmentBusy={assessmentBusy} />}{modal === 'job' && <JobModal onClose={() => setModal(null)} onSave={saveJob} />}{modal === 'account' && <AccountModal onClose={() => setModal(null)} onSave={createAccount} />}</div>
}

function Login({ email, password, fullName, setEmail, setPassword, setFullName, signIn, signUp, signInWithGoogle, error, notice }: { email: string; password: string; fullName: string; setEmail: (value: string) => void; setPassword: (value: string) => void; setFullName: (value: string) => void; signIn: (event: React.FormEvent) => void; signUp: (event: React.FormEvent) => void; signInWithGoogle: () => void; error: string; notice: string }) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const isSignup = mode === 'signup'
  return <main className="login-page"><div className="login-art"><div className="brand light"><div className="brand-mark">T</div><span>talentflow</span></div><div className="art-copy"><p className="eyebrow">Hiring, with clarity</p><h1>The calm place to build your next team.</h1><p>One focused workspace for every candidate, conversation, and great hire.</p></div><div className="quote">“The fastest part of our hiring process is finally the part that matters.”<small>— Maya, Head of People</small></div></div><div className="login-panel"><div className="login-form"><p className="eyebrow">{isSignup ? 'Get started' : 'Welcome back'}</p><h2>{isSignup ? 'Create your Talentflow account' : 'Sign in to Talentflow'}</h2><p className="muted">{isSignup ? 'Create an account to join a hiring workspace.' : "Your team's hiring workspace is waiting."}</p><button type="button" className="button google-button full" onClick={signInWithGoogle}><Globe2 size={16} />Continue with Google</button><div className="auth-divider">or use email</div><form onSubmit={isSignup ? signUp : signIn}>{isSignup && <label>Full name<input autoFocus type="text" value={fullName} onChange={event => setFullName(event.target.value)} required /></label>}<label>Email address<input autoFocus={!isSignup} type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} required /></label>{error && <p className="form-error">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}<button className="button primary full">{isSignup ? 'Create account' : 'Sign in'} <ChevronDown size={16} className="rotate" /></button></form><button type="button" className="login-switch" onClick={() => setMode(isSignup ? 'signin' : 'signup')}>{isSignup ? 'Already have an account? Sign in' : 'New to Talentflow? Create an account'}</button>{!supabase && <p className="login-note">Supabase must be configured before users can sign in or create an account.</p>}</div><span className="login-footer">© 2026 Talentflow · Privacy · Terms</span></div></main>
}
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="metric"><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }
function Pipeline({ filtered, jobs, jobFilter, setJobFilter, nameFilter, setNameFilter, jobName, moveCandidate, onAdd }: { filtered: Candidate[]; jobs: Job[]; jobFilter: string; setJobFilter: (value: string) => void; nameFilter: string; setNameFilter: (value: string) => void; jobName: (id: string) => string; moveCandidate: (id: string, stage: Stage) => void; onAdd: () => void }) { return <><div className="section-heading"><div><h2>Pipeline</h2><span>{filtered.length} candidates in view</span></div><div className="filters"><div className="search-box"><Search size={16} /><input value={nameFilter} onChange={event => setNameFilter(event.target.value)} placeholder="Search candidates" /></div><div className="select-box"><Filter size={15} /><select value={jobFilter} onChange={event => setJobFilter(event.target.value)}><option value="all">All jobs</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></div></div></div><section className="board">{stages.map(stage => <div className="column" key={stage}><div className="column-title"><span className={`stage-dot ${stageTone[stage]}`} />{stage}<b>{filtered.filter(candidate => candidate.stage === stage).length}</b></div>{filtered.filter(candidate => candidate.stage === stage).map(candidate => <CandidateCard key={candidate.id} candidate={candidate} jobName={jobName(candidate.jobId)} moveCandidate={moveCandidate} />)}<button className="add-column" onClick={onAdd}><Plus size={14} />Add candidate</button></div>)}</section></> }
function CandidateCard({ candidate, jobName, moveCandidate }: { candidate: Candidate; jobName: string; moveCandidate: (id: string, stage: Stage) => void }) {
  const [open, setOpen] = useState(false)
  return <article className="candidate-card"><div className="candidate-top"><div className="avatar">{candidate.initials}</div><div className="candidate-name"><strong>{candidate.name}</strong><span>{jobName}</span></div><button className="icon-button" onClick={() => setOpen(!open)} aria-label="Change stage"><ChevronDown size={16} /></button></div><div className="candidate-meta"><span>{candidate.location}</span><span className="score"><Sparkles size={12} />{candidate.score}% match</span></div>{candidate.summary && <p className="candidate-summary">{candidate.summary}</p>}<div className="candidate-footer"><span>{candidate.added}</span><div className="candidate-contact">{candidate.email && <a href={`mailto:${candidate.email}`} aria-label={`Email ${candidate.name}`}><Mail size={13} /></a>}{candidate.phone && <a href={`tel:${candidate.phone}`} aria-label={`Call ${candidate.name}`}><Phone size={13} /></a>}{candidate.linkedin && <a href={candidate.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn profile"><ExternalLink size={14} /></a>}</div></div>{open && <div className="stage-menu">{stages.map(stage => <button key={stage} onClick={() => { moveCandidate(candidate.id, stage); setOpen(false) }}>{stage}</button>)}</div>}</article>
}
function Jobs({ jobs, candidates, onAdd }: { jobs: Job[]; candidates: Candidate[]; onAdd: () => void }) { return <section className="jobs-grid">{jobs.map(job => <article className="job-card" key={job.id}><div className="job-card-top"><div className="job-icon"><BriefcaseBusiness size={19} /></div><span className="status">{job.status}</span></div><h2>{job.title}</h2><p>{job.location}</p><div className="job-stats"><strong>{candidates.filter(candidate => candidate.jobId === job.id).length}</strong><span>candidates</span></div></article>)}<button className="new-job-card" onClick={onAdd}><Plus size={20} /><strong>Post another role</strong><span>Start a focused pipeline</span></button></section> }
function AdminDashboard({ jobs, candidates, pendingUsers, onApproveUser, onNavigate, onAddAccount, onAddJob, onAddCandidate }: { jobs: Job[]; candidates: Candidate[]; pendingUsers: PendingUser[]; onApproveUser: (userId: string, role: Role) => void; onNavigate: (view: string) => void; onAddAccount: () => void; onAddJob: () => void; onAddCandidate: () => void }) {
  const averageScore = candidates.length ? Math.round(candidates.reduce((sum, candidate) => sum + candidate.score, 0) / candidates.length) : 0
  return <section className="admin-dashboard">{pendingUsers.length > 0 && <article className="admin-control-panel access-requests"><div className="admin-panel-heading"><div><span className="eyebrow">New customers</span><h3>Access requests</h3></div><span className="request-count large">{pendingUsers.length}</span></div><p className="muted">These users confirmed their email and are waiting for workspace access.</p>{pendingUsers.map(user => <div className="access-request" key={user.id}><div className="avatar">{user.fullName.slice(0, 2).toUpperCase()}</div><div className="access-user"><strong>{user.fullName}</strong><span>{user.email}</span></div><button className="button primary" onClick={() => onApproveUser(user.id, 'customer')}>Grant customer access</button></div>)}</article>}<div className="admin-hero"><div><span className="admin-kicker"><ShieldCheck size={14} />Authorized administrator</span><h2>Workspace control center</h2><p>Monitor hiring activity and manage every area of this workspace.</p></div><button className="button primary" onClick={onAddAccount}><UserPlus size={16} />Invite team member</button></div><div className="admin-metrics"><Metric icon={<BriefcaseBusiness size={18} />} label="Open roles" value={jobs.length.toString()} detail="Hiring plans in this workspace" /><Metric icon={<Users size={18} />} label="Candidates" value={candidates.length.toString()} detail="Across every pipeline" /><Metric icon={<ClipboardList size={18} />} label="In interview" value={candidates.filter(candidate => candidate.stage === 'Interview').length.toString()} detail="Active interview stage" /><Metric icon={<Sparkles size={18} />} label="Average score" value={`${averageScore}%`} detail="AI-assisted candidate signal" /></div><div className="admin-grid"><article className="admin-control-panel"><div className="admin-panel-heading"><div><span className="eyebrow">Workspace controls</span><h3>Manage the hiring system</h3></div><ShieldCheck size={21} /></div><div className="admin-actions"><button onClick={() => onNavigate('Pipeline')}><BarChart3 size={18} /><span><strong>Open pipeline</strong><small>Review and move candidates</small></span><ChevronDown size={16} className="admin-arrow" /></button><button onClick={() => onNavigate('Jobs')}><BriefcaseBusiness size={18} /><span><strong>Manage jobs</strong><small>Post and review open roles</small></span><ChevronDown size={16} className="admin-arrow" /></button><button onClick={() => onNavigate('Candidates')}><Users size={18} /><span><strong>Manage candidates</strong><small>Search every candidate record</small></span><ChevronDown size={16} className="admin-arrow" /></button><button onClick={() => onNavigate('Team')}><UserPlus size={18} /><span><strong>Team & access</strong><small>Invite users and assign roles</small></span><ChevronDown size={16} className="admin-arrow" /></button></div></article><article className="admin-control-panel admin-quick-panel"><div className="admin-panel-heading"><div><span className="eyebrow">Quick actions</span><h3>Make a change</h3></div><Plus size={21} /></div><button className="quick-action" onClick={onAddJob}><BriefcaseBusiness size={18} /><span><strong>Post a job</strong><small>Create a new hiring pipeline</small></span></button><button className="quick-action" onClick={onAddCandidate}><Users size={18} /><span><strong>Add candidate</strong><small>Add a person to any role</small></span></button><button className="quick-action" onClick={onAddAccount}><UserPlus size={18} /><span><strong>Invite user</strong><small>Grant workspace access</small></span></button></article></div></section>
}
function Team({ session, onAdd }: { session: Session; onAdd: () => void }) { const [members, setMembers] = useState<WorkspaceMember[]>([]); const [loading, setLoading] = useState(true); const [errorMessage, setErrorMessage] = useState(''); const [refreshKey, setRefreshKey] = useState(0); useEffect(() => { if (!supabase || session.role !== 'admin') return; const client = supabase; setLoading(true); setErrorMessage(''); const loadMembers = async () => { const { data, error } = await client.functions.invoke('admin-manage-access', { body: { action: 'members' } }); if (error) { setErrorMessage(error.message); setMembers([]) } else setMembers((data?.members ?? []) as WorkspaceMember[]); setLoading(false) }; void loadMembers() }, [session.role, session.organizationId, refreshKey]); return <section className="team-card"><div className="team-header"><div><h2>Team & access</h2><p>Manage members connected to this workspace.</p></div><div className="top-actions"><button className="button secondary" onClick={() => setRefreshKey(value => value + 1)} disabled={loading}>Refresh</button><button className="button primary" onClick={onAdd}><UserPlus size={16} />Create account</button></div></div>{loading ? <p className="muted">Loading workspace members...</p> : errorMessage ? <p className="form-error">Unable to load members: {errorMessage}. Deploy the updated admin-manage-access function.</p> : members.length === 0 ? <p className="muted">No workspace members found yet.</p> : members.map(member => <div className="team-row" key={member.id}><div className="avatar">{member.fullName.slice(0, 2).toUpperCase()}</div><div><strong>{member.fullName}</strong><span>{member.email}</span></div><span className="role">{member.role}</span></div>)}</section> }
function CandidateModal({ jobs, onClose, onSave, assessmentBusy }: { jobs: Job[]; onClose: () => void; onSave: (candidate: Candidate, resumeText: string, jobDescription: string) => void; assessmentBusy: boolean }) {
  const [name, setName] = useState('')
  const [roleName, setRoleName] = useState('')
  const [location, setLocation] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [resume, setResume] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const matchedJob = jobs.find(item => item.title.trim().toLocaleLowerCase() === roleName.trim().toLocaleLowerCase())
  const jobId = roleName.trim() ? matchedJob?.id ?? `new:${roleName.trim()}` : ''
  const job = matchedJob
  const handleFile = async (file?: File) => {
    if (!file) return
    setFileError(''); setFileName(file.name)
    try {
      const text = await extractCvText(file)
      if (!text.trim()) throw new Error('No selectable text was found. Scanned PDFs need OCR before upload.')
      setResume(text)
    } catch (error) {
      setFileName(''); setFileError(error instanceof Error ? error.message : 'Unable to read this CV file.')
    }
  }
  return <Modal title="Add candidate" onClose={onClose} wide>
    <p className="modal-intro">Build a complete candidate profile now. Add a CV to generate an optional AI-assisted hiring note.</p>
    <div className="form-section"><div className="form-section-heading"><span>01</span><div><strong>Candidate details</strong><small>Information used to identify and contact this person.</small></div></div>
      <div className="form-grid"><label className="field-span-2">Full name<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Taylor Morgan" /></label><label>Role<input list="workspace-roles" value={roleName} onChange={event => setRoleName(event.target.value)} placeholder="Search or type a new role" /><datalist id="workspace-roles">{jobs.map(item => <option key={item.id} value={item.title} />)}</datalist><span className="field-hint">{matchedJob ? 'Existing role selected.' : 'A new job pipeline will be created for this role.'}</span></label><label>Location<input list="location-suggestions" value={location} onChange={event => setLocation(event.target.value)} placeholder="Search a city or country" /><datalist id="location-suggestions">{locationSuggestions.map(item => <option key={item} value={item} />)}</datalist></label></div>
    </div>
    <div className="form-section"><div className="form-section-heading"><span>02</span><div><strong>Contact links</strong><small>Optional details for the recruiting team.</small></div></div>
      <div className="form-grid"><label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="taylor@example.com" /></label><label>Phone number<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+1 555 123 4567" /></label><label className="field-span-2">LinkedIn profile<input type="url" value={linkedin} onChange={event => setLinkedin(event.target.value)} placeholder="https://linkedin.com/in/taylor-morgan" /></label></div>
    </div>
    <div className="form-section"><div className="form-section-heading"><span>03</span><div><strong>CV and assessment</strong><small>PDF, DOCX, TXT, Markdown, or RTF. Scanned PDFs need OCR.</small></div></div>
      <label className="file-field"><input type="file" accept=".pdf,.docx,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={event => void handleFile(event.target.files?.[0])} disabled={assessmentBusy} /><span><b>{fileName ? 'Replace uploaded CV' : 'Choose a CV file'}</b><small>{fileName || 'or paste the CV text below'}</small></span></label>{fileError && <p className="form-error">{fileError}</p>}
      <label>CV text <span className="field-hint">Optional — used only for the AI assessment</span><textarea value={resume} onChange={event => setResume(event.target.value)} placeholder="Paste or edit extracted resume text…" /></label>
    </div>
    <div className="modal-actions"><button className="button secondary" onClick={onClose} disabled={assessmentBusy}>Cancel</button><button className="button primary" disabled={!name.trim() || !jobId || assessmentBusy} onClick={() => onSave({ id: crypto.randomUUID(), name: name.trim(), jobId, stage: 'Applied', location: location.trim() || 'Location not added', initials: name.trim().split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(), score: 0, added: 'Just now', linkedin: linkedin.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined }, resume, job?.description ?? job?.title ?? '')}>{assessmentBusy ? 'Generating assessment…' : 'Add candidate'}</button></div>
  </Modal>
}
function JobModal({ onClose, onSave }: { onClose: () => void; onSave: (job: Omit<Job, 'id' | 'status'>) => void }) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('Remote')
  const [description, setDescription] = useState('')
  return <Modal title="Post a new role" onClose={onClose} wide>
    <p className="modal-intro">Start a focused hiring pipeline. A clear role brief creates a better experience for your team and more useful candidate assessments.</p>
    <div className="form-section"><div className="form-section-heading"><span>01</span><div><strong>Role basics</strong><small>These details appear across your hiring workspace.</small></div></div><div className="form-grid"><label className="field-span-2">Job title<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Product Marketing Manager" /></label><label className="field-span-2">Work location<input value={location} onChange={event => setLocation(event.target.value)} placeholder="e.g. Cape Town · Hybrid" /></label></div></div>
    <div className="form-section"><div className="form-section-heading"><span>02</span><div><strong>Role brief</strong><small>Include responsibilities, required skills, seniority, and experience.</small></div></div><label>Job description<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the role, the outcomes this person will own, and the experience that will help them succeed…" /></label><p className="field-hint">This description is used as context when assessing candidate CVs.</p></div>
    <div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!title.trim()} onClick={() => onSave({ title: title.trim(), location: location.trim() || 'Remote', description: description.trim() || undefined })}>Post role</button></div>
  </Modal>
}
function AccountModal({ onClose, onSave }: { onClose: () => void; onSave: (account: { email: string; fullName: string; role: Role }) => void }) {
  const settingsMode = window.location.hash === '#account'
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('customer')
  const [timezone, setTimezone] = useState('Africa/Johannesburg')
  const [language, setLanguage] = useState('English')
  const [inAppNotifications, setInAppNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [liveActivity, setLiveActivity] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activity, setActivity] = useState<string[]>([])
  const close = () => { window.location.hash = ''; onClose() }

  useEffect(() => {
    if (!settingsMode || !supabase) return
    const client = supabase
    let active = true
    let channel: ReturnType<typeof client.channel> | undefined
    const load = async () => {
      const { data: auth } = await client.auth.getUser()
      if (!auth.user || !active) return
      const [{ data: profile, error }, { data: membership }] = await Promise.all([
        client.from('profiles').select('full_name,timezone,language,notifications_in_app,notifications_email,live_activity_enabled').eq('id', auth.user.id).maybeSingle(),
        client.from('memberships').select('organization_id').eq('user_id', auth.user.id).limit(1).maybeSingle(),
      ])
      if (!active) return
      if (error) { setMessage('Profile preferences will be available after the latest database migration is applied.'); return }
      setEmail(auth.user.email ?? '')
      setFullName(profile?.full_name ?? '')
      setTimezone(profile?.timezone ?? 'Africa/Johannesburg')
      setLanguage(profile?.language ?? 'English')
      setInAppNotifications(profile?.notifications_in_app ?? true)
      setEmailNotifications(profile?.notifications_email ?? true)
      setLiveActivity(profile?.live_activity_enabled ?? true)
      if (!membership?.organization_id) return
      channel = client.channel(`account-activity:${membership.organization_id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates', filter: `organization_id=eq.${membership.organization_id}` }, payload => setActivity(current => [`Candidate activity updated just now (${payload.eventType.toLowerCase()}).`, ...current].slice(0, 4)))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `organization_id=eq.${membership.organization_id}` }, payload => setActivity(current => [`Job activity updated just now (${payload.eventType.toLowerCase()}).`, ...current].slice(0, 4)))
        .subscribe()
    }
    void load()
    return () => { active = false; if (channel) void client.removeChannel(channel) }
  }, [settingsMode])

  const saveProfile = async () => {
    if (!supabase) return
    setSaving(true); setMessage('')
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setSaving(false); setMessage('Your session has expired. Please sign in again.'); return }
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim(), timezone, language, notifications_in_app: inAppNotifications, notifications_email: emailNotifications, live_activity_enabled: liveActivity }).eq('id', auth.user.id)
    setSaving(false)
    setMessage(error ? `Unable to save: ${error.message}` : 'Account settings saved.')
  }
  const logout = async () => { if (supabase) await supabase.auth.signOut(); window.location.hash = ''; window.location.reload() }

  if (settingsMode) return <Modal title="Manage account" onClose={close} wide>
    <p className="modal-intro">Keep your personal information and workspace preferences up to date.</p>
    <div className="form-section"><div className="form-section-heading"><span>01</span><div><strong>Personal profile</strong><small>Visible to your workspace administrators and teammates.</small></div></div><div className="form-grid"><label>Full name<input value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Your full name" /></label><label>Email address<input value={email} readOnly aria-readonly="true" /><span className="field-hint">Email is managed through your sign-in provider.</span></label></div></div>
    <div className="form-section"><div className="form-section-heading"><span>02</span><div><strong>Regional preferences</strong><small>Used to format times and tailor the interface.</small></div></div><div className="form-grid"><label>Time zone<select value={timezone} onChange={event => setTimezone(event.target.value)}><option>Africa/Johannesburg</option><option>Africa/Nairobi</option><option>Europe/London</option><option>Europe/Amsterdam</option><option>America/New_York</option><option>America/Los_Angeles</option><option>Asia/Dubai</option><option>Asia/Singapore</option><option>Australia/Sydney</option><option>UTC</option></select></label><label>Language<select value={language} onChange={event => setLanguage(event.target.value)}><option>English</option><option>Afrikaans</option><option>isiZulu</option><option>French</option><option>Portuguese</option><option>Spanish</option></select></label></div></div>
    <div className="form-section"><div className="form-section-heading"><span>03</span><div><strong>Notifications and live activity</strong><small>Choose how you stay informed about this workspace.</small></div></div><div className="preference-list"><label className="preference"><span><strong>In-app notifications</strong><small>Show updates while Talentflow is open.</small></span><input type="checkbox" checked={inAppNotifications} onChange={event => setInAppNotifications(event.target.checked)} /></label><label className="preference"><span><strong>Email notifications</strong><small>Receive important workspace updates by email.</small></span><input type="checkbox" checked={emailNotifications} onChange={event => setEmailNotifications(event.target.checked)} /></label><label className="preference"><span><strong>Live workspace activity</strong><small>Receive real-time job and candidate updates.</small></span><input type="checkbox" checked={liveActivity} onChange={event => setLiveActivity(event.target.checked)} /></label></div>{liveActivity && <div className="activity-feed"><strong>Live activity</strong>{activity.length ? activity.map((item, index) => <span key={`${item}-${index}`}>{item}</span>) : <span>Listening for candidate and job updates in this workspace.</span>}</div>}</div>
    {message && <p className={message.startsWith('Unable') ? 'form-error' : 'form-success'} role="status">{message}</p>}
    <div className="modal-actions"><button className="button danger" onClick={() => void logout()}>Log out</button><span className="modal-actions-spacer" /><button className="button secondary" onClick={close}>Close</button><button className="button primary" disabled={saving || !fullName.trim()} onClick={() => void saveProfile()}>{saving ? 'Saving…' : 'Save changes'}</button></div>
  </Modal>

  return <Modal title="Create workspace account" onClose={close}><p className="muted">An invite email is sent by Supabase Auth. The user receives access to this workspace.</p><label>Full name<input autoFocus value={fullName} onChange={event => setFullName(event.target.value)} /></label><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Role<select value={role} onChange={event => setRole(event.target.value as Role)}><option value="customer">Customer</option><option value="admin">Admin</option></select></label><div className="modal-actions"><button className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={!email || !fullName} onClick={() => onSave({ email, fullName, role })}>Create account</button></div></Modal>
}
function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="modal-backdrop" role="presentation"><div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div> }
export default App
