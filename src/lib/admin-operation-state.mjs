export function supportDetailMatches(selectedId, detailId, loading = false) {
  return Boolean(selectedId && selectedId === detailId && !loading);
}

export function setConversationDraft(drafts, conversationId, value) {
  if (!conversationId) return drafts;
  const next = { ...drafts };
  if (value) next[conversationId] = value;
  else delete next[conversationId];
  return next;
}

export function acknowledgeConversationDraft(drafts, conversationId, submitted) {
  if ((drafts[conversationId] ?? "").trim() !== submitted.trim()) return drafts;
  return setConversationDraft(drafts, conversationId, "");
}

export function pageHasNext({ total, page, pageSize, returned }) {
  return Number.isFinite(total) ? (page + 1) * pageSize < total : returned === pageSize;
}
