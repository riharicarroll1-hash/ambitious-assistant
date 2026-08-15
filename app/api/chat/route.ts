import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Connect to Supabase
    const supabase = await createClient();

    // Identify the signed-in user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Load this user's active memories
    const { data: memories, error: memoryError } = await supabase
      .from("memories")
      .select("content, memory_type, importance")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("importance", { ascending: false })
      .limit(25);

    if (memoryError) {
      console.error("Memory fetch error:", memoryError);
    }

    // Turn memories into context Ambitious can understand
    const memoryContext =
      memories && memories.length > 0
        ? memories
            .map(
              (memory) =>
                `- [${memory.memory_type}] ${memory.content}`
            )
            .join("\n")
        : "No saved memories yet.";

    // Ask OpenAI
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
- When information is missing, ask only for what is necessary.
- Keep responses concise, practical and useful.

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

Here are Hari's currently saved memories:

${memoryContext}

Use these memories when they are relevant to Hari's request.
Do not mention the memory database unless Hari specifically asks about it.
Do not invent memories that are not provided above.

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
