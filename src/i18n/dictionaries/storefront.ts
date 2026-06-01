export type StorefrontTranslator = (key: string) => string;

export function tx(
  t: StorefrontTranslator,
  key: string,
  fallback: string
) {
  const value = t(key);

  return value === key ? fallback : value;
}

export function txFormat(
  t: StorefrontTranslator,
  key: string,
  fallback: string,
  params: Record<string, string | number>
) {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    tx(t, key, fallback)
  );
}

export function txCount(
  t: StorefrontTranslator,
  count: number,
  singularKey: string,
  singularFallback: string,
  pluralKey: string,
  pluralFallback: string
) {
  return count === 1
    ? tx(t, singularKey, singularFallback)
    : tx(t, pluralKey, pluralFallback);
}

const categoryKeys: Record<string, string> = {
  "Back Cover": "backCover",
  Batterie: "batteries",
  Connettori: "ports",
  "Flat Cable": "flexCables",
  Fotocamere: "cameras",
  Frame: "frames",
  Schermi: "screens",
  Speaker: "speakers",
};

const brandKeys: Record<string, string> = {
  Apple: "apple",
  Google: "google",
  Honor: "honor",
  Huawei: "huawei",
  OnePlus: "onePlus",
  Oppo: "oppo",
  Samsung: "samsung",
  Xiaomi: "xiaomi",
};

const stockStatusKeys: Record<string, string> = {
  "In Stock": "inStock",
  "Low Stock": "lowStock",
  "Out of Stock": "outOfStock",
};

const orderStatusKeys: Record<string, string> = {
  accepted: "accepted",
  cancelled: "cancelled",
  completed: "completed",
  delivered: "delivered",
  draft: "draft",
  paid: "paid",
  pending_payment: "pendingPayment",
  picking: "picking",
  packed: "packed",
  shipped: "shipped",
  submitted: "submitted",
};

const rmaStatusKeys: Record<string, string> = {
  approved: "approved",
  received: "received",
  refunded: "refunded",
  rejected: "rejected",
  replaced: "replaced",
  requested: "requested",
};

const leadTimeKeys: Record<string, string> = {
  "24/48h Italia": "twentyFourFortyEightItaly",
  "48h Italia": "fortyEightItaly",
  "Riassortimento 5 giorni": "restockFiveDays",
};

const rmaReasonKeys: Record<string, string> = {
  "Batteria non conforme": "batteryNotCompliant",
  "Connettore danneggiato": "damagedConnector",
  "Danno da trasporto": "shippingDamage",
  "Difetto display / touch": "displayTouchDefect",
  "Prodotto errato": "wrongProduct",
  "Capacità sotto soglia test": "capacityBelowThreshold",
  "Touch non risponde dopo installazione": "touchNotResponding",
};

const rmaResolutionKeys: Record<string, string> = {
  "In attesa di verifica laboratorio": "waitingLabCheck",
  "Sostituzione spedita": "replacementShipped",
};

export function categoryLabel(t: StorefrontTranslator, value: string) {
  const key = categoryKeys[value];

  return key ? tx(t, `storefront.data.categories.${key}`, value) : value;
}

export function brandLabel(t: StorefrontTranslator, value: string) {
  const key = brandKeys[value];

  return key ? tx(t, `storefront.data.brands.${key}`, value) : value;
}

export function stockStatusLabel(t: StorefrontTranslator, value: string) {
  const key = stockStatusKeys[value];

  return key ? tx(t, `storefront.data.stockStatus.${key}`, value) : value;
}

export function orderStatusLabel(t: StorefrontTranslator, value: string) {
  const key = orderStatusKeys[value];

  return key ? tx(t, `storefront.data.orderStatus.${key}`, value) : value;
}

export function rmaStatusLabel(t: StorefrontTranslator, value: string) {
  const key = rmaStatusKeys[value];

  return key ? tx(t, `storefront.data.rmaStatus.${key}`, value) : value;
}

export function leadTimeLabel(t: StorefrontTranslator, value: string) {
  const key = leadTimeKeys[value];

  return key ? tx(t, `storefront.data.leadTime.${key}`, value) : value;
}

export function rmaReasonLabel(t: StorefrontTranslator, value: string) {
  const key = rmaReasonKeys[value];

  return key ? tx(t, `storefront.data.rmaReasons.${key}`, value) : value;
}

export function rmaResolutionLabel(t: StorefrontTranslator, value: string) {
  const key = rmaResolutionKeys[value];

  return key ? tx(t, `storefront.data.rmaResolutions.${key}`, value) : value;
}

export const storefrontItIT = {
  "storefront.data.brands.apple": "Apple",
  "storefront.data.brands.google": "Google",
  "storefront.data.brands.honor": "Honor",
  "storefront.data.brands.huawei": "Huawei",
  "storefront.data.brands.onePlus": "OnePlus",
  "storefront.data.brands.oppo": "Oppo",
  "storefront.data.brands.samsung": "Samsung",
  "storefront.data.brands.xiaomi": "Xiaomi",
  "storefront.data.categories.backCover": "Back Cover",
  "storefront.data.categories.batteries": "Batterie",
  "storefront.data.categories.cameras": "Fotocamere",
  "storefront.data.categories.flexCables": "Flat Cable",
  "storefront.data.categories.frames": "Frame",
  "storefront.data.categories.ports": "Connettori",
  "storefront.data.categories.screens": "Schermi",
  "storefront.data.categories.speakers": "Speaker",
  "storefront.data.leadTime.fortyEightItaly": "48h Italia",
  "storefront.data.leadTime.restockFiveDays": "Riassortimento 5 giorni",
  "storefront.data.leadTime.twentyFourFortyEightItaly": "24/48h Italia",
  "storefront.data.orderStatus.accepted": "Accettato",
  "storefront.data.orderStatus.cancelled": "Annullato",
  "storefront.data.orderStatus.completed": "Completato",
  "storefront.data.orderStatus.delivered": "Consegnato",
  "storefront.data.orderStatus.draft": "Bozza",
  "storefront.data.orderStatus.paid": "Pagato",
  "storefront.data.orderStatus.pendingPayment": "Da pagare",
  "storefront.data.orderStatus.packed": "Imballato",
  "storefront.data.orderStatus.picking": "In preparazione",
  "storefront.data.orderStatus.shipped": "Spedito",
  "storefront.data.orderStatus.submitted": "Nuovo ordine",
  "storefront.data.rmaReasons.batteryNotCompliant": "Batteria non conforme",
  "storefront.data.rmaReasons.capacityBelowThreshold": "Capacità sotto soglia test",
  "storefront.data.rmaReasons.damagedConnector": "Connettore danneggiato",
  "storefront.data.rmaReasons.displayTouchDefect": "Difetto display / touch",
  "storefront.data.rmaReasons.shippingDamage": "Danno da trasporto",
  "storefront.data.rmaReasons.touchNotResponding": "Touch non risponde dopo installazione",
  "storefront.data.rmaReasons.wrongProduct": "Prodotto errato",
  "storefront.data.rmaResolutions.replacementShipped": "Sostituzione spedita",
  "storefront.data.rmaResolutions.waitingLabCheck": "In attesa di verifica laboratorio",
  "storefront.data.rmaStatus.approved": "Approvata",
  "storefront.data.rmaStatus.received": "Ricevuta",
  "storefront.data.rmaStatus.refunded": "Rimborsata",
  "storefront.data.rmaStatus.rejected": "Respinta",
  "storefront.data.rmaStatus.replaced": "Sostituita",
  "storefront.data.rmaStatus.requested": "Richiesta",
  "storefront.data.stockStatus.inStock": "Disponibile",
  "storefront.data.stockStatus.lowStock": "Scorta bassa",
  "storefront.data.stockStatus.outOfStock": "Esaurito",
  "storefront.data.stockLevel.belowMoq": "Sotto MOQ",
  "storefront.data.stockLevel.good": "Disponibilita buona",
  "storefront.data.stockLevel.limited": "Scorte limitate",
  "storefront.data.stockLevel.outOfStock": "Esaurito",
  "storefront.catalog.allProducts": "Tutto il catalogo",
  "storefront.catalog.availableOnly": "Solo disponibili",
  "storefront.catalog.availableOnlyAria": "Filtra solo prodotti disponibili",
  "storefront.catalog.clearFilters": "Cancella filtri",
  "storefront.catalog.emptyDescription":
    "Modifica ricerca o filtri rapidi per tornare al listino disponibile.",
  "storefront.catalog.emptyTitle": "Nessun ricambio trovato",
  "storefront.catalog.loadingMore": "Caricamento...",
  "storefront.catalog.loadMore": "Carica altri {count} SKU",
  "storefront.account.menuLabel": "Area account",
  "storefront.account.openAccount": "Centro personale",
  "storefront.account.openAdmin": "Pannello admin",
  "storefront.account.signOut": "Esci",
  "storefront.account.staffRole": "Accesso staff",
  "storefront.common.b2bAccount": "Centro personale",
  "storefront.common.checkout": "Checkout",
  "storefront.common.close": "Chiudi",
  "storefront.common.professionalCustomer": "Cliente professionale",
  "storefront.common.professionalPrices": "Prezzi professionali",
  "storefront.common.continueShopping": "Continua acquisti",
  "storefront.common.free": "Gratis",
  "storefront.common.listSeparator": ", ",
  "storefront.common.pieces": "pezzi",
  "storefront.common.piecesShort": "pz",
  "storefront.common.shipping": "Spedizione",
  "storefront.common.status": "Stato",
  "storefront.common.subtotal": "Subtotale",
  "storefront.common.total": "Totale",
  "storefront.common.unitEach": "cad.",
  "storefront.common.vat": "IVA",
  "storefront.cart.badge": "Carrello clienti",
  "storefront.cart.checkoutLabel": "Procedi al checkout",
  "storefront.cart.clear": "Svuota carrello",
  "storefront.cart.clearConfirm": "Svuotare tutti gli articoli dal carrello?",
  "storefront.cart.blockedDescription":
    "Le righe restano nel carrello. Controlla lo stato su ogni articolo: puoi correggere quantità oltre stock o MOQ senza perdere la selezione.",
  "storefront.cart.blockedLoginDescription":
    "Le righe restano nel carrello. Accedi o richiedi accesso professionale per vedere i prezzi, oppure rimuovi gli articoli non disponibili.",
  "storefront.cart.blockedAccountDescription":
    "Account riconosciuto. Completa o fai attivare il profilo cliente, poi aggiorna il carrello per vedere prezzi e checkout.",
  "storefront.cart.blockedTitle": "Alcuni articoli richiedono attenzione",
  "storefront.cart.continueShort": "Continua",
  "storefront.cart.detailsError":
    "Alcuni dettagli del carrello non sono stati aggiornati. Ricarica la pagina se i totali non corrispondono.",
  "storefront.cart.emptyDescription":
    "Aggiungi prodotti dal catalogo per preparare il checkout.",
  "storefront.cart.emptyTitle": "Carrello vuoto",
  "storefront.cart.goToCatalog": "Vai al catalogo",
  "storefront.cart.increaseAria": "Aumenta quantità per {sku}",
  "storefront.cart.increaseTitle": "Aumenta quantità",
  "storefront.cart.itemCountMany": "{count} pezzi",
  "storefront.cart.itemCountOne": "1 pezzo",
  "storefront.cart.lineCountMany": "{count} articoli",
  "storefront.cart.lineCountOne": "1 articolo",
  "storefront.cart.loadingDescription":
    "Lettura del carrello sincronizzato con il tuo account.",
  "storefront.cart.loadingProductsDescription":
    "Recupero disponibilità, MOQ e prezzi per gli articoli salvati.",
  "storefront.cart.loadingProductsTitle": "Caricamento prodotti",
  "storefront.cart.loadingTitle": "Caricamento carrello",
  "storefront.cart.localReadyDescription":
    "Il carrello e legato al tuo account: disponibilita e quantita vengono ricontrollate al momento dell'ordine.",
  "storefront.cart.localReadyShort": "Le modifiche sono sincronizzate con il tuo account.",
  "storefront.cart.localReadyTitle": "Carrello account pronto per checkout",
  "storefront.cart.loginRequiredTitle": "Accedi per usare il carrello",
  "storefront.cart.loginRequiredDescription":
    "Il carrello e disponibile solo dopo il login. Accedi per vedere e modificare gli articoli del tuo account.",
  "storefront.cart.minimumTitle": "Quantità minima MOQ {minimum}",
  "storefront.cart.moqBadge": "MOQ {moq}",
  "storefront.cart.priceEach": "{price} cad.",
  "storefront.cart.quantityAria": "Quantità per {sku}",
  "storefront.cart.removeLineAria": "Rimuovi riga {sku}",
  "storefront.cart.removeLineTitle": "Rimuovi questa riga dal carrello",
  "storefront.cart.removeUnavailable": "Rimuovi non disponibili",
  "storefront.cart.skuLabel": "SKU {sku}",
  "storefront.cart.snapshotRefreshing": "Aggiornamento",
  "storefront.cart.rejectedGenericDescription":
    "Questa riga resta salvata, ma deve essere risolta prima del checkout.",
  "storefront.cart.rejectedGenericLabel": "Da verificare",
  "storefront.cart.rejectedLoginDescription":
    "Articolo salvato nel carrello. Accedi o richiedi accesso come cliente professionale per vedere il prezzo e procedere.",
  "storefront.cart.rejectedLoginLabel": "Prezzo professionale protetto",
  "storefront.cart.rejectedAccountSyncDescription":
    "Sessione valida, ma il profilo account non e stato sincronizzato. Aggiorna la pagina o contatta un amministratore.",
  "storefront.cart.rejectedAccountSyncLabel": "Sincronizzazione account richiesta",
  "storefront.cart.rejectedCustomerProfileDescription":
    "Account riconosciuto, ma il profilo cliente e ancora in collegamento o da completare. Apri il centro personale o contatta un amministratore.",
  "storefront.cart.rejectedCustomerProfileLabel": "Profilo cliente da collegare",
  "storefront.cart.rejectedCustomerAssignmentDescription":
    "Account riconosciuto, ma il listino cliente non e ancora attivo. Chiedi all'amministratore di attivare l'account in gestione account.",
  "storefront.cart.rejectedCustomerAssignmentLabel": "Cliente da attivare",
  "storefront.cart.rejectedCustomerSuspendedDescription":
    "Account riconosciuto, ma il profilo cliente e sospeso. Contatta l'amministratore prima di procedere.",
  "storefront.cart.rejectedCustomerSuspendedLabel": "Account cliente sospeso",
  "storefront.cart.rejectedWholesaleRequiredDescription":
    "Account riconosciuto, ma il listino professionale non e ancora abilitato per questo cliente.",
  "storefront.cart.rejectedWholesaleRequiredLabel": "Prezzi professionali da abilitare",
  "storefront.cart.rejectedLoadingDescription":
    "Stiamo recuperando nome, immagine e disponibilita aggiornati per questa riga.",
  "storefront.cart.rejectedLoadingLabel": "Dettagli prodotto in caricamento",
  "storefront.cart.rejectedLoadingName": "Dettagli prodotto in caricamento",
  "storefront.cart.rejectedNotFoundDescription":
    "Questo SKU non risulta piu disponibile nel catalogo pubblico.",
  "storefront.cart.rejectedNotFoundLabel": "SKU non trovato",
  "storefront.cart.rejectedPriceDescription":
    "Il prezzo non e disponibile per questa riga. Rimuovila o riprova dopo l'aggiornamento del listino.",
  "storefront.cart.rejectedPriceLabel": "Prezzo non disponibile",
  "storefront.cart.rejectedBelowMoqDescription":
    "Quantità inferiore al MOQ {moq}. Aumenta manualmente la quantità per ripristinare l'acquisto.",
  "storefront.cart.rejectedBelowMoqLabel": "Sotto MOQ",
  "storefront.cart.rejectedOverStockDescription":
    "Stock disponibile {stock}. Riduci manualmente la quantità a {stock} o meno per ripristinare l'acquisto.",
  "storefront.cart.rejectedOverStockLabel": "Oltre stock",
  "storefront.cart.rejectedUnavailableDescription":
    "L'articolo non e acquistabile in questo momento per disponibilita o MOQ.",
  "storefront.cart.rejectedUnavailableLabel": "Non acquistabile",
  "storefront.cart.rows": "Articoli",
  "storefront.cart.stockBadge": "Stock {stock}",
  "storefront.cart.summaryLoading": "Caricamento carrello del tuo account...",
  "storefront.cart.summaryNote":
    "Il carrello non blocca stock: disponibilita e quantita vengono riservate solo alla conferma ordine.",
  "storefront.cart.summaryNoteBlocked":
    "Il carrello non blocca stock. Alcune righe richiedono login, disponibilita o correzione quantita; i totali includono solo righe acquistabili.",
  "storefront.cart.summaryNoteReviewCheckout":
    "Puoi aprire il checkout per vedere cosa manca. Login, cliente, prezzi, stock e MOQ verranno comunque verificati prima dell'invio.",
  "storefront.cart.summaryNoteSynced":
    "Il carrello non blocca stock: l'ordine riservera gli articoli solo dopo la conferma.",
  "storefront.cart.summaryTitle": "Riepilogo ordine",
  "storefront.cart.title": "Conferma prodotti e quantità",
  "storefront.assistedOrder.catalogBanner": "Ordine per cliente",
  "storefront.assistedOrder.catalogBannerGeneric":
    "Ordine per cliente: prezzi del cliente selezionato",
  "storefront.cart.decreaseAria": "Riduci quantità per {sku}",
  "storefront.cart.decreaseTitle": "Riduci quantità",
  "storefront.cart.stockLimitTitle": "Stock disponibile esaurito",
  "storefront.cart.loginForPrices": "Accedi",
  "storefront.cart.priceLoginDescription":
    "Accedi o richiedi accesso professionale per aggiungere articoli al carrello e vedere i prezzi.",
  "storefront.cart.priceLoginTitle": "Accedi per vedere prezzi professionali",
  "storefront.cart.requestProfessionalAccess": "Richiedi accesso",
  "storefront.cart.unresolvedDescription":
    "Aggiorna il catalogo o aggiungi nuovamente gli articoli disponibili.",
  "storefront.cart.unresolvedTitle": "Prodotti del carrello non disponibili",
  "storefront.checkout.badge": "Checkout clienti",
  "storefront.checkout.companyLinkedDescription":
    "{name} verrà usato come profilo fiscale per /api/orders.",
  "storefront.checkout.companyLinkedTitle": "Cliente collegato",
  "storefront.checkout.companyMissingDescription":
    "Nessun cliente è collegato alla sessione corrente. Crea o completa il profilo in gestione clienti prima del checkout.",
  "storefront.checkout.companyMissingTitle": "Profilo cliente mancante",
  "storefront.checkout.confirm.single":
    "Confermo dati fiscali, indirizzo di spedizione, prezzi IVA inclusa, disponibilita e MOQ mostrati nel checkout.",
  "storefront.checkout.confirm.address":
    "Confermo che l'indirizzo di spedizione e la fascia consegna sono aggiornati.",
  "storefront.checkout.confirm.invoice":
    "Confermo che Partita IVA, codice fiscale, PEC e codice destinatario sono corretti per la fattura elettronica.",
  "storefront.checkout.confirm.stockPolicy":
    "Accetto che disponibilità, MOQ e tempi di evasione seguano lo stato magazzino mostrato nel checkout.",
  "storefront.checkout.confirmTitle": "Conferme prima dell'invio",
  "storefront.checkout.description":
    "Controlla cliente, articoli, spedizione e pagamento prima dell'invio.",
  "storefront.checkout.disabledCompanyReason":
    "Checkout disabilitato: collega un profilo cliente all'utente Supabase.",
  "storefront.checkout.accountVerified": "Account verificato",
  "storefront.checkout.backToCart": "Torna al carrello",
  "storefront.checkout.billingAddress": "Indirizzo fatturazione",
  "storefront.checkout.catalogLoadError":
    "Impossibile caricare il listino cliente. Aggiorna la pagina e riprova.",
  "storefront.checkout.completeProfile": "Completa profilo",
  "storefront.checkout.customerNotReady": "Cliente non pronto per l'ordine",
  "storefront.checkout.customerNotReadyDescription":
    "Il cliente selezionato non soddisfa i requisiti ordine. Controlla stato, tipo, assegnazione e dati profilo.",
  "storefront.checkout.customerBlocker.assignment":
    "Il cliente deve essere assegnato a un listino prima dell'ordine.",
  "storefront.checkout.customerBlocker.profile":
    "Completa questi dati cliente prima dell'ordine: {fields}.",
  "storefront.checkout.customerBlocker.status":
    "Il cliente deve essere attivo prima di creare ordini.",
  "storefront.checkout.customerBlocker.type":
    "Il cliente deve essere wholesale per l'ordine assistito.",
  "storefront.checkout.customerContextPendingDescription":
    "Seleziona o completa il cliente per calcolare prezzo, scorte e MOQ prima dell'invio. SKU: {skus}.",
  "storefront.checkout.customerContextPendingTitle": "Cliente da completare",
  "storefront.checkout.delegated.description":
    "Scegli il cliente: prezzi, controlli e ordine useranno il suo livello e profilo.",
  "storefront.checkout.delegated.missingDescription":
    "Seleziona il cliente per calcolare il suo listino e creare l'ordine.",
  "storefront.checkout.delegated.missingTitle": "Cliente da selezionare",
  "storefront.checkout.delegated.placeholder": "Seleziona cliente",
  "storefront.checkout.delegated.select": "Seleziona cliente",
  "storefront.checkout.delegated.title": "Ordine per conto cliente",
  "storefront.checkout.deliveryAddressMissing":
    "Completa l'indirizzo di spedizione nel profilo cliente.",
  "storefront.checkout.fixCart": "Torna al carrello per correggere",
  "storefront.checkout.formInvalid": "Completa indirizzo cliente e conferma finale prima di inviare l'ordine.",
  "storefront.checkout.formInvalidTitle": "Dati checkout incompleti",
  "storefront.checkout.itemPendingAccount":
    "Accedi o collega un cliente per calcolare prezzo, scorte e MOQ.",
  "storefront.checkout.itemPendingCustomer":
    "Seleziona il cliente per calcolare prezzo, scorte e MOQ.",
  "storefront.checkout.itemPendingCustomerContext":
    "Seleziona o completa il cliente per calcolare prezzo, scorte e MOQ.",
  "storefront.checkout.itemUnavailable":
    "Questa riga non e piu disponibile per il checkout.",
  "storefront.checkout.itemsNeedReview": "Articoli da rivedere",
  "storefront.checkout.itemColumn.product": "Prodotto",
  "storefront.checkout.issue.duplicate": "SKU duplicato nel carrello.",
  "storefront.checkout.issue.moq": "Quantità inferiore al MOQ {moq}.",
  "storefront.checkout.issue.outOfStock": "Prodotto attualmente esaurito.",
  "storefront.checkout.issue.priceMissing":
    "Prezzo effettivo non disponibile per questo SKU.",
  "storefront.checkout.issue.profileIncomplete":
    "Profilo cliente incompleto: {fields}.",
  "storefront.checkout.issue.profileMissing": "Profilo cliente non disponibile.",
  "storefront.checkout.issue.stockLimit": "Disponibili solo {stock} pezzi.",
  "storefront.checkout.issue.unavailable": "SKU non disponibile nel catalogo.",
  "storefront.checkout.loadingItemsTitle": "Caricamento articoli ordine",
  "storefront.checkout.loadingTargetPrices":
    "Caricamento prezzi cliente per gli articoli del carrello.",
  "storefront.checkout.preview.errorTitle": "Controllo ordine non riuscito",
  "storefront.checkout.preview.loading": "Controllo prezzi, scorte e MOQ in corso.",
  "storefront.checkout.shippingFixed":
    "Metodo logistico gestito dal magazzino PartsPro. Puoi indicare fascia oraria o note di consegna.",
  "storefront.checkout.preview.title": "Controllo ordine",
  "storefront.checkout.profileMissing": "Dati cliente da completare",
  "storefront.checkout.profileMissingAll": "Profilo cliente",
  "storefront.checkout.required": "Campo obbligatorio.",
  "storefront.checkout.savedShippingAddress": "Indirizzo spedizione salvato",
  "storefront.checkout.section.customer": "Cliente e fatturazione",
  "storefront.checkout.section.items": "Dettaglio articoli",
  "storefront.checkout.summary.needsCustomer":
    "Seleziona il cliente per calcolare prezzi, scorte e MOQ.",
  "storefront.checkout.summary.note":
    "Prezzi IVA inclusa; viene aggiunta solo la spedizione.",
  "storefront.checkout.unresolvedItems": "Alcuni articoli non sono piu disponibili.",
  "storefront.checkout.field.codiceDestinatario": "Codice destinatario",
  "storefront.checkout.field.codiceFiscale": "Codice fiscale",
  "storefront.checkout.field.companyName": "Ragione sociale",
  "storefront.checkout.field.deliveryWindow": "Fascia consegna preferita",
  "storefront.checkout.field.deliveryWindowPlaceholder":
    "Es. mattina, pomeriggio, ritiro su appuntamento",
  "storefront.checkout.field.electronicInvoice": "PEC / SDI",
  "storefront.checkout.field.notes": "Note ordine",
  "storefront.checkout.field.notesPlaceholder":
    "Es. consegna solo mattina, riferimento interno...",
  "storefront.checkout.field.partitaIva": "Partita IVA",
  "storefront.checkout.field.pec": "PEC",
  "storefront.checkout.field.purchaseOrderNumber": "Riferimento interno / PO",
  "storefront.checkout.field.purchaseOrderPlaceholder": "Es. PO-2026-0524",
  "storefront.checkout.field.shippingCity": "Comune",
  "storefront.checkout.field.shippingProvince": "Provincia",
  "storefront.checkout.field.shippingStreet": "Via",
  "storefront.checkout.field.shippingZip": "CAP",
  "storefront.checkout.group.company": "Dati azienda",
  "storefront.checkout.group.delivery": "Consegna",
  "storefront.checkout.group.invoice": "Fatturazione elettronica",
  "storefront.checkout.group.payment": "Pagamento",
  "storefront.checkout.group.shippingAddress": "Indirizzo spedizione",
  "storefront.checkout.option.agreedTerms.description":
    "Solo per clienti con termini approvati.",
  "storefront.checkout.option.agreedTerms.label": "Pagamento concordato",
  "storefront.checkout.option.bankTransfer.description":
    "Crea ordine in attesa di pagamento.",
  "storefront.checkout.option.bankTransfer.label": "Bonifico bancario",
  "storefront.checkout.option.cash.description":
    "Ordine in attesa di incasso in sede.",
  "storefront.checkout.option.cash.label": "Contanti",
  "storefront.checkout.option.card.description": "Metodo non più usato nel checkout.",
  "storefront.checkout.option.card.label": "Metodo legacy",
  "storefront.checkout.option.express.detail": "Gratis sopra 250 EUR prodotti IVA inclusa",
  "storefront.checkout.option.express.description":
    "GLS/BRT con tracking e consegna in Italia lavorativa.",
  "storefront.checkout.option.express.label": "Corriere espresso 24/48h",
  "storefront.checkout.option.insured.detail": "Priorità magazzino Milano",
  "storefront.checkout.option.insured.description":
    "Copertura merce per display e ricambi ad alto valore.",
  "storefront.checkout.option.insured.label": "Espresso assicurato",
  "storefront.checkout.option.pickup.detail": "Disponibile su appuntamento",
  "storefront.checkout.option.pickup.description":
    "Preparazione banco e ritiro da parte del cliente.",
  "storefront.checkout.option.pickup.label": "Ritiro sede Milano",
  "storefront.checkout.runtime.disabled": "Checkout disabilitato",
  "storefront.checkout.runtime.loginDescription":
    "Supabase è configurato: accedi per associare il checkout alla sessione.",
  "storefront.checkout.runtime.loginReason":
    "Checkout disabilitato: effettua il login prima di confermare l'ordine.",
  "storefront.checkout.runtime.missingSupabaseDescription":
    "Supabase non è configurato. Aggiungi le variabili Supabase prima di accettare ordini reali.",
  "storefront.checkout.runtime.missingSupabaseReason":
    "Checkout disabilitato: configurazione Supabase mancante.",
  "storefront.checkout.runtime.needsProfileDescription":
    "Puoi vedere i prezzi e preparare il carrello, ma prima dell'ordine devi completare dati fiscali, contatto e indirizzi richiesti dal tipo cliente.",
  "storefront.checkout.runtime.needsProfileReason":
    "Checkout disabilitato: completa dati fiscali, contatto e indirizzi nel profilo cliente.",
  "storefront.checkout.runtime.needsProfileTitle": "Dati cliente da completare",
  "storefront.checkout.runtime.priceAccessDescription":
    "Il checkout richiede un cliente professionale abilitato e un prezzo effettivo valido per ogni SKU.",
  "storefront.checkout.runtime.priceAccessReason":
    "Checkout disabilitato: il listino cliente non è ancora abilitato.",
  "storefront.checkout.runtime.priceAccessTitle": "Listino da abilitare",
  "storefront.checkout.runtime.readyBadge": "Supabase attivo",
  "storefront.checkout.runtime.readyDescription":
    "Sessione Supabase attiva. L'ordine viene inviato all'API esistente /api/orders.",
  "storefront.checkout.runtime.readyTitle": "Checkout pronto",
  "storefront.checkout.runtime.sessionErrorDescription":
    "La configurazione risulta presente, ma non è stato possibile leggere la sessione Supabase.",
  "storefront.checkout.runtime.sessionErrorReason":
    "Checkout disabilitato: sessione Supabase non verificata. Riprova dopo il login o controlla .env.local.",
  "storefront.checkout.submit.button.cartEmpty": "Carrello vuoto",
  "storefront.checkout.submit.button.disabled": "Checkout disabilitato",
  "storefront.checkout.submit.button.idle": "Conferma ordine",
  "storefront.checkout.submit.button.loading": "Invio ordine...",
  "storefront.checkout.submit.button.loadingCart": "Caricamento carrello",
  "storefront.checkout.submit.button.blocked": "Non inviabile",
  "storefront.checkout.submit.button.success": "Ordine inviato",
  "storefront.checkout.submit.cartEmptyReason":
    "Il carrello è vuoto: aggiungi almeno un prodotto prima di confermare l'ordine.",
  "storefront.checkout.submit.cartLoadingReason":
    "Caricamento carrello del tuo account...",
  "storefront.checkout.submit.defaultDisabled": "Checkout disabilitato in questo momento.",
  "storefront.checkout.submit.formMissing":
    "Modulo checkout non trovato. Ricarica la pagina e riprova.",
  "storefront.checkout.submit.idleDisabled": "Checkout disabilitato in questo momento.",
  "storefront.checkout.submit.idleReady":
    "Checkout pronto: conferma l'ordine tramite /api/orders.",
  "storefront.checkout.submit.idleReadyFallback":
    "Checkout pronto: invia a /api/orders le righe salvate nel carrello.",
  "storefront.checkout.submit.invalidForm":
    "Completa i campi obbligatori e le conferme prima di inviare l'ordine.",
  "storefront.checkout.submit.missingCustomer":
    "Profilo cliente non disponibile: collega o completa il cliente prima di confermare l'ordine.",
  "storefront.checkout.submit.orderAccepted": "Ordine {id} creato correttamente.",
  "storefront.checkout.submit.orderIncomplete":
    "Risposta ordine incompleta. Controlla l'API /api/orders.",
  "storefront.checkout.submit.orderRejected": "Ordine non accettato dal gestionale.",
  "storefront.checkout.submit.sendError": "Errore durante l'invio.",
  "storefront.checkout.submit.sending": "Creazione ordine in corso...",
  "storefront.checkout.submit.timeout":
    "Invio ordine scaduto. Controlla la connessione e riprova.",
  "storefront.checkout.submit.unresolvedItemsReason":
    "Alcuni articoli del carrello non sono più disponibili: torna al carrello e rimuovili prima di confermare l'ordine.",
  "storefront.checkout.error.customerNotReady":
    "Il profilo cliente deve essere completato prima dell'ordine.",
  "storefront.checkout.error.loginRequired": "Accedi prima di confermare l'ordine.",
  "storefront.checkout.error.priceAccess": "Il listino cliente non è ancora abilitato.",
  "storefront.checkout.error.priceChanged":
    "Alcuni prezzi sono cambiati. Aggiorna il checkout e riprova.",
  "storefront.checkout.error.skuUnavailable": "Uno o più articoli non sono più disponibili.",
  "storefront.checkout.error.stockInvalid":
    "Una o più righe non rispettano scorte, quantità o MOQ.",
  "storefront.checkout.success.dialogDescription":
    "Abbiamo registrato l'ordine. Puoi seguirlo dal tuo account.",
  "storefront.checkout.success.dialogTitle": "Ordine creato correttamente",
  "storefront.checkout.success.openOrders": "Vai agli ordini",
  "storefront.checkout.success.orderNumber": "Numero ordine",
  "storefront.checkout.success.total": "Totale ordine",
  "storefront.checkout.unitPriceTaxIncluded": "Prezzo IVA incl.",
  "storefront.checkout.title": "Conferma ordine e dati fiscali",
  "storefront.customer.assignment.archived": "Archiviato",
  "storefront.customer.assignment.assigned": "Assegnato",
  "storefront.customer.assignment.convertedToEmployee": "Convertito in staff",
  "storefront.customer.assignment.needsReview": "Da revisionare",
  "storefront.customer.level.bronze": "Bronzo",
  "storefront.customer.level.diamond": "Diamante",
  "storefront.customer.level.emerald": "Smeraldo",
  "storefront.customer.level.gold": "Oro",
  "storefront.customer.level.king": "King",
  "storefront.customer.level.master": "Master",
  "storefront.customer.level.silver": "Argento",
  "storefront.customer.status.approved": "Approvato",
  "storefront.customer.status.pending": "In attesa",
  "storefront.customer.status.rejected": "Respinto",
  "storefront.customer.status.suspended": "Sospeso",
  "storefront.customer.type.retail": "Retail",
  "storefront.customer.type.wholesale": "Wholesale",
  "storefront.product.backToCatalog": "Torna al catalogo",
  "storefront.product.card.accountReviewHint": "MOQ {moq} · verifica listino",
  "storefront.product.card.accountReviewLabel": "Account in revisione",
  "storefront.product.card.add": "Aggiungi",
  "storefront.product.card.addAria":
    "Aggiungi {name} al carrello. MOQ {moq}.",
  "storefront.product.card.added": "Aggiunto",
  "storefront.product.card.addFailed": "Riprova",
  "storefront.product.card.basePrice": "Prezzo base",
  "storefront.product.card.extraModelsTitle":
    "{count} modelli compatibili aggiuntivi",
  "storefront.product.card.loginHint": "MOQ {moq} · login richiesto",
  "storefront.product.card.loginLabel": "Accedi per prezzo",
  "storefront.product.card.priceLocked": "Listino",
  "storefront.product.card.priceMissing": "Prezzo",
  "storefront.product.card.priceNeedsUpdate": "Listino da aggiornare",
  "storefront.product.card.priceUnset": "Prezzo non impostato",
  "storefront.product.card.previewImageAria": "Apri anteprima immagine {name}",
  "storefront.product.card.profileHint": "MOQ {moq} · riprova tra poco",
  "storefront.product.card.profileLabel": "Profilo in preparazione",
  "storefront.product.card.reviewBadgeTitle": "Account in revisione",
  "storefront.product.card.stockLevelTitle": "Disponibilita: {level}",
  "storefront.product.card.stockLine": "{level}",
  "storefront.product.card.suspendedHint": "MOQ {moq} · contatta supporto",
  "storefront.product.card.suspendedLabel": "Account sospeso",
  "storefront.product.card.unavailable": "Esaurito",
  "storefront.product.card.unavailableAria":
    "{name} non disponibile per il carrello",
  "storefront.product.card.visiblePriceHint": "IVA inclusa · MOQ {moq}",
  "storefront.product.card.wholesaleHint": "MOQ {moq} · verifica cliente",
  "storefront.product.card.wholesaleLabel": "Listino da abilitare",
  "storefront.product.detail.customerConditions": "Condizioni cliente",
  "storefront.product.detail.invoice": "Fattura",
  "storefront.product.detail.invoiceText": "PEC / Codice Destinatario",
  "storefront.product.detail.lot": "Lotto",
  "storefront.product.detail.lotTracked": "Tracciato",
  "storefront.product.detail.stockLevel": "Disponibilita",
  "storefront.product.detail.stockLevelText": "Indicatore senza quantita",
  "storefront.product.purchase.add": "Aggiungi al carrello",
  "storefront.product.purchase.addAria":
    "Aggiungi {quantity} pezzi di {name} al carrello",
  "storefront.product.purchase.added": "Aggiunto",
  "storefront.product.purchase.addFailed": "Riprova",
  "storefront.product.purchase.goCheckout": "Vai al checkout",
  "storefront.product.purchase.orderNow": "Ordina ora",
  "storefront.product.purchase.orderNowAria":
    "Ordina ora {quantity} pezzi di {name}",
  "storefront.product.purchase.unavailableTitle": "Acquisto non disponibile",
  "storefront.product.card.loginToAdd": "Accedi",
  "storefront.product.card.loginToAddAria":
    "Accedi per aggiungere {name} al carrello.",
  "storefront.product.restock.aria": "Avvisami quando {name} torna disponibile",
  "storefront.product.restock.detailDescription":
    "Questo SKU non e acquistabile ora per stock o MOQ. Salva un avviso quando il riassortimento sara disponibile.",
  "storefront.product.restock.detailTitle": "Riassortimento",
  "storefront.product.restock.loginRequired":
    "Accedi per salvare l'avviso di riassortimento",
  "storefront.product.restock.request": "Avvisami al riassortimento",
  "storefront.product.restock.retry": "Riprova",
  "storefront.product.restock.saved": "Avviso salvato",
  "storefront.product.quantity.decrease": "Riduci",
  "storefront.product.quantity.decreaseAria": "Riduci quantita di {name}",
  "storefront.product.quantity.inCart": "Nel carrello",
  "storefront.product.quantity.inCartSummary":
    "{quantity} pezzi gia salvati nel carrello.",
  "storefront.product.quantity.inCartTitle": "{quantity} pezzi nel carrello",
  "storefront.product.quantity.increase": "Aumenta",
  "storefront.product.quantity.increaseAria": "Aumenta quantita di {name}",
  "storefront.product.quantity.overStock":
    "Disponibili {stock}: riduci la quantita per procedere.",
  "storefront.product.quantity.overStockTitle":
    "Quantita oltre stock: disponibili {stock} pezzi.",
  "storefront.product.quantity.remove": "Rimuovi",
  "storefront.product.quantity.removeAria": "Rimuovi {name} dal carrello",
  "storefront.product.quantity.stockLimit": "Limite stock",
  "storefront.product.detail.minimumOrder": "Ordine minimo",
  "storefront.product.detail.noPriceDescription":
    "Sessione verificata, ma il prezzo per questo SKU non è ancora stato aggiornato.",
  "storefront.product.detail.noPriceTitle": "Prezzo non impostato",
  "storefront.product.detail.packing": "Packing",
  "storefront.product.detail.packingAntiStatic": "Antistatico",
  "storefront.product.detail.priceGate.login.actionLabel": "Accedi",
  "storefront.product.detail.priceGate.login.cardDescription":
    "Accedi con un account cliente per sbloccare prezzo netto, preventivo e invio al carrello.",
  "storefront.product.detail.priceGate.login.cardTitle": "Prezzo protetto",
  "storefront.product.detail.priceGate.login.description":
    "Accedi per vedere prezzo, quantità minime, sconti livello e condizioni di pagamento.",
  "storefront.product.detail.priceGate.login.title":
    "Prezzi riservati agli account verificati",
  "storefront.product.detail.priceGate.profile.actionLabel": "Apri account",
  "storefront.product.detail.priceGate.profile.cardDescription":
    "La sessione è valida, ma il profilo cliente PartsPro non è ancora collegato correttamente.",
  "storefront.product.detail.priceGate.profile.cardTitle": "Profilo in preparazione",
  "storefront.product.detail.priceGate.profile.description":
    "Accesso rilevato: stiamo preparando il profilo cliente necessario per mostrare il listino.",
  "storefront.product.detail.priceGate.profile.title": "Profilo cliente richiesto",
  "storefront.product.detail.priceGate.review.actionLabel": "Apri account",
  "storefront.product.detail.priceGate.review.cardDescription":
    "Il tuo account è attivo e può vedere i prezzi. Il team PartsPro completerà la verifica del profilo cliente.",
  "storefront.product.detail.priceGate.review.cardTitle": "In revisione",
  "storefront.product.detail.priceGate.review.description":
    "Account in revisione: il prezzo resta visibile mentre PartsPro completa la verifica del profilo cliente.",
  "storefront.product.detail.priceGate.review.title": "In revisione",
  "storefront.product.detail.priceGate.suspended.cardDescription":
    "Il listino è temporaneamente bloccato per questo account. Contatta il team PartsPro.",
  "storefront.product.detail.priceGate.suspended.cardTitle": "Account sospeso",
  "storefront.product.detail.priceGate.suspended.description":
    "Accesso rilevato, ma il listino non è disponibile per account sospesi.",
  "storefront.product.detail.priceGate.suspended.title": "Listino sospeso",
  "storefront.product.detail.priceGate.wholesale.actionLabel": "Apri account",
  "storefront.product.detail.priceGate.wholesale.cardDescription":
    "Questo account non è ancora abilitato al listino cliente. Completa la verifica del profilo.",
  "storefront.product.detail.priceGate.wholesale.cardTitle": "Listino da abilitare",
  "storefront.product.detail.priceGate.wholesale.description":
    "Accesso rilevato: per questo SKU serve un profilo cliente abilitato.",
  "storefront.product.detail.priceGate.wholesale.title":
    "Prezzi riservati ai clienti abilitati",
  "storefront.product.detail.priceVisibleOrderLockedDescription":
    "Il prezzo è disponibile per consultazione, ma checkout e carrello richiedono un cliente professionale abilitato.",
  "storefront.product.detail.priceVisibleOrderLockedTitle":
    "Listino non abilitato all'ordine",
  "storefront.product.detail.qc": "QC",
  "storefront.product.detail.qcText": "Test pre-spedizione",
  "storefront.product.detail.sessionCustomerVerified":
    "Sessione cliente verificata",
  "storefront.product.detail.sessionPricePending":
    "Account verificato: il prezzo per questo SKU deve ancora essere aggiornato.",
  "storefront.product.detail.sessionPriceReady":
    "Prezzo netto, quantità minime e condizioni cliente sono disponibili per questo SKU.",
  "storefront.product.detail.trackedDelivery": "Consegna tracciata in Italia",
  "storefront.product.detail.logisticsEstimate": "Stima logistica",
  "storefront.header.openAccount": "Apri centro personale",
  "storefront.header.openCart": "Apri carrello",
  "storefront.header.openMenu": "Apri menu",
  "storefront.header.mobileMenuTitle": "Menu PartsPro",
  "storefront.header.searchFull": "Cerca SKU, brand, modello...",
  "storefront.header.searchSubmit": "Cerca",
  "storefront.logo.tagline": "Ricambi smartphone per clienti professionali",
  "storefront.home.brands.eyebrow": "Brand e modelli",
  "storefront.home.brands.stats.brands": "brand gestiti",
  "storefront.home.brands.stats.delivery": "Italia",
  "storefront.home.brands.stats.models": "modelli indicizzati",
  "storefront.home.brands.stats.sku": "SKU catalogo",
  "storefront.home.brands.title": "Navigazione rapida per compatibilità",
  "storefront.home.categories.eyebrow": "Catalogo",
  "storefront.home.categories.title": "Categorie richieste dai laboratori",
  "storefront.home.common.catalog": "Catalogo",
  "storefront.home.common.openCatalog": "Apri catalogo",
  "storefront.home.common.skuCount": "{count} SKU",
  "storefront.home.common.viewAll": "Vedi tutto",
  "storefront.home.header.availableOnly": "Solo disponibili",
  "storefront.home.header.logoLabel": "Torna alla home PartsPro",
  "storefront.home.hero.badge": "Forniture professionali Italia",
  "storefront.home.hero.browseCatalog": "Sfoglia catalogo",
  "storefront.home.hero.catalogFallback": "Catalogo professionale",
  "storefront.home.hero.description":
    "PartsPro unisce catalogo professionale, disponibilità locale, prezzi riservati, fatturazione elettronica e RMA tracciabile in un unico flusso per il mercato italiano.",
  "storefront.home.hero.loginForPrices": "Richiedi accesso professionale",
  "storefront.home.hero.stats.brands": "brand e famiglie",
  "storefront.home.hero.stats.delivery": "logistica Italia",
  "storefront.home.hero.stats.sku": "SKU nel catalogo",
  "storefront.home.hero.title": "Ricambi smartphone per laboratori e rivenditori",
  "storefront.home.hero.visualText":
    "SKU, stock, MOQ e compatibilità sono pensati per acquisti ricorrenti.",
  "storefront.home.hero.visualTitle": "Catalogo operativo, non vetrina statica",
  "storefront.home.notifications": "Notifiche",
  "storefront.home.mobileMenuDescription": "Menu mobile con home, catalogo e account.",
  "storefront.home.mobileSearch": "Cerca SKU / prodotto",
  "storefront.home.productCard.basePrice": "Prezzo base",
  "storefront.home.productCard.extraModels": "+{count} modelli",
  "storefront.home.productCard.loginPrice": "Prezzo dopo login",
  "storefront.home.productCard.open": "Apri",
  "storefront.home.productCard.openAria": "Apri scheda prodotto {name}",
  "storefront.home.productCard.pendingHint": "In revisione · MOQ {moq}",
  "storefront.home.productCard.pendingPrice": "In revisione",
  "storefront.home.productCard.priceHint": "MOQ {moq} · login richiesto",
  "storefront.home.productCard.priceVisibleHint": "IVA inclusa · MOQ {moq}",
  "storefront.home.productCard.profileHint": "MOQ {moq} · riprova tra poco",
  "storefront.home.productCard.profilePrice": "Profilo in preparazione",
  "storefront.home.productCard.stockLine": "{level}",
  "storefront.home.productCard.suspendedHint": "MOQ {moq} · contatta supporto",
  "storefront.home.productCard.suspendedPrice": "Account sospeso",
  "storefront.home.productCard.wholesaleHint": "MOQ {moq} · verifica cliente",
  "storefront.home.productCard.wholesalePrice": "Listino da abilitare",
  "storefront.home.products.action": "Disponibili ora",
  "storefront.home.products.empty":
    "Il catalogo pubblico non è disponibile in questo momento. Puoi comunque aprire il catalogo o accedere per verificare il listino.",
  "storefront.home.products.eyebrow": "Stock reale",
  "storefront.home.products.title": "Ricambi pronti da consultare",
  "storefront.home.rightRail.account.subtitle": "Profilo, ordini e RMA",
  "storefront.home.rightRail.account.title": "Centro personale",
  "storefront.home.rightRail.cart.empty": "Aggiungi un prodotto per preparare checkout e ordine.",
  "storefront.home.rightRail.cart.manyLines": "{count} righe",
  "storefront.home.rightRail.cart.oneLine": "1 riga",
  "storefront.home.rightRail.cart.quantity": "{count} pz",
  "storefront.home.rightRail.cart.subtotal": "Subtotale",
  "storefront.home.rightRail.cart.title": "Anteprima carrello",
  "storefront.home.rightRail.invoice.eInvoice": "Fattura elettronica con PEC / SDI",
  "storefront.home.rightRail.invoice.payment": "Prezzi netti dopo approvazione",
  "storefront.home.rightRail.invoice.title": "Documenti professionali",
  "storefront.home.rightRail.invoice.trace": "SKU e lotti tracciati in ordine",
  "storefront.home.searchPlaceholder": "Cerca prodotto, SKU, brand, modello...",
  "storefront.home.sidebar.subtitle": "Brand e modelli",
  "storefront.home.sidebar.title": "Catalogo rapido",
  "storefront.home.trust.delivery.title": "Logistica Italia",
  "storefront.home.trust.delivery.value": "24/48h sui ricambi disponibili",
  "storefront.home.trust.invoice.title": "Fattura aziendale",
  "storefront.home.trust.invoice.value": "PEC, Codice SDI e dati aziendali",
  "storefront.home.trust.localStock.title": "Stock locale",
  "storefront.home.trust.localStock.value": "Disponibilità aggiornata per SKU e modello",
  "storefront.home.trust.quality.title": "Qualità verificata",
  "storefront.home.trust.quality.value": "Gradi, lotti e controlli pre-spedizione",
  "storefront.home.trust.support.title": "RMA tracciabile",
  "storefront.home.trust.support.value": "Assistenza post-vendita per laboratori",
  "storefront.home.workflow.account.text":
    "Accedi o richiedi approvazione per vedere prezzi e condizioni.",
  "storefront.home.workflow.account.title": "Verifica il profilo cliente",
  "storefront.home.workflow.action": "Apri account",
  "storefront.home.workflow.afterSales.text":
    "Segui richieste, fatture e storico direttamente dall'account.",
  "storefront.home.workflow.afterSales.title": "Gestisci RMA e documenti",
  "storefront.home.workflow.catalog.text":
    "Filtra per brand, modello, categoria e disponibilità reale.",
  "storefront.home.workflow.catalog.title": "Trova il ricambio",
  "storefront.home.workflow.eyebrow": "Flusso clienti professionali",
  "storefront.home.workflow.order.text":
    "Aggiungi MOQ, conferma IVA e spedizione, poi invia l'ordine.",
  "storefront.home.workflow.order.title": "Prepara l'ordine",
  "storefront.home.workflow.title": "Dalla ricerca al post-vendita senza passaggi manuali",
  "storefront.login.action": "Accedi",
  "storefront.login.badge": "Accesso clienti",
  "storefront.login.createAccount": "Crea account",
  "storefront.login.creatingAccount": "Creazione account...",
  "storefront.login.disabledConfig":
    "Il pulsante resta disattivato finché la publishable key Supabase non è configurata.",
  "storefront.login.divider": "oppure",
  "storefront.login.displayName": "Nome",
  "storefront.login.displayNamePlaceholder": "Nome cliente",
  "storefront.login.email": "Email",
  "storefront.login.google": "Continua con Google",
  "storefront.login.newCustomer.description":
    "Crea un account cliente base oppure richiedi l'accesso come cliente professionale.",
  "storefront.login.newCustomer.professional": "Richiedi accesso professionale",
  "storefront.login.newCustomer.title": "Nuovo cliente",
  "storefront.login.password": "Password",
  "storefront.login.passwordLogin": "Accedi con password",
  "storefront.login.signingIn": "Accesso in corso...",
  "storefront.login.runtime.missingBody":
    "Supabase è collegato al progetto, ma manca ancora NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
  "storefront.login.runtime.missingTitle": "Configurazione Supabase mancante",
  "storefront.login.runtime.readyBody":
    "Le credenziali vengono verificate con Supabase Auth. Dopo il login i clienti aprono l'area account, lo staff apre il pannello admin.",
  "storefront.login.runtime.readyTitle": "Login Supabase attivo",
  "storefront.login.title": "Login PartsPro",
  "storefront.login.verify.body":
    "Inserisci il codice numerico a 6 cifre inviato alla tua email.",
  "storefront.login.verify.code": "Codice",
  "storefront.login.verify.resend": "Invia nuovo codice",
  "storefront.login.verify.resendPending": "Invio codice...",
  "storefront.login.verify.resendTo": "Invia di nuovo a",
  "storefront.login.verify.submit": "Verifica e accedi",
  "storefront.login.verify.submitPending": "Verifica codice...",
  "storefront.login.verify.title": "Verifica email",
  "storefront.login.wechat": "Continua con WeChat",
  "storefront.professional.after.account.body":
    "Userai login, carrello, checkout e RMA con lo stesso profilo cliente.",
  "storefront.professional.after.account.title": "Accesso account",
  "storefront.professional.after.prices.body":
    "Dopo l'approvazione puoi vedere listino, MOQ e condizioni dedicate.",
  "storefront.professional.after.prices.title": "Prezzi professionali",
  "storefront.professional.after.review.body":
    "Controlliamo azienda, contatto e dati fiscali prima di abilitare il profilo.",
  "storefront.professional.after.review.title": "Verifica dati",
  "storefront.professional.after.title": "Dopo l'invio",
  "storefront.professional.badge": "Richiesta accesso clienti professionali",
  "storefront.professional.description":
    "Invia i dati aziendali per abilitare prezzi professionali, condizioni dedicate e checkout con fatturazione elettronica.",
  "storefront.professional.field.address": "Indirizzo",
  "storefront.professional.field.city": "Comune",
  "storefront.professional.field.codiceDestinatario": "Codice destinatario",
  "storefront.professional.field.codiceFiscale": "Codice fiscale",
  "storefront.professional.field.companyName": "Ragione sociale",
  "storefront.professional.field.contactName": "Referente",
  "storefront.professional.field.email": "Email",
  "storefront.professional.field.notes": "Note",
  "storefront.professional.field.notesPlaceholder":
    "Indica categorie di interesse, volume medio o esigenze operative...",
  "storefront.professional.field.partitaIva": "Partita IVA",
  "storefront.professional.field.pec": "PEC",
  "storefront.professional.field.phone": "Telefono",
  "storefront.professional.field.province": "Provincia",
  "storefront.professional.field.website": "Sito web",
  "storefront.professional.form.title": "Dati azienda",
  "storefront.professional.login": "Ho già un account",
  "storefront.professional.privacy":
    "Autorizzo il trattamento dei dati per la valutazione della richiesta.",
  "storefront.professional.status.changed":
    "Modifiche pronte. Invia di nuovo la richiesta quando vuoi.",
  "storefront.professional.status.consentRequired":
    "Accetta condizioni e privacy prima di inviare la richiesta.",
  "storefront.professional.status.error": "Errore durante l'invio della richiesta.",
  "storefront.professional.status.idle":
    "Compila i dati aziendali per richiedere l'accesso clienti professionali.",
  "storefront.professional.status.loading": "Invio richiesta in corso...",
  "storefront.professional.status.rejected":
    "Richiesta non accettata. Controlla i campi e riprova.",
  "storefront.professional.status.success":
    "Richiesta inviata. Il team PartsPro controllerà i dati e ti contatterà via email.",
  "storefront.professional.submit": "Invia richiesta",
  "storefront.professional.submit.loading": "Invio...",
  "storefront.professional.terms":
    "Confermo che i dati inseriti sono corretti e accetto le condizioni di richiesta accesso.",
  "storefront.professional.title": "Richiedi accesso clienti professionali",
  "storefront.rma.backToAccount": "Torna all'account",
  "storefront.rma.badge": "RMA tracciabile",
  "storefront.rma.description":
    "Collega la richiesta a un ordine, descrivi il difetto e prepara foto o video per velocizzare la verifica del laboratorio.",
  "storefront.rma.form.description": "Descrizione problema",
  "storefront.rma.form.descriptionPlaceholder":
    "Indica test effettuati, sintomi, modello dispositivo e condizioni del ricambio...",
  "storefront.rma.form.evidence": "Carica foto o video del difetto",
  "storefront.rma.form.evidenceEmpty":
    "Nessun file selezionato. L'API riceve solo i dati RMA.",
  "storefront.rma.form.evidenceHint":
    "JPG, PNG o MP4 fino a 20MB. I file restano come anteprima locale.",
  "storefront.rma.form.evidenceSelected":
    "{count} file selezionati solo come anteprima locale.",
  "storefront.rma.form.order": "Ordine",
  "storefront.rma.form.orderLine": "Riga ordine",
  "storefront.rma.form.orderLinePlaceholder": "ID riga ordine dallo storico ordini",
  "storefront.rma.form.orderPlaceholder": "Numero ordine reale",
  "storefront.rma.form.quantity": "Quantità",
  "storefront.rma.form.reason": "Motivo RMA",
  "storefront.rma.form.title": "Nuova richiesta RMA",
  "storefront.rma.recent.empty": "Nessuna richiesta RMA registrata.",
  "storefront.rma.recent.title": "Richieste recenti",
  "storefront.rma.result.number": "Numero RMA",
  "storefront.rma.result.order": "Ordine",
  "storefront.rma.result.status": "Stato",
  "storefront.rma.rules.lab.body":
    "Il team controlla il ricambio e aggiorna lo stato nella tua area account.",
  "storefront.rma.rules.lab.title": "Verifica laboratorio",
  "storefront.rma.rules.noteBody":
    "I danni da installazione o liquidi possono essere esclusi dalla sostituzione automatica.",
  "storefront.rma.rules.noteTitle": "Nota",
  "storefront.rma.rules.order.body":
    "Le richieste senza numero ordine non possono essere validate automaticamente.",
  "storefront.rma.rules.order.title": "Collega sempre l'ordine",
  "storefront.rma.rules.photo.body":
    "Carica immagini del difetto e del sigillo qualità prima della spedizione.",
  "storefront.rma.rules.photo.title": "Foto prima del reso",
  "storefront.rma.rules.title": "Regole RMA",
  "storefront.rma.submit.button": "Invia richiesta RMA",
  "storefront.rma.submit.buttonLoading": "Invio RMA...",
  "storefront.rma.submit.changed":
    "Modifiche locali pronte. Invia di nuovo per creare una nuova RMA.",
  "storefront.rma.submit.error": "Errore durante l'invio RMA.",
  "storefront.rma.submit.idle":
    "Compila i dati e invia la richiesta al flusso RMA.",
  "storefront.rma.submit.invalidQuantity":
    "Inserisci una quantità valida, almeno 1 pezzo.",
  "storefront.rma.submit.loading": "Invio richiesta RMA in corso...",
  "storefront.rma.submit.success": "Richiesta {id} registrata correttamente.",
  "storefront.rma.title": "Apri una richiesta di reso o sostituzione",
};

export const storefrontZhCN = {
  "storefront.data.brands.apple": "苹果",
  "storefront.data.brands.google": "谷歌",
  "storefront.data.brands.honor": "荣耀",
  "storefront.data.brands.huawei": "华为",
  "storefront.data.brands.onePlus": "一加",
  "storefront.data.brands.oppo": "OPPO",
  "storefront.data.brands.samsung": "三星",
  "storefront.data.brands.xiaomi": "小米",
  "storefront.data.categories.backCover": "后盖",
  "storefront.data.categories.batteries": "电池",
  "storefront.data.categories.cameras": "摄像头",
  "storefront.data.categories.flexCables": "排线",
  "storefront.data.categories.frames": "中框",
  "storefront.data.categories.ports": "接口",
  "storefront.data.categories.screens": "屏幕",
  "storefront.data.categories.speakers": "扬声器",
  "storefront.data.leadTime.fortyEightItaly": "意大利 48 小时",
  "storefront.data.leadTime.restockFiveDays": "5 天后补货",
  "storefront.data.leadTime.twentyFourFortyEightItaly": "意大利 24/48 小时",
  "storefront.data.orderStatus.accepted": "已接单",
  "storefront.data.orderStatus.cancelled": "已取消",
  "storefront.data.orderStatus.completed": "已完成",
  "storefront.data.orderStatus.delivered": "已送达",
  "storefront.data.orderStatus.draft": "草稿",
  "storefront.data.orderStatus.paid": "已付款",
  "storefront.data.orderStatus.pendingPayment": "待付款",
  "storefront.data.orderStatus.packed": "已打包",
  "storefront.data.orderStatus.picking": "备货中",
  "storefront.data.orderStatus.shipped": "已发货",
  "storefront.data.orderStatus.submitted": "新订单",
  "storefront.data.rmaReasons.batteryNotCompliant": "电池不符合要求",
  "storefront.data.rmaReasons.capacityBelowThreshold": "容量测试低于阈值",
  "storefront.data.rmaReasons.damagedConnector": "连接器损坏",
  "storefront.data.rmaReasons.displayTouchDefect": "屏幕/触控故障",
  "storefront.data.rmaReasons.shippingDamage": "运输损坏",
  "storefront.data.rmaReasons.touchNotResponding": "安装后触控无响应",
  "storefront.data.rmaReasons.wrongProduct": "商品错误",
  "storefront.data.rmaResolutions.replacementShipped": "替换件已发出",
  "storefront.data.rmaResolutions.waitingLabCheck": "等待实验室检测",
  "storefront.data.rmaStatus.approved": "已批准",
  "storefront.data.rmaStatus.received": "已收到",
  "storefront.data.rmaStatus.refunded": "已退款",
  "storefront.data.rmaStatus.rejected": "已拒绝",
  "storefront.data.rmaStatus.replaced": "已更换",
  "storefront.data.rmaStatus.requested": "已提交",
  "storefront.data.stockStatus.inStock": "有库存",
  "storefront.data.stockStatus.lowStock": "库存紧张",
  "storefront.data.stockStatus.outOfStock": "缺货",
  "storefront.data.stockLevel.belowMoq": "低于起订",
  "storefront.data.stockLevel.good": "库存充足",
  "storefront.data.stockLevel.limited": "少量现货",
  "storefront.data.stockLevel.outOfStock": "暂时缺货",
  "storefront.catalog.allProducts": "全部目录",
  "storefront.catalog.availableOnly": "仅看有货",
  "storefront.catalog.availableOnlyAria": "仅筛选有货商品",
  "storefront.catalog.clearFilters": "清除筛选",
  "storefront.catalog.emptyDescription": "调整搜索或快速筛选，以返回可售目录。",
  "storefront.catalog.emptyTitle": "未找到配件",
  "storefront.catalog.loadingMore": "正在加载...",
  "storefront.catalog.loadMore": "再加载 {count} 个 SKU",
  "storefront.account.menuLabel": "账户区域",
  "storefront.account.openAccount": "个人中心",
  "storefront.account.openAdmin": "后台面板",
  "storefront.account.signOut": "退出账号",
  "storefront.account.staffRole": "员工权限",
  "storefront.common.b2bAccount": "个人中心",
  "storefront.common.checkout": "结账",
  "storefront.common.close": "关闭",
  "storefront.common.professionalCustomer": "专业客户",
  "storefront.common.professionalPrices": "专业客户价格",
  "storefront.common.continueShopping": "继续采购",
  "storefront.common.free": "免费",
  "storefront.common.listSeparator": "、",
  "storefront.common.pieces": "件",
  "storefront.common.piecesShort": "件",
  "storefront.common.shipping": "配送",
  "storefront.common.status": "状态",
  "storefront.common.subtotal": "小计",
  "storefront.common.total": "总计",
  "storefront.common.unitEach": "每件",
  "storefront.common.vat": "增值税",
  "storefront.cart.badge": "客户购物车",
  "storefront.cart.checkoutLabel": "前往结账",
  "storefront.cart.clear": "清空购物车",
  "storefront.cart.clearConfirm": "确定清空购物车中的所有商品吗？",
  "storefront.cart.blockedDescription":
    "商品行会继续保留在购物车中。请查看每个商品的状态；超过库存或低于起订量时可以手动调整数量，不会丢失选择。",
  "storefront.cart.blockedLoginDescription":
    "商品行会继续保留在购物车中。请登录或申请专业客户权限查看价格，也可以移除不可用商品。",
  "storefront.cart.blockedAccountDescription":
    "已识别当前账号。请补全或启用客户资料后刷新购物车，即可查看价格和结账。",
  "storefront.cart.blockedTitle": "部分商品需要处理",
  "storefront.cart.continueShort": "继续",
  "storefront.cart.detailsError":
    "部分购物车详情未能更新。如果合计金额不一致，请刷新页面。",
  "storefront.cart.emptyDescription": "从目录添加商品后即可准备结账。",
  "storefront.cart.emptyTitle": "购物车为空",
  "storefront.cart.goToCatalog": "前往目录",
  "storefront.cart.increaseAria": "增加 {sku} 的数量",
  "storefront.cart.increaseTitle": "增加数量",
  "storefront.cart.itemCountMany": "{count} 件",
  "storefront.cart.itemCountOne": "1 件",
  "storefront.cart.lineCountMany": "{count} 个商品项",
  "storefront.cart.lineCountOne": "1 个商品项",
  "storefront.cart.loadingDescription": "正在读取当前账号的购物车。",
  "storefront.cart.loadingProductsDescription":
    "正在获取已保存商品的可用库存、起订量和价格。",
  "storefront.cart.loadingProductsTitle": "正在加载商品",
  "storefront.cart.loadingTitle": "正在加载购物车",
  "storefront.cart.localReadyDescription":
    "购物车绑定当前登录账号；确认下单时会重新检查库存和数量。",
  "storefront.cart.localReadyShort": "修改会同步到当前账号。",
  "storefront.cart.localReadyTitle": "账号购物车已可用于结账",
  "storefront.cart.loginRequiredTitle": "登录后使用购物车",
  "storefront.cart.loginRequiredDescription":
    "购物车只对登录账号开放。请先登录，再查看、添加或结算当前账号的商品。",
  "storefront.cart.minimumTitle": "最低起订量 MOQ {minimum}",
  "storefront.cart.moqBadge": "MOQ {moq}",
  "storefront.cart.priceEach": "{price} / 件",
  "storefront.cart.quantityAria": "{sku} 的数量",
  "storefront.cart.removeLineAria": "移除 {sku} 这一行",
  "storefront.cart.removeLineTitle": "从购物车移除此行",
  "storefront.cart.removeUnavailable": "移除不可用商品",
  "storefront.cart.skuLabel": "SKU {sku}",
  "storefront.cart.snapshotRefreshing": "更新中",
  "storefront.cart.rejectedGenericDescription":
    "该商品行仍保存在购物车中，但需要处理后才能结账。",
  "storefront.cart.rejectedGenericLabel": "待确认",
  "storefront.cart.rejectedLoginDescription":
    "商品已保存在购物车中。登录或申请专业客户权限后可以查看价格并继续。",
  "storefront.cart.rejectedLoginLabel": "专业客户价格受保护",
  "storefront.cart.rejectedAccountSyncDescription":
    "已识别登录会话，但账号资料暂未同步完成。请刷新页面，或联系管理员检查账号管理。",
  "storefront.cart.rejectedAccountSyncLabel": "账号资料待同步",
  "storefront.cart.rejectedCustomerProfileDescription":
    "已识别当前账号，但客户档案仍在关联或待补全。请打开个人中心刷新资料，或联系管理员。",
  "storefront.cart.rejectedCustomerProfileLabel": "客户档案待关联",
  "storefront.cart.rejectedCustomerAssignmentDescription":
    "已识别当前账号，但客户价目表还未启用。请管理员在账号管理中激活该客户。",
  "storefront.cart.rejectedCustomerAssignmentLabel": "客户待启用",
  "storefront.cart.rejectedCustomerSuspendedDescription":
    "已识别当前账号，但客户档案已暂停。请联系管理员恢复后再继续。",
  "storefront.cart.rejectedCustomerSuspendedLabel": "客户账号已暂停",
  "storefront.cart.rejectedWholesaleRequiredDescription":
    "已识别当前账号，但专业客户价目表尚未启用。",
  "storefront.cart.rejectedWholesaleRequiredLabel": "专业价待启用",
  "storefront.cart.rejectedLoadingDescription":
    "正在获取该商品行的名称、图片和最新可用状态。",
  "storefront.cart.rejectedLoadingLabel": "商品资料加载中",
  "storefront.cart.rejectedLoadingName": "商品资料加载中",
  "storefront.cart.rejectedNotFoundDescription":
    "该 SKU 当前不在公开目录中。",
  "storefront.cart.rejectedNotFoundLabel": "未找到 SKU",
  "storefront.cart.rejectedPriceDescription":
    "该商品行暂时没有可用价格。请移除或等待价目表更新后重试。",
  "storefront.cart.rejectedPriceLabel": "价格暂不可用",
  "storefront.cart.rejectedBelowMoqDescription":
    "当前数量低于起订量 {moq}。请手动增加数量后恢复购买。",
  "storefront.cart.rejectedBelowMoqLabel": "低于起订量",
  "storefront.cart.rejectedOverStockDescription":
    "当前可用库存 {stock}。请手动将数量减少到 {stock} 或以下后恢复购买。",
  "storefront.cart.rejectedOverStockLabel": "超过库存",
  "storefront.cart.rejectedUnavailableDescription":
    "该商品当前因库存或起订量限制无法购买。",
  "storefront.cart.rejectedUnavailableLabel": "当前不可购买",
  "storefront.cart.rows": "商品项",
  "storefront.cart.stockBadge": "库存 {stock}",
  "storefront.cart.summaryLoading": "正在加载当前账号的购物车...",
  "storefront.cart.summaryNote":
    "购物车不会锁定库存；库存和数量只会在确认下单时重新检查并锁定。",
  "storefront.cart.summaryNoteBlocked":
    "购物车不会锁定库存。部分商品需要登录、恢复库存或手动调整数量后才能结账；合计金额只包含当前可购买的商品项。",
  "storefront.cart.summaryNoteReviewCheckout":
    "可以先进入结账页查看和处理原因；提交订单前仍会校验登录、客户资料、价格、库存和 MOQ。",
  "storefront.cart.summaryNoteSynced":
    "购物车不会锁定库存；确认下单成功后才会锁定商品。",
  "storefront.cart.summaryTitle": "订单摘要",
  "storefront.cart.title": "确认商品与数量",
  "storefront.assistedOrder.catalogBanner": "代客户下单",
  "storefront.assistedOrder.catalogBannerGeneric":
    "代客户下单：已按所选客户价格显示",
  "storefront.cart.decreaseAria": "减少 {sku} 的数量",
  "storefront.cart.decreaseTitle": "减少数量",
  "storefront.cart.stockLimitTitle": "已达到可用库存上限",
  "storefront.cart.loginForPrices": "登录",
  "storefront.cart.priceLoginDescription":
    "请先登录或申请专业客户权限，再添加商品并查看对应价格。",
  "storefront.cart.priceLoginTitle": "登录后查看专业客户价格",
  "storefront.cart.requestProfessionalAccess": "申请权限",
  "storefront.cart.unresolvedDescription": "请刷新目录，或重新添加当前可用商品。",
  "storefront.cart.unresolvedTitle": "购物车中的商品当前不可用",
  "storefront.checkout.badge": "客户结账",
  "storefront.checkout.companyLinkedDescription":
    "{name} 将作为 /api/orders 的税务资料使用。",
  "storefront.checkout.companyLinkedTitle": "客户已关联",
  "storefront.checkout.companyMissingDescription":
    "当前会话没有关联客户。请先在客户管理中创建或补全客户资料，再进行结账。",
  "storefront.checkout.companyMissingTitle": "缺少客户资料",
  "storefront.checkout.confirm.single":
    "我确认税务资料、客户账号配送地址、含税价格、库存和 MOQ 均已核对。",
  "storefront.checkout.confirm.address": "我确认配送地址和首选配送时段已更新。",
  "storefront.checkout.confirm.invoice":
    "我确认增值税号、税号、PEC 和收件代码可用于电子发票。",
  "storefront.checkout.confirm.stockPolicy":
    "我接受库存、起订量和发货时间以结账页显示的仓库状态为准。",
  "storefront.checkout.confirmTitle": "提交前确认",
  "storefront.checkout.description":
    "提交前核对客户、商品、配送和付款。",
  "storefront.checkout.disabledCompanyReason":
    "结账已禁用：请将 Supabase 用户关联到客户资料。",
  "storefront.checkout.accountVerified": "账户已验证",
  "storefront.checkout.backToCart": "返回购物车",
  "storefront.checkout.billingAddress": "账单地址",
  "storefront.checkout.catalogLoadError": "客户价目表加载失败，请刷新后重试。",
  "storefront.checkout.completeProfile": "补全资料",
  "storefront.checkout.customerNotReady": "客户暂不能下单",
  "storefront.checkout.customerNotReadyDescription":
    "所选客户当前不满足下单条件，请检查客户状态、类型、归属和资料完整度。",
  "storefront.checkout.customerBlocker.assignment":
    "该客户必须先分配到价目表后才能下单。",
  "storefront.checkout.customerBlocker.profile":
    "请先补全这些客户资料：{fields}。",
  "storefront.checkout.customerBlocker.status":
    "该客户必须处于活跃/已批准状态后才能下单。",
  "storefront.checkout.customerBlocker.type":
    "代客户下单只支持已启用的批发客户。",
  "storefront.checkout.customerContextPendingDescription":
    "请先选择或完善客户资料，再计算商品价格、库存和 MOQ 后提交。SKU：{skus}。",
  "storefront.checkout.customerContextPendingTitle": "客户资料待完善",
  "storefront.checkout.delegated.description":
    "选择客户后，价格、校验和订单都会使用该客户的等级和资料。",
  "storefront.checkout.delegated.missingDescription":
    "请选择客户，以计算客户价并创建订单。",
  "storefront.checkout.delegated.missingTitle": "请选择客户",
  "storefront.checkout.delegated.placeholder": "选择客户",
  "storefront.checkout.delegated.select": "选择客户",
  "storefront.checkout.delegated.title": "代客户下单",
  "storefront.checkout.deliveryAddressMissing": "请先在客户资料中补全配送地址。",
  "storefront.checkout.fixCart": "返回购物车修正",
  "storefront.checkout.formInvalid": "请补全客户配送地址并勾选最终确认后再提交订单。",
  "storefront.checkout.formInvalidTitle": "结账资料不完整",
  "storefront.checkout.itemPendingAccount": "登录或关联客户后计算价格、库存和 MOQ。",
  "storefront.checkout.itemPendingCustomer": "选择客户后计算价格、库存和 MOQ。",
  "storefront.checkout.itemPendingCustomerContext":
    "选择或完善客户资料后再计算价格、库存和 MOQ。",
  "storefront.checkout.itemUnavailable": "该商品项当前无法用于结账。",
  "storefront.checkout.itemsNeedReview": "商品项需要处理",
  "storefront.checkout.itemColumn.product": "商品",
  "storefront.checkout.issue.duplicate": "购物车中有重复 SKU。",
  "storefront.checkout.issue.moq": "数量低于起订量 {moq}。",
  "storefront.checkout.issue.outOfStock": "商品当前缺货。",
  "storefront.checkout.issue.priceMissing": "该 SKU 暂无有效客户价。",
  "storefront.checkout.issue.profileIncomplete": "客户资料缺少：{fields}。",
  "storefront.checkout.issue.profileMissing": "客户资料不可用。",
  "storefront.checkout.issue.stockLimit": "当前仅有 {stock} 件可售。",
  "storefront.checkout.issue.unavailable": "该 SKU 当前不在可售目录中。",
  "storefront.checkout.loadingItemsTitle": "正在加载商品明细",
  "storefront.checkout.loadingTargetPrices": "正在加载购物车商品的客户价格。",
  "storefront.checkout.preview.errorTitle": "订单校验失败",
  "storefront.checkout.preview.loading": "正在校验价格、库存和 MOQ。",
  "storefront.checkout.shippingFixed":
    "由 PartsPro 仓库统一安排物流；可填写期望配送时段或配送备注。",
  "storefront.checkout.preview.title": "订单校验",
  "storefront.checkout.profileMissing": "客户资料待补全",
  "storefront.checkout.profileMissingAll": "客户资料",
  "storefront.checkout.required": "必填字段。",
  "storefront.checkout.savedShippingAddress": "已保存配送地址",
  "storefront.checkout.section.customer": "客户与开票",
  "storefront.checkout.section.items": "商品明细",
  "storefront.checkout.summary.needsCustomer": "选择客户后计算客户价、库存和 MOQ。",
  "storefront.checkout.summary.note":
    "价格已含税，仅另计运费。",
  "storefront.checkout.unresolvedItems": "部分商品项当前不可用。",
  "storefront.checkout.field.codiceDestinatario": "收件代码",
  "storefront.checkout.field.codiceFiscale": "税号",
  "storefront.checkout.field.companyName": "公司名称",
  "storefront.checkout.field.deliveryWindow": "首选配送时段",
  "storefront.checkout.field.deliveryWindowPlaceholder":
    "例如上午、下午、预约自提",
  "storefront.checkout.field.electronicInvoice": "PEC / SDI",
  "storefront.checkout.field.notes": "订单备注",
  "storefront.checkout.field.notesPlaceholder":
    "例如只上午配送、内部参考号...",
  "storefront.checkout.field.partitaIva": "增值税号",
  "storefront.checkout.field.pec": "PEC",
  "storefront.checkout.field.purchaseOrderNumber": "内部参考 / PO",
  "storefront.checkout.field.purchaseOrderPlaceholder": "例如 PO-2026-0524",
  "storefront.checkout.field.shippingCity": "城市",
  "storefront.checkout.field.shippingProvince": "省份",
  "storefront.checkout.field.shippingStreet": "街道",
  "storefront.checkout.field.shippingZip": "邮编",
  "storefront.checkout.group.company": "公司资料",
  "storefront.checkout.group.delivery": "配送",
  "storefront.checkout.group.invoice": "电子发票",
  "storefront.checkout.group.payment": "付款",
  "storefront.checkout.group.shippingAddress": "配送地址",
  "storefront.checkout.option.agreedTerms.description": "仅限已批准账期的客户。",
  "storefront.checkout.option.agreedTerms.label": "约定付款",
  "storefront.checkout.option.bankTransfer.description": "创建待付款订单。",
  "storefront.checkout.option.bankTransfer.label": "银行转账",
  "storefront.checkout.option.cash.description": "创建待收款订单，后台收款后再标记已支付。",
  "storefront.checkout.option.cash.label": "现金支付",
  "storefront.checkout.option.card.description": "结账页已不再使用该付款方式。",
  "storefront.checkout.option.card.label": "旧付款方式",
  "storefront.checkout.option.express.detail": "含税商品金额超过 250 EUR 免运费",
  "storefront.checkout.option.express.description":
    "GLS/BRT，可追踪，意大利工作日配送。",
  "storefront.checkout.option.express.label": "24/48 小时快递",
  "storefront.checkout.option.insured.detail": "米兰仓库优先处理",
  "storefront.checkout.option.insured.description":
    "为屏幕和高价值配件提供货物保险。",
  "storefront.checkout.option.insured.label": "保价快递",
  "storefront.checkout.option.pickup.detail": "可预约",
  "storefront.checkout.option.pickup.description":
    "仓库备货后由客户到米兰门店/仓库自提。",
  "storefront.checkout.option.pickup.label": "米兰自提",
  "storefront.checkout.runtime.disabled": "已禁用",
  "storefront.checkout.runtime.loginDescription":
    "Supabase 已配置：请登录以将结账与当前会话关联。",
  "storefront.checkout.runtime.loginReason": "结账已禁用：请先登录再确认订单。",
  "storefront.checkout.runtime.missingSupabaseDescription":
    "Supabase 尚未配置。接受真实订单前请添加 Supabase 环境变量。",
  "storefront.checkout.runtime.missingSupabaseReason":
    "结账已禁用：缺少 Supabase 配置。",
  "storefront.checkout.runtime.needsProfileDescription":
    "你可以查看价格并准备购物车，但下单前需要根据客户类型补全税务资料、联系人和地址。",
  "storefront.checkout.runtime.needsProfileReason":
    "结账已禁用：请在客户资料中补全税务、联系人和地址信息。",
  "storefront.checkout.runtime.needsProfileTitle": "客户资料待补全",
  "storefront.checkout.runtime.priceAccessDescription":
    "结账需要已启用的专业客户资料，并且每个 SKU 都需要有效价格。",
  "storefront.checkout.runtime.priceAccessReason": "结账已禁用：客户价目表尚未启用。",
  "storefront.checkout.runtime.priceAccessTitle": "价目表待启用",
  "storefront.checkout.runtime.readyBadge": "Supabase 已启用",
  "storefront.checkout.runtime.readyDescription":
    "Supabase 会话有效。订单将提交到现有 /api/orders API。",
  "storefront.checkout.runtime.readyTitle": "结账已就绪",
  "storefront.checkout.runtime.sessionErrorDescription":
    "配置似乎存在，但无法读取 Supabase 会话。",
  "storefront.checkout.runtime.sessionErrorReason":
    "结账已禁用：Supabase 会话未验证。请登录后重试，或检查 .env.local。",
  "storefront.checkout.submit.button.cartEmpty": "购物车为空",
  "storefront.checkout.submit.button.disabled": "结账已禁用",
  "storefront.checkout.submit.button.idle": "确认订单",
  "storefront.checkout.submit.button.loading": "正在提交订单...",
  "storefront.checkout.submit.button.loadingCart": "正在加载购物车",
  "storefront.checkout.submit.button.blocked": "无法提交",
  "storefront.checkout.submit.button.success": "订单已提交",
  "storefront.checkout.submit.cartEmptyReason":
    "购物车为空：请至少添加一个商品后再确认订单。",
  "storefront.checkout.submit.cartLoadingReason": "正在加载当前账号的购物车...",
  "storefront.checkout.submit.defaultDisabled": "当前无法结账。",
  "storefront.checkout.submit.formMissing": "未找到结账表单。请刷新页面后重试。",
  "storefront.checkout.submit.idleDisabled": "当前无法结账。",
  "storefront.checkout.submit.idleReady":
    "结账已就绪：通过 /api/orders 确认订单。",
  "storefront.checkout.submit.idleReadyFallback":
    "结账已就绪：将购物车中保存的行发送到 /api/orders。",
  "storefront.checkout.submit.invalidForm": "请补全必填字段并勾选确认项后再提交订单。",
  "storefront.checkout.submit.missingCustomer":
    "客户资料不可用：请先关联或补全客户，再确认订单。",
  "storefront.checkout.submit.orderAccepted": "订单 {id} 已成功创建。",
  "storefront.checkout.submit.orderIncomplete": "订单响应不完整。请检查 /api/orders。",
  "storefront.checkout.submit.orderRejected": "后台未接受该订单。",
  "storefront.checkout.submit.sendError": "提交时发生错误。",
  "storefront.checkout.submit.sending": "正在创建订单...",
  "storefront.checkout.submit.timeout": "订单提交超时。请检查网络后重试。",
  "storefront.checkout.submit.unresolvedItemsReason":
    "购物车中有商品当前不可用：请返回购物车移除后再确认订单。",
  "storefront.checkout.error.customerNotReady": "客户资料需要补全后才能下单。",
  "storefront.checkout.error.loginRequired": "请先登录再确认订单。",
  "storefront.checkout.error.priceAccess": "客户价目表尚未启用。",
  "storefront.checkout.error.priceChanged": "部分价格已变化。请刷新结账页后重试。",
  "storefront.checkout.error.skuUnavailable": "一个或多个商品当前不可用。",
  "storefront.checkout.error.stockInvalid": "一个或多个商品不满足库存、数量或 MOQ 规则。",
  "storefront.checkout.success.dialogDescription": "订单已登记成功，可在个人中心查看进度。",
  "storefront.checkout.success.dialogTitle": "订单已成功创建",
  "storefront.checkout.success.openOrders": "查看订单",
  "storefront.checkout.success.orderNumber": "订单号",
  "storefront.checkout.success.total": "订单总计",
  "storefront.checkout.unitPriceTaxIncluded": "含税单价",
  "storefront.checkout.title": "确认订单与税务资料",
  "storefront.customer.assignment.archived": "已归档",
  "storefront.customer.assignment.assigned": "已分配",
  "storefront.customer.assignment.convertedToEmployee": "已转为员工",
  "storefront.customer.assignment.needsReview": "待审核",
  "storefront.customer.level.bronze": "青铜",
  "storefront.customer.level.diamond": "钻石",
  "storefront.customer.level.emerald": "翡翠",
  "storefront.customer.level.gold": "黄金",
  "storefront.customer.level.king": "King",
  "storefront.customer.level.master": "Master",
  "storefront.customer.level.silver": "白银",
  "storefront.customer.status.approved": "已批准",
  "storefront.customer.status.pending": "待处理",
  "storefront.customer.status.rejected": "已拒绝",
  "storefront.customer.status.suspended": "已暂停",
  "storefront.customer.type.retail": "零售",
  "storefront.customer.type.wholesale": "批发",
  "storefront.product.backToCatalog": "返回目录",
  "storefront.product.card.accountReviewHint": "起订量 {moq} · 价目表审核",
  "storefront.product.card.accountReviewLabel": "账户审核中",
  "storefront.product.card.add": "添加",
  "storefront.product.card.addAria":
    "将 {name} 加入购物车。起订量 {moq}。",
  "storefront.product.card.added": "已添加",
  "storefront.product.card.addFailed": "重试",
  "storefront.product.card.basePrice": "原价",
  "storefront.product.card.extraModelsTitle": "另有 {count} 个兼容机型",
  "storefront.product.card.loginHint": "起订量 {moq} · 需要登录",
  "storefront.product.card.loginLabel": "登录查看价格",
  "storefront.product.card.priceLocked": "价目表",
  "storefront.product.card.priceMissing": "价格",
  "storefront.product.card.priceNeedsUpdate": "价目表待更新",
  "storefront.product.card.priceUnset": "价格未设置",
  "storefront.product.card.previewImageAria": "打开 {name} 图片预览",
  "storefront.product.card.profileHint": "起订量 {moq} · 请稍后重试",
  "storefront.product.card.profileLabel": "资料准备中",
  "storefront.product.card.reviewBadgeTitle": "账户审核中",
  "storefront.product.card.stockLevelTitle": "库存等级：{level}",
  "storefront.product.card.stockLine": "{level}",
  "storefront.product.card.suspendedHint": "起订量 {moq} · 联系支持",
  "storefront.product.card.suspendedLabel": "账户已暂停",
  "storefront.product.card.unavailable": "缺货",
  "storefront.product.card.unavailableAria": "{name} 当前不能加入购物车",
  "storefront.product.card.visiblePriceHint": "含税价 · 起订量 {moq}",
  "storefront.product.card.wholesaleHint": "起订量 {moq} · 客户资料审核",
  "storefront.product.card.wholesaleLabel": "价目表待启用",
  "storefront.product.detail.customerConditions": "客户条件",
  "storefront.product.detail.invoice": "发票",
  "storefront.product.detail.invoiceText": "PEC / 收件代码",
  "storefront.product.detail.lot": "批次",
  "storefront.product.detail.lotTracked": "可追踪",
  "storefront.product.detail.stockLevel": "库存等级",
  "storefront.product.detail.stockLevelText": "不显示具体数量",
  "storefront.product.purchase.add": "添加到购物车",
  "storefront.product.purchase.addAria": "将 {quantity} 件 {name} 加入购物车",
  "storefront.product.purchase.added": "已添加",
  "storefront.product.purchase.addFailed": "重试",
  "storefront.product.purchase.goCheckout": "前往结账",
  "storefront.product.purchase.orderNow": "立即下单",
  "storefront.product.purchase.orderNowAria": "立即下单 {quantity} 件 {name}",
  "storefront.product.purchase.unavailableTitle": "暂不可购买",
  "storefront.product.card.loginToAdd": "登录",
  "storefront.product.card.loginToAddAria": "登录后将 {name} 加入购物车。",
  "storefront.product.restock.aria": "{name} 补货后提醒我",
  "storefront.product.restock.detailDescription":
    "该 SKU 当前因库存或起订量不足暂不可买。保存提醒后，补货可用时再处理。",
  "storefront.product.restock.detailTitle": "补货提醒",
  "storefront.product.restock.loginRequired": "登录后可提醒补货",
  "storefront.product.restock.request": "提醒补货",
  "storefront.product.restock.retry": "重试",
  "storefront.product.restock.saved": "已提醒",
  "storefront.product.quantity.decrease": "减少",
  "storefront.product.quantity.decreaseAria": "减少 {name} 的数量",
  "storefront.product.quantity.inCart": "已在购物车",
  "storefront.product.quantity.inCartSummary":
    "购物车中已保存 {quantity} 件。",
  "storefront.product.quantity.inCartTitle": "购物车中有 {quantity} 件",
  "storefront.product.quantity.increase": "增加",
  "storefront.product.quantity.increaseAria": "增加 {name} 的数量",
  "storefront.product.quantity.overStock":
    "当前可用 {stock} 件，请减少数量后继续。",
  "storefront.product.quantity.overStockTitle":
    "数量超过库存：当前可用 {stock} 件。",
  "storefront.product.quantity.remove": "移除",
  "storefront.product.quantity.removeAria": "从购物车移除 {name}",
  "storefront.product.quantity.stockLimit": "库存上限",
  "storefront.product.detail.minimumOrder": "最低起订量",
  "storefront.product.detail.noPriceDescription":
    "会话已验证，但此 SKU 的价格尚未更新。",
  "storefront.product.detail.noPriceTitle": "价格未设置",
  "storefront.product.detail.packing": "包装",
  "storefront.product.detail.packingAntiStatic": "防静电",
  "storefront.product.detail.priceGate.login.actionLabel": "登录",
  "storefront.product.detail.priceGate.login.cardDescription":
    "登录客户账户后可解锁净价、报价和加入购物车。",
  "storefront.product.detail.priceGate.login.cardTitle": "价格受保护",
  "storefront.product.detail.priceGate.login.description":
    "登录后可查看价格、起订量、等级折扣和付款条件。",
  "storefront.product.detail.priceGate.login.title": "价格仅对已验证账户开放",
  "storefront.product.detail.priceGate.profile.actionLabel": "打开账户",
  "storefront.product.detail.priceGate.profile.cardDescription":
    "会话有效，但 PartsPro 客户资料尚未正确关联。",
  "storefront.product.detail.priceGate.profile.cardTitle": "资料准备中",
  "storefront.product.detail.priceGate.profile.description":
    "已检测到登录：我们正在准备显示价目表所需的客户资料。",
  "storefront.product.detail.priceGate.profile.title": "需要客户资料",
  "storefront.product.detail.priceGate.review.actionLabel": "打开账户",
  "storefront.product.detail.priceGate.review.cardDescription":
    "你的账户已启用并可查看价格。PartsPro 团队会继续完成客户资料审核。",
  "storefront.product.detail.priceGate.review.cardTitle": "审核中",
  "storefront.product.detail.priceGate.review.description":
    "账户审核中：在 PartsPro 完成客户资料审核期间，价格仍保持可见。",
  "storefront.product.detail.priceGate.review.title": "审核中",
  "storefront.product.detail.priceGate.suspended.cardDescription":
    "此账户的价目表暂时锁定。请联系 PartsPro 团队。",
  "storefront.product.detail.priceGate.suspended.cardTitle": "账户已暂停",
  "storefront.product.detail.priceGate.suspended.description":
    "已检测到登录，但暂停账户无法使用价目表。",
  "storefront.product.detail.priceGate.suspended.title": "价目表已暂停",
  "storefront.product.detail.priceGate.wholesale.actionLabel": "打开账户",
  "storefront.product.detail.priceGate.wholesale.cardDescription":
    "此账户尚未启用客户价目表。请完成资料审核。",
  "storefront.product.detail.priceGate.wholesale.cardTitle": "价目表待启用",
  "storefront.product.detail.priceGate.wholesale.description":
    "已检测到登录：此 SKU 需要已启用的客户资料。",
  "storefront.product.detail.priceGate.wholesale.title": "价格仅对已启用客户开放",
  "storefront.product.detail.priceVisibleOrderLockedDescription":
    "价格可查看，但购物车和结账需要已启用的专业客户资料。",
  "storefront.product.detail.priceVisibleOrderLockedTitle": "当前价目表不能下单",
  "storefront.product.detail.qc": "质检",
  "storefront.product.detail.qcText": "发货前测试",
  "storefront.product.detail.sessionCustomerVerified": "客户会话已验证",
  "storefront.product.detail.sessionPricePending":
    "账户已验证：此 SKU 的价格尚未更新。",
  "storefront.product.detail.sessionPriceReady":
    "此 SKU 的净价、起订量和客户条件已可用。",
  "storefront.product.detail.trackedDelivery": "意大利境内可追踪配送",
  "storefront.product.detail.logisticsEstimate": "物流预估",
  "storefront.header.openAccount": "打开个人中心",
  "storefront.header.openCart": "打开购物车",
  "storefront.header.openMenu": "打开菜单",
  "storefront.header.mobileMenuTitle": "PartsPro 菜单",
  "storefront.header.searchFull": "搜索 SKU、品牌、机型...",
  "storefront.header.searchSubmit": "搜索",
  "storefront.logo.tagline": "意大利专业客户手机配件",
  "storefront.home.brands.eyebrow": "品牌与机型",
  "storefront.home.brands.stats.brands": "管理品牌",
  "storefront.home.brands.stats.delivery": "意大利",
  "storefront.home.brands.stats.models": "已索引机型",
  "storefront.home.brands.stats.sku": "目录 SKU",
  "storefront.home.brands.title": "按兼容性快速导航",
  "storefront.home.categories.eyebrow": "目录",
  "storefront.home.categories.title": "维修店常用分类",
  "storefront.home.common.catalog": "目录",
  "storefront.home.common.openCatalog": "打开目录",
  "storefront.home.common.skuCount": "{count} SKU",
  "storefront.home.common.viewAll": "查看全部",
  "storefront.home.header.availableOnly": "仅看有货",
  "storefront.home.header.logoLabel": "返回 PartsPro 首页",
  "storefront.home.hero.badge": "意大利专业客户供货",
  "storefront.home.hero.browseCatalog": "浏览目录",
  "storefront.home.hero.catalogFallback": "专业客户目录",
  "storefront.home.hero.description":
    "PartsPro 将专业客户目录、本地库存、登录后专属价格、电子发票和可追踪 RMA 统一到一个面向意大利市场的采购流程中。",
  "storefront.home.hero.loginForPrices": "申请专业客户权限",
  "storefront.home.hero.stats.brands": "品牌与系列",
  "storefront.home.hero.stats.delivery": "意大利物流",
  "storefront.home.hero.stats.sku": "目录 SKU",
  "storefront.home.hero.title": "面向维修店和经销商的手机配件供货",
  "storefront.home.hero.visualText": "SKU、库存、起订量和兼容性信息都围绕高频补货采购设计。",
  "storefront.home.hero.visualTitle": "可操作目录，不是静态展示页",
  "storefront.home.notifications": "通知",
  "storefront.home.mobileMenuDescription": "移动菜单包含首页、目录和账户。",
  "storefront.home.mobileSearch": "搜索 SKU / 商品",
  "storefront.home.productCard.basePrice": "原价",
  "storefront.home.productCard.extraModels": "+{count} 个机型",
  "storefront.home.productCard.loginPrice": "登录后查看价格",
  "storefront.home.productCard.open": "查看",
  "storefront.home.productCard.openAria": "打开商品详情 {name}",
  "storefront.home.productCard.pendingHint": "审核中 · 起订量 {moq}",
  "storefront.home.productCard.pendingPrice": "审核",
  "storefront.home.productCard.priceHint": "起订量 {moq} · 需要登录",
  "storefront.home.productCard.priceVisibleHint": "含税价 · 起订量 {moq}",
  "storefront.home.productCard.profileHint": "起订量 {moq} · 请稍后重试",
  "storefront.home.productCard.profilePrice": "资料准备中",
  "storefront.home.productCard.stockLine": "{level}",
  "storefront.home.productCard.suspendedHint": "起订量 {moq} · 联系支持",
  "storefront.home.productCard.suspendedPrice": "账户已暂停",
  "storefront.home.productCard.wholesaleHint": "起订量 {moq} · 客户资料审核",
  "storefront.home.productCard.wholesalePrice": "价目表待启用",
  "storefront.home.products.action": "当前有货",
  "storefront.home.products.empty":
    "公共目录暂时不可用。你仍可以打开目录，或登录后查看完整价目表。",
  "storefront.home.products.eyebrow": "真实库存",
  "storefront.home.products.title": "可立即查看的现货配件",
  "storefront.home.rightRail.account.subtitle": "资料、订单和 RMA",
  "storefront.home.rightRail.account.title": "个人中心",
  "storefront.home.rightRail.cart.empty": "添加商品后即可准备结账和订单。",
  "storefront.home.rightRail.cart.manyLines": "{count} 行",
  "storefront.home.rightRail.cart.oneLine": "1 行",
  "storefront.home.rightRail.cart.quantity": "{count} 件",
  "storefront.home.rightRail.cart.subtotal": "小计",
  "storefront.home.rightRail.cart.title": "购物车预览",
  "storefront.home.rightRail.invoice.eInvoice": "支持 PEC / SDI 电子发票",
  "storefront.home.rightRail.invoice.payment": "审核后显示净价",
  "storefront.home.rightRail.invoice.title": "专业客户单据",
  "storefront.home.rightRail.invoice.trace": "订单中追踪 SKU 与批次",
  "storefront.home.searchPlaceholder": "搜索商品、SKU、品牌、机型...",
  "storefront.home.sidebar.subtitle": "品牌与机型",
  "storefront.home.sidebar.title": "快速目录",
  "storefront.home.trust.delivery.title": "意大利物流",
  "storefront.home.trust.delivery.value": "有货配件 24/48 小时配送",
  "storefront.home.trust.invoice.title": "企业发票",
  "storefront.home.trust.invoice.value": "PEC、SDI 和公司开票资料",
  "storefront.home.trust.localStock.title": "本地库存",
  "storefront.home.trust.localStock.value": "按 SKU 和机型更新可用库存",
  "storefront.home.trust.quality.title": "质量已验证",
  "storefront.home.trust.quality.value": "等级、批次和发货前质检",
  "storefront.home.trust.support.title": "可追踪 RMA",
  "storefront.home.trust.support.value": "为维修店提供售后支持",
  "storefront.home.workflow.account.text": "登录或申请审核后查看价格与采购条件。",
  "storefront.home.workflow.account.title": "完善个人中心资料",
  "storefront.home.workflow.action": "打开账户",
  "storefront.home.workflow.afterSales.text": "在账户中追踪 RMA、发票和历史记录。",
  "storefront.home.workflow.afterSales.title": "管理 RMA 与单据",
  "storefront.home.workflow.catalog.text": "按品牌、机型、分类和真实库存筛选。",
  "storefront.home.workflow.catalog.title": "找到配件",
  "storefront.home.workflow.eyebrow": "专业客户流程",
  "storefront.home.workflow.order.text": "设置起订量，确认增值税与配送，然后提交订单。",
  "storefront.home.workflow.order.title": "准备订单",
  "storefront.home.workflow.title": "从搜索到售后，减少手动沟通",
  "storefront.login.action": "登录",
  "storefront.login.badge": "客户登录",
  "storefront.login.createAccount": "创建账户",
  "storefront.login.creatingAccount": "正在创建账户...",
  "storefront.login.disabledConfig":
    "Supabase publishable key 尚未配置，因此按钮保持禁用。",
  "storefront.login.divider": "或者",
  "storefront.login.displayName": "姓名",
  "storefront.login.displayNamePlaceholder": "客户姓名",
  "storefront.login.email": "邮箱",
  "storefront.login.google": "继续使用 Google",
  "storefront.login.newCustomer.description":
    "可以先创建基础客户账户，也可以申请成为专业客户。",
  "storefront.login.newCustomer.professional": "申请专业客户权限",
  "storefront.login.newCustomer.title": "新客户",
  "storefront.login.password": "密码",
  "storefront.login.passwordLogin": "使用密码登录",
  "storefront.login.signingIn": "正在登录...",
  "storefront.login.runtime.missingBody":
    "Supabase 已连接到项目，但 .env.local 中仍缺少 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。",
  "storefront.login.runtime.missingTitle": "缺少 Supabase 配置",
  "storefront.login.runtime.readyBody":
    "账号密码会通过 Supabase Auth 验证。客户登录后进入个人中心，员工登录后进入后台面板。",
  "storefront.login.runtime.readyTitle": "Supabase 登录已启用",
  "storefront.login.title": "登录 PartsPro",
  "storefront.login.verify.body": "请输入发送到邮箱的 6 位数字验证码。",
  "storefront.login.verify.code": "验证码",
  "storefront.login.verify.resend": "重新发送验证码",
  "storefront.login.verify.resendPending": "正在发送验证码...",
  "storefront.login.verify.resendTo": "重新发送到",
  "storefront.login.verify.submit": "验证并登录",
  "storefront.login.verify.submitPending": "正在验证验证码...",
  "storefront.login.verify.title": "验证邮箱",
  "storefront.login.wechat": "继续使用 WeChat",
  "storefront.professional.after.account.body":
    "之后会用同一个客户资料进入登录、购物车、结账和 RMA 流程。",
  "storefront.professional.after.account.title": "账户权限",
  "storefront.professional.after.prices.body":
    "审核通过后即可查看价目表、起订量和专属采购条件。",
  "storefront.professional.after.prices.title": "专业客户价格",
  "storefront.professional.after.review.body":
    "我们会先核对公司、联系人和税务资料，再启用客户资料。",
  "storefront.professional.after.review.title": "资料审核",
  "storefront.professional.after.title": "提交后",
  "storefront.professional.badge": "专业客户权限申请",
  "storefront.professional.description":
    "提交公司资料后，可申请启用专业客户价格、专属条件和支持电子发票的结账流程。",
  "storefront.professional.field.address": "地址",
  "storefront.professional.field.city": "城市",
  "storefront.professional.field.codiceDestinatario": "收件代码",
  "storefront.professional.field.codiceFiscale": "税号",
  "storefront.professional.field.companyName": "公司名称",
  "storefront.professional.field.contactName": "联系人",
  "storefront.professional.field.email": "邮箱",
  "storefront.professional.field.notes": "备注",
  "storefront.professional.field.notesPlaceholder":
    "可填写关注分类、平均采购量或业务需求...",
  "storefront.professional.field.partitaIva": "增值税号",
  "storefront.professional.field.pec": "PEC",
  "storefront.professional.field.phone": "电话",
  "storefront.professional.field.province": "省份",
  "storefront.professional.field.website": "网站",
  "storefront.professional.form.title": "公司资料",
  "storefront.professional.login": "已有账户",
  "storefront.professional.privacy": "同意将资料用于本次申请审核。",
  "storefront.professional.status.changed": "修改已保存，可再次提交申请。",
  "storefront.professional.status.consentRequired": "请先勾选条件与隐私确认。",
  "storefront.professional.status.error": "提交申请时发生错误。",
  "storefront.professional.status.idle": "填写公司资料后即可申请专业客户权限。",
  "storefront.professional.status.loading": "正在提交申请...",
  "storefront.professional.status.rejected": "申请未被接受。请检查字段后重试。",
  "storefront.professional.status.success":
    "申请已提交。PartsPro 团队会审核资料，并通过邮箱联系你。",
  "storefront.professional.submit": "提交申请",
  "storefront.professional.submit.loading": "正在提交...",
  "storefront.professional.terms": "确认所填资料真实准确，并接受权限申请条件。",
  "storefront.professional.title": "申请专业客户权限",
  "storefront.rma.backToAccount": "返回个人中心",
  "storefront.rma.badge": "可追踪 RMA",
  "storefront.rma.description":
    "将申请关联到订单，描述问题，并准备照片或视频，以加快检测流程。",
  "storefront.rma.form.description": "问题描述",
  "storefront.rma.form.descriptionPlaceholder":
    "填写已做测试、故障表现、设备型号和配件状态...",
  "storefront.rma.form.evidence": "上传故障照片或视频",
  "storefront.rma.form.evidenceEmpty": "未选择文件。API 只接收 RMA 数据。",
  "storefront.rma.form.evidenceHint":
    "支持 JPG、PNG 或 MP4，最大 20MB。文件仅作为本地预览。",
  "storefront.rma.form.evidenceSelected": "已选择 {count} 个文件，仅作为本地预览。",
  "storefront.rma.form.order": "订单",
  "storefront.rma.form.orderLine": "订单行",
  "storefront.rma.form.orderLinePlaceholder": "订单历史中的订单行 ID",
  "storefront.rma.form.orderPlaceholder": "真实订单号",
  "storefront.rma.form.quantity": "数量",
  "storefront.rma.form.reason": "RMA 原因",
  "storefront.rma.form.title": "新建 RMA 申请",
  "storefront.rma.recent.empty": "暂无 RMA 申请。",
  "storefront.rma.recent.title": "最近申请",
  "storefront.rma.result.number": "RMA 编号",
  "storefront.rma.result.order": "订单",
  "storefront.rma.result.status": "状态",
  "storefront.rma.rules.lab.body": "团队会检测配件，并在个人中心更新状态。",
  "storefront.rma.rules.lab.title": "实验室检测",
  "storefront.rma.rules.noteBody": "安装损坏或进液损坏可能不在自动更换范围内。",
  "storefront.rma.rules.noteTitle": "提示",
  "storefront.rma.rules.order.body": "没有订单号的申请无法自动验证。",
  "storefront.rma.rules.order.title": "始终关联订单",
  "storefront.rma.rules.photo.body": "寄回前请上传故障和质检封签照片。",
  "storefront.rma.rules.photo.title": "退回前提供照片",
  "storefront.rma.rules.title": "RMA 规则",
  "storefront.rma.submit.button": "提交 RMA 申请",
  "storefront.rma.submit.buttonLoading": "正在提交 RMA...",
  "storefront.rma.submit.changed": "本地修改已保存。可再次提交以创建新的 RMA。",
  "storefront.rma.submit.error": "提交 RMA 时发生错误。",
  "storefront.rma.submit.idle": "填写资料后提交 RMA 流程。",
  "storefront.rma.submit.invalidQuantity": "请输入有效数量，至少 1 件。",
  "storefront.rma.submit.loading": "正在提交 RMA 申请...",
  "storefront.rma.submit.success": "申请 {id} 已成功登记。",
  "storefront.rma.title": "提交退货或更换申请",
};

export const storefrontDictionaries = {
  "it-IT": storefrontItIT,
  "zh-CN": storefrontZhCN,
};
