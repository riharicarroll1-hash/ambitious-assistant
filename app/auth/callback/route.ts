import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(`${origin}/login`);
  }

  const response = NextResponse.redirect(
    `${origin}/?calendar=connected`
  );

  if (data.session.provider_token) {
    response.cookies.set(
      "google_provider_token",
      data.session.provider_token,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      }
    );
  }

  if (data.session.provider_refresh_token) {
    response.cookies.set(
      "google_provider_refresh_token",
      data.session.provider_refresh_token,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      }
    );
  }

  return response;
}
