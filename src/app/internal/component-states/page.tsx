import { notFound } from "next/navigation";
import { AsyncFeedback } from "@/components/partspro/async-feedback";
import { ActionButton } from "@/components/partspro/action-button";
export default function ComponentStatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">PartsPro component states · synthetic demo</h1>
    {(["loading", "empty", "error", "success", "unknown", "info"] as const).map((state) => <AsyncFeedback key={state} state={state} title={state} description="Synthetic UI state. No business request is sent." actions={<ActionButton variant="outline">Review</ActionButton>} />)}
    <div className="flex flex-wrap gap-3">{(["idle", "pending", "success", "unknown"] as const).map((state) => <ActionButton key={state} state={state} pendingLabel="Saving…">{state}</ActionButton>)}</div>
  </main>;
}
