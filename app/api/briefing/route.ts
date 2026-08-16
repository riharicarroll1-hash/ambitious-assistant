import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CalendarEvent = {
  title?: string;
  start?: string | null;
  end?: string | null;
  allDay?: boolean;
};

type Task = {
  title?: string;
  status?: string;
};

function validTimeZone(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat(
      "en-AU",
      {
        timeZone: value,
      }
    ).format(new Date());

    return value;
  } catch {
    return "UTC";
  }
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

    const events: CalendarEvent[] =
      Array.isArray(body.events)
        ? body.events
        : [];

    const tasks: Task[] =
      Array.isArray(body.tasks)
        ? body.tasks
        : [];

    const timeZone =
      validTimeZone(
        body.timeZone
      );

    const now = new Date();

    const today =
      new Intl.DateTimeFormat(
        "en-AU",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone,
        }
      ).format(now);

    const currentTime =
      new Intl.DateTimeFormat(
        "en-AU",
        {
          hour: "numeric",
          minute: "2-digit",
          timeZone,
        }
      ).format(now);

    const calendarContext =
      events.length > 0
        ? events
            .map((event) => {
              if (event.allDay) {
                return `- All day: ${
                  event.title ||
                  "Untitled event"
                }`;
              }

              if (!event.start) {
                return `- ${
                  event.title ||
                  "Untitled event"
                }`;
              }

              const start =
                new Intl.DateTimeFormat(
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

              let end = "";

              if (event.end) {
                end =
                  new Intl.DateTimeFormat(
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
                      event.end
                    )
                  );
              }

              return `- ${start}${
                end
                  ? `–${end}`
                  : ""
              }: ${
                event.title ||
                "Untitled event"
              }`;
            })
            .join("\n")
        : "- Nothing scheduled today";

    const taskContext =
      tasks.length > 0
        ? tasks
            .map(
              (task) =>
                `- ${
                  task.status ===
                  "completed"
                    ? "DONE"
                    : "PENDING"
                }: ${
                  task.title ||
                  "Untitled task"
                }`
            )
            .join("\n")
        : "- No priorities found";

    const response =
      await openai.responses.create({
        model: "gpt-5.4",

        instructions: `
You are Ambitious, Hari's personal executive assistant.

Your job is to look at Hari's real calendar and priorities
and give him a useful daily briefing.

IMPORTANT:
All calendar times supplied below have already been converted
into the user's current device timezone.

The user's current timezone is:
${timeZone}

Do NOT convert these times again.

Rules:
- Be concise.
- Maximum 3 short paragraphs.
- Prioritise what actually matters today.
- Mention scheduling conflicts or useful free gaps if obvious.
- Do not invent appointments.
- Do not invent deadlines.
- Treat completed tasks as already done.
- Use the current local time when deciding what is still ahead today.
- Do not recommend doing an event that has already passed.
- If the day is empty, say so and suggest using the available time productively.
- Speak naturally, like a highly capable executive assistant.
`,

        input: `
CURRENT LOCAL DATE:
${today}

CURRENT LOCAL TIME:
${currentTime}

DEVICE TIMEZONE:
${timeZone}

TODAY'S CALENDAR:
${calendarContext}

TODAY'S PRIORITIES:
${taskContext}

Give Hari his briefing for today.
`,
      });

    return NextResponse.json({
      briefing:
        response.output_text ||
        "Your day is ready.",
      timeZone,
    });
  } catch (error) {
    console.error(
      "AI briefing error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not generate briefing.",
      },
      {
        status: 500,
      }
    );
  }
}
