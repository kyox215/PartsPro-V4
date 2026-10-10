import assert from "node:assert/strict";
import test from "node:test";
import { supportDetailMatches, setConversationDraft, acknowledgeConversationDraft, pageHasNext } from "../src/lib/admin-operation-state.mjs";

test("support drafts are isolated by conversation and empty drafts are removed", () => {
  let drafts = setConversationDraft({}, "A", "A reply");
  drafts = setConversationDraft(drafts, "B", "B reply");
  assert.deepEqual(drafts, { A: "A reply", B: "B reply" });
  assert.equal(drafts.C ?? "", "");
  assert.deepEqual(setConversationDraft(drafts, "B", ""), { A: "A reply" });
});
test("acknowledging one reply preserves another conversation and edits made in flight", () => {
  assert.deepEqual(acknowledgeConversationDraft({ A: "sent", B: "draft" }, "A", "sent"), { B: "draft" });
  assert.deepEqual(acknowledgeConversationDraft({ A: "new edit" }, "A", "sent"), { A: "new edit" });
});
test("a failed or loading conversation cannot use an old detail as the selected target", () => {
  assert.equal(supportDetailMatches("B", "A"), false);
  assert.equal(supportDetailMatches("A", "A", true), false);
  assert.equal(supportDetailMatches("", ""), false);
  assert.equal(supportDetailMatches("B", "B"), true);
});
test("pagination continues beyond the first page and stops at a known end", () => {
  assert.equal(pageHasNext({ total: 81, page: 0, pageSize: 80, returned: 80 }), true);
  assert.equal(pageHasNext({ total: 81, page: 1, pageSize: 80, returned: 1 }), false);
  assert.equal(pageHasNext({ total: null, page: 2, pageSize: 50, returned: 50 }), true);
  assert.equal(pageHasNext({ total: null, page: 2, pageSize: 50, returned: 49 }), false);
});
