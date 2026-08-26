import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF, qaConfirmation } from "./lib/qa-project-config.mjs";

const REQUIRED_CONFIRMATION = qaConfirmation("RESET");

const execute = process.argv.includes("--execute");
const baseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
const confirmation = process.env.QA_RESET_CONFIRM?.trim() ?? "";

if (!baseUrl || !secretKey) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");
}

const projectRef = new URL(baseUrl).hostname.split(".")[0];
if (projectRef !== QA_PROJECT_REF || projectRef === PRODUCTION_PROJECT_REF) {
  throw new Error(`QA project guard rejected ref ${projectRef}`);
}

if (!execute || confirmation !== REQUIRED_CONFIRMATION) {
  throw new Error(
    `Destructive reset blocked. Pass --execute and QA_RESET_CONFIRM=${REQUIRED_CONFIRMATION}`,
  );
}

const headers = { apikey: secretKey };

async function responseError(response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    return String(parsed.message ?? parsed.msg ?? parsed.error ?? parsed.code ?? response.status);
  } catch {
    return text.slice(0, 160) || String(response.status);
  }
}

async function countRelation(relation) {
  const response = await fetch(
    `${baseUrl}/rest/v1/${encodeURIComponent(relation)}?select=*&limit=0`,
    { method: "HEAD", headers: { ...headers, Prefer: "count=exact" } },
  );
  if (!response.ok) return null;
  const range = response.headers.get("content-range");
  const count = Number(range?.split("/")[1]);
  return Number.isFinite(count) ? count : null;
}

async function resetPublicData() {
  const schemaResponse = await fetch(`${baseUrl}/rest/v1/`, { headers });
  if (!schemaResponse.ok) {
    throw new Error(`OpenAPI unavailable: ${await responseError(schemaResponse)}`);
  }
  const schema = await schemaResponse.json();
  const relations = Object.entries(schema.paths ?? {})
    .filter(([path, operations]) =>
      /^\/[A-Za-z_][A-Za-z0-9_]*$/.test(path) && Boolean(operations.delete),
    )
    .map(([path]) => path.slice(1))
    .sort();

  const filters = new Map();
  for (const relation of relations) {
    const properties = schema.definitions?.[relation]?.properties ?? {};
    const column = Object.hasOwn(properties, "id") ? "id" : Object.keys(properties)[0];
    if (column) filters.set(relation, `${encodeURIComponent(column)}=not.is.null`);
  }

  let pending = [];
  for (const relation of relations) {
    const count = await countRelation(relation);
    if (count && count > 0) pending.push(relation);
  }

  const initialRows = (
    await Promise.all(pending.map((relation) => countRelation(relation)))
  ).reduce((sum, count) => sum + (count ?? 0), 0);

  for (let pass = 0; pending.length > 0 && pass <= relations.length; pass += 1) {
    let progress = false;
    const next = [];
    for (const relation of pending) {
      const filter = filters.get(relation);
      if (!filter) {
        next.push(relation);
        continue;
      }
      const response = await fetch(
        `${baseUrl}/rest/v1/${encodeURIComponent(relation)}?${filter}`,
        { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } },
      );
      const remaining = await countRelation(relation);
      if (response.ok && remaining === 0) {
        progress = true;
      } else {
        next.push(relation);
      }
    }
    pending = next;
    if (!progress) break;
  }

  if (pending.length > 0) {
    throw new Error(`Could not clear public relations: ${pending.join(", ")}`);
  }
  return { relations: relations.length, rows: initialRows };
}

async function resetAuthUsers() {
  let deleted = 0;
  while (true) {
    const response = await fetch(`${baseUrl}/auth/v1/admin/users?page=1&per_page=50`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(`Auth user listing failed: ${await responseError(response)}`);
    }
    const payload = await response.json();
    const users = Array.isArray(payload) ? payload : (payload.users ?? []);
    if (users.length === 0) break;
    for (const user of users) {
      const deleteResponse = await fetch(`${baseUrl}/auth/v1/admin/users/${user.id}`, {
        method: "DELETE",
        headers,
      });
      if (!deleteResponse.ok) {
        throw new Error(`Auth user deletion failed: ${await responseError(deleteResponse)}`);
      }
      deleted += 1;
    }
  }
  return deleted;
}

async function resetStorage() {
  const response = await fetch(`${baseUrl}/storage/v1/bucket`, { headers });
  if (!response.ok) {
    throw new Error(`Storage bucket listing failed: ${await responseError(response)}`);
  }
  const buckets = await response.json();
  let deleted = 0;
  for (const bucket of buckets) {
    const emptyResponse = await fetch(
      `${baseUrl}/storage/v1/bucket/${encodeURIComponent(bucket.id)}/empty`,
      { method: "POST", headers },
    );
    if (!emptyResponse.ok) {
      throw new Error(`Storage bucket empty failed: ${await responseError(emptyResponse)}`);
    }
    const deleteResponse = await fetch(
      `${baseUrl}/storage/v1/bucket/${encodeURIComponent(bucket.id)}`,
      { method: "DELETE", headers },
    );
    if (!deleteResponse.ok) {
      throw new Error(`Storage bucket deletion failed: ${await responseError(deleteResponse)}`);
    }
    deleted += 1;
  }
  return deleted;
}

console.log(`Resetting QA project ${projectRef}; production guard active`);
const storageBuckets = await resetStorage();
const publicData = await resetPublicData();
const authUsers = await resetAuthUsers();
console.log(
  `QA reset complete: publicRelations=${publicData.relations}, publicRows=${publicData.rows}, authUsers=${authUsers}, storageBuckets=${storageBuckets}`,
);
