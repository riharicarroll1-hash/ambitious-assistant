"use client";

import { useState } from "react";
export default function Home() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function askAssistant() {
    if (!message.trim()) return;

    setLoading(true);
    setReply("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();
      setReply(data.reply || data.error || "No response.");
    } catch {
      setReply("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-10">
        <header className="mb-10">
          <p className="mb-2 text-sm text-zinc-500">AMBITION</p>

          <h1 className="text-3xl font-semibold tracking-tight">
            Good morning, Hari.
          </h1>

          <p className="mt-2 text-zinc-400">
            Here&apos;s what your day looks like.
          </p>
        </header>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">TODAY</h2>
            <span className="text-sm text-zinc-600">Saturday</span>
          </div>

          <div className="space-y-3">
            <Event time="8:30 AM" title="Morning routine" />
            <Event time="10:00 AM" title="Trading" />
            <Event time="1:00 PM" title="Gym" />
            <Event time="3:00 PM" title="Content" />
            <Event time="5:00 PM" title="Family time" />
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="mb-2 text-xs font-medium text-violet-400">
            AI BRIEFING
          </p>

          <p className="leading-7 text-zinc-300">
            Your morning is structured well. You have a gap after trading that
            could be used for FX Replay before the gym.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium text-zinc-400">
            TODAY&apos;S PRIORITIES
          </h2>

          <div className="space-y-3">
            <Priority title="Trading session" />
            <Priority title="Gym" />
            <Priority title="Record content" />
            <Priority title="15,000 steps" />
          </div>
        </section>

        <div className="fixed bottom-6 left-1/2 w-[calc(100%-3rem)] max-w-md -translate-x-1/2">
  {reply && (
    <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-200">
      {reply}
    </div>
  )}

  <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-white p-2">
    <input
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") askAssistant();
      }}
      placeholder="Ask Ambition anything..."
      className="min-w-0 flex-1 bg-transparent px-3 py-2 text-black outline-none"
    />

    <button
      onClick={askAssistant}
      disabled={loading}
      className="rounded-xl bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
    >
      {loading ? "..." : "Ask"}
    </button>
  </div>
</div>
      </div>
    </main>
  );
}

function Event({
  time,
  title,
}: {
  time: string;
  title: string;
}) {
  return (
    <div className="flex items-center rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4">
      <div className="w-24 text-sm text-zinc-500">{time}</div>

      <div className="h-8 w-[2px] rounded-full bg-violet-500" />

      <div className="ml-4 font-medium">{title}</div>
    </div>
  );
}

function Priority({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 px-4 py-4">
      <div className="h-5 w-5 rounded-full border border-zinc-600" />
      <span className="text-zinc-300">{title}</span>
    </div>
  );
}
