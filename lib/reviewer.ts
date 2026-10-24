import "server-only";
import { headers } from "next/headers";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Demo-grade gate: phones on the venue Wi-Fi reach the app by LAN IP and may
// only submit expenses; finance actions only work from the presenter's laptop
// (opened as localhost). The Host header can be forged, so this is not real
// auth — swap in a login before deploying anywhere public.
export async function assertReviewer() {
  const host = (await headers()).get("host") ?? "";
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error("Finance actions are only available on the reviewer's machine.");
  }
}
