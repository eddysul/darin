/** Immutable credential snapshot for an already admitted media operation. */
export function sessionClientOptions(accessToken: string) {
  return {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
}
