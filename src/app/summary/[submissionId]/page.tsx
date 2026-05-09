import { TrainingReportViewer } from "@/components/training-report-viewer";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  return <TrainingReportViewer submissionId={submissionId} />;
}
