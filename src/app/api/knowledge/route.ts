import { jsonError } from "@/lib/api";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        evaluation: {
          include: {
            submission: {
              include: { exercise: true },
            },
          },
        },
      },
    });

    return Response.json({ knowledgePoints });
  } catch (error) {
    return jsonError(error);
  }
}
