import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type GoalTarget = {
  id: string;
  goal_id: string;
  title: string;
  frequency: "daily" | "weekly";
  target_value: number;
  unit: string | null;
  active: boolean;
  goals:
    | {
        id: string;
        title: string;
        status: string;
      }
    | {
        id: string;
        title: string;
        status: string;
      }[];
};

type ProgressRow = {
  target_id: string;
  progress_date: string;
  value: number;
  completed: boolean;
};

function dateString(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonday(date: Date) {
  const result = new Date(date);

  const day = result.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  result.setDate(
    result.getDate() +
      difference
  );

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const localDate =
      typeof body.localDate ===
      "string"
        ? body.localDate
        : dateString(
            new Date()
          );

    const today =
      new Date(
        `${localDate}T12:00:00`
      );

    const monday =
      getMonday(today);

    const sunday =
      new Date(monday);

    sunday.setDate(
      monday.getDate() + 6
    );

    const weekStart =
      dateString(monday);

    const weekEnd =
      dateString(sunday);

    const dayIndex =
      Math.floor(
        (
          today.getTime() -
          monday.getTime()
        ) /
          (
            1000 *
            60 *
            60 *
            24
          )
      );

    const daysRemaining =
      Math.max(
        1,
        7 - dayIndex
      );

    const {
      data: targets,
      error: targetError,
    } =
      await supabase
        .from(
          "goal_targets"
        )
        .select(`
          id,
          goal_id,
          title,
          frequency,
          target_value,
          unit,
          active,
          goals!inner (
            id,
            title,
            status
          )
        `)
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "active",
          true
        )
        .eq(
          "goals.status",
          "active"
        );

    if (targetError) {
      console.error(
        "Priority target error:",
        targetError
      );

      return NextResponse.json(
        {
          error:
            "Could not load goal actions.",
        },
        {
          status: 500,
        }
      );
    }

    const {
      data: progress,
      error: progressError,
    } =
      await supabase
        .from(
          "goal_progress"
        )
        .select(
          "target_id, progress_date, value, completed"
        )
        .eq(
          "user_id",
          user.id
        )
        .gte(
          "progress_date",
          weekStart
        )
        .lte(
          "progress_date",
          weekEnd
        );

    if (progressError) {
      console.error(
        "Priority progress error:",
        progressError
      );
    }

    const progressRows =
      (progress ||
        []) as ProgressRow[];

    const priorities =
      (
        (targets ||
          []) as GoalTarget[]
      )
        .map((target) => {
          const goal =
            Array.isArray(
              target.goals
            )
              ? target
                  .goals[0]
              : target.goals;

          if (!goal) {
            return null;
          }

          const targetProgress =
            progressRows.filter(
              (row) =>
                row.target_id ===
                target.id
            );

          const todayProgress =
            targetProgress.find(
              (row) =>
                row.progress_date ===
                localDate
            );

          const todayValue =
            Number(
              todayProgress?.value ||
                0
            );

          if (
            target.frequency ===
            "daily"
          ) {
            const required =
              Number(
                target.target_value
              ) || 1;

            const remaining =
              Math.max(
                0,
                required -
                  todayValue
              );

            return {
              targetId:
                target.id,

              goalId:
                target.goal_id,

              goalTitle:
                goal.title,

              title:
                target.title,

              frequency:
                target.frequency,

              unit:
                target.unit,

              targetValue:
                required,

              completedValue:
                todayValue,

              todayTarget:
                required,

              remainingToday:
                remaining,

              completed:
                remaining <= 0,
            };
          }

          const weeklyTarget =
            Number(
              target.target_value
            ) || 1;

          const completedThisWeek =
            targetProgress.reduce(
              (
                total,
                row
              ) =>
                total +
                Number(
                  row.value ||
                    0
                ),
              0
            );

          const remainingThisWeek =
            Math.max(
              0,
              weeklyTarget -
                completedThisWeek
            );

          if (
            remainingThisWeek <=
            0
          ) {
            return null;
          }

          const suggestedToday =
            Math.max(
              1,
              Math.ceil(
                remainingThisWeek /
                  daysRemaining
              )
            );

          const remainingToday =
            Math.max(
              0,
              suggestedToday -
                todayValue
            );

          return {
            targetId:
              target.id,

            goalId:
              target.goal_id,

            goalTitle:
              goal.title,

            title:
              target.title,

            frequency:
              target.frequency,

            unit:
              target.unit,

            targetValue:
              weeklyTarget,

            completedValue:
              todayValue,

            weeklyCompleted:
              completedThisWeek,

            weeklyRemaining:
              remainingThisWeek,

            todayTarget:
              suggestedToday,

            remainingToday,

            completed:
              remainingToday <= 0,
          };
        })
        .filter(Boolean);

    return NextResponse.json({
      localDate,
      weekStart,
      weekEnd,
      daysRemaining,
      priorities,
    });
  } catch (error) {
    console.error(
      "Today priority error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not build today's priorities.",
      },
      {
        status: 500,
      }
    );
  }
}
