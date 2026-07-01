import Image from "next/image";
import { cn } from "@/lib/utils";

export const PARTSPRO_MAIN_LOGO_SRC = "/brand/partspro-main-logo.png";

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
      <Image
        src={PARTSPRO_MAIN_LOGO_SRC}
        alt=""
        width={44}
        height={44}
        sizes={compact ? "40px" : "44px"}
        className={cn(
          "size-11 shrink-0 rounded-xl bg-black object-cover shadow-[0_12px_30px_rgba(59,91,255,0.24)] ring-1 ring-white/70",
          compact && "size-10 rounded-lg"
        )}
      />
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
