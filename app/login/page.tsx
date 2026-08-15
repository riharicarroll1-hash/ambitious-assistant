"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email to confirm your account.");
    }

    setLoading(false);
  }

  async function signIn() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      window.location.href = "/";
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 text-white">
      <div className="w-full max-w-sm">
        <p className="mb-3 text-sm text-violet-400">AMBITION</p>

        <h1 className="text-3xl font-semibold">
          Welcome back.
        </h1>

        <p className="mt-2 text-zinc-400">
          Sign in to your personal assistant.
        </p>

        <div className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 outline-none"
          />

          {message && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
              {message}
            </div>
          )}

          <button
            onClick={signIn}
            disabled={loading}
            className="w-full rounded-2xl bg-white px-4 py-4 font-medium text-black disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Sign in"}
          </button>

          <button
            onClick={signUp}
            disabled={loading}
            className="w-full rounded-2xl border border-zinc-700 px-4 py-4 font-medium text-white disabled:opacity-50"
          >
            Create account
          </button>
        </div>
      </div>
    </main>
  );
}
