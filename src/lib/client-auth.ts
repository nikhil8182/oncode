/**
 * Client-side auth helpers.
 *
 * Reads the auth token from the URL query parameter `?token=`
 * and provides utilities for authenticated fetch calls.
 */

/** Get the auth token from the current URL query string. */
export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || "";
}

/**
 * Append the auth token to a URL as a query parameter.
 * If the URL already has query params, appends with &; otherwise uses ?.
 */
export function withAuthToken(url: string): string {
  const token = getAuthToken();
  if (!token) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

/**
 * Create a Headers object with the Authorization bearer token set.
 * Merges with any additional headers provided.
 */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...extra,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
