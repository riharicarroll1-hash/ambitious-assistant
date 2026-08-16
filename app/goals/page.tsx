"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type GoalTarget = {
  id: string;
  goal_id: string;
  title: string;
  frequency: "daily" | "weekly";
  target_value: number;
  unit: string | null;
  active: boolean;
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  target_unit: string | null;
  target_date: string | null;
  status: string;
  goal_targets?: GoalTarget[];
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalTargetValue, setGoalTargetValue] = useState("");
  const [goalTargetUnit, setGoalTargetUnit] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");

  const [addingTargetTo, setAddingTargetTo] =
    useState<string | null>(null);

  const [targetTitle, setTargetTitle] = useState("");
  const [targetFrequency, setTargetFrequency] =
    useState<"daily" | "weekly">("daily");
  const [targetValue, setTargetValue] = useState("1");
  const [targetUnit, setTargetUnit] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Could not load your account.");
        return;
      }

      const {
        data,
        error: goalsError,
      } = await supabase
        .from("goals")
        .select(`
          id,
          title,
          description,
          target_value,
          target_unit,
          target_date,
          status,
          goal_targets (
            id,
            goal_id,
            title,
            frequency,
            target_value,
            unit,
            active
          )
        `)
        .eq("user_id", user.id)
        .neq("status", "archived")
        .order("created_at", {
          ascending: false,
        });

      if (goalsError) {
        console.error(goalsError);
        setError("Could not load your goals.");
        return;
      }

      setGoals(data || []);
    } catch (err) {
      console.error(err);
      setError("Something went wrong loading goals.");
    } finally {
      setLoading(false);
    }
  }

  async function createGoal() {
    if (!goalTitle.trim()) return;

    setSaving(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Could not load your account.");
        return;
      }

      const { error: insertError } =
        await supabase
          .from("goals")
          .insert({
            user_id: user.id,
            title: goalTitle.trim(),
            description:
              goalDescription.trim() || null,
            target_value:
              goalTargetValue.trim()
                ? Number(goalTargetValue)
                : null,
            target_unit:
              goalTargetUnit.trim() || null,
            target_date:
              goalTargetDate || null,
            status: "active",
          });

      if (insertError) {
        console.error(insertError);
        setError("Could not create goal.");
        return;
      }

      setGoalTitle("");
      setGoalDescription("");
      setGoalTargetValue("");
      setGoalTargetUnit("");
      setGoalTargetDate("");
      setShowGoalForm(false);

      await loadGoals();
    } finally {
      setSaving(false);
    }
  }

  async function addTarget(goalId: string) {
    if (!targetTitle.trim()) return;

    setSaving(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Could not load your account.");
        return;
      }

      const { error: insertError } =
        await supabase
          .from("goal_targets")
          .insert({
            goal_id: goalId,
            user_id: user.id,
            title: targetTitle.trim(),
            frequency: targetFrequency,
            target_value:
              Number(targetValue) || 1,
            unit:
              targetUnit.trim() || null,
            active: true,
          });

      if (insertError) {
        console.error(insertError);
        setError("Could not add target.");
        return;
      }

      setTargetTitle("");
      setTargetFrequency("daily");
      setTargetValue("1");
      setTargetUnit("");
      setAddingTargetTo(null);

      await loadGoals();
    } finally {
      setSaving(false);
    }
  }

  async function changeGoalStatus(
    goalId: string,
    status: string
  ) {
    const { error } = await supabase
      .from("goals")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId);

    if (error) {
      console.error(error);
      setError("Could not update goal.");
      return;
    }

    await loadGoals();
  }

  async function removeTarget(targetId: string) {
    const { error } = await supabase
      .from("goal_targets")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId);

    if (error) {
      console.error(error);
      setError("Could not remove target.");
      return;
    }

    await loadGoals();
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="mx-auto max-w-md px-5 pb-24 pt-14">

        <header className="mb-8">
          <Link
            href="/"
            className="mb-6 inline-block text-sm text-zinc-500"
          >
            ← Back
          </Link>

          <div className="flex items-end justify-between">
            <div>
              <p className="mb-2 text-sm text-violet-400">
                AMBITIOUS
              </p>

              <h1 className="text-3xl font-semibold">
                Goals
              </h1>

              <p className="mt-2 text-zinc-400">
                Build the system behind the outcome.
              </p>
            </div>

            <button
              onClick={() =>
                setShowGoalForm(true)
              }
              className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-medium"
            >
              + Goal
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            {error}
          </div>
        )}

        {showGoalForm && (
          <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-5 text-sm text-violet-400">
              NEW BIG GOAL
            </p>

            <input
              value={goalTitle}
              onChange={(e) =>
                setGoalTitle(e.target.value)
              }
              placeholder="Lose 15kg"
              className="mb-3 w-full rounded-2xl border border-zinc-800 bg-[#111113] px-4 py-4 outline-none"
            />

            <textarea
              value={goalDescription}
              onChange={(e) =>
                setGoalDescription(e.target.value)
              }
              placeholder="Why does this goal matter?"
              rows={3}
              className="mb-3 w-full resize-none rounded-2xl border border-zinc-800 bg-[#111113] px-4 py-4 outline-none"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
              <input
                value={goalTargetValue}
                onChange={(e) =>
                  setGoalTargetValue(
                    e.target.value
                  )
                }
                inputMode="decimal"
                placeholder="Target"
                className="rounded-2xl border border-zinc-800 bg-[#111113] px-4 py-4 outline-none"
              />

              <input
                value={goalTargetUnit}
                onChange={(e) =>
                  setGoalTargetUnit(
                    e.target.value
                  )
                }
                placeholder="kg, videos..."
                className="rounded-2xl border border-zinc-800 bg-[#111113] px-4 py-4 outline-none"
              />
            </div>

            <input
              type="date"
              value={goalTargetDate}
              onChange={(e) =>
                setGoalTargetDate(
                  e.target.value
                )
              }
              className="mb-4 w-full rounded-2xl border border-zinc-800 bg-[#111113] px-4 py-4 outline-none"
            />

            <div className="flex gap-3">
              <button
                onClick={createGoal}
                disabled={
                  saving ||
                  !goalTitle.trim()
                }
                className="flex-1 rounded-2xl bg-violet-500 px-4 py-4 font-medium disabled:opacity-40"
              >
                {saving
                  ? "Saving..."
                  : "Create goal"}
              </button>

              <button
                onClick={() =>
                  setShowGoalForm(false)
                }
                className="rounded-2xl border border-zinc-800 px-5 py-4 text-zinc-400"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-500">
            Loading goals...
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-lg font-medium">
              No active goals yet.
            </p>

            <p className="mt-2 leading-6 text-zinc-500">
              Add the outcome you want, then
              build the smaller behaviours
              underneath it.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {goals.map((goal) => {
              const targets =
                goal.goal_targets?.filter(
                  (target) => target.active
                ) || [];

              return (
                <section
                  key={goal.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
                >
                  <div className="mb-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-violet-400">
                          Big goal
                        </p>

                        <h2 className="mt-2 text-xl font-semibold">
                          {goal.title}
                        </h2>
                      </div>

                      <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs capitalize text-zinc-500">
                        {goal.status}
                      </span>
                    </div>

                    {goal.description && (
                      <p className="mt-3 leading-6 text-zinc-400">
                        {goal.description}
                      </p>
                    )}

                    {(goal.target_value ||
                      goal.target_date) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {goal.target_value && (
                          <span className="rounded-full bg-[#151518] px-3 py-2 text-xs text-zinc-300">
                            Target:{" "}
                            {goal.target_value}{" "}
                            {goal.target_unit || ""}
                          </span>
                        )}

                        {goal.target_date && (
                          <span className="rounded-full bg-[#151518] px-3 py-2 text-xs text-zinc-300">
                            By{" "}
                            {new Intl.DateTimeFormat(
                              "en-AU",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            ).format(
                              new Date(
                                `${goal.target_date}T00:00:00`
                              )
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-zinc-900 pt-5">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm text-zinc-500">
                        TARGETS
                      </p>

                      <button
                        onClick={() =>
                          setAddingTargetTo(
                            addingTargetTo ===
                              goal.id
                              ? null
                              : goal.id
                          )
                        }
                        className="text-sm text-violet-400"
                      >
                        + Add target
                      </button>
                    </div>

                    {targets.length === 0 && (
                      <p className="text-sm text-zinc-600">
                        No targets yet.
                      </p>
                    )}

                    <div className="space-y-3">
                      {targets.map(
                        (target) => (
                          <div
                            key={target.id}
                            className="flex items-center justify-between rounded-2xl bg-[#111113] px-4 py-4"
                          >
                            <div>
                              <p className="text-zinc-200">
                                {target.title}
                              </p>

                              <p className="mt-1 text-xs text-zinc-600">
                                {target.target_value}{" "}
                                {target.unit ||
                                  "times"}{" "}
                                /{" "}
                                {target.frequency ===
                                "daily"
                                  ? "day"
                                  : "week"}
                              </p>
                            </div>

                            <button
                              onClick={() =>
                                removeTarget(
                                  target.id
                                )
                              }
                              className="text-xl text-zinc-700"
                            >
                              ×
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    {addingTargetTo ===
                      goal.id && (
                      <div className="mt-4 rounded-2xl border border-zinc-800 bg-[#111113] p-4">
                        <input
                          value={targetTitle}
                          onChange={(e) =>
                            setTargetTitle(
                              e.target.value
                            )
                          }
                          placeholder="15,000 steps"
                          className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none"
                        />

                        <div className="mb-3 grid grid-cols-2 gap-3">
                          <select
                            value={
                              targetFrequency
                            }
                            onChange={(e) =>
                              setTargetFrequency(
                                e.target
                                  .value as
                                  | "daily"
                                  | "weekly"
                              )
                            }
                            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                          >
                            <option value="daily">
                              Daily
                            </option>
                            <option value="weekly">
                              Weekly
                            </option>
                          </select>

                          <input
                            value={targetValue}
                            onChange={(e) =>
                              setTargetValue(
                                e.target.value
                              )
                            }
                            inputMode="decimal"
                            placeholder="Target"
                            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none"
                          />
                        </div>

                        <input
                          value={targetUnit}
                          onChange={(e) =>
                            setTargetUnit(
                              e.target.value
                            )
                          }
                          placeholder="steps, videos, sessions..."
                          className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none"
                        />

                        <button
                          onClick={() =>
                            addTarget(
                              goal.id
                            )
                          }
                          disabled={
                            saving ||
                            !targetTitle.trim()
                          }
                          className="w-full rounded-xl bg-violet-500 px-4 py-3 font-medium disabled:opacity-40"
                        >
                          Add target
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex gap-2 border-t border-zinc-900 pt-5">
                    {goal.status ===
                    "active" ? (
                      <button
                        onClick={() =>
                          changeGoalStatus(
                            goal.id,
                            "paused"
                          )
                        }
                        className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-400"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          changeGoalStatus(
                            goal.id,
                            "active"
                          )
                        }
                        className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-400"
                      >
                        Activate
                      </button>
                    )}

                    <button
                      onClick={() =>
                        changeGoalStatus(
                          goal.id,
                          "completed"
                        )
                      }
                      className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-400"
                    >
                      Complete
                    </button>

                    <button
                      onClick={() =>
                        changeGoalStatus(
                          goal.id,
                          "archived"
                        )
                      }
                      className="ml-auto rounded-xl px-4 py-2 text-sm text-zinc-700"
                    >
                      Archive
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
