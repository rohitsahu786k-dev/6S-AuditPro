import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  iconColor,
  iconBg,
  valueColor,
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-[10px] border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-2 flex items-start justify-between">
        <span className="text-[11px] font-bold uppercase text-t2">{label}</span>
        <div className="rounded-md p-1.5" style={{ background: iconBg, color: iconColor }}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-t2">{caption}</div>
    </div>
  );
}
