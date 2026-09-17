"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  adminDestination,
  createAdminSession,
  isAdminConfigured,
  validAdminCredentials,
} from "../../lib/admin-access";

export async function signInAdmin(_state: { error: string }, form: FormData) {
  if (!isAdminConfigured()) return { error: "O acesso administrativo ainda não foi configurado." };
  const username = form.get("username");
  const password = form.get("password");
  if (
    typeof username !== "string" || typeof password !== "string" ||
    username.length > 256 || password.length > 1024 ||
    !validAdminCredentials(username.trim(), password)
  ) return { error: "Usuário ou senha inválidos." };

  (await cookies()).set(ADMIN_SESSION_COOKIE, createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  redirect(adminDestination(form.get("next")));
}

export async function signOutAdmin() {
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
