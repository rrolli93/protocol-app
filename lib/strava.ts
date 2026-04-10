// ─── Strava OAuth + API helpers ───────────────────────────────────────────────

export const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';
const STRAVA_CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET ?? '';
export const STRAVA_REDIRECT_URI = 'protocol://strava-callback';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  distance: number;        // metres
  moving_time: number;     // seconds
  start_date: string;      // ISO 8601
  map: {
    id: string;
    summary_polyline: string | null;
    resource_state: number;
  };
}

export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: Record<string, unknown>;
}

// ─── Auth URL ─────────────────────────────────────────────────────────────────

/**
 * Returns the Strava OAuth authorization URL.
 * Opens in WebBrowser; Strava redirects to STRAVA_REDIRECT_URI with ?code=...
 */
export function buildStravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

// ─── Token Exchange ───────────────────────────────────────────────────────────

/**
 * Exchanges an authorization code for an access + refresh token.
 * NOTE: requires real STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET at runtime.
 */
export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token exchange failed (${response.status}): ${text}`);
  }

  return (await response.json()) as StravaTokenResponse;
}

// ─── Refresh Access Token ─────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token refresh failed (${response.status}): ${text}`);
  }

  return (await response.json()) as StravaTokenResponse;
}

// ─── Activities ───────────────────────────────────────────────────────────────

/**
 * Fetches the athlete's recent activities.
 * @param accessToken  Valid Strava OAuth access token
 * @param perPage      Number of activities to fetch (default 30)
 */
export async function getRecentActivities(
  accessToken: string,
  perPage = 30,
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: String(perPage),
    page: '1',
  });

  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava activities fetch failed (${response.status}): ${text}`);
  }

  return (await response.json()) as StravaActivity[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's activities (UTC day comparison). */
export function filterTodayActivities(activities: StravaActivity[]): StravaActivity[] {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  return activities.filter((a) => a.start_date.startsWith(today));
}

/** Converts metres to kilometres, rounded to 2 dp. */
export function metresToKm(metres: number): number {
  return Math.round((metres / 1000) * 100) / 100;
}
