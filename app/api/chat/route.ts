import OpenAI from "openai";
import { NextResponse } from "next/server";

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

    const response = await openai.responses.create({
      model: "gpt-5.4",
      instructions: `You are Ambition, Hari's personal AI assistant.

Your job is to help Hari organise and execute his day.

Be concise, practical and action-oriented.
Help with planning, priorities, trading preparation, business, content, routines and personal productivity.
When appropriate, turn ideas into clear next actions.
Do not overwhelm him with unnecessary information.`,
      input: message,
    });

    return NextResponse.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
