import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !publicKey) {
  throw new Error("Missing Supabase public client environment variables.");
}

export function createPublicClient() {
  return createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function requireAdminClient() {
  if (!secretKey) {
    throw new Error(
      "BLOCKED: SUPABASE_SECRET_KEY is required for disposable confirmed-email QA users. " +
        "Do not add this key to Expo public environment variables.",
    );
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function createQaAccount(label) {
  const admin = requireAdminClient();
  const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `qa-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}@darin.invalid`;
  const password = `Darin!${crypto.randomUUID()}9`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    throw new Error(`${label} QA user create: ${created.error?.message ?? "no user"}`);
  }

  const sb = createPublicClient();
  const signedIn = await sb.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.user || !signedIn.data.session) {
    await admin.auth.admin.deleteUser(created.data.user.id).catch(() => undefined);
    throw new Error(`${label} QA login: ${signedIn.error?.message ?? "no session"}`);
  }
  return { sb, user: signedIn.data.user, label, qaUserId: created.data.user.id };
}

export async function createQaAccounts(labels) {
  const accounts = [];
  try {
    for (const label of labels) accounts.push(await createQaAccount(label));
    return accounts;
  } catch (error) {
    if (accounts.length) await cleanupQaAccounts(accounts);
    throw error;
  }
}

export async function cleanupQaAccounts(accounts) {
  const admin = requireAdminClient();
  await Promise.allSettled(accounts.map(({ sb }) => sb.auth.signOut({ scope: "local" })));
  await Promise.allSettled(accounts.map(({ qaUserId }) => admin.auth.admin.deleteUser(qaUserId)));
}
