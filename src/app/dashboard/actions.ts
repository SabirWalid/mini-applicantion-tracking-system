"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assessCv } from "@/lib/ai-assessment";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", user.id)
    .single();

  return {
    user,
    profile,
    supabase,
  };
}

function toDashboardRedirect(customerId?: string) {
  if (customerId) {
    return `/dashboard?customer=${encodeURIComponent(customerId)}`;
  }

  return "/dashboard";
}

function toErrorRedirect(basePath: string, message: string) {
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(message)}`;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createJob(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const customerId = String(formData.get("customerId") || "").trim();

  const { user, profile, supabase } = await getCurrentProfile();

  const targetCustomerId =
    profile?.role === "admin" && customerId ? customerId : user.id;

  if (!title) {
    redirect(toErrorRedirect(toDashboardRedirect(targetCustomerId), "Job title is required"));
  }

  const { error } = await supabase.from("jobs").insert({
    title,
    description,
    customer_id: targetCustomerId,
    created_by: user.id,
  });

  if (error) {
    redirect(toErrorRedirect(toDashboardRedirect(targetCustomerId), error.message));
  }

  revalidatePath("/dashboard");
  redirect(toDashboardRedirect(targetCustomerId));
}

export async function createCandidate(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  const linkedinUrl = String(formData.get("linkedinUrl") || "").trim();
  const cvText = String(formData.get("cvText") || "").trim();
  const jobId = String(formData.get("jobId") || "").trim();
  const customerId = String(formData.get("customerId") || "").trim();

  const { user, profile, supabase } = await getCurrentProfile();

  const targetCustomerId =
    profile?.role === "admin" && customerId ? customerId : user.id;

  if (!fullName || !jobId) {
    redirect(
      toErrorRedirect(
        toDashboardRedirect(targetCustomerId),
        "Candidate name and job are required",
      ),
    );
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id,description")
    .eq("id", jobId)
    .single();

  const assessment = assessCv(job?.description || "", cvText || "");

  const { error } = await supabase.from("candidates").insert({
    customer_id: targetCustomerId,
    job_id: jobId,
    full_name: fullName,
    linkedin_url: linkedinUrl || null,
    cv_text: cvText || null,
    stage: "sourced",
    assessment_score: assessment.score,
    assessment_summary: assessment.summary,
    created_by: user.id,
  });

  if (error) {
    redirect(toErrorRedirect(toDashboardRedirect(targetCustomerId), error.message));
  }

  revalidatePath("/dashboard");
  redirect(toDashboardRedirect(targetCustomerId));
}

export async function moveCandidateStage(formData: FormData) {
  const candidateId = String(formData.get("candidateId") || "").trim();
  const stage = String(formData.get("stage") || "").trim();
  const customerId = String(formData.get("customerId") || "").trim();

  const allowed = new Set([
    "sourced",
    "screening",
    "interview",
    "offer",
    "hired",
    "rejected",
  ]);

  if (!candidateId || !allowed.has(stage)) {
    redirect("/dashboard?error=Invalid+candidate+stage+update");
  }

  const { user, profile, supabase } = await getCurrentProfile();

  const targetCustomerId =
    profile?.role === "admin" && customerId ? customerId : user.id;

  const { error } = await supabase
    .from("candidates")
    .update({ stage })
    .eq("id", candidateId);

  if (error) {
    redirect(toErrorRedirect(toDashboardRedirect(targetCustomerId), error.message));
  }

  revalidatePath("/dashboard");
  redirect(toDashboardRedirect(targetCustomerId));
}

export async function createAccount(formData: FormData) {
  const { user, profile } = await getCurrentProfile();

  if (profile?.role !== "admin") {
    redirect("/dashboard?error=Only+admins+can+create+accounts");
  }

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const role = String(formData.get("role") || "customer").trim();

  if (!email || !password || !["admin", "customer"].includes(role)) {
    redirect("/dashboard?error=Invalid+account+payload");
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      createdBy: user.id,
    },
  });

  if (error || !data.user) {
    redirect(`/dashboard?error=${encodeURIComponent(error?.message || "Failed to create user")}`);
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: data.user.id,
    email,
    full_name: fullName || null,
    role,
  });

  if (profileError) {
    redirect(`/dashboard?error=${encodeURIComponent(profileError.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?message=Account+created+successfully");
}
