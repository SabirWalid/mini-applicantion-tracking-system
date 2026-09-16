import { useEffect, useState } from 'react'
import { BarChart3, BriefcaseBusiness, ChevronDown, ClipboardList, ExternalLink, Filter, LogOut, Plus, Search, Sparkles, UserPlus, Users, X } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Stage = 'Applied' | 'Screening' | 'Interview' | 'Offer'
type Job = { id: string; title: string; location: string; count: number; status: string }
type Candidate = { id: string; name: string; role: string; jobId: string; stage: Stage; location: string; initials: string; score: number; added: string; linkedin?: string }

const seedJobs: Job[] = [
  { id: 'product', title: 'Senior Product Designer', location: 'Remote · US', count: 8, status: 'Active' },
  { id: 'engineer', title: 'Frontend Engineer', location: 'New York · Hybrid', count: 12, status: 'Active' },
  { id: 'growth', title: 'Growth Marketing Lead', location: 'Remote · US', count: 5, status: 'Active' },
]
const seedCandidates: Candidate[] = [
  { id: '1', name: 'Avery Morgan', role: 'Senior Product Designer', jobId: 'product', stage: 'Applied', location: 'Austin, TX', initials: 'AM', score: 91, added: '2h ago', linkedin: 'https://linkedin.com' },
  { id: '2', name: 'Jamie Chen', role: 'Senior Product Designer', jobId: 'product', stage: 'Screening', location: 'Seattle, WA', initials: 'JC', score: 86, added: 'Yesterday' },
  { id: '3', name: 'Maya Patel', role: 'Frontend Engineer', jobId: 'engineer', stage: 'Interview', location: 'Brooklyn, NY', initials: 'MP', score: 94, added: 'Yesterday' },
  { id: '4', name: 'Jordan Bell', role: 'Frontend Engineer', jobId: 'engineer', stage: 'Applied', location: 'Chicago, IL', initials: 'JB', score: 78, added: '2d ago' },
  { id: '5', name: 'Noah Williams', role: 'Growth Marketing Lead', jobId: 'growth', stage: 'Offer', location: 'Denver, CO', initials: 'NW', score: 89, added: '3d ago' },
  { id: '6', name: 'Sam Rivera', role: 'Growth Marketing Lead', jobId: 'growth', stage: 'Screening', location: 'Los Angeles, CA', initials: 'SR', score: 82, added: '4d ago' },
]

const stages: Stage[] = ['Applied', 'Screening', 'Interview', 'Offer']
const stageTone: Record<Stage, string> = { Applied: 'blue', Screening: 'amber', Interview: 'violet', Offer: 'green' }

function App() {
  const [session, setSession] = useState<{ email: string; role: 'admin' | 'customer'; userId?: string; organizationId?: string } | null>(null)
  const [email, setEmail] = useState('demo@talentflow.io')
  const [password, setPassword] = useState('password')
  const [authError, setAuthError] = useState('')
  const [candidates, setCandidates] = useState(seedCandidates)
  const [jobs, setJobs] = useState(seedJobs)
  const [activeView, setActiveView] = useState('Pipeline')
  const [jobFilter, setJobFilter] = useState('all')
  const [nameFilter, setNameFilter] = useState('')
  const [showCandidate, setShowCandidate] = useState(false)
  const [showJob, setShowJob] = useState(false)

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setAuthError('')
    if (supabase) {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(error.message); return }
      const { data: membership } = await supabase.from('memberships').select('organization_id, role').eq('user_id', data.user?.id).limit(1).maybeSingle()
      setSession({ email: data.user?.email ?? email, role: membership?.role ?? 'customer', userId: data.user?.id, organizationId: membership?.organization_id })
    } else {
      setSession({ email, role: email.startsWith('admin') ? 'admin' : 'customer' })
    }
  }

  useEffect(() => {
    if (!supabase || !session?.organizationId) return
    const loadWorkspace = async () => {
      const [{ data: jobRows }, { data: candidateRows }] = await Promise.all([
        supabase.from('jobs').select('id, title, location, status').eq('organization_id', session.organizationId).order('created_at', { ascending: false }),
        supabase.from('candidates').select('id, full_name, location, job_id, stage, linkedin_url, ai_score, created_at').eq('organization_id', session.organizationId).order('created_at', { ascending: false }),
      ])
      if (jobRows) setJobs(jobRows.map(job => ({ id: job.id, title: job.title, location: job.location, status: job.status, count: 0 })))
      if (candidateRows) setCandidates(candidateRows.map(candidate => ({ id: candidate.id, name: candidate.full_name, role: '', jobId: candidate.job_id, stage: candidate.stage as Stage, location: candidate.location ?? 'Location not added', initials: candidate.full_name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(), score: candidate.ai_score ?? 0, added: new Date(candidate.created_at).toLocaleDateString(), linkedin: candidate.linkedin_url ?? undefined })))
    }
    void loadWorkspace()
  }, [session?.organizationId])

  if (!session) return <Login email={email} password={password} setEmail={setEmail} setPassword={setPassword} signIn={signIn} error={authError} />

  const filteredCandidates = candidates.filter(candidate => (jobFilter === 'all' || candidate.jobId === jobFilter) && candidate.name.toLowerCase().includes(nameFilter.toLowerCase()))
  const jobName = (jobId: string) => jobs.find(job => job.id === jobId)?.title ?? 'Unknown role'
  const moveCandidate = async (id: string, stage: Stage) => {
    setCandidates(current => current.map(candidate => candidate.id === id ? { ...candidate, stage } : candidate))
    if (supabase && session.organizationId) await supabase.from('candidates').update({ stage }).eq('id', id).eq('organization_id', session.organizationId)
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">T</div><span>talentflow</span><small>WORKSPACE</small></div>
      <div className="workspace-switcher"><div className="workspace-avatar">AC</div><div><strong>Acme Co.</strong><span>Customer workspace</span></div><ChevronDown size={15} /></div>
      <nav>
        <p className="nav-label">Workspace</p>
        {['Pipeline', 'Jobs', 'Candidates'].map(item => <button key={item} className={activeView === item ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView(item)}>{item === 'Pipeline' ? <BarChart3 size={17} /> : item === 'Jobs' ? <BriefcaseBusiness size={17} /> : <Users size={17} />}{item}</button>)}
        {session.role === 'admin' && <><p className="nav-label admin-label">Admin</p><button className="nav-item" onClick={() => setActiveView('Team')}><UserPlus size={17} />Team & access</button></>}
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><Sparkles size={16} /><strong>AI candidate notes</strong><span>Score CVs faster with structured signals.</span></div><button className="user-row" onClick={() => setSession(null)}><div className="avatar small">{session.email.slice(0, 2).toUpperCase()}</div><div><strong>{session.email.split('@')[0]}</strong><span>{session.role === 'admin' ? 'Admin' : 'Recruiter'}</span></div><LogOut size={15} /></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><p className="eyebrow">{activeView === 'Pipeline' ? 'Hiring overview' : activeView}</p><h1>{activeView === 'Pipeline' ? 'Candidate pipeline' : activeView === 'Jobs' ? 'Your open roles' : activeView === 'Candidates' ? 'All candidates' : 'Team & access'}</h1></div><div className="top-actions"><span className="live-dot">Live workspace</span><button className="button primary" onClick={() => activeView === 'Jobs' ? setShowJob(true) : setShowCandidate(true)}><Plus size={17} />{activeView === 'Jobs' ? 'Post a job' : 'Add candidate'}</button></div></header>
      {activeView === 'Pipeline' && <><section className="metrics"><Metric icon={<Users size={18} />} label="Total candidates" value={candidates.length.toString()} detail="+12% this month" /><Metric icon={<BriefcaseBusiness size={18} />} label="Open roles" value={jobs.length.toString()} detail="All hiring plans active" /><Metric icon={<ClipboardList size={18} />} label="In interview" value={candidates.filter(c => c.stage === 'Interview').length.toString()} detail="2 scheduled this week" /><Metric icon={<Sparkles size={18} />} label="Avg. CV score" value="87" detail="Across active pipeline" /></section><div className="section-heading"><div><h2>Pipeline</h2><span>{filteredCandidates.length} candidates in view</span></div><div className="filters"><div className="search-box"><Search size={16} /><input value={nameFilter} onChange={event => setNameFilter(event.target.value)} placeholder="Search candidates" /></div><div className="select-box"><Filter size={15} /><select value={jobFilter} onChange={event => setJobFilter(event.target.value)}><option value="all">All jobs</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></div></div></div><section className="board">{stages.map(stage => <div className="column" key={stage}><div className="column-title"><span className={`stage-dot ${stageTone[stage]}`} />{stage}<b>{filteredCandidates.filter(c => c.stage === stage).length}</b></div>{filteredCandidates.filter(c => c.stage === stage).map(candidate => <CandidateCard key={candidate.id} candidate={candidate} jobName={jobName(candidate.jobId)} moveCandidate={moveCandidate} />)}<button className="add-column" onClick={() => setShowCandidate(true)}><Plus size={14} />Add candidate</button></div>)}</section></>}
      {activeView === 'Jobs' && <Jobs jobs={jobs} candidates={candidates} onAdd={() => setShowJob(true)} />}
      {activeView === 'Candidates' && <section className="candidate-list">{filteredCandidates.map(candidate => <CandidateCard key={candidate.id} candidate={candidate} jobName={jobName(candidate.jobId)} moveCandidate={moveCandidate} />)}</section>}
      {activeView === 'Team' && <Team />}
      <footer>Talentflow ATS <span>·</span> Built for focused hiring <span>·</span> <a href="https://supabase.com" target="_blank">Powered by Supabase <ExternalLink size={12} /></a></footer>
    </main>
    {showCandidate && <CandidateModal jobs={jobs} onClose={() => setShowCandidate(false)} onSave={async candidate => { if (supabase && session.organizationId && session.userId) { const { data } = await supabase.from('candidates').insert({ organization_id: session.organizationId, job_id: candidate.jobId, full_name: candidate.name, location: candidate.location, stage: candidate.stage, created_by: session.userId }).select('id').single(); if (data) candidate.id = data.id } setCandidates(current => [...current, candidate]); setShowCandidate(false) }} />}
    {showJob && <JobModal onClose={() => setShowJob(false)} onSave={async job => { const newJob = { ...job, count: 0, status: 'Active' }; if (supabase && session.organizationId && session.userId) { const { data } = await supabase.from('jobs').insert({ organization_id: session.organizationId, title: job.title, location: job.location, created_by: session.userId }).select('id').single(); if (data) newJob.id = data.id } setJobs(current => [...current, newJob]); setShowJob(false) }} />}
  </div>
}

function Login({ email, password, setEmail, setPassword, signIn, error }: { email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void; signIn: (event: React.FormEvent) => void; error: string }) { return <main className="login-page"><div className="login-art"><div className="brand light"><div className="brand-mark">T</div><span>talentflow</span></div><div className="art-copy"><p className="eyebrow">Hiring, with clarity</p><h1>The calm place to build your next team.</h1><p>One focused workspace for every candidate, conversation, and great hire.</p></div><div className="quote">“The fastest part of our hiring process is finally the part that matters.”<small>— Maya, Head of People</small></div></div><div className="login-panel"><div className="login-form"><p className="eyebrow">Welcome back</p><h2>Sign in to Talentflow</h2><p className="muted">Your team's hiring workspace is waiting.</p><form onSubmit={signIn}><label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <p className="form-error">{error}</p>}<button className="button primary full">Sign in <ChevronDown size={16} className="rotate" /></button></form><p className="login-note">Demo mode is active. Use any email and password.<br />Admin access: start your email with <strong>admin</strong>.</p></div><span className="login-footer">© 2026 Talentflow · Privacy · Terms</span></div></main> }

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="metric"><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }
function CandidateCard({ candidate, jobName, moveCandidate }: { candidate: Candidate; jobName: string; moveCandidate: (id: string, stage: Stage) => void }) { const [open, setOpen] = useState(false); return <article className="candidate-card"><div className="candidate-top"><div className="avatar">{candidate.initials}</div><div className="candidate-name"><strong>{candidate.name}</strong><span>{jobName}</span></div><button className="icon-button" onClick={() => setOpen(!open)} aria-label="Change stage"><ChevronDown size={16} /></button></div><div className="candidate-meta"><span>{candidate.location}</span><span className="score"><Sparkles size={12} />{candidate.score}% match</span></div><div className="candidate-footer"><span>{candidate.added}</span>{candidate.linkedin && <a href={candidate.linkedin} target="_blank" aria-label="LinkedIn profile"><ExternalLink size={14} /></a>}</div>{open && <div className="stage-menu">{stages.map(stage => <button key={stage} onClick={() => { moveCandidate(candidate.id, stage); setOpen(false) }}>{stage}</button>)}</div>}</article> }
function Jobs({ jobs, candidates, onAdd }: { jobs: Job[]; candidates: Candidate[]; onAdd: () => void }) { return <section className="jobs-grid">{jobs.map(job => <article className="job-card" key={job.id}><div className="job-card-top"><div className="job-icon"><BriefcaseBusiness size={19} /></div><span className="status">{job.status}</span></div><h2>{job.title}</h2><p>{job.location}</p><div className="job-stats"><strong>{candidates.filter(candidate => candidate.jobId === job.id).length}</strong><span>candidates</span><button className="text-button">View pipeline <ExternalLink size={13} /></button></div></article>)}<button className="new-job-card" onClick={onAdd}><Plus size={20} /><strong>Post another role</strong><span>Start a focused pipeline</span></button></section> }
function Team() { return <section className="team-card"><div className="team-header"><div><h2>Team & access</h2><p>Manage who can access this workspace.</p></div><button className="button primary"><UserPlus size={16} />Invite teammate</button></div><div className="team-row"><div className="avatar">AC</div><div><strong>Acme Co. owner</strong><span>admin@acme.co</span></div><span className="role">Admin</span></div><div className="team-row"><div className="avatar gold">JR</div><div><strong>Jamie Recruiter</strong><span>jamie@acme.co</span></div><span className="role">Recruiter</span></div></section> }
function CandidateModal({ jobs, onClose, onSave }: { jobs: Job[]; onClose: () => void; onSave: (candidate: Candidate) => void }) { const [name, setName] = useState(''); const [jobId, setJobId] = useState(jobs[0]?.id ?? 'product'); const [location, setLocation] = useState(''); return <Modal title="Add candidate" onClose={onClose}><p className="muted">Add a person to a role and start tracking their journey.</p><label>Full name<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Taylor Morgan" /></label><label>Role<select value={jobId} onChange={event => setJobId(event.target.value)}>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label>Location<input value={location} onChange={event => setLocation(event.target.value)} placeholder="e.g. Austin, TX" /></label><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!name} onClick={() => onSave({ id: Date.now().toString(), name, location: location || 'Location not added', role: jobs.find(job => job.id === jobId)?.title ?? '', jobId, stage: 'Applied', initials: name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(), score: 0, added: 'Just now' })}>Add candidate</button></div></Modal> }
function JobModal({ onClose, onSave }: { onClose: () => void; onSave: (job: Omit<Job, 'count' | 'status'>) => void }) { const [title, setTitle] = useState(''); const [location, setLocation] = useState('Remote'); return <Modal title="Post a new role" onClose={onClose}><p className="muted">Keep the brief concise. You can refine it later.</p><label>Job title<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Product Marketing Manager" /></label><label>Location<input value={location} onChange={event => setLocation(event.target.value)} /></label><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!title} onClick={() => onSave({ id: title.toLowerCase().replaceAll(' ', '-'), title, location })}>Post role</button></div></Modal> }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div> }

export default App
