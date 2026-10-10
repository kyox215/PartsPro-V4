// The offline plan is available before connection; external tasks require saved readiness.
export function marketplaceActionBlocker(settings, connection, action) {
  if (action === 'plan_listings') return null;
  if (!settings?.enabled) return 'disabled';
  if (!connection?.connected) return 'connection';
  if (connection.environment !== settings.environment) return 'environment';
  if (settings.environment === 'production' && !settings.productionEnabled) return 'production';
  if (action === 'publish_eligible') {
    if (!settings.autoPublishEnabled) return 'publish';
    if (![settings.merchantLocationKey, settings.paymentPolicyId, settings.returnPolicyId, settings.fulfillmentPolicyId].every(v=>typeof v==='string'&&v.trim())) return 'policies';
  }
  if (action === 'sync_inventory' && !settings.autoSyncEnabled) return 'sync';
  if (action === 'import_orders' && !settings.orderImportEnabled) return 'orders';
  return null;
}
