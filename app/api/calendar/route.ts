import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type GoogleEvent = {
  id: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
};

async function getFreshAccessToken(
  refreshToken: string
) {
  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth environment variables are missing."
    );
  }

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();

    console.error(
      "Google refresh token error:",
      text
    );

    throw new Error(
      "Could not refresh Google access token."
    );
  }

  const data = await response.json();

  return data.access_token as string;
}

export async function GET(
  request: Request
) {
  try {
    const cookieStore = await cookies();

    let accessToken =
      cookieStore.get(
        "google_provider_token"
      )?.value;

    const refreshToken =
      cookieStore.get(
        "google_provider_refresh_token"
      )?.value;

    if (!accessToken && refreshToken) {
      accessToken =
        await getFreshAccessToken(
          refreshToken
        );
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          connected: false,
          events: [],
          error:
            "Google Calendar is not connected.",
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);

    const requestedDays =
      Number(
        url.searchParams.get("days")
      ) || 1;

    const days = Math.min(
      Math.max(requestedDays, 1),
      7
    );

    const timeZone =
      url.searchParams.get(
        "timeZone"
      ) || "UTC";

    const timeMin =
      url.searchParams.get(
        "timeMin"
      );

    const timeMax =
      url.searchParams.get(
        "timeMax"
      );

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        {
          connected: false,
          events: [],
          error:
            "Calendar date range is missing.",
        },
        { status: 400 }
      );
    }

    const params =
      new URLSearchParams({
        timeMin,
        timeMax,
        timeZone,
        singleEvents: "true",
        orderBy: "startTime",
      });

    const calendarUrl =
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;

    let calendarResponse =
      await fetch(
        calendarUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

    if (
      calendarResponse.status === 401 &&
      refreshToken
    ) {
      accessToken =
        await getFreshAccessToken(
          refreshToken
        );

      calendarResponse =
        await fetch(
          calendarUrl,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );
    }

    if (!calendarResponse.ok) {
      const text =
        await calendarResponse.text();

      console.error(
        "Google Calendar API error:",
        text
      );

      throw new Error(
        "Google Calendar request failed."
      );
    }

    const data =
      await calendarResponse.json();

    return NextResponse.json({
      connected: true,
      days,
      timeZone,
      events: formatEvents(
        data.items || []
      ),
    });
  } catch (error) {
    console.error(
      "Calendar route error:",
      error
    );

    return NextResponse.json(
      {
        connected: false,
        events: [],
        error:
          "Could not load Google Calendar.",
      },
      { status: 500 }
    );
  }
}

function formatEvents(
  events: GoogleEvent[]
) {
  return events.map((event) => ({
    id: event.id,
    title:
      event.summary ||
      "Untitled event",
    start:
      event.start?.dateTime ||
      event.start?.date ||
      null,
    end:
      event.end?.dateTime ||
      event.end?.date ||
      null,
    allDay:
      Boolean(event.start?.date),
  }));
}
