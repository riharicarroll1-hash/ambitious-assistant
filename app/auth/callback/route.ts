import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const flowId = requestUrl.searchParams.get("sb_flow_id");

  const forwardedHost =
    request.headers.get("x-forwarded-host");

  const host =
    forwardedHost ||
    request.headers.get("host") ||
    "ambitious-assistant.vercel.app";

  const protocol =
    process.env.NODE_ENV === "development"
      ? "http"
      : "https";

  const appOrigin =
    process.env.NODE_ENV === "development"
      ? requestUrl.origin
      : `${protocol}://${host}`;

  if (!code) {
    return NextResponse.redirect(
      `${appOrigin}/?calendar=error&reason=no_code`
    );
  }

  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined
    );

  if (error || !data.session) {
    console.error(
      "Google OAuth exchange failed:",
      error
    );

    return NextResponse.redirect(
      `${appOrigin}/?calendar=error&reason=exchange_failed`
    );
  }

  const response = NextResponse.redirect(
    `${appOrigin}/?calendar=connected`
  );

  if (data.session.provider_token) {
    response.cookies.set(
      "google_provider_token",
      data.session.provider_token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV !==
          "development",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      }
    );
  }

  if (
    data.session.provider_refresh_token
  ) {
    response.cookies.set(
      "google_provider_refresh_token",
      data.session.provider_refresh_token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV !==
          "development",
        sameSite: "lax",
        path: "/",
        maxAge:
          60 * 60 * 24 * 365,
      }
    );
  }

  return response;
}
