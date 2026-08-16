"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const defaultPriorities = [
  "Trading session",
  "Gym",
  "Record content",
  "15,000 steps",
];

type Task = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

export default function Home() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskError, setTaskError] = useState("");

  const [calendarEvents, setCalendarEvents] = useState<
    CalendarEvent[]
  >([]);

  const [calendarLoading, setCalendarLoading] =
    useState(true);

  const [calendarConnected, setCalendarConnected] =
    useState(false);

  const [calendarConnecting, setCalendarConnecting] =
    useState(false);

  const [calendarError, setCalendarError] =
    useState("");

  useEffect(() => {
    loadTodaysPriorities();
    loadCalendar();

    const params = new URLSearchParams(
      window.location.search
    );

    if (params.get("calendar") === "connected") {
      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );
    }
  }, []);

  async function loadCalendar() {
    setCalendarLoading(true);
    setCalendarError("");

    try {
      const response = await fetch("/api/calendar", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.connected) {
        setCalendarConnected(false);
        setCalendarEvents([]);

        if (response.status !== 401) {
          setCalendarError(
            data.error ||
              "Could not load Google Calendar."
          );
        }

        return;
      }

      setCalendarConnected(true);
      setCalendarEvents(data.events || []);
    } catch (error) {
      console.error(
        "Calendar loading error:",
        error
      );

      setCalendarConnected(false);
      setCalendarError(
        "Could not load Google Calendar."
      );
    } finally {
      setCalendarLoading(false);
    }
  }

  async function connectGoogleCalendar() {
    setCalendarConnecting(true);

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
            access_type: "offline",
            prompt: "consent",
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

      setCalendarConnecting(false);
    }
  }

  async function loadTodaysPriorities() {
    setTasksLoading(true);
    setTaskError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setTaskError(
          "Could not load your account."
        );
        return;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(startOfDay);

      endOfDay.setDate(
        endOfDay.getDate() + 1
      );

      const {
        data: existingTasks,
        error: fetchError,
      } = await supabase
        .from("tasks")
        .select(
          "id, title, status, due_date"
        )
        .eq("user_id", user.id)
        .gte(
          "due_date",
          startOfDay.toISOString()
        )
        .lt(
          "due_date",
          endOfDay.toISOString()
        )
        .in(
          "title",
          defaultPriorities
        );

      if (fetchError) {
        console.error(fetchError);

        setTaskError(
          "Could not load today's priorities."
        );

        return;
      }

      const existingTitles =
        new Set(
          (existingTasks || []).map(
            (task) => task.title
          )
        );

      const missingTitles =
        defaultPriorities.filter(
          (title) =>
            !existingTitles.has(title)
        );

      let createdTasks: Task[] = [];

      if (missingTitles.length > 0) {
        const newTasks =
          missingTitles.map((title) => ({
            user_id: user.id,
            title,
            status: "pending",
            priority: "normal",
            due_date:
              new Date().toISOString(),
            can_be_scheduled: true,
            estimated_minutes: 30,
            description: null,
          }));

        const {
          data,
          error: insertError,
        } = await supabase
          .from("tasks")
          .insert(newTasks)
          .select(
            "id, title, status, due_date"
          );

        if (insertError) {
          console.error(insertError);

          setTaskError(
            "Could not create today's priorities."
          );

          return;
        }

        createdTasks = data || [];
      }

      const allTasks = [
        ...(existingTasks || []),
        ...createdTasks,
      ];

      const orderedTasks =
        defaultPriorities
          .map((title) =>
            allTasks.find(
              (task) =>
                task.title === title
            )
          )
          .filter(Boolean) as Task[];

      setTasks(orderedTasks);
    } catch (error) {
      console.error(error);

      setTaskError(
        "Something went wrong loading priorities."
      );
    } finally {
      setTasksLoading(false);
    }
  }

  async function togglePriority(
    task: Task
  ) {
    const newStatus =
      task.status === "completed"
        ? "pending"
        : "completed";

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: newStatus,
            }
          : item
      )
    );

    const { error } =
      await supabase
        .from("tasks")
        .update({
          status: newStatus,
        })
        .eq("id", task.id);

    if (error) {
      console.error(error);

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: task.status,
              }
            : item
        )
      );

      setTaskError(
        "Could not update that priority."
      );
    }
  }

  async function askAssistant() {
    if (!message.trim()) return;

    setLoading(true);
    setReply("");

    try {
      const response =
        await fetch("/api/chat", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message,
          }),
        });

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
        hour: "numeric",
        minute: "2-digit",
      }
    ).format(
      new Date(event.start)
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-40 pt-16">

        <header className="mb-10">
          <p className="mb-2 text-sm text-violet-400">
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
          {calendarConnected ? (
            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4">
              <div>
                <p className="font-medium">
                  Google Calendar
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Your schedule is live
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                Connected
              </div>
            </div>
          ) : (
            <button
              onClick={connectGoogleCalendar}
              disabled={calendarConnecting}
              className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-left transition active:scale-[0.99] disabled:opacity-50"
            >
              <div>
                <p className="font-medium">
                  Google Calendar
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Connect your real schedule
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
                  weekday: "long",
                }
              ).format(new Date())}
            </span>
          </div>

          {calendarLoading && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-zinc-500">
              Loading your calendar...
            </div>
          )}

          {!calendarLoading &&
            calendarError && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5">
                <p className="text-zinc-300">
                  {calendarError}
                </p>

                <button
                  onClick={loadCalendar}
                  className="mt-3 text-sm text-violet-400"
                >
                  Try again
                </button>
              </div>
            )}

          {!calendarLoading &&
            calendarConnected &&
            !calendarError &&
            calendarEvents.length === 0 && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-zinc-500">
                Nothing scheduled today.
              </div>
            )}

          {!calendarLoading &&
            calendarEvents.length > 0 && (
              <div className="space-y-3">
                {calendarEvents.map(
                  (event) => (
                    <Event
                      key={event.id}
                      time={formatEventTime(
                        event
                      )}
                      title={event.title}
                    />
                  )
                )}
              </div>
            )}
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="mb-3 text-sm text-violet-400">
            AI BRIEFING
          </p>

          <p className="leading-7 text-zinc-300">
            Your calendar is now connected.
            Next, Ambitious will use your
            real schedule, priorities and
            memories to help organise your
            day.
          </p>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">
              TODAY&apos;S PRIORITIES
            </h2>

            {tasks.length > 0 && (
              <span className="text-xs text-zinc-600">
                {
                  tasks.filter(
                    (task) =>
                      task.status ===
                      "completed"
                  ).length
                }
                /{tasks.length} done
              </span>
            )}
          </div>

          {tasksLoading && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-zinc-500">
              Loading priorities...
            </div>
          )}

          {taskError && (
            <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
              {taskError}
            </div>
          )}

          {!tasksLoading && (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Priority
                  key={task.id}
                  title={task.title}
                  completed={
                    task.status ===
                    "completed"
                  }
                  onToggle={() =>
                    togglePriority(task)
                  }
                />
              ))}
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
            onChange={(e) =>
              setMessage(
                e.target.value
              )
            }
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
