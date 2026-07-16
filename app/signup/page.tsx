"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

const inputClassName =
  "w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Signed up successfully — log them straight in rather than
      // making them re-enter credentials on a separate login page.
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Account created — please sign in.");
        router.push("/login");
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-black/10 p-6 dark:border-white/15"
      >
        <h1 className="text-xl font-bold text-foreground">Create Account</h1>

        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm text-foreground/60">
            Name <span className="text-foreground/40">(optional)</span>
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClassName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-foreground/60">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClassName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-foreground/60">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClassName}
          />
          <span className="text-xs text-foreground/40">At least 8 characters.</span>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Sign Up"}
        </button>

        <p className="text-sm text-foreground/60">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
