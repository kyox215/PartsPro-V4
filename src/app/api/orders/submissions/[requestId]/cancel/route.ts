import { NextResponse } from "next/server";
import { apiError, readJsonBody } from "@/lib/partspro-api";
import { createOrderSchema } from "@/lib/partspro-checkout-schema";
import { cancelCheckoutSubmission } from "@/lib/partspro-checkout-submission";
import { RepositoryWriteError } from "@/lib/partspro-repository";
export async function POST(request:Request,{params}:{params:Promise<{requestId:string}>}) {
  const body=await readJsonBody(request);if(!body.ok)return apiError(400,"INVALID_JSON","Invalid request.");
  const parsed=createOrderSchema.safeParse(body.data);const {requestId}=await params;
  if(!parsed.success || parsed.data.requestId!==requestId)return apiError(400,"INVALID_SUBMISSION_ID","Invalid submission reference.");
  const {requestId:id,...intent}=parsed.data;
  try{return NextResponse.json(await cancelCheckoutSubmission(id,intent),{headers:{"Cache-Control":"no-store"}});}
  catch(error){if(error instanceof RepositoryWriteError)return apiError(error.status,error.code,error.message);return apiError(503,"ORDER_RESULT_UNKNOWN","Stop result needs verification.");}
}
