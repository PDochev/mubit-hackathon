import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_POLICY } from "./policy";
import type { Store } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
// The committed snapshot of our demo data (claims, precedents, evaluations,
// Night Shift games). A fresh clone starts from it; the first write copies it
// into data/store.json, which is gitignored.
const DEMO_PATH = path.join(process.cwd(), "demo", "store.json");

function emptyStore(): Store {
  return {
    claims: [],
    precedents: [],
    policy: {
      text: DEFAULT_POLICY,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    evals: [],
  };
}

async function readJson(file: string): Promise<Store | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Store;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function readStore(): Promise<Store> {
  return (
    (await readJson(STORE_PATH)) ?? (await readJson(DEMO_PATH)) ?? emptyStore()
  );
}

// Serialise every read-modify-write so concurrent model calls can't clobber
// each other's updates.
let queue: Promise<unknown> = Promise.resolve();

export function updateStore<T>(mutate: (store: Store) => T): Promise<T> {
  const run = queue.then(async () => {
    const store = await readStore();
    const result = mutate(store);
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    await writeFile(tmp, JSON.stringify(store, null, 2));
    await rename(tmp, STORE_PATH);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

export function nextId(prefix: string, existing: { id: string }[]): string {
  const max = existing.reduce((n, item) => {
    const num = Number(item.id.slice(prefix.length));
    return Number.isFinite(num) ? Math.max(n, num) : n;
  }, 0);
  return `${prefix}${max + 1}`;
}
