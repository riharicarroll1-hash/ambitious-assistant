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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const events: CalendarEvent[] =
      Array.isArray(body.events)
        ? body.events
        : [];

    const tasks: Task[] =
      Array.isArray(body.tasks)
        ? body.tasks
        : [];

    const today = new Intl.DateTimeFormat(
      "en-AU",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    ).format(new Date());

    const calendarContext =
      events.length > 0
        ? events
            .map((event) => {
              const time =
                event.allDay
                  ? "All day"
                  : event.start
                  ? new Intl.DateTimeFormat(
                      "en-AU",
                      {
                        hour: "numeric",
                        minute: "2-digit",
                      }
                    ).format(
                      new Date(event.start)
                    )
                  : "No time";

              return `- ${time}: ${
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

Your job is to look at Hari's real calendar and priorities and give him a useful daily briefing.

Rules:
- Be concise.
- Maximum 3 short sentences.
- Prioritise what actually matters today.
- Mention scheduling conflicts or useful free gaps if obvious.
- Do not invent appointments.
- Do not invent deadlines.
- Treat completed tasks as already done.
- If the day is empty, say so and suggest using the available time productively.
- Speak naturally, like a highly capable executive assistant.
- Do not say "based on your calendar data".
`,

        input: `
TODAY:
${today}

CALENDAR:
${calendarContext}

PRIORITIES:
${taskContext}

Give Hari his briefing for today.
`,
      });

    return NextResponse.json({
      briefing:
        response.output_text ||
        "Your day is ready.",
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
      { status: 500 }
    );
  }
}
