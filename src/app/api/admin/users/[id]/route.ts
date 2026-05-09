import { z } from "zod";
import { jsonError } from "@/lib/api";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateUserSchema = z.object({
  isVip: z.boolean(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireCurrentUser();
    if (admin.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = updateUserSchema.parse(await request.json());

    const user = await prisma.user.update({
      where: { id },
      data: {
        isVip: payload.isVip,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        isVip: true,
      },
    });

    return Response.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}
