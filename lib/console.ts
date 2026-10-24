// Links into this project's Mubit console.
export const MUBIT_PROJECT_URL =
  "https://app.mubit.ai/console/projects/ws-e4d85b3d9c35a2e0";

// The Requests list, newest first. `copies=1` keeps recorded copies in the
// list; without it the console hides them and shows "No calls". The console
// gives each call its own id (not the x-middleware-request-id we store), so a
// single request can't be linked to directly.
export const MUBIT_REQUESTS_URL = `${MUBIT_PROJECT_URL}/requests?copies=1`;
