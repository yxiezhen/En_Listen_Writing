"use client";

import { useEffect, useState } from "react";
import type { TrainingReport } from "@/lib/ai/types";

type ReportResponse = {
  report: TrainingReport;
  cached: boolean;
  generatedAt?: string | null;
  submission: {
    exercise: { title: string };
    evaluation?: { overallScore: number } | null;
  };
};

export function TrainingReportViewer({ submissionId }: { submissionId: string }) {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        const response = await fetch(`/api/reports/${submissionId}`);
        const result = (await response.json()) as ReportResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "生成报告失败");
        }

        if (!cancelled) {
          setData(result);
        }
      } catch (innerError) {
        if (!cancelled) {
          setError(innerError instanceof Error ? innerError.message : "生成报告失败");
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded-2xl bg-red-50 p-6 text-red-700">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="mt-4 text-slate-600">正在生成训练总结...</p>
        </div>
      </main>
    );
  }

  const { report } = data;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-[210mm] justify-end gap-3 print:hidden">
        <span className="flex items-center rounded-xl bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          {data.cached ? "已读取缓存报告" : "已新生成并缓存"}
        </span>
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          导出 PDF / 打印
        </button>
      </div>
      <article className="training-report-sheet mx-auto max-w-[210mm] bg-white p-10 shadow-2xl print:shadow-none">
        <header className="training-report-header border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600 print:text-[10px]">
            EN Listen Writing
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950 print:mt-2 print:text-xl">
            {report.title}
          </h1>
          <p className="mt-2 text-slate-600 print:text-xs">{report.subtitle}</p>
          <p className="mt-4 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 print:mt-2 print:px-3 print:py-1 print:text-xs">
            {report.scoreLine}
          </p>
        </header>

        <section className="training-report-highlights mt-6 grid gap-3 sm:grid-cols-3">
          {report.highlights.map((item) => (
            <div
              key={item}
              className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 print:p-3 print:text-[11px] print:leading-4"
            >
              {item}
            </div>
          ))}
        </section>

        <section className="training-report-sections mt-6 space-y-5">
          {report.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="text-lg font-semibold text-slate-950 print:text-sm">
                {section.heading}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-700 print:mt-1 print:text-[11px] print:leading-4">
                {section.body}
              </p>
              {section.bullets?.length ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600 print:mt-1 print:space-y-0 print:text-[11px] print:leading-4">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>

        <section className="training-report-plan mt-6 rounded-2xl bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold text-emerald-950 print:text-sm">
            Next Review Plan
          </h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-6 text-emerald-900 print:mt-2 print:space-y-0 print:text-[11px] print:leading-4">
            {report.actionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <footer className="training-report-footer mt-6 border-t border-slate-200 pt-4 text-sm leading-7 text-slate-600 print:text-[11px] print:leading-4">
          {report.closingNote}
        </footer>
      </article>
    </main>
  );
}
