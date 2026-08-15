import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type MemoryDecision = {
  should_save: boolean;
  content: string;
  memory_type:
    | "preference"
    | "routine"
    | "goal"
    | "rule"
    | "commitment"
    | "personal"
    | "none";
  importance: number;
};

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

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

    // --------------------------------------------------
    // EXPLICIT MEMORY
    // --------------------------------------------------

    const explicitMemoryMatch = message.trim().match(
      /^(?:please\s+)?remember(?:\s+that)?\s+(.+)/i
    );

    if (explicitMemoryMatch) {
      const memoryContent =
        explicitMemoryMatch[1].trim();

      if (!memoryContent) {
        return NextResponse.json({
          reply: "What would you like me to remember?",
        });
      }

      const { data: existingMemory } =
        await supabase
          .from("memories")
          .select("id")
          .eq("user_id", user.id)
          .eq("content", memoryContent)
          .eq("active", true)
          .maybeSingle();

      if (!existingMemory) {
        const { error: saveError } =
          await supabase
            .from("memories")
            .insert({
              user_id: user.id,
              content: memoryContent,
              memory_type: "explicit",
              importance: 9,
              active: true,
            });

        if (saveError) {
          console.error(
            "Explicit memory save error:",
            saveError
          );

          return NextResponse.json(
            {
              error:
                "I couldn't save that memory.",
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        reply: existingMemory
          ? `I already remember that: ${memoryContent}`
          : `Remembered: ${memoryContent}`,
      });
    }

    // --------------------------------------------------
    // LOAD CURRENT MEMORIES
    // --------------------------------------------------

    const {
      data: memories,
      error: memoryError,
    } = await supabase
      .from("memories")
      .select(
        "content, memory_type, importance"
      )
      .eq("user_id", user.id)
      .eq("active", true)
      .order("importance", {
        ascending: false,
      })
      .limit(50);

    if (memoryError) {
      console.error(
        "Memory fetch error:",
        memoryError
      );
    }

    const existingMemoryContext =
      memories && memories.length > 0
        ? memories
            .map(
              (memory) =>
                `- [${memory.memory_type}] ${memory.content}`
            )
            .join("\n")
        : "No saved memories yet.";

    // --------------------------------------------------
    // AUTOMATIC MEMORY DECISION
    // --------------------------------------------------

    let newlySavedMemory:
      | {
          content: string;
          memory_type: string;
          importance: number;
        }
      | null = null;

    try {
      const memoryCheck =
        await openai.responses.create({
          model: "gpt-5.4",

          input: [
            {
              role: "system",
              content: `You decide whether information from Hari's message should become long-term memory for his personal executive assistant.

SAVE information when it is likely to remain useful in future conversations.

Good things to save:
- stable preferences
- recurring routines
- long-term goals
- personal operating rules
- standing commitments
- important persistent facts
- preferred ways of working
- recurring scheduling constraints

Usually DO NOT save:
- casual conversation
- temporary moods
- one-off questions
- things happening only today
- current market observations
- temporary prices or numbers
- information already contained in existing memories
- instructions that only apply to the current response

Be conservative. It is better to save nothing than to clutter memory.

Rewrite saved memories as short, standalone facts that will still make sense later.

Existing memories:
${existingMemoryContext}`,
            },
            {
              role: "user",
              content: message,
            },
          ],

          text: {
            format: {
              type: "json_schema",
              name: "memory_decision",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  should_save: {
                    type: "boolean",
                  },
                  content: {
                    type: "string",
                  },
                  memory_type: {
                    type: "string",
                    enum: [
                      "preference",
                      "routine",
                      "goal",
                      "rule",
                      "commitment",
                      "personal",
                      "none",
                    ],
                  },
                  importance: {
                    type: "integer",
                    minimum: 1,
                    maximum: 10,
                  },
                },
                required: [
                  "should_save",
                  "content",
                  "memory_type",
                  "importance",
                ],
                additionalProperties: false,
              },
            },
          },
        });

      const decision = JSON.parse(
        memoryCheck.output_text
      ) as MemoryDecision;

      if (
        decision.should_save &&
        decision.memory_type !== "none" &&
        decision.content.trim()
      ) {
        const cleanContent =
          decision.content.trim();

        const { data: duplicate } =
          await supabase
            .from("memories")
            .select("id")
            .eq("user_id", user.id)
            .eq("content", cleanContent)
            .eq("active", true)
            .maybeSingle();

        if (!duplicate) {
          const { error: autoSaveError } =
            await supabase
              .from("memories")
              .insert({
                user_id: user.id,
                content: cleanContent,
                memory_type:
                  decision.memory_type,
                importance:
                  decision.importance,
                active: true,
              });

          if (autoSaveError) {
            console.error(
              "Automatic memory save error:",
              autoSaveError
            );
          } else {
            newlySavedMemory = {
              content: cleanContent,
              memory_type:
                decision.memory_type,
              importance:
                decision.importance,
            };
          }
        }
      }
    } catch (memoryDecisionError) {
      // Memory classification should never stop
      // Ambitious from answering normally.
      console.error(
        "Automatic memory decision error:",
        memoryDecisionError
      );
    }

    // --------------------------------------------------
    // BUILD FINAL MEMORY CONTEXT
    // --------------------------------------------------

    const memoryContext =
      newlySavedMemory
        ? `${existingMemoryContext}
- [${newlySavedMemory.memory_type}] ${newlySavedMemory.content}`
        : existingMemoryContext;

    // --------------------------------------------------
    // LOAD TODAY'S TASKS
    // --------------------------------------------------

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(
      endOfDay.getDate() + 1
    );

    const {
      data: todaysTasks,
      error: taskError,
    } = await supabase
      .from("tasks")
      .select(
        "title, status, priority, due_date"
      )
      .eq("user_id", user.id)
      .gte(
        "due_date",
        startOfDay.toISOString()
      )
      .lt(
        "due_date",
        endOfDay.toISOString()
      );

    if (taskError) {
      console.error(
        "Task fetch error:",
        taskError
      );
    }

    const taskContext =
      todaysTasks &&
      todaysTasks.length > 0
        ? todaysTasks
            .map(
              (task) =>
                `- ${task.title} | status: ${task.status} | priority: ${task.priority}`
            )
            .join("\n")
        : "No tasks found for today.";

    // --------------------------------------------------
    // MAIN AMBITIOUS RESPONSE
    // --------------------------------------------------

    const response =
      await openai.responses.create({
        model: "gpt-5.4",

        instructions: `You are Ambitious, Hari's personal executive assistant and personal operating system.

Your job is to help Hari organise, prioritise, schedule and execute his life.

Think like a highly capable executive assistant:
- Protect fixed commitments.
- Treat flexible commitments as movable.
- Prefer clear action over long explanations.
- Reduce unnecessary decisions.
- Use existing information before asking Hari questions.
- When priorities conflict, surface the conflict clearly.
- When information is missing, ask only for what is genuinely necessary.
- Keep responses concise, practical and useful.
- Do not repeatedly ask Hari for information already available below.

Hari may ask about:
- daily and weekly planning
- trading
- business
- content
- routines
- habits
- fitness
- golf
- family
- reminders
- tasks
- scheduling
- goals

SAVED MEMORIES:

${memoryContext}

TODAY'S TASKS AND PRIORITIES:

${taskContext}

Use these memories and tasks naturally when relevant.

If a task is marked completed, treat it as already done.

Do not mention that automatic memory analysis occurred.

Do not claim something was saved unless the application actually saved it.

Never pretend you changed a calendar, task, routine, memory or external system unless the application actually performed that action.`,

        input: message,
      });

    return NextResponse.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error(
      "Chat API error:",
      error
    );

    return NextResponse.json(
      {
        error: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
