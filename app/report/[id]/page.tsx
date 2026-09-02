import { sql } from "@/lib/db";
import { getFix } from "@/lib/fixSnippets";
import type { CheckResult } from "@/lib/checks";
import UnlockButton from "../UnlockButton";

const STATUS_LABEL: Record<string, string> = {
  pass: "Pass",
  warn: "Warning",
  fail: "Fail",
  review: "Needs review",
  na: "Not applicable",
};

const STATUS_COLOR: Record<string, string> = {
  pass: "text-emerald-600 bg-emerald-50",
  warn: "text-amber-600 bg-amber-50",
  fail: "text-red-600 bg-red-50",
  review: "text-blue-600 bg-blue-50",
  na: "text-black/40 bg-black/[0.03]",
};

export default async function ReportPage({ params }: { params: { id: string } }) {
  const rows = await sql`select id, url, score, findings, unlocked from reports where id = ${params.id} limit 1`;
  const report = rows[0] as any;

  if (!report) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Report not found</h1>
          <a href="/" className="underline">Run a new scan</a>
        </div>
      </div>
    );
  }

  const findings: CheckResult[] = report.findings;
  const siteName = new URL(report.url).hostname.replace(/^www\./, "");
  const categories = Array.from(new Set(findings.map((f) => f.category)));
  const failCount = findings.filter((f) => f.status === "fail").length;
  const warnCount = findings.filter((f) => f.status === "warn").length;

  return (
    <div className="min-h-screen">
      <nav className="h-16 flex items-center px-6 border-b border-black/[0.06]">
        <a href="/" className="font-black tracking-tight text-lg">ActLayer</a>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-black/50 text-sm">Compliance scan for</p>
        <h1 className="text-2xl font-black break-all">{report.url}</h1>

        <div className="mt-6 flex items-center gap-6">
          <div className="text-5xl font-black">{report.score}<span className="text-xl text-black/40">/100</span></div>
          <div className="text-sm text-black/60">
            {failCount > 0 && <div className="text-red-600 font-semibold">{failCount} failing</div>}
            {warnCount > 0 && <div className="text-amber-600 font-semibold">{warnCount} warnings</div>}
            {failCount === 0 && warnCount === 0 && <div className="text-emerald-600 font-semibold">No major gaps found</div>}
          </div>
        </div>

        {!report.unlocked && (failCount > 0 || warnCount > 0) && (
          <div className="mt-6 p-5 rounded-2xl border border-black/10 bg-black/[0.02]">
            <p className="text-sm text-black/70 mb-3">
              Unlock the exact fix for every failing and warning check below — drop-in code, disclosure copy, and privacy-policy language.
            </p>
            <UnlockButton reportId={report.id} />
          </div>
        )}

        {categories.map((category) => (
          <section key={category} className="mt-10">
            <h2 className="text-lg font-bold mb-3">{category}</h2>
            <div className="space-y-3">
              {findings
                .filter((f) => f.category === category)
                .map((f) => {
                  const fix = f.fixAvailable ? getFix(f.id, siteName) : null;
                  return (
                    <div key={f.id} className="border border-black/10 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-sm">{f.title}</span>
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${STATUS_COLOR[f.status]}`}>
                          {STATUS_LABEL[f.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-black/60">{f.detail}</p>
                      {fix && (
                        <div className="mt-3">
                          {report.unlocked ? (
                            <pre className="text-[12px] bg-black text-white rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
{fix.content}
                            </pre>
                          ) : (
                            <div className="relative">
                              <pre className="text-[12px] bg-black text-white rounded-lg p-3 overflow-hidden blur-sm select-none max-h-24">
{fix.content}
                              </pre>
                              <div className="absolute inset-0 grid place-items-center text-[12px] font-bold text-white">
                                Unlock to view fix
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        ))}

        <p className="mt-10 text-[12px] text-black/35">
          This is a technical/content scan, not legal advice. Built with{" "}
          <a href="https://gysm.io" className="underline hover:text-black">GYSM.IO</a>.
        </p>
      </main>
    </div>
  );
}

export const dynamic = "force-dynamic";
