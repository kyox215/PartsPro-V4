import "server-only";

import type { RmaAttachment, RmaRequest } from "@/lib/partspro-data";
import {
  createServiceRoleClient,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/admin";

export const rmaEvidenceBucket = "rma-evidence";
export const rmaEvidenceSignedUrlTtlSeconds = 15 * 60;

export async function signRmaRequestAttachments(
  requests: RmaRequest[]
): Promise<RmaRequest[]> {
  if (!isSupabaseServiceRoleConfigured()) {
    return requests;
  }

  const supabase = createServiceRoleClient();

  return Promise.all(
    requests.map(async (request) => ({
      ...request,
      attachments: await signRmaAttachments(request.attachments ?? [], supabase),
    }))
  );
}

export async function signSingleRmaRequestAttachments(
  request: RmaRequest
): Promise<RmaRequest> {
  const [signed] = await signRmaRequestAttachments([request]);
  return signed ?? request;
}

async function signRmaAttachments(
  attachments: RmaAttachment[],
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  return Promise.all(
    attachments.map(async (attachment) => {
      if (!attachment.path || attachment.bucket !== rmaEvidenceBucket) {
        return attachment;
      }

      const { data, error } = await supabase.storage
        .from(rmaEvidenceBucket)
        .createSignedUrl(attachment.path, rmaEvidenceSignedUrlTtlSeconds);

      if (error || !data?.signedUrl) {
        return attachment;
      }

      return {
        ...attachment,
        signedUrl: data.signedUrl,
      };
    })
  );
}
