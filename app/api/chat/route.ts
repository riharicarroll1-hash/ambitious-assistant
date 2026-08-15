import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message || !message.trim()) {
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
    // EXPLICIT MEMORY SAVING
    // Examples:
    // "Remember that I trade from 10am to 12pm."
    // "Remember I prefer meetings in the afternoon."
    // "Please remember that Friday is family focused."
    // --------------------------------------------------

    const memoryMatch = message.trim().match(
      /^(?:please\s+)?remember(?:\s+that)?\s+(.+)/i
    );

    if (memoryMatch) {
      const memoryContent = memoryMatch[1].trim();

      if (!memoryContent) {
        return NextResponse.json({
          reply: "What would you like me to remember?",
        });
      }

      // Check whether this exact memory already exists
      const { data: existingMemory } = await supabase
        .from("memories")
        .select("id")
        .eq("user_id", user.id)
        .eq("content", memoryContent)
        .eq("active", true)
        .maybeSingle();

      if (existingMemory) {
        return NextResponse.json({
          reply: `I already remember that: ${memoryContent}`,
        });
      }

      const { error: saveError } = await supabase
        .from("memories")
        .insert({
          user_id: user.id,
          content: memoryContent,
          memory_type: "explicit",
          importance: 8,
          active: true,
        });

      if (saveError) {
        console.error("Memory save error:", saveError);

        return NextResponse.json(
          { error: "I couldn't save that memory." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        reply: `Remembered: ${memoryContent}`,
      });
    }

    // --------------------------------------------------
    // LOAD ACTIVE MEMORIES
    // --------------------------------------------------

    const { data: memories, error: memoryError } = await supabase
      .from("memories")
      .select("content, memory_type, importance")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("importance", { ascending: false })
      .limit(50);

    if (memoryError) {
      console.error("Memory fetch error:", memoryError);
    }

    const memoryContext =
      memories && memories.length > 0
        ? memories
            .map(
              (memory) =>
                `- [${memory.memory_type}] ${memory.content}`
            )
            .join("\n")
        : "No saved memories yet.";

    // --------------------------------------------------
    // LOAD TODAY'S TASKS / PRIORITIES
    // --------------------------------------------------

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const { data: todaysTasks, error: taskError } = await supabase
      .from("tasks")
      .select("title, status, priority, due_date")
      .eq("user_id", user.id)
      .gte("due_date", startOfDay.toISOString())
      .lt("due_date", endOfDay.toISOString());

    if (taskError) {
      console.error("Task fetch error:", taskError);
    }

    const taskContext =
      todaysTasks && todaysTasks.length > 0
        ? todaysTasks
            .map(
              (task) =>
                `- ${task.title} | status: ${task.status} | priority: ${task.priority}`
            )
            .join("\n")
        : "No tasks found for today.";

    // --------------------------------------------------
    // ASK OPENAI
    // --------------------------------------------------

    const response = await openai.responses.create({
      model: "gpt-5.4",

      instructions: `You are Ambitious, Hari's personal executive assistant and personal operating system.

Your job is to help Hari organise, prioritise, schedule and execute his life.

Think like a highly capable executive assistant:
- Protect fixed commitments.
- Treat flexible commitments as movable.
- Prefer clear action over long explanations.
- Help reduce overload and unnecessary decisions.
- When something can be scheduled, think about the best time to place it.
- When priorities conflict, surface the conflict clearly.
- When information is missing, ask only for what is genuinely necessary.
- Keep responses concise, practical and useful.
- Use saved information when relevant.
- Do not repeatedly ask Hari for information that is already provided in his memories or tasks.

Hari may ask about:
- daily and weekly planning
- trading preparation and review
- business priorities
- content creation
- routines and habits
- fitness
- golf
- family commitments
- reminders
- tasks
- scheduling

SAVED MEMORIES:

${memoryContext}

TODAY'S TASKS AND PRIORITIES:

${taskContext}

Use these memories and tasks when relevant.

If a task is marked completed, treat it as already done.

Do not claim something is saved unless the application has actually saved it.

Never pretend you have changed a calendar, task, routine or memory unless the application has actually performed that action.`,

      input: message,
    });

    return NextResponse.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
