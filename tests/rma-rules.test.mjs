import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRmaLineRefundCap,
  isCommercialOutcomeAvailable,
  isRmaActionAvailable,
  reasonRequiresImage,
} from "../src/lib/partspro-rma-rules.mjs";

test("evidence rule is scope-aware: only active statutory withdrawal may omit a photo", () => {
  const scopes = [
    "statutory_b2c_withdrawal",
    "b2b_commercial",
    "legacy_unverified",
    "b2c_warranty",
  ];

  for (const scope of scopes) {
    for (const reason of [null, "withdrawal_no_longer_needed", "quality_defect"]) {
      const required = reasonRequiresImage(reason, scope);
      const expected =
        scope !== "statutory_b2c_withdrawal" ||
        (reason !== null && reason !== "withdrawal_no_longer_needed");
      assert.equal(required, expected, `${scope}/${reason ?? "empty"}`);
    }
  }
});

test("two-axis action availability requires QC and keeps inventory independent", () => {
  assert.equal(
    isRmaActionAvailable({
      action: "request_wallet_refund",
      status: "received",
      qcStatus: "passed",
      inventoryDisposition: "quarantine",
    }),
    true
  );
  assert.equal(
    isRmaActionAvailable({
      action: "restock_return",
      status: "refunded",
      qcStatus: "passed",
      inventoryDisposition: "quarantine",
    }),
    true
  );
  assert.equal(
    isRmaActionAvailable({
      action: "close",
      status: "refunded",
      qcStatus: "passed",
      inventoryDisposition: "quarantine",
    }),
    false
  );
  assert.equal(
    isRmaActionAvailable({
      action: "close",
      status: "refunded",
      qcStatus: "passed",
      inventoryDisposition: "restock",
      receivedAt: "2026-08-28T10:00:00.000Z",
    }),
    true
  );
  assert.equal(
    isRmaActionAvailable({
      action: "close",
      status: "refunded",
      qcStatus: "pending",
      inventoryDisposition: "restock",
      receivedAt: "2026-08-28T10:00:00.000Z",
    }),
    false
  );
  assert.equal(
    isRmaActionAvailable({ action: "close", status: "rejected" }),
    true
  );
});

test("line refund cap uses approved quantity, prior refunds and order balance", () => {
  assert.equal(
    calculateRmaLineRefundCap({
      unitPriceSnapshot: 12.5,
      approvedQuantity: 2,
      orderLineEligibleQuantity: 2,
      existingRmaRefunds: 5,
      orderRefundableBalance: 100,
    }),
    20
  );
  assert.equal(
    calculateRmaLineRefundCap({
      unitPriceSnapshot: 12.5,
      approvedQuantity: 4,
      orderLineEligibleQuantity: 4,
      existingRmaRefunds: 0,
      orderRefundableBalance: 20,
    }),
    20
  );
  assert.equal(
    calculateRmaLineRefundCap({
      unitPriceSnapshot: 10,
      approvedQuantity: 1,
      orderLineEligibleQuantity: 2,
      existingRmaRefunds: 10,
      orderRefundableBalance: 100,
    }),
    10
  );
});

test("commercial outcome rule fails closed across refund/replacement interleaving", () => {
  const cleanReceived = {
    status: "received",
    resolutionAction: null,
    replacementOrderId: null,
    walletRequestStatus: null,
  };
  assert.equal(isCommercialOutcomeAvailable({ ...cleanReceived, action: "request_wallet_refund" }), true);
  assert.equal(
    isCommercialOutcomeAvailable({
      ...cleanReceived,
      action: "mark_replacement_sent",
      walletRequestStatus: "pending",
    }),
    false
  );
  assert.equal(
    isCommercialOutcomeAvailable({
      ...cleanReceived,
      action: "request_wallet_refund",
      resolutionAction: "replacement",
    }),
    false
  );
  // A rejected wallet request remains fail-closed until an explicit future
  // reselection contract exists.
  assert.equal(
    isCommercialOutcomeAvailable({
      ...cleanReceived,
      action: "mark_replacement_sent",
      walletRequestStatus: "rejected",
    }),
    false
  );
});
