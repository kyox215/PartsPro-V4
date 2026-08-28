-- RMA ACL lockdown (defense in depth)
--
-- RMA table access is mediated by the application service role and the
-- existing security-definer RPC contracts. Keep service_role privileges and
-- all row-level policies unchanged; remove only direct client-role grants.
revoke all privileges on table public.rma_requests
  from anon, authenticated;
revoke all privileges on table public.rma_request_events
  from anon, authenticated;
revoke all privileges on table public.rma_drafts
  from anon, authenticated;
revoke all privileges on table public.rma_attachments
  from anon, authenticated;
revoke all privileges on table public.rma_action_executions
  from anon, authenticated;

-- Do not let a browser role advance the RMA request-number sequence directly.
revoke all privileges on sequence public.rma_request_no_seq
  from anon, authenticated;

-- These trigger functions are private implementation details. PUBLIC's
-- default EXECUTE grant must be removed explicitly; trigger execution by the
-- owning database role is unaffected.
revoke execute on function private.record_rma_request_created_event()
  from public, anon, authenticated;
revoke execute on function private.sync_rma_wallet_refund_status()
  from public, anon, authenticated;
