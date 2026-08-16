"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Frequency = "daily" | "weekly";

type GoalAction = {
  id?: string;
  goal_id?: string;
  title: string;
  frequency: Frequency;
  target_value: number;
  unit: string | null;
  active?: boolean;
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  goal_targets?: GoalAction[];
};

function actionLabel(action: GoalAction) {
  if (
    action.frequency === "daily" &&
    action.target_value === 1 &&
    action.unit === "completion"
  ) {
    return "Daily";
  }

  if (action.frequency === "daily") {
    return `${action.target_value} ${
      action.unit || ""
    } / day`;
  }

  return `${action.target_value} ${
    action.unit || ""
  } / week`;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);

  const [goalTitle, setGoalTitle] = useState("");
  const [goalWhy, setGoalWhy] = useState("");
  const [goalDate, setGoalDate] = useState("");

  const [suggestedActions, setSuggestedActions] =
    useState<GoalAction[]>([]);

  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingAction, setEditingAction] =
    useState<number | null>(null);

  const [manualGoalId, setManualGoalId] =
    useState<string | null>(null);

  const [manualTitle, setManualTitle] = useState("");
  const [manualFrequency, setManualFrequency] =
    useState<Frequency>("daily");
  const [manualValue, setManualValue] = useState("1");
  const [manualUnit, setManualUnit] =
    useState("completion");

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Could not load your account.");
        return;
      }

      const { data, error } = await supabase
        .from("goals")
        .select(`
          id,
          title,
          description,
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

      if (error) {
        console.error(error);
        setError("Could not load your goals.");
        return;
      }

      setGoals(data || []);
    } catch (err) {
      console.error(err);
      setError("Could not load your goals.");
    } finally {
      setLoading(false);
    }
  }

  function resetNewGoal() {
    setCreating(false);
    setGoalTitle("");
    setGoalWhy("");
    setGoalDate("");
    setSuggestedActions([]);
    setEditingAction(null);
  }

  async function buildWithAI() {
    if (!goalTitle.trim()) return;

    setBuilding(true);
    setError("");

    try {
      const response = await fetch(
        "/api/goals/build",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            goal: goalTitle,
            why: goalWhy,
            deadline: goalDate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Could not build your goal."
        );
        return;
      }

      setSuggestedActions(
        (data.actions || []).map(
          (action: GoalAction) => ({
            title: action.title,
            frequency: action.frequency,
            target_value:
              Number(action.target_value) || 1,
            unit: action.unit || "completion",
          })
        )
      );
    } catch (err) {
      console.error(err);
      setError("Could not build your goal.");
    } finally {
      setBuilding(false);
    }
  }

  async function saveGoal() {
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

      const {
        data: goal,
        error: goalError,
      } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          title: goalTitle.trim(),
          description:
            goalWhy.trim() || null,
          target_date: goalDate || null,
          status: "active",
        })
        .select("id")
        .single();

      if (goalError || !goal) {
        console.error(goalError);
        setError("Could not save your goal.");
        return;
      }

      if (suggestedActions.length > 0) {
        const rows = suggestedActions.map(
          (action) => ({
            goal_id: goal.id,
            user_id: user.id,
            title: action.title.trim(),
            frequency: action.frequency,
            target_value:
              Number(action.target_value) || 1,
            unit:
              action.unit?.trim() ||
              "completion",
            active: true,
          })
        );

        const { error: actionsError } =
          await supabase
            .from("goal_targets")
            .insert(rows);

        if (actionsError) {
          console.error(actionsError);
          setError(
            "Goal saved, but some actions could not be added."
          );
        }
      }

      resetNewGoal();
      await loadGoals();
    } finally {
      setSaving(false);
    }
  }

  function updateSuggestedAction(
    index: number,
    changes: Partial<GoalAction>
  ) {
    setSuggestedActions((current) =>
      current.map((action, i) =>
        i === index
          ? {
              ...action,
              ...changes,
            }
          : action
      )
    );
  }

  function removeSuggestedAction(index: number) {
    setSuggestedActions((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  function addBlankSuggestedAction() {
    setSuggestedActions((current) => [
      ...current,
      {
        title: "",
        frequency: "daily",
        target_value: 1,
        unit: "completion",
      },
    ]);

    setEditingAction(suggestedActions.length);
  }

  async function addManualAction(goalId: string) {
    if (!manualTitle.trim()) return;

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("goal_targets")
        .insert({
          goal_id: goalId,
          user_id: user.id,
          title: manualTitle.trim(),
          frequency: manualFrequency,
          target_value:
            Number(manualValue) || 1,
          unit:
            manualUnit.trim() || "completion",
          active: true,
        });

      if (error) {
        console.error(error);
        setError("Could not add action.");
        return;
      }

      setManualGoalId(null);
      setManualTitle("");
      setManualFrequency("daily");
      setManualValue("1");
      setManualUnit("completion");

      await loadGoals();
    } finally {
      setSaving(false);
    }
  }

  async function removeExistingAction(id: string) {
    const { error } = await supabase
      .from("goal_targets")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setError("Could not remove action.");
      return;
    }

    await loadGoals();
  }

  async function changeGoalStatus(
    id: string,
    status: string
  ) {
    const { error } = await supabase
      .from("goals")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setError("Could not update goal.");
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
            ← Home
          </Link>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-violet-400">
                AMBITIOUS
              </p>

              <h1 className="text-3xl font-semibold">
                Goals
              </h1>

              <p className="mt-2 text-zinc-400">
                Set the outcome. Build the system.
              </p>
            </div>

            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="shrink-0 rounded-2xl bg-violet-500 px-4 py-3 text-sm font-medium"
              >
                + New Goal
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            {error}
          </div>
        )}

        {creating && (
          <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">

            <div className="mb-6">
              <p className="text-xs text-violet-400">
                NEW GOAL
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                What do you want to achieve?
              </h2>
            </div>

            <label className="mb-2 block text-sm text-zinc-500">
              Your big goal
            </label>

            <input
              value={goalTitle}
              onChange={(e) =>
                setGoalTitle(e.target.value)
              }
              placeholder="e.g. Lose 15kg"
              className="mb-5 w-full rounded-2xl border border-zinc-800 bg-[#111113] px-4 py-4 outline-none"
            />

            <label className="mb-2 block text-sm text-zinc-500">
              Why does this matter? Optional
            </label>

            <textarea
              value={goalWhy}
              onChange={(e) =>
                setGoalWhy(e.target.value)
              }
              placeholder="e.g. I want to feel fitter, healthier and perform better."
              rows={3}
              className="mb-5 w-full resize-none rounded-2xl border border-zinc-800 bg-[#111113] px-4 py-4 outline-none"
            />

            <label className="mb-2 block text-sm text-zinc-500">
              When do you want it by? Optional
            </label>

            <input
              type="date"
              value={goalDate}
              onChange={(e) =>
                setGoalDate(e.target.value)
              }
              className="mb-6 w-full rounded-2xl border border-zinc-800 bg-[#111113] px-4 py-4 outline-none"
            />

            <button
              onClick={buildWithAI}
              disabled={
                building ||
                !goalTitle.trim()
              }
              className="w-full rounded-2xl bg-violet-500 px-4 py-4 font-medium disabled:opacity-40"
            >
              {building
                ? "Building your plan..."
                : "✨ Build my plan with AI"}
            </button>

            {suggestedActions.length > 0 && (
              <div className="mt-8 border-t border-zinc-900 pt-6">

                <div className="mb-4">
                  <p className="text-xs text-violet-400">
                    ACTIONS TO GET THERE
                  </p>

                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Ambitious has suggested these.
                    Change anything before saving.
                  </p>
                </div>

                <div className="space-y-3">
                  {suggestedActions.map(
                    (action, index) => (
                      <div
                        key={index}
                        className="rounded-2xl bg-[#111113] p-4"
                      >
                        {editingAction === index ? (
                          <>
                            <input
                              value={action.title}
                              onChange={(e) =>
                                updateSuggestedAction(
                                  index,
                                  {
                                    title:
                                      e.target.value,
                                  }
                                )
                              }
                              placeholder="What do you need to do?"
                              className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 outline-none"
                            />

                            <label className="mb-2 block text-xs text-zinc-600">
                              How often?
                            </label>

                            <select
                              value={action.frequency}
                              onChange={(e) =>
                                updateSuggestedAction(
                                  index,
                                  {
                                    frequency:
                                      e.target
                                        .value as Frequency,
                                  }
                                )
                              }
                              className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3"
                            >
                              <option value="daily">
                                Daily
                              </option>
                              <option value="weekly">
                                Weekly
                              </option>
                            </select>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="mb-2 block text-xs text-zinc-600">
                                  How many?
                                </label>

                                <input
                                  value={
                                    action.target_value
                                  }
                                  onChange={(e) =>
                                    updateSuggestedAction(
                                      index,
                                      {
                                        target_value:
                                          Number(
                                            e.target
                                              .value
                                          ) || 1,
                                      }
                                    )
                                  }
                                  inputMode="decimal"
                                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 outline-none"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs text-zinc-600">
                                  What?
                                </label>

                                <input
                                  value={
                                    action.unit || ""
                                  }
                                  onChange={(e) =>
                                    updateSuggestedAction(
                                      index,
                                      {
                                        unit:
                                          e.target
                                            .value,
                                      }
                                    )
                                  }
                                  placeholder="videos"
                                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 outline-none"
                                />
                              </div>
                            </div>

                            <button
                              onClick={() =>
                                setEditingAction(null)
                              }
                              className="mt-3 text-sm text-violet-400"
                            >
                              Done
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-zinc-200">
                                {action.title ||
                                  "New action"}
                              </p>

                              <p className="mt-1 text-sm text-zinc-600">
                                {actionLabel(action)}
                              </p>
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() =>
                                  setEditingAction(
                                    index
                                  )
                                }
                                className="text-sm text-violet-400"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() =>
                                  removeSuggestedAction(
                                    index
                                  )
                                }
                                className="text-xl text-zinc-700"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                <button
                  onClick={addBlankSuggestedAction}
                  className="mt-4 text-sm text-violet-400"
                >
                  + Add another action
                </button>

                <button
                  onClick={saveGoal}
                  disabled={saving}
                  className="mt-6 w-full rounded-2xl bg-white px-4 py-4 font-medium text-black disabled:opacity-40"
                >
                  {saving
                    ? "Saving..."
                    : "Save goal & system"}
                </button>
              </div>
            )}

            <button
              onClick={resetNewGoal}
              className="mt-4 w-full py-3 text-sm text-zinc-600"
            >
              Cancel
            </button>
          </section>
        )}

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            YOUR SYSTEMS
          </p>

          <span className="text-xs text-zinc-700">
            {
              goals.filter(
                (goal) =>
                  goal.status === "active"
              ).length
            }{" "}
            active
          </span>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-500">
            Loading goals...
          </div>
        ) : goals.length === 0 ? (
          <div
