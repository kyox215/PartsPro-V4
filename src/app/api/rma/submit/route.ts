import { handleRmaSubmit } from "@/lib/partspro-rma-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRmaSubmit(request);
}
