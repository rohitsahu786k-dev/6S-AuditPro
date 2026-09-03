"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, RotateCcw } from "lucide-react";

export function FindingsDateFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const fromDate = searchParams.get("from") || "";
  const toDate = searchParams.get("to") || "";

  useEffect(() => {
    const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search by ID, question, observation..."]');
    const filterCard = searchInput?.closest(".mb-5");
    if (!filterCard) return;

    const slot = document.createElement("div");
    slot.dataset.findingsDateFilter = "true";
    filterCard.appendChild(slot);
    setPortalTarget(slot);

    return () => {
      setPortalTarget(null);
      slot.remove();
    };
  }, []);

  function updateRange(nextFrom: string, nextTo: string) {
    let safeFrom = nextFrom;
    let safeTo = nextTo;

    if (safeFrom && safeTo && safeFrom > safeTo) {
      if (safeFrom !== fromDate) safeTo = safeFrom;
      else safeFrom = safeTo;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (safeFrom) params.set("from", safeFrom);
    else params.delete("from");
    if (safeTo) params.set("to", safeTo);
    else params.delete("to");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (!portalTarget) return null;

  return createPortal(
    <div className="mt-3 flex flex-wrap items-end gap-2.5 border-t border-bd pt-3">
      <div className="mr-1 flex min-w-[135px] items-center gap-2 pb-2.5 text-xs font-extrabold uppercase tracking-wide text-t2">
        <CalendarRange size={16} className="text-brand" /> Finding Date
      </div>

      <label className="grid min-w-[170px] flex-1 gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-t2">From Date</span>
        <input
          type="date"
          value={fromDate}
          max={toDate || undefined}
          onChange={(event) => updateRange(event.target.value, toDate)}
          className="w-full rounded-lg border border-bd bg-white px-3 py-2.5 text-sm text-t1 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
        />
      </label>

      <label className="grid min-w-[170px] flex-1 gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-t2">To Date</span>
        <input
          type="date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(event) => updateRange(fromDate, event.target.value)}
          className="w-full rounded-lg border border-bd bg-white px-3 py-2.5 text-sm text-t1 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
        />
      </label>

      <button
        type="button"
        onClick={() => updateRange("", "")}
        disabled={!fromDate && !toDate}
        className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-lg border border-bd bg-white px-3 text-xs font-bold text-t1 hover:bg-bg3 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RotateCcw size={14} /> Clear Date
      </button>
    </div>,
    portalTarget
  );
}
