export function supportDetailMatches(selectedId: string, detailId: string | null | undefined, loading?: boolean): boolean;
export function setConversationDraft(drafts: Record<string, string>, conversationId: string, value: string): Record<string, string>;
export function acknowledgeConversationDraft(drafts: Record<string, string>, conversationId: string, submitted: string): Record<string, string>;
export function pageHasNext(input: { total: number | null; page: number; pageSize: number; returned: number }): boolean;
