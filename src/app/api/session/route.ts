import { z } from "zod";
import { getCurrentUser, signIn, signOut } from "@/lib/auth";
import { jsonError } from "@/lib/api";

const sessionSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
  password: z.string().min(6).max(128),
  displayName: z.string().max(80).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
});

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ user });
}

export async function POST(request: Request) {
  try {
    const payload = sessionSchema.parse(await request.json());
    const user = await signIn(
      payload.username,
      payload.password,
      payload.displayName || payload.username,
      payload.email || undefined,
    );
    return Response.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      return Response.json({ error: "用户名或密码不正确" }, { status: 401 });
    }

    return jsonError(error);
  }
}

export async function DELETE() {
  await signOut();
  return Response.json({ ok: true });
}
