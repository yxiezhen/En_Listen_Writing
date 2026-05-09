import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LearningWorkspace } from "@/components/learning-workspace";

export default async function Home() {
  const user = await getCurrentUser();
  const exercises = user
    ? await prisma.listeningExercise.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          submissions: {
            include: {
              evaluation: {
                include: { knowledgePoints: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      })
    : [];
  const knowledgePoints = user
    ? await prisma.knowledgePoint.findMany({
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
      })
    : [];
  const adminUsers =
    user?.role === "ADMIN"
      ? await prisma.user.findMany({
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
        })
      : [];

  return (
    <LearningWorkspace
      initialUser={user}
      initialExercises={JSON.parse(JSON.stringify(exercises))}
      initialKnowledgePoints={JSON.parse(JSON.stringify(knowledgePoints))}
      initialAdminUsers={JSON.parse(JSON.stringify(adminUsers))}
    />
  );
}
