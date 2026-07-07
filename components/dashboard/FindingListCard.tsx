import Link from "next/link";
import { ArrowRight, Clock, ListChecks, ShieldAlert } from "lucide-react";
import { SEVERITY_BADGE_STYLES } from "@/lib/status-styles";
import type { Severity } from "@/types/domain";

type Finding = {
  _id: string;
  findingNumber: string;
  severity: string;
  question: string;
  dueDate?: string;
};

export function FindingListCard({ findings, loading }: { findings: Finding[]; loading: boolean }) {
  return (
    <div className="rounded-[10px] border border-bd bg-bg1 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between border-b border-bd px-5 py-4">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[#dc2626]">
          <ShieldAlert size={16} /> Urgent CAPA Findings
        </h3>
        <Link href="/findings" className="flex items-center gap-1 text-xs text-t2 hover:text-t1">
          View All <ArrowRight size={12} />
        </Link>
      </div>
      <div className="px-5 py-2.5">
        {loading ? (
          <div className="p-5 text-center text-sm text-t2">Loading findings...</div>
        ) : findings.length === 0 ? (
          <div className="flex items-center justify-center gap-1.5 p-5 text-sm text-green">
            <ListChecks size={16} /> No critical findings outstanding!
          </div>
        ) : (
          <div className="grid gap-2.5">
            {findings.map((finding) => {
              const severityStyle = SEVERITY_BADGE_STYLES[finding.severity as Severity] ?? SEVERITY_BADGE_STYLES.Low;
              return (
                <div key={finding._id} className="flex items-center justify-between border-b border-[#f1f5f9] py-2.5 last:border-b-0">
                  <div className="max-w-[75%]">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-[13px]">{finding.findingNumber}</strong>
                      <span
                        className="rounded-full border px-1.5 py-px text-[9px] font-bold"
                        style={{ background: severityStyle.bg, color: severityStyle.text, borderColor: severityStyle.border }}
                      >
                        {finding.severity}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-t2">{finding.question}</div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full border border-[#fecaca] bg-[#fff5f5] px-2.5 py-0.5 text-[11px] font-bold text-red">
                    <Clock size={10} /> {finding.dueDate ? new Date(finding.dueDate).toLocaleDateString() : "No Date"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
