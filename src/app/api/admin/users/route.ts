import { jsonError } from "@/lib/api";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    if (user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        isVip: true,
        createdAt: true,
        _count: {
          select: {
            exercises: true,
            knowledgePoints: true,
          },
        },
      },
    });

    return Response.json({ users });
  } catch (error) {
    return jsonError(error);
  }
}
