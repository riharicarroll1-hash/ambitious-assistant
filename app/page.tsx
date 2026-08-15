"use client";

import { useEffect, useState } from "react";

const priorities = [
  "Trading session",
  "Gym",
  "Record content",
  "15,000 steps",
];

export default function Home() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("ambitious-priorities");

    if (saved) {
      try {
        setCompleted(JSON.parse(saved));
      } catch {
        setCompleted([]);
      }
    }
  }, []);

  function togglePriority(title: string) {
    setCompleted((current) => {
      const updated = current.includes(title)
        ? current.filter((item) => item !== title)
        : [...current, title];

      localStorage.setItem(
        "ambitious-priorities",
        JSON.stringify(updated)
      );

      return updated;
    });
  }

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

      setReply(
        data.reply ||
          data.error ||
          "Something went wrong."
      );
    } catch {
      setReply("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-40 pt-16">

        <header className="mb-10">
          <p className="mb-2 text-sm text-zinc-500">
            AMBITIOUS
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            Good morning, Hari.
          </h1>

          <p className="mt-2 text-zinc-400">
            Here&apos;s what your day looks like.
          </p>
        </header>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">
              TODAY
            </h2>

            <span className="text-sm text-zinc-600">
              {new Intl.DateTimeFormat("en-AU", {
                weekday: "long",
              }).format(new Date())}
            </span>
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
          <p className="mb-3 text-sm text-violet-400">
            AI BRIEFING
          </p>

          <p className="leading-7 text-zinc-300">
            Your morning is structured well. You have a gap
            after trading that could be used for FX Replay
            before the gym.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium text-zinc-400">
            TODAY&apos;S PRIORITIES
          </h2>

          <div className="space-y-3">
            {priorities.map((title) => (
              <Priority
                key={title}
                title={title}
                completed={completed.includes(title)}
                onToggle={() => togglePriority(title)}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-6 left-1/2 w-[calc(100%-40px)] max-w-md -translate-x-1/2">

        {reply && (
          <div className="relative mb-3 rounded-3xl border border-zinc-800 bg-[#111113] p-5 pr-12 shadow-xl">
            <button
              onClick={() => setReply("")}
              aria-label="Dismiss response"
              className="absolute right-4 top-3 text-2xl text-zinc-500 transition hover:text-white"
            >
              ×
            </button>

            <p className="whitespace-pre-wrap leading-6 text-zinc-200">
              {reply}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-3xl border border-zinc-700 bg-white p-2 shadow-xl">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                askAssistant();
              }
            }}
            placeholder="Ask Ambitious anything..."
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-black outline-none placeholder:text-zinc-500"
          />

          <button
            onClick={askAssistant}
            disabled={loading}
            className="rounded-2xl bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "..." : "Ask"}
          </button>
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
    <div className="flex items-center rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5">
      <div className="w-24 text-sm text-zinc-500">
        {time}
      </div>

      <div className="h-8 w-[2px] rounded-full bg-violet-500" />

      <div className="ml-4 font-medium">
        {title}
      </div>
    </div>
  );
}

function Priority({
  title,
  completed,
  onToggle,
}: {
  title: string;
  completed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-left transition active:scale-[0.99]"
    >
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          completed
            ? "border-violet-500 bg-violet-500"
            : "border-zinc-600"
        }`}
      >
        {completed && (
          <span className="text-sm font-bold text-white">
            ✓
          </span>
        )}
      </div>

      <span
        className={`transition ${
          completed
            ? "text-zinc-600 line-through"
            : "text-zinc-300"
        }`}
      >
        {title}
      </span>
    </button>
  );
}
