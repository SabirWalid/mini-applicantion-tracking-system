import { login } from "@/app/login/actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold">Mini ATS</h1>
        <p className="text-sm text-gray-600">
          Sign in with a customer or admin account.
        </p>
      </div>

      {params.error ? (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {params.error}
        </p>
      ) : null}

      <form action={login} className="space-y-3 rounded border bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            required
            type="email"
            name="email"
            className="w-full rounded border px-3 py-2"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            required
            type="password"
            name="password"
            className="w-full rounded border px-3 py-2"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-black px-3 py-2 text-white hover:bg-gray-800"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
