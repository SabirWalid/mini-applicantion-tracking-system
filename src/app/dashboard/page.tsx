import Link from "next/link";
import {
  createAccount,
  createCandidate,
  createJob,
  moveCandidateStage,
  signOut,
} from "@/app/dashboard/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const stages = [
  "sourced",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

type DashboardPageProps = {
  searchParams: Promise<{
    customer?: string;
    job?: string;
    name?: string;
    error?: string;
    message?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="mb-3">You are logged out.</p>
        <Link href="/login" className="text-blue-700 underline">
          Go to login
        </Link>
      </main>
    );
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      role: "customer",
    });

    const { data: createdProfile } = await supabase
      .from("profiles")
      .select("id,email,full_name,role")
      .eq("id", user.id)
      .single();

    profile = createdProfile;
  }

  const { data: customerRows } =
    profile?.role === "admin"
      ? await supabase
          .from("profiles")
          .select("id,full_name,email,role")
          .order("created_at", { ascending: false })
      : {
          data: [] as Array<{
            id: string;
            full_name: string | null;
            email: string;
            role: string;
          }>,
        };
  const customers = customerRows ?? [];

  const selectedCustomerId =
    profile?.role === "admin" ? params.customer || user.id : user.id;

  const selectedJob = params.job || "";
  const selectedName = params.name || "";

  const { data: jobRows } = await supabase
    .from("jobs")
    .select("id,title,description,customer_id")
    .eq("customer_id", selectedCustomerId)
    .order("created_at", { ascending: false });
  const jobs = jobRows ?? [];

  let candidatesQuery = supabase
    .from("candidates")
    .select(
      "id,full_name,linkedin_url,stage,job_id,customer_id,assessment_score,assessment_summary",
    )
    .eq("customer_id", selectedCustomerId)
    .order("created_at", { ascending: false });

  if (selectedJob) {
    candidatesQuery = candidatesQuery.eq("job_id", selectedJob);
  }

  if (selectedName) {
    candidatesQuery = candidatesQuery.ilike("full_name", `%${selectedName}%`);
  }

  const { data: candidateRows } = await candidatesQuery;
  const candidates = candidateRows ?? [];

  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mini ATS Dashboard</h1>
          <p className="text-sm text-gray-600">
            Signed in as {profile?.full_name || profile?.email} ({profile?.role || "customer"})
          </p>
        </div>

        <form action={signOut}>
          <button type="submit" className="rounded border px-4 py-2 text-sm">
            Sign out
          </button>
        </form>
      </header>

      {params.error ? (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {params.error}
        </p>
      ) : null}
      {params.message ? (
        <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {params.message}
        </p>
      ) : null}

      {profile?.role === "admin" ? (
        <section className="grid gap-4 rounded border bg-white p-4 shadow-sm md:grid-cols-2">
          <form className="space-y-2" action={createAccount}>
            <h2 className="font-semibold">Create account (admin/customer)</h2>
            <input
              required
              type="email"
              name="email"
              placeholder="Email"
              className="w-full rounded border px-3 py-2"
            />
            <input
              required
              type="password"
              name="password"
              placeholder="Temporary password"
              className="w-full rounded border px-3 py-2"
            />
            <input
              name="fullName"
              placeholder="Full name"
              className="w-full rounded border px-3 py-2"
            />
            <select name="role" className="w-full rounded border px-3 py-2" defaultValue="customer">
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="rounded bg-black px-3 py-2 text-white">
              Create account
            </button>
          </form>

          <form className="space-y-2" method="get">
            <h2 className="font-semibold">Act on behalf of customer</h2>
            <select
              name="customer"
              className="w-full rounded border px-3 py-2"
              defaultValue={selectedCustomerId}
            >
              <option value={user.id}>My own workspace</option>
              {customers
                .filter((customer) => customer.role === "customer")
                .map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {(customer.full_name || customer.email) + " - " + customer.email}
                  </option>
                ))}
            </select>
            <button type="submit" className="rounded border px-3 py-2">
              Switch workspace
            </button>
          </form>
        </section>
      ) : null}

      <section className="grid gap-4 rounded border bg-white p-4 shadow-sm md:grid-cols-2">
        <form action={createJob} className="space-y-2">
          <h2 className="font-semibold">Post a job</h2>
          <input type="hidden" name="customerId" value={selectedCustomerId} />
          <input
            required
            name="title"
            placeholder="Job title"
            className="w-full rounded border px-3 py-2"
          />
          <textarea
            required
            name="description"
            placeholder="Job description"
            className="min-h-28 w-full rounded border px-3 py-2"
          />
          <button type="submit" className="rounded bg-black px-3 py-2 text-white">
            Create job
          </button>
        </form>

        <form action={createCandidate} className="space-y-2">
          <h2 className="font-semibold">Add candidate</h2>
          <input type="hidden" name="customerId" value={selectedCustomerId} />
          <input
            required
            name="fullName"
            placeholder="Candidate full name"
            className="w-full rounded border px-3 py-2"
          />
          <input
            name="linkedinUrl"
            placeholder="LinkedIn URL"
            className="w-full rounded border px-3 py-2"
          />
          <select required name="jobId" className="w-full rounded border px-3 py-2" defaultValue="">
            <option value="" disabled>
              Select job
            </option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
          <textarea
            name="cvText"
            placeholder="Paste CV or profile summary for AI assessment"
            className="min-h-28 w-full rounded border px-3 py-2"
          />
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            disabled={jobs.length === 0}
          >
            Add candidate
          </button>
          {jobs.length === 0 ? (
            <p className="text-xs text-gray-600">Create a job first.</p>
          ) : null}
        </form>
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <form method="get" className="grid gap-2 md:grid-cols-4">
          {profile?.role === "admin" ? (
            <input type="hidden" name="customer" value={selectedCustomerId} />
          ) : null}
          <input
            name="name"
            defaultValue={selectedName}
            placeholder="Filter by candidate name"
            className="rounded border px-3 py-2"
          />
          <select name="job" defaultValue={selectedJob} className="rounded border px-3 py-2">
            <option value="">All jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded border px-3 py-2">
            Apply filters
          </button>
          <Link
            className="rounded border px-3 py-2 text-center"
            href={
              profile?.role === "admin"
                ? `/dashboard?customer=${selectedCustomerId}`
                : "/dashboard"
            }
          >
            Reset
          </Link>
        </form>
      </section>

      <section className="overflow-x-auto rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Candidate Kanban</h2>
        <div className="grid min-w-[1000px] grid-cols-6 gap-3">
          {stages.map((stage) => {
            const stageCandidates = candidates.filter((candidate) => candidate.stage === stage);

            return (
              <div key={stage} className="rounded border bg-gray-50 p-2">
                <h3 className="mb-2 text-sm font-semibold capitalize">
                  {stage} ({stageCandidates.length})
                </h3>
                <div className="space-y-2">
                  {stageCandidates.map((candidate) => (
                    <div key={candidate.id} className="rounded border bg-white p-2 text-xs">
                      <p className="font-semibold text-sm">{candidate.full_name}</p>
                      <p className="text-gray-600">
                        Job: {jobsById.get(candidate.job_id)?.title || "Unknown"}
                      </p>
                      {candidate.linkedin_url ? (
                        <a
                          href={candidate.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 underline"
                        >
                          LinkedIn
                        </a>
                      ) : null}
                      <p className="mt-1 text-gray-600">AI score: {candidate.assessment_score ?? "n/a"}</p>
                      {candidate.assessment_summary ? (
                        <p className="mt-1 text-gray-600">{candidate.assessment_summary}</p>
                      ) : null}
                      <form action={moveCandidateStage} className="mt-2 space-y-1">
                        <input type="hidden" name="candidateId" value={candidate.id} />
                        <input type="hidden" name="customerId" value={selectedCustomerId} />
                        <select
                          name="stage"
                          defaultValue={candidate.stage}
                          className="w-full rounded border px-2 py-1"
                        >
                          {stages.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="w-full rounded border px-2 py-1">
                          Move
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
