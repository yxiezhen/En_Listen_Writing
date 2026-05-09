import { z } from "zod";
import { jsonError } from "@/lib/api";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateKnowledgeSchema = z.object({
  masteryStatus: z.enum(["NEW", "REVIEWING", "MASTERED"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const payload = updateKnowledgeSchema.parse(await request.json());
    const knowledgePoint = await prisma.knowledgePoint.update({
      where: {
        id,
        userId: user.id,
      },
      data: {
        masteryStatus: payload.masteryStatus,
      },
    });

    return Response.json({ knowledgePoint });
  } catch (error) {
    return jsonError(error);
  }
}
