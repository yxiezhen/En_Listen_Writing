import { jsonError } from "@/lib/api";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const exercise = await prisma.listeningExercise.findFirst({
      where: { id, userId: user.id },
      include: {
        submissions: {
          select: { imageStorageKey: true },
        },
      },
    });

    if (!exercise) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }

    await prisma.listeningExercise.delete({
      where: { id: exercise.id },
    });

    const storageKeys = [
      exercise.audioStorageKey,
      ...exercise.submissions
        .map((submission: { imageStorageKey: string | null }) => submission.imageStorageKey)
        .filter((key: string | null): key is string => Boolean(key)),
    ];

    await Promise.allSettled(storageKeys.map((key) => deleteStoredFile(key)));

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
