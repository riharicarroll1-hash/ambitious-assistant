"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type CalendarEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

type Priority = {
  targetId: string;
  goalId: string;
  goalTitle: string;
  title: string;
  frequency: "daily" | "weekly";
  unit: string | null;
  targetValue: number;
  completedValue: number;
  weeklyCompleted?: number;
  weeklyRemaining?: number;
  todayTarget: number;
  remainingToday: number;
  completed: boolean;
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toLocalIso(date: Date) {
  const pad = (value: number) =>
    String(value).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  const offsetMinutes =
    -date.getTimezoneOffset();

  const sign =
    offsetMinutes >= 0 ? "+" : "-";

  const absolute =
    Math.abs(offsetMinutes);

  const offsetHour =
    pad(
      Math.floor(
        absolute / 60
      )
    );

  const offsetMinute =
    pad(
      absolute % 60
    );

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMinute}`;
}

export default function Home() {
  const [message, setMessage] =
    useState("");

  const [reply, setReply] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    calendarEvents,
    setCalendarEvents,
  ] = useState<CalendarEvent[]>([]);

  const [
    calendarLoading,
    setCalendarLoading,
  ] = useState(true);

  const [
    calendarConnected,
    setCalendarConnected,
  ] = useState(false);

  const [
    calendarConnecting,
    setCalendarConnecting,
  ] = useState(false);

  const [
    calendarError,
    setCalendarError,
  ] = useState("");

  const [
    priorities,
    setPriorities,
  ] = useState<Priority[]>([]);

  const [
    prioritiesLoading,
    setPrioritiesLoading,
  ] = useState(true);

  const [
    priorityError,
    setPriorityError,
  ] = useState("");

  const [
    briefing,
    setBriefing,
  ] = useState("");

  const [
    briefingLoading,
    setBriefingLoading,
  ] = useState(true);

  const [
    briefingError,
    setBriefingError,
  ] = useState("");

  const timeZone = useMemo(() => {
    try {
      return (
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone || "UTC"
      );
    } catch {
      return "UTC";
    }
  }, []);

  const today =
    localDateString();

  useEffect(() => {
    loadCalendar();
    loadPriorities();

    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get("calendar") ===
      "connected"
    ) {
      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );
    }
  }, []);

  useEffect(() => {
    if (
      !calendarLoading &&
      !prioritiesLoading &&
      calendarConnected
    ) {
      generateBriefing(
        calendarEvents,
        priorities
      );
    }
  }, [
    calendarLoading,
    prioritiesLoading,
    calendarConnected,
    calendarEvents,
    priorities,
  ]);

  function getDateRange(
    days: number
  ) {
    const start = new Date();

    start.setHours(
      0,
      0,
      0,
      0
    );

    const end =
      new Date(start);

    end.setDate(
      end.getDate() + days
    );

    return {
      timeMin:
        toLocalIso(start),

      timeMax:
        toLocalIso(end),
    };
  }

  async function loadPriorities() {
    setPrioritiesLoading(true);
    setPriorityError("");

    try {
      const response =
        await fetch(
          "/api/priorities/today",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                localDate:
                  localDateString(),
                timeZone,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setPriorityError(
          data.error ||
            "Could not load today's priorities."
        );

        return;
      }

      setPriorities(
        data.priorities || []
      );
    } catch (error) {
      console.error(
        "Priority loading error:",
        error
      );

      setPriorityError(
        "Could not load today's priorities."
      );
    } finally {
      setPrioritiesLoading(
        false
      );
    }
  }

  async function togglePriority(
    priority: Priority
  ) {
    setPriorityError("");

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setPriorityError(
          "Could not load your account."
        );

        return;
      }

      const newValue =
        priority.completed
          ? 0
          : priority.todayTarget;

      const completed =
        newValue >=
        priority.todayTarget;

      const { error } =
        await supabase
          .from(
            "goal_progress"
          )
          .upsert(
            {
              target_id:
                priority.targetId,

              goal_id:
                priority.goalId,

              user_id:
                user.id,

              progress_date:
                today,

              value:
                newValue,

              completed,

              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                "target_id,progress_date",
            }
          );

      if (error) {
        console.error(
          "Progress update error:",
          error
        );

        setPriorityError(
          "Could not update that priority."
        );

        return;
      }

      await loadPriorities();
    } catch (error) {
      console.error(error);

      setPriorityError(
        "Could not update that priority."
      );
    }
  }

  async function loadCalendar() {
    setCalendarLoading(true);
    setCalendarError("");

    try {
      const {
        timeMin,
        timeMax,
      } = getDateRange(1);

      const params =
        new URLSearchParams({
          days: "1",
          timeZone,
          timeMin,
          timeMax,
        });

      const response =
        await fetch(
          `/api/calendar?${params.toString()}`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.connected
      ) {
        setCalendarConnected(
          false
        );

        setCalendarEvents([]);

        if (
          response.status !==
          401
        ) {
          setCalendarError(
            data.error ||
              "Could not load Google Calendar."
          );
        }

        return;
      }

      setCalendarConnected(
        true
      );

      setCalendarEvents(
        data.events || []
      );
    } catch (error) {
      console.error(
        "Calendar loading error:",
        error
      );

      setCalendarConnected(
        false
      );

      setCalendarError(
        "Could not load Google Calendar."
      );
    } finally {
      setCalendarLoading(
        false
      );
    }
  }

  async function generateBriefing(
    events: CalendarEvent[],
    currentPriorities: Priority[]
  ) {
    setBriefingLoading(true);
    setBriefingError("");

    try {
      const response =
        await fetch(
          "/api/briefing",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                events,

                tasks:
                  currentPriorities.map(
                    (
                      priority
                    ) => ({
                      title:
                        priority.title,

                      status:
                        priority.completed
                          ? "completed"
                          : "pending",
                    })
                  ),

                timeZone,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setBriefingError(
          data.error ||
            "Could not generate today's briefing."
        );

        return;
      }

      setBriefing(
        data.briefing ||
          "Your day is ready."
      );
    } catch (error) {
      console.error(
        "Briefing loading error:",
        error
      );

      setBriefingError(
        "Could not generate today's briefing."
      );
    } finally {
      setBriefingLoading(
        false
      );
    }
  }

  async function connectGoogleCalendar() {
    setCalendarConnecting(
      true
    );

    const redirectTo =
      `${window.location.origin}/auth/callback`;

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",

        options: {
          redirectTo,

          scopes:
            "openid email profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events.readonly",

          queryParams: {
            access_type:
              "offline",

            prompt:
              "consent",
          },
        },
      });

    if (error) {
      console.error(
        "Google Calendar connection error:",
        error
      );

      setReply(
        "I couldn't start the Google Calendar connection."
      );

      setCalendarConnecting(
        false
      );
    }
  }

  async function askAssistant() {
    if (!message.trim()) {
      return;
    }

    setLoading(true);
    setReply("");

    try {
      const {
        timeMin,
        timeMax,
      } = getDateRange(7);

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                message,
                timeZone,
                timeMin,
                timeMax,
              }),
          }
        );

      const data =
        await response.json();

      setReply(
        data.reply ||
          data.error ||
          "Something went wrong."
      );
    } catch {
      setReply(
        "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatEventTime(
    event: CalendarEvent
  ) {
    if (event.allDay) {
      return "All day";
    }

    if (!event.start) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "en-AU",
      {
        hour:
          "numeric",

        minute:
          "2-digit",

        timeZone,
      }
    ).format(
      new Date(
        event.start
      )
    );
  }

  function priorityDetail(
    priority: Priority
  ) {
    if (
      priority.frequency ===
      "daily"
    ) {
      if (
        priority.targetValue ===
          1 &&
        priority.unit ===
          "completion"
      ) {
        return "Today";
      }

      return `${priority.todayTarget} ${
        priority.unit || ""
      } today`;
    }

    return `${priority.todayTarget} ${
      priority.unit || ""
    } today · ${
      priority.weeklyCompleted ||
      0
    }/${priority.targetValue} this week`;
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-40 pt-16">

        <header className="mb-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="mb-2 text-sm text-violet-400">
                AMBITIOUS
              </p>

              <h1 className="text-3xl font-semibold tracking-tight">
                Good morning,
                Hari.
              </h1>

              <p className="mt-2 text-zinc-400">
                Here&apos;s what your
                day looks like.
              </p>
            </div>

            <Link
              href="/goals"
              className="mt-1 shrink-0 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-violet-400"
            >
              Goals
            </Link>
          </div>
        </header>

        <Link
          href="/goals"
          className="mb-8 flex items-center justify-between rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5"
        >
          <div>
            <p className="text-sm text-violet-400">
              GOALS & SYSTEMS
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              Manage what
              Ambitious is helping
              you achieve
            </p>
          </div>

          <span className="text-xl text-zinc-600">
            ›
          </span>
        </Link>

        <section className="mb-8">
          {calendarConnected ? (
            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4">
              <div>
                <p className="font-medium">
                  Google Calendar
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Your schedule
                  is live
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Connected
              </div>
            </div>
          ) : (
            <button
              onClick={
                connectGoogleCalendar
              }
              disabled={
                calendarConnecting
              }
              className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-left"
            >
              <div>
                <p className="font-medium">
                  Google Calendar
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Connect your real
                  schedule
                </p>
              </div>

              <span className="text-sm text-violet-400">
                {calendarConnecting
                  ? "Connecting..."
                  : "Connect"}
              </span>
            </button>
          )}
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">
              TODAY
            </h2>

            <span className="text-sm text-zinc-600">
              {new Intl.DateTimeFormat(
                "en-AU",
                {
                  weekday:
                    "long",

                  timeZone,
                }
              ).format(
                new Date()
              )}
            </span>
          </div>

          {calendarLoading && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-zinc-500">
              Loading your
              calendar...
            </div>
          )}

          {!calendarLoading &&
            calendarError && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5">
                <p className="text-zinc-300">
                  {calendarError}
                </p>

                <button
                  onClick={
                    loadCalendar
                  }
                  className="mt-3 text-sm text-violet-400"
                >
                  Try again
                </button>
              </div>
            )}

          {!calendarLoading &&
            calendarConnected &&
            !calendarError &&
            calendarEvents.length ===
              0 && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-zinc-500">
                Nothing scheduled
                today.
              </div>
            )}

          {!calendarLoading &&
            calendarEvents.length >
              0 && (
              <div className="space-y-3">
                {calendarEvents.map(
                  (event) => (
                    <Event
                      key={
                        event.id
                      }
                      time={formatEventTime(
                        event
                      )}
                      title={
                        event.title
                      }
                    />
                  )
                )}
              </div>
            )}
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-violet-400">
              AI BRIEFING
            </p>

            {!briefingLoading &&
              calendarConnected && (
                <button
                  onClick={() =>
                    generateBriefing(
                      calendarEvents,
                      priorities
                    )
                  }
                  className="text-xs text-zinc-600"
                >
                  Refresh
                </button>
              )}
          </div>

          {briefingLoading &&
            calendarConnected && (
              <p className="leading-7 text-zinc-500">
                Analysing your
                day...
              </p>
            )}

          {briefingError && (
            <p className="leading-7 text-zinc-400">
              {briefingError}
            </p>
          )}

          {!briefingLoading &&
            !briefingError &&
            briefing && (
              <p className="whitespace-pre-wrap leading-7 text-zinc-300">
                {briefing}
              </p>
            )}
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-zinc-400">
                TODAY&apos;S
                PRIORITIES
              </h2>

              <p className="mt-1 text-xs text-zinc-700">
                Generated from
                your active goals
              </p>
            </div>

            {priorities.length >
              0 && (
              <span className="text-xs text-zinc-600">
                {
                  priorities.filter(
                    (
                      priority
                    ) =>
                      priority.completed
                  ).length
                }
                /{priorities.length} done
              </span>
            )}
          </div>

          {prioritiesLoading ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-zinc-500">
              Building today&apos;s
              priorities...
            </div>
          ) : priorityError ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-zinc-400">
              {priorityError}
            </div>
          ) : priorities.length ===
            0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-zinc-300">
                Nothing required
                from your goals
                today.
              </p>

              <Link
                href="/goals"
                className="mt-3 inline-block text-sm text-violet-400"
              >
                Manage goals →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {priorities.map(
                (priority) => (
                  <PriorityCard
                    key={
                      priority.targetId
                    }
                    title={
                      priority.title
                    }
                    goal={
                      priority.goalTitle
                    }
                    detail={priorityDetail(
                      priority
                    )}
                    completed={
                      priority.completed
                    }
                    onToggle={() =>
                      togglePriority(
                        priority
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-6 left-1/2 w-[calc(100%-40px)] max-w-md -translate-x-1/2">
        {reply && (
          <div className="relative mb-3 max-h-[55vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-[#111113] p-5 pr-12 shadow-xl">
            <button
              onClick={() =>
                setReply("")
              }
              className="absolute right-4 top-3 text-2xl text-zinc-500"
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
            onChange={(e) =>
              setMessage(
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key ===
                "Enter"
              ) {
                askAssistant();
              }
            }}
            placeholder="Ask Ambitious anything..."
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-black outline-none"
          />

          <button
            onClick={
              askAssistant
            }
            disabled={
              loading
            }
            className="rounded-2xl bg-black px-5 py-3 font-medium text-white"
          >
            {loading
              ? "..."
              : "Ask"}
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
      <div className="w-24 shrink-0 text-sm text-zinc-500">
        {time}
      </div>

      <div className="h-8 w-[2px] shrink-0 rounded-full bg-violet-500" />

      <div className="ml-4 font-medium">
        {title}
      </div>
    </div>
  );
}

function PriorityCard({
  title,
  goal,
  detail,
  completed,
  onToggle,
}: {
  title: string;
  goal: string;
  detail: string;
  completed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-left"
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
          completed
            ? "border-violet-500 bg-violet-500"
            : "border-zinc-600"
        }`}
      >
        {completed && (
          <span className="font-bold">
            ✓
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={
            completed
              ? "text-zinc-600 line-through"
              : "text-zinc-200"
          }
        >
          {title}
        </p>

        <p className="mt-1 text-xs text-zinc-600">
          {goal}
        </p>

        <p className="mt-1 text-sm text-violet-400">
          {detail}
        </p>
      </div>
    </button>
  );
}
