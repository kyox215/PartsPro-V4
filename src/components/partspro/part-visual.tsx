import type { PartVisual as PartVisualType } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";

type PartVisualProps = {
  variant: PartVisualType;
  className?: string;
};

export function PartVisual({ variant, className }: PartVisualProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_35%_25%,#f9fbff,#dfe7f8_54%,#cbd7ec)]",
        className
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),transparent_42%)]" />
      {variant === "screen" && <ScreenVisual />}
      {variant === "battery" && <BatteryVisual />}
      {variant === "cover" && <CoverVisual />}
      {variant === "port" && <PortVisual />}
      {variant === "camera" && <CameraVisual />}
      {variant === "flex" && <FlexVisual />}
      {variant === "speaker" && <SpeakerVisual />}
      {variant === "frame" && <FrameVisual />}
    </div>
  );
}

function ScreenVisual() {
  return (
    <div className="relative h-[78%] w-[48%] rounded-[18px] bg-slate-950 p-1.5 shadow-2xl">
      <div className="h-full rounded-[14px] bg-[radial-gradient(circle_at_65%_22%,#f472b6,#7c3aed_38%,#020617_72%)]" />
      <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full bg-white/18" />
    </div>
  );
}

function BatteryVisual() {
  return (
    <div className="relative h-[74%] w-[42%] rounded-md border border-slate-700 bg-slate-900 p-2 shadow-2xl">
      <div className="absolute -top-2 left-1/2 h-2 w-8 -translate-x-1/2 rounded-t bg-slate-700" />
      <div className="h-full rounded bg-[linear-gradient(180deg,#1f2937,#111827)]" />
      <div className="absolute inset-x-4 bottom-5 h-14 rounded bg-white/8" />
      <div className="absolute left-1/2 top-1/2 h-16 w-12 -translate-x-1/2 -translate-y-1/2 rounded border border-white/20" />
    </div>
  );
}

function CoverVisual() {
  return (
    <div className="relative h-[74%] w-[48%] rounded-[18px] bg-[linear-gradient(145deg,#f8fafc,#94a3b8)] shadow-2xl">
      <div className="absolute left-3 top-3 size-8 rounded-full bg-slate-900 shadow-inner" />
      <div className="absolute left-[18px] top-[18px] size-3 rounded-full bg-slate-500" />
      <div className="absolute bottom-4 left-1/2 h-1 w-12 -translate-x-1/2 rounded bg-white/55" />
    </div>
  );
}

function PortVisual() {
  return (
    <div className="relative h-[38%] w-[68%] rounded-xl bg-slate-900 shadow-2xl">
      <div className="absolute left-1/2 top-1/2 h-8 w-14 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-slate-500 bg-slate-800" />
      <div className="absolute left-5 top-4 size-5 rounded-full bg-emerald-400" />
      <div className="absolute bottom-4 right-6 h-3 w-10 rounded bg-indigo-400" />
    </div>
  );
}

function CameraVisual() {
  return (
    <div className="relative flex h-[62%] w-[72%] items-center justify-center gap-3 rounded-2xl bg-slate-950 shadow-2xl">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="grid size-16 place-items-center rounded-full bg-slate-800 ring-4 ring-slate-700"
        >
          <div className="size-9 rounded-full bg-[radial-gradient(circle,#93c5fd,#1e3a8a_58%,#020617)]" />
        </div>
      ))}
    </div>
  );
}

function FlexVisual() {
  return (
    <div className="relative h-[76%] w-[55%]">
      <div className="absolute left-2 top-2 h-28 w-7 rotate-[-18deg] rounded bg-slate-900 shadow-xl" />
      <div className="absolute bottom-5 right-5 h-28 w-8 rotate-[24deg] rounded bg-slate-800 shadow-xl" />
      <div className="absolute left-8 top-1/2 h-8 w-28 -translate-y-1/2 rounded bg-[linear-gradient(90deg,#111827,#334155)] shadow-xl" />
      <div className="absolute right-2 top-8 size-8 rounded bg-amber-400" />
    </div>
  );
}

function SpeakerVisual() {
  return (
    <div className="relative h-[35%] w-[72%] rounded-lg bg-slate-950 shadow-2xl">
      <div className="absolute inset-x-5 top-1/2 h-3 -translate-y-1/2 rounded-full bg-slate-600" />
      <div className="absolute left-6 top-4 size-3 rounded-full bg-slate-400" />
      <div className="absolute right-6 top-4 size-3 rounded-full bg-slate-400" />
    </div>
  );
}

function FrameVisual() {
  return (
    <div className="relative h-[78%] w-[50%] rounded-[20px] border-[10px] border-slate-800 bg-transparent shadow-2xl">
      <div className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded bg-slate-500" />
      <div className="absolute bottom-2 left-1/2 h-1 w-12 -translate-x-1/2 rounded bg-slate-500" />
    </div>
  );
}
