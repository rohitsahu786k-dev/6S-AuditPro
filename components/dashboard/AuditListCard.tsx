import Link from "next/link";
import { ArrowRight, Building, Calendar, ClipboardCheck } from "lucide-react";
import { scoreBadgeStyle } from "@/lib/status-styles";

type Audit = {
  _id: string;
  auditNumber: string;
  department: string;
  zone: string;
  date: string;
  totalScore: number;
};

export function AuditListCard({ audits, loading }: { audits: Audit[]; loading: boolean }) {
  return (
    <div className="rounded-[10px] border border-bd bg-bg1 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between border-b border-bd px-5 py-4">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <ClipboardCheck size={16} className="text-t2" /> Recent 6S Audits
        </h3>
        <Link href="/audits" className="flex items-center gap-1 text-xs text-t2 hover:text-t1">
          View All <ArrowRight size={12} />
        </Link>
      </div>
      <div className="px-5 py-2.5">
        {loading ? (
          <div className="p-5 text-center text-sm text-t2">Loading audits...</div>
        ) : audits.length === 0 ? (
          <div className="p-5 text-center text-sm text-t2">No audits recorded yet.</div>
        ) : (
          <div className="grid gap-2.5">
            {audits.map((audit) => {
              const badge = scoreBadgeStyle(audit.totalScore);
              return (
                <div key={audit._id} className="flex items-center justify-between border-b border-[#f1f5f9] py-2.5 last:border-b-0">
                  <div>
                    <div className="text-[13px] font-semibold">{audit.auditNumber}</div>
                    <div className="mt-0.5 flex gap-2 text-[11px] text-t2">
                      <span className="flex items-center gap-1">
                        <Building size={10} /> {audit.department} - {audit.zone}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {new Date(audit.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-xs font-bold"
                    style={{ background: badge.bg, color: badge.text, borderColor: badge.border }}
                  >
                    {audit.totalScore}%
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
