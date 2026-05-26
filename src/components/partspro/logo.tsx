import { Hexagon } from "lucide-react";
import { cn } from "@/lib/utils";

type LogoProps = {
  compact?: boolean;
  className?: string;
  tagline?: string;
};

export function PartsProLogo({
  compact = false,
  className,
  tagline = "Ricambi smartphone Italia",
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid size-9 place-items-center rounded-lg bg-[linear-gradient(135deg,#3b5bff,#7c3aed)] text-white shadow-[0_12px_30px_rgba(59,91,255,0.24)]">
        <Hexagon className="size-6 fill-white/12" strokeWidth={2.4} />
        <span className="absolute text-sm font-black tracking-tight">P</span>
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-xl font-black tracking-normal text-slate-950">
            PartsPro
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500">
            {tagline}
          </div>
        </div>
      )}
    </div>
  );
}
