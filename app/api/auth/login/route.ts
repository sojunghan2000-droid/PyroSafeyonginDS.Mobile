import { NextRequest, NextResponse } from "next/server";
import { anon, usernameToEmail } from "@/lib/supa";
import { COOKIE, encodeUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
  }
  const { data, error } = await anon().auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error || !data.user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  const meta = data.user.user_metadata ?? {};
  const role = (data.user.app_metadata ?? {}).role ?? "user";
  const user = {
    username: meta.username ?? username,
    name: meta.name ?? username,
    role,
  };
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(COOKIE, encodeUser(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
