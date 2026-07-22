import { AuthError, getUser, login, logout } from "@netlify/identity";
import type { Config } from "@netlify/functions";
import { json, rejectCrossOriginMutation } from "./lib/admin.js";

const isAdmin = (user: Awaited<ReturnType<typeof getUser>>) =>
  Boolean(user && (user.roles?.includes("admin") || user.role === "admin"));

export default async (request: Request) => {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  if (request.method === "GET") {
    const user = await getUser();
    if (!isAdmin(user)) return json({ authenticated: false }, { status: 401 });
    return json({ authenticated: true, user: { email: user?.email, name: user?.name } });
  }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";

      if (!email || !password) {
        return json({ error: "Email and password are required." }, { status: 400 });
      }

      const user = await login(email, password);
      if (!isAdmin(user)) {
        await logout();
        return json({ error: "Administrator access required." }, { status: 403 });
      }

      return json({ authenticated: true, user: { email: user.email, name: user.name } });
    } catch (error) {
      if (error instanceof AuthError) {
        return json({ error: "Invalid email or password." }, { status: error.status === 401 ? 401 : 400 });
      }
      return json({ error: "Unable to sign in right now." }, { status: 500 });
    }
  }

  if (request.method === "DELETE") {
    await logout();
    return json({ authenticated: false });
  }

  return json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "GET, POST, DELETE" } });
};

export const config: Config = {
  path: "/api/admin/session",
};
