import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const goal =
      typeof body.goal === "string"
        ? body.goal.trim()
        : "";

    const why =
      typeof body.why === "string"
        ? body.why.trim()
        : "";

    const deadline =
      typeof body.deadline === "string"
        ? body.deadline
        : "";

    if (!goal) {
      return NextResponse.json(
        { error: "Goal is required." },
        { status: 400 }
      );
    }

    const response =
      await openai.responses.create({
        model: "gpt-5.4",

        instructions: `
You are helping a user turn a larger outcome into a simple execution system.

Your job is NOT to give motivational advice.

Your job is to identify the small recurring behaviours that, if performed consistently, would make the larger goal more likely.

Return ONLY valid JSON.

Use exactly this shape:

{
  "actions": [
    {
      "title": "15,000 steps",
      "frequency": "daily",
      "target_value": 1,
      "unit": "completion"
    }
  ]
}

Allowed frequency values:
- daily
- weekly

Rules:

For a behaviour that simply needs to happen every day:
frequency = "daily"
target_value = 1
unit = "completion"

Example:
Eat to nutrition plan
→ daily / 1 / completion

For something measured as a quantity each day:
frequency = "daily"
target_value = the quantity
unit = the natural unit

Example:
10 stories per day
→ daily / 10 / stories

For something performed X times per week:
frequency = "weekly"
target_value = X
unit = the natural unit

Example:
Gym 4 times per week
→ weekly / 4 / sessions

For a weekly production target:
frequency = "weekly"
target_value = quantity
unit = natural unit

Example:
16 short-form videos per week
→ weekly / 16 / videos

Keep the system practical.
Usually suggest 3 to 6 actions.
Do not overcomplicate the goal.
Do not invent highly specific medical, financial or professional requirements.
Use the user's own wording when it is already specific.
`,

        input: `
BIG GOAL:
${goal}

WHY IT MATTERS:
${why || "Not provided"}

TARGET DATE:
${deadline || "No deadline provided"}

Build the recurring actions that would support this goal.
`,
      });

    const cleaned =
      response.output_text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const result = JSON.parse(cleaned);

    return NextResponse.json({
      actions:
        Array.isArray(result.actions)
          ? result.actions
          : [],
    });
  } catch (error) {
    console.error(
      "Goal builder error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not build the goal plan.",
      },
      { status: 500 }
    );
  }
}
