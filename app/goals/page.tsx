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
  calendar_match?: string | null;
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
    return `${action.target_value} ${action.unit || ""} / day`;
  }

  return `${action.target_value} ${action.unit || ""} / week`;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [archivedGoals, setArchivedGoals] = useState<Goal[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // NEW GOAL
  const [creating, setCreating] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalWhy, setGoalWhy] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [suggestedActions, setSuggestedActions] =
    useState<GoalAction[]>([]);
  const [building, setBuilding] = useState(false);
  const [editingSuggestedAction, setEditingSuggestedAction] =
    useState<number | null>(null);

  // EXISTING GOAL EDITING
  const [editingGoalId, setEditingGoalId] =
    useState<string | null>(null);

  const [editGoalTitle, setEditGoalTitle] = useState("");
  const [editGoalWhy, setEditGoalWhy] = useState("");
  const [editGoalDate, setEditGoalDate] = useState("");

  const [editingExistingActionId, setEditingExistingActionId] =
    useState<string | null>(null);

  const [editActionTitle, setEditActionTitle] = useState("");
  const [editActionFrequency, setEditActionFrequency] =
    useState<Frequency>("daily");
  const [editActionValue, setEditActionValue] = useState("1");
  const [editActionUnit, setEditActionUnit] =
    useState("completion");
  const [editActionCalendarMatch, setEditActionCalendarMatch] =
    useState("");

  // ADD ACTION
  const [manualGoalId, setManualGoalId] =
    useState<string | null>(null);

  const [manualTitle, setManualTitle] = useState("");
  const [manualFrequency, setManualFrequency] =
    useState<Frequency>("daily");
  const [manualValue, setManualValue] = useState("1");
  const [manualUnit, setManualUnit] =
    useState("completion");
  const [manualCalendarMatch, setManualCalendarMatch] =
    useState("");

  // MENUS / ARCHIVE
  const [goalMenu, setGoalMenu] =
    useState<string | null>(null);

  const [showArchived, setShowArchived] =
    useState(false);

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
            calendar_match,
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

  async function loadArchivedGoals() {
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
            calendar_match,
            active
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "archived")
        .order("updated_at", {
          ascending: false,
        });

      if (error) {
        console.error(error);
        setError("Could not load archived goals.");
        return;
      }

      setArchivedGoals(data || []);
    } catch (err) {
      console.error(err);
      setError("Could not load archived goals.");
    }
  }

  // ------------------------------
  // NEW GOAL
  // ------------------------------

  function resetNewGoal() {
    setCreating(false);
    setGoalTitle("");
    setGoalWhy("");
    setGoalDate("");
    setSuggestedActions([]);
    setEditingSuggestedAction(null);
  }

  async function buildWithAI() {
    if (!goalTitle.trim()) return;

    setBuilding(true);
    setError("");

    try {
      const response = await fetch("/api/goals/build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: goalTitle,
          why: goalWhy,
          deadline: goalDate,
        }),
      });

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
            unit:
              action.unit || "completion",
            calendar_match:
              action.calendar_match || "",
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
          target_date:
            goalDate || null,
          status: "active",
        })
        .select("id")
        .single();

      if (goalError || !goal) {
        console.error(goalError);
        setError("Could not save your goal.");
        return;
      }

      const validActions =
        suggestedActions.filter(
          (action) =>
            action.title.trim()
        );

      if (validActions.length > 0) {
        const rows =
          validActions.map(
            (action) => ({
              goal_id: goal.id,
              user_id: user.id,
              title: action.title.trim(),
              frequency:
                action.frequency,
              target_value:
                Number(
                  action.target_value
                ) || 1,
              unit:
                action.unit?.trim() ||
                "completion",
              calendar_match:
                action.calendar_match?.trim() ||
                null,
              active: true,
            })
          );

        const {
          error: actionsError,
        } = await supabase
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
    const newIndex =
      suggestedActions.length;

    setSuggestedActions((current) => [
      ...current,
      {
        title: "",
        frequency: "daily",
        target_value: 1,
        unit: "completion",
        calendar_match: "",
      },
    ]);

    setEditingSuggestedAction(newIndex);
  }

  // ------------------------------
  // EDIT BIG GOAL
  // ------------------------------

  function startEditingGoal(goal: Goal) {
    setGoalMenu(null);
    setEditingGoalId(goal.id);
    setEditGoalTitle(goal.title);
    setEditGoalWhy(
      goal.description || ""
    );
    setEditGoalDate(
      goal.target_date || ""
    );

    setManualGoalId(null);
    setEditingExistingActionId(null);
  }

  function cancelEditingGoal() {
    setEditingGoalId(null);
    setEditGoalTitle("");
    setEditGoalWhy("");
    setEditGoalDate("");
    setEditingExistingActionId(null);
  }

  async function saveEditedGoal(goalId: string) {
    if (!editGoalTitle.trim()) return;

    setSaving(true);
    setError("");

    try {
      const { error } =
        await supabase
          .from("goals")
          .update({
            title:
              editGoalTitle.trim(),
            description:
              editGoalWhy.trim() ||
              null,
            target_date:
              editGoalDate || null,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", goalId);

      if (error) {
        console.error(error);
        setError(
          "Could not save goal changes."
        );
        return;
      }

      cancelEditingGoal();
      await loadGoals();
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------
  // EDIT EXISTING ACTION
  // ------------------------------

  function startEditingAction(action: GoalAction) {
    if (!action.id) return;

    setEditingExistingActionId(
      action.id
    );

    setEditActionTitle(
      action.title
    );

    setEditActionFrequency(
      action.frequency
    );

    setEditActionValue(
      String(
        action.target_value || 1
      )
    );

    setEditActionUnit(
      action.unit || "completion"
    );

    setEditActionCalendarMatch(
      action.calendar_match || ""
    );
  }

  function cancelEditingAction() {
    setEditingExistingActionId(null);
    setEditActionTitle("");
    setEditActionFrequency("daily");
    setEditActionValue("1");
    setEditActionUnit("completion");
    setEditActionCalendarMatch("");
  }

  async function saveEditedAction(
    actionId: string
  ) {
    if (!editActionTitle.trim()) return;

    setSaving(true);
    setError("");

    try {
      const { error } =
        await supabase
          .from("goal_targets")
          .update({
            title:
              editActionTitle.trim(),
            frequency:
              editActionFrequency,
            target_value:
              Number(
                editActionValue
              ) || 1,
            unit:
              editActionUnit.trim() ||
              "completion",
            calendar_match:
              editActionCalendarMatch.trim() ||
              null,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", actionId);

      if (error) {
        console.error(error);
        setError(
          "Could not save action changes."
        );
        return;
      }

      cancelEditingAction();
      await loadGoals();
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------
  // ADD ACTION
  // ------------------------------

  async function addManualAction(
    goalId: string
  ) {
    if (!manualTitle.trim()) return;

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

      const { error } =
        await supabase
          .from("goal_targets")
          .insert({
            goal_id: goalId,
            user_id: user.id,
            title:
              manualTitle.trim(),
            frequency:
              manualFrequency,
            target_value:
              Number(
                manualValue
              ) || 1,
            unit:
              manualUnit.trim() ||
              "completion",
            calendar_match:
              manualCalendarMatch.trim() ||
              null,
            active: true,
          });

      if (error) {
        console.error(error);
        setError(
          "Could not add action."
        );
        return;
      }

      setManualGoalId(null);
      setManualTitle("");
      setManualFrequency("daily");
      setManualValue("1");
      setManualUnit("completion");
      setManualCalendarMatch("");

      await loadGoals();
    } finally {
      setSaving(false);
    }
  }

  async function removeExistingAction(
    id: string
  ) {
    const confirmed =
      window.confirm(
        "Remove this action from the goal?"
      );

    if (!confirmed) return;

    const { error } =
      await supabase
        .from("goal_targets")
        .update({
          active: false,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id);

    if (error) {
      console.error(error);
      setError(
        "Could not remove action."
      );
      return;
    }

    await loadGoals();
  }

  // ------------------------------
  // GOAL STATUS / ARCHIVE
  // ------------------------------

  async function changeGoalStatus(
    id: string,
    status: string
  ) {
    const { error } =
      await supabase
        .from("goals")
        .update({
          status,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id);

    if (error) {
      console.error(error);
      setError(
        "Could not update goal."
      );
      return;
    }

    setGoalMenu(null);

    await loadGoals();

    if (showArchived) {
      await loadArchivedGoals();
    }
  }

  async function archiveGoal(id: string) {
    setGoalMenu(null);

    await changeGoalStatus(
      id,
      "archived"
    );

    await loadArchivedGoals();
  }

  async function restoreGoal(id: string) {
    const { error } =
      await supabase
        .from("goals")
        .update({
          status: "active",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id);

    if (error) {
      console.error(error);
      setError(
        "Could not restore goal."
      );
      return;
    }

    await loadGoals();
    await loadArchivedGoals();
  }

  async function deleteGoal(
    id: string,
    title: string
  ) {
    const confirmed =
      window.confirm(
        `Permanently delete "${title}"?\n\nThis will also delete its actions and progress. This cannot be undone.`
      );

    if (!confirmed) return;

    setGoalMenu(null);

    const { error } =
      await supabase
        .from("goals")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(error);
      setError(
        "Could not delete goal."
      );
      return;
    }

    await loadGoals();
    await loadArchivedGoals();
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
                onClick={() =>
                  setCreating(true)
                }
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
            <p className="text-xs text-violet-400">
              NEW GOAL
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              What do you want to achieve?
            </h2>

            <label className="mb-2 mt-6 block text-sm text-zinc-500">
              Your big goal
            </label>

            <input
              value={goalTitle}
              onChange={(e) =>
                setGoalTitle(
                  e.target.value
                )
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
                setGoalWhy(
                  e.target.value
                )
              }
              placeholder="e.g. Feel fitter, healthier and more confident."
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
                setGoalDate(
                  e.target.value
                )
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

                <p className="text-xs text-violet-400">
                  ACTIONS TO GET THERE
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  Review these before saving.
                </p>

                <div className="mt-4 space-y-3">
                  {suggestedActions.map(
                    (action, index) => (
                      <div
                        key={index}
                        className="rounded-2xl bg-[#111113] p-4"
                      >
                        {editingSuggestedAction === index ? (
                          <ActionEditor
                            title={action.title}
                            frequency={action.frequency}
                            value={String(
                              action.target_value
                            )}
                            unit={
                              action.unit ||
                              ""
                            }
                            calendarMatch={
                              action.calendar_match ||
                              ""
                            }
                            onTitleChange={(value) =>
                              updateSuggestedAction(
                                index,
                                {
                                  title: value,
                                }
                              )
                            }
                            onFrequencyChange={(value) =>
                              updateSuggestedAction(
                                index,
                                {
                                  frequency:
                                    value,
                                }
                              )
                            }
                            onValueChange={(value) =>
                              updateSuggestedAction(
                                index,
                                {
                                  target_value:
                                    Number(
                                      value
                                    ) || 1,
                                }
                              )
                            }
                            onUnitChange={(value) =>
                              updateSuggestedAction(
                                index,
                                {
                                  unit: value,
                                }
                              )
                            }
                            onCalendarChange={(value) =>
                              updateSuggestedAction(
                                index,
                                {
                                  calendar_match:
                                    value,
                                }
                              )
                            }
                            onSave={() =>
                              setEditingSuggestedAction(
                                null
                              )
                            }
                            saveLabel="Done"
                          />
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-zinc-200">
                                {action.title ||
                                  "New action"}
                              </p>

                              <p className="mt-1 text-sm text-zinc-600">
                                {actionLabel(
                                  action
                                )}
                              </p>

                              {action.calendar_match && (
                                <p className="mt-2 text-xs text-violet-400">
                                  Calendar:{" "}
                                  {
                                    action.calendar_match
                                  }
                                </p>
                              )}
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() =>
                                  setEditingSuggestedAction(
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
                  onClick={
                    addBlankSuggestedAction
                  }
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
                  goal.status ===
                  "active"
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
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-lg font-medium">
              No active goals yet.
            </p>

            <p className="mt-2 text-zinc-500">
              Add the outcome you want and build the system underneath it.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {goals.map((goal) => {
              const actions =
                goal.goal_targets?.filter(
                  (action) =>
                    action.active
                ) || [];

              const isEditing =
                editingGoalId === goal.id;

              return (
                <section
                  key={goal.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
                >

                  {isEditing ? (
                    <>
                      <p className="text-xs text-violet-400">
                        EDIT BIG GOAL
                      </p>

                      <label className="mb-2 mt-5 block text-xs text-zinc-600">
                        Goal
                      </label>

                      <input
                        value={
                          editGoalTitle
                        }
                        onChange={(e) =>
                          setEditGoalTitle(
                            e.target.value
                          )
                        }
                        className="mb-4 w-full rounded-xl border border-zinc-800 bg-[#111113] px-4 py-3 outline-none"
                      />

                      <label className="mb-2 block text-xs text-zinc-600">
                        Why it matters
                      </label>

                      <textarea
                        value={
                          editGoalWhy
                        }
                        onChange={(e) =>
                          setEditGoalWhy(
                            e.target.value
                          )
                        }
                        rows={3}
                        className="mb-4 w-full resize-none rounded-xl border border-zinc-800 bg-[#111113] px-4 py-3 outline-none"
                      />

                      <label className="mb-2 block text-xs text-zinc-600">
                        Target date
                      </label>

                      <input
                        type="date"
                        value={
                          editGoalDate
                        }
                        onChange={(e) =>
                          setEditGoalDate(
                            e.target.value
                          )
                        }
                        className="mb-5 w-full rounded-xl border border-zinc-800 bg-[#111113] px-4 py-3 outline-none"
                      />

                      <div className="flex gap-3">
                        <button
                          onClick={() =>
                            saveEditedGoal(
                              goal.id
                            )
                          }
                          disabled={
                            saving ||
                            !editGoalTitle.trim()
                          }
                          className="flex-1 rounded-xl bg-violet-500 px-4 py-3 font-medium disabled:opacity-40"
                        >
                          Save changes
                        </button>

                        <button
                          onClick={
                            cancelEditingGoal
                          }
                          className="rounded-xl border border-zinc-800 px-4 py-3 text-zinc-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
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
                            {
                              goal.description
                            }
                          </p>
                        )}

                        {goal.target_date && (
                          <div className="mt-4">
                            <span className="rounded-full bg-[#151518] px-3 py-2 text-xs text-zinc-300">
                              Target date:{" "}
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
                          </div>
                        )}
                      </div>

                      <div className="border-t border-zinc-900 pt-5">

                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm text-zinc-500">
                            ACTIONS TO GET THERE
                          </p>

                          <button
                            onClick={() =>
                              setManualGoalId(
                                manualGoalId ===
                                  goal.id
                                  ? null
                                  : goal.id
                              )
                            }
                            className="text-sm text-violet-400"
                          >
                            + Add action
                          </button>
                        </div>

                        <div className="space-y-3">
                          {actions.map(
                            (action) => {
                              const editing =
                                action.id ===
                                editingExistingActionId;

                              return (
                                <div
                                  key={action.id}
                                  className="rounded-2xl bg-[#111113] p-4"
                                >
                                  {editing &&
                                  action.id ? (
                                    <ActionEditor
                                      title={
                                        editActionTitle
                                      }
                                      frequency={
                                        editActionFrequency
                                      }
                                      value={
                                        editActionValue
                                      }
                                      unit={
                                        editActionUnit
                                      }
                                      calendarMatch={
                                        editActionCalendarMatch
                                      }
                                      onTitleChange={
                                        setEditActionTitle
                                      }
                                      onFrequencyChange={
                                        setEditActionFrequency
                                      }
                                      onValueChange={
                                        setEditActionValue
                                      }
                                      onUnitChange={
                                        setEditActionUnit
                                      }
                                      onCalendarChange={
                                        setEditActionCalendarMatch
                                      }
                                      onSave={() =>
                                        saveEditedAction(
                                          action.id!
                                        )
                                      }
                                      onCancel={
                                        cancelEditingAction
                                      }
                                      saveLabel={
                                        saving
                                          ? "Saving..."
                                          : "Save action"
                                      }
                                    />
                                  ) : (
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <p className="text-zinc-200">
                                          {
                                            action.title
                                          }
                                        </p>

                                        <p className="mt-1 text-sm text-zinc-600">
                                          {actionLabel(
                                            action
                                          )}
                                        </p>

                                        {action.calendar_match && (
                                          <p className="mt-2 text-xs text-violet-400">
                                            Calendar:{" "}
                                            {
                                              action.calendar_match
                                            }
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() =>
                                            startEditingAction(
                                              action
                                            )
                                          }
                                          className="text-sm text-violet-400"
                                        >
                                          Edit
                                        </button>

                                        {action.id && (
                                          <button
                                            onClick={() =>
                                              removeExistingAction(
                                                action.id!
                                              )
                                            }
                                            className="text-xl text-zinc-700"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>

                        {manualGoalId ===
                          goal.id && (
                          <div className="mt-4 rounded-2xl border border-zinc-800 bg-[#111113] p-4">

                            <ActionEditor
                              title={
                                manualTitle
                              }
                              frequency={
                                manualFrequency
                              }
                              value={
                                manualValue
                              }
                              unit={
                                manualUnit
                              }
                              calendarMatch={
                                manualCalendarMatch
                              }
                              onTitleChange={
                                setManualTitle
                              }
                              onFrequencyChange={
                                setManualFrequency
                              }
                              onValueChange={
                                setManualValue
                              }
                              onUnitChange={
                                setManualUnit
                              }
                              onCalendarChange={
                                setManualCalendarMatch
                              }
                              onSave={() =>
                                addManualAction(
                                  goal.id
                                )
                              }
                              onCancel={() =>
                                setManualGoalId(
                                  null
                                )
                              }
                              saveLabel="Add action"
                            />
                          </div>
                        )}
                      </div>

                      <div className="mt-5 flex items-center gap-2 border-t border-zinc-900 pt-5">

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

                        <div className="relative ml-auto">
                          <button
                            onClick={() =>
                              setGoalMenu(
                                goalMenu ===
                                  goal.id
                                  ? null
                                  : goal.id
                              )
                            }
                            className="rounded-xl px-4 py-2 text-xl text-zinc-500"
                          >
                            •••
                          </button>

                          {goalMenu ===
                            goal.id && (
                            <div className="absolute bottom-12 right-0 z-20 w-52 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151518] shadow-2xl">

                              <button
                                onClick={() =>
                                  startEditingGoal(
                                    goal
                                  )
                                }
                                className="block w-full px-4 py-4 text-left text-sm text-violet-400"
                              >
                                Edit goal
                              </button>

                              <div className="border-t border-zinc-800" />

                              <button
                                onClick={() =>
                                  archiveGoal(
                                    goal.id
                                  )
                                }
                                className="block w-full px-4 py-4 text-left text-sm text-zinc-300"
                              >
                                Archive goal
                              </button>

                              <div className="border-t border-zinc-800" />

                              <button
                                onClick={() =>
                                  deleteGoal(
                                    goal.id,
                                    goal.title
                                  )
                                }
                                className="block w-full px-4 py-4 text-left text-sm text-red-400"
                              >
                                Delete permanently
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <section className="mt-10 border-t border-zinc-900 pt-6">

          <button
            onClick={async () => {
              if (!showArchived) {
                await loadArchivedGoals();
              }

              setShowArchived(
                !showArchived
              );
            }}
            className="flex w-full items-center justify-between py-3 text-left"
          >
            <div>
              <p className="text-sm text-zinc-500">
                ARCHIVED GOALS
              </p>

              <p className="mt-1 text-xs text-zinc-700">
                Past systems and goals
              </p>
            </div>

            <span className="text-zinc-600">
              {showArchived
                ? "⌃"
                : "›"}
            </span>
          </button>

          {showArchived && (
            <div className="mt-3 space-y-2">

              {archivedGoals.length ===
              0 ? (
                <p className="py-4 text-sm text-zinc-700">
                  Nothing archived.
                </p>
              ) : (
                archivedGoals.map(
                  (goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center justify-between rounded-2xl bg-[#111113] px-4 py-4"
                    >
                      <div className="min-w-0 pr-4">
                        <p className="truncate text-zinc-400">
                          {goal.title}
                        </p>

                        <p className="mt-1 text-xs text-zinc-700">
                          Archived
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-3">
                        <button
                          onClick={() =>
                            restoreGoal(
                              goal.id
                            )
                          }
                          className="text-sm text-violet-400"
                        >
                          Restore
                        </button>

                        <button
                          onClick={() =>
                            deleteGoal(
                              goal.id,
                              goal.title
                            )
                          }
                          className="text-sm text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ActionEditor({
  title,
  frequency,
  value,
  unit,
  calendarMatch,
  onTitleChange,
  onFrequencyChange,
  onValueChange,
  onUnitChange,
  onCalendarChange,
  onSave,
  onCancel,
  saveLabel,
}: {
  title: string;
  frequency: Frequency;
  value: string;
  unit: string;
  calendarMatch: string;

  onTitleChange: (value: string) => void;
  onFrequencyChange: (value: Frequency) => void;
  onValueChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  onCalendarChange: (value: string) => void;

  onSave: () => void;
  onCancel?: () => void;

  saveLabel: string;
}) {
  return (
    <>
      <label className="mb-2 block text-xs text-zinc-600">
        What do you need to do?
      </label>

      <input
        value={title}
        onChange={(e) =>
          onTitleChange(
            e.target.value
          )
        }
        placeholder="e.g. Strength training"
        className="mb-4 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 outline-none"
      />

      <label className="mb-2 block text-xs text-zinc-600">
        How often?
      </label>

      <select
        value={frequency}
        onChange={(e) =>
          onFrequencyChange(
            e.target
              .value as Frequency
          )
        }
        className="mb-4 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3"
      >
        <option value="daily">
          Daily
        </option>

        <option value="weekly">
          Weekly
        </option>
      </select>

      <div className="mb-4 grid grid-cols-2 gap-3">

        <div>
          <label className="mb-2 block text-xs text-zinc-600">
            How many?
          </label>

          <input
            value={value}
            onChange={(e) =>
              onValueChange(
                e.target.value
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
            value={unit}
            onChange={(e) =>
              onUnitChange(
                e.target.value
              )
            }
            placeholder="sessions"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 outline-none"
          />
        </div>
      </div>

      <label className="mb-2 block text-xs text-zinc-600">
        Calendar match
        <span className="ml-1 text-zinc-700">
          Optional
        </span>
      </label>

      <input
        value={calendarMatch}
        onChange={(e) =>
          onCalendarChange(
            e.target.value
          )
        }
        placeholder="e.g. Gym"
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 outline-none"
      />

      <p className="mt-2 text-xs leading-5 text-zinc-700">
        Example: if the action is Strength training but your Google Calendar event says Gym, enter Gym here.
      </p>

      <div className="mt-4 flex gap-3">
        <button
          onClick={onSave}
          disabled={!title.trim()}
          className="flex-1 rounded-xl bg-violet-500 px-4 py-3 font-medium disabled:opacity-40"
        >
          {saveLabel}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-xl border border-zinc-800 px-4 py-3 text-zinc-500"
          >
            Cancel
          </button>
        )}
      </div>
    </>
  );
}
