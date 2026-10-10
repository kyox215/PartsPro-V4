import { NextResponse } from "next/server";
// Called only after a completed write; a failed read must never invite replay.
export async function savedAccountResponse(read: () => Promise<unknown>, rpc: string) {
  try {
    const data = await read();
    if (data) return NextResponse.json({ data, meta: { saved: true, source: "supabase_rpc", rpc } });
  } catch { /* Return committed status independently from the optional refresh. */ }
  return NextResponse.json({ data: null, meta: { saved: true, source: "supabase_rpc", rpc, readError: "ACCOUNT_SAVED_REFRESH_UNAVAILABLE" } });
}
