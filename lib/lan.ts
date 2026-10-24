import "server-only";
import { networkInterfaces } from "node:os";

// The URL phones on the same Wi-Fi can open. PUBLIC_URL wins (e.g. a tunnel).
export function publicUrl(): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const port = process.env.PORT ?? "3000";
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return `http://${a.address}:${port}`;
    }
  }
  return `http://localhost:${port}`;
}
