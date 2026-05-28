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
  cancelled: "cancelled",
  delivered: "delivered",
  draft: "draft",
  paid: "paid",
  pending_payment: "pendingPayment",
  picking: "picking",
  shipped: "shipped",
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
  "storefront.data.orderStatus.cancelled": "Annullato",
  "storefront.data.orderStatus.delivered": "Consegnato",
  "storefront.data.orderStatus.draft": "Bozza",
  "storefront.data.orderStatus.paid": "Pagato",
  "storefront.data.orderStatus.pendingPayment": "Da pagare",
  "storefront.data.orderStatus.picking": "In preparazione",
  "storefront.data.orderStatus.shipped": "Spedito",
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
  "storefront.catalog.allProducts": "Tutto il catalogo",
  "storefront.catalog.availableOnly": "Solo disponibili",
  "storefront.catalog.availableOnlyAria": "Filtra solo prodotti disponibili",
  "storefront.account.menuLabel": "Area account",
  "storefront.account.openAccount": "Centro personale",
  "storefront.account.openAdmin": "Pannello admin",
  "storefront.account.signOut": "Esci",
  "storefront.account.staffRole": "Accesso staff",
  "storefront.common.b2bAccount": "Centro personale",
  "storefront.common.checkout": "Checkout",
  "storefront.common.continueShopping": "Continua acquisti",
  "storefront.common.free": "Gratis",
  "storefront.common.pieces": "pezzi",
  "storefront.common.piecesShort": "pz",
  "storefront.common.shipping": "Spedizione",
  "storefront.common.subtotal": "Subtotale",
  "storefront.common.total": "Totale",
  "storefront.common.unitEach": "cad.",
  "storefront.common.vat": "IVA",
  "storefront.cart.badge": "Carrello clienti",
  "storefront.cart.checkoutLabel": "Procedi al checkout",
  "storefront.cart.clear": "Svuota carrello",
  "storefront.cart.clearConfirm": "Svuotare tutti gli articoli dal carrello?",
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
  "storefront.cart.lineCountMany": "{count} righe",
  "storefront.cart.lineCountOne": "1 riga",
  "storefront.cart.loadingDescription":
    "Lettura della selezione salvata in questo browser.",
  "storefront.cart.loadingProductsDescription":
    "Recupero disponibilità, MOQ e prezzi per gli articoli salvati.",
  "storefront.cart.loadingProductsTitle": "Caricamento prodotti",
  "storefront.cart.loadingTitle": "Caricamento carrello",
  "storefront.cart.localReadyDescription":
    "Quantità e rimozioni aggiornano la selezione salvata nel browser e saranno usate dal payload checkout. Il salvataggio backend avviene solo alla conferma ordine.",
  "storefront.cart.localReadyShort": "Le modifiche salvano gli articoli nel browser.",
  "storefront.cart.localReadyTitle": "Carrello locale pronto per checkout",
  "storefront.cart.minimumTitle": "Quantità minima MOQ {minimum}",
  "storefront.cart.priceEach": "{price} cad.",
  "storefront.cart.quantityAria": "Quantità per {sku}",
  "storefront.cart.removeLineAria": "Rimuovi riga {sku}",
  "storefront.cart.removeLineTitle": "Rimuovi questa riga dal carrello",
  "storefront.cart.removeUnavailable": "Rimuovi non disponibili",
  "storefront.cart.rows": "Righe",
  "storefront.cart.summaryLoading": "Caricamento carrello salvato nel browser...",
  "storefront.cart.summaryNote":
    "Totali calcolati dalla selezione salvata nel browser. Il checkout invia questi articoli all'endpoint esistente /api/orders.",
  "storefront.cart.summaryNoteSynced":
    "Totali aggiornati dalla selezione salvata nel browser. Il checkout invierà queste righe all'endpoint /api/orders.",
  "storefront.cart.summaryTitle": "Riepilogo ordine",
  "storefront.cart.title": "Conferma prodotti e quantità",
  "storefront.cart.decreaseAria": "Riduci quantità per {sku}",
  "storefront.cart.decreaseTitle": "Riduci quantità",
  "storefront.cart.stockLimitTitle": "Stock disponibile esaurito",
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
  "storefront.checkout.confirm.address":
    "Confermo che l'indirizzo di spedizione e la fascia consegna sono aggiornati.",
  "storefront.checkout.confirm.invoice":
    "Confermo che Partita IVA, codice fiscale, PEC e codice destinatario sono corretti per la fattura elettronica.",
  "storefront.checkout.confirm.stockPolicy":
    "Accetto che disponibilità, MOQ e tempi di evasione seguano lo stato magazzino mostrato nel checkout.",
  "storefront.checkout.confirmTitle": "Conferme prima dell'invio",
  "storefront.checkout.description":
    "I dati vengono preparati come snapshot ordine per fattura, spedizione e gestione RMA. L'invio usa l'endpoint esistente /api/orders con le righe salvate nel carrello locale.",
  "storefront.checkout.disabledCompanyReason":
    "Checkout disabilitato: collega un profilo cliente all'utente Supabase.",
  "storefront.checkout.field.codiceDestinatario": "Codice destinatario",
  "storefront.checkout.field.codiceFiscale": "Codice fiscale",
  "storefront.checkout.field.companyName": "Ragione sociale",
  "storefront.checkout.field.deliveryWindow": "Fascia consegna preferita",
  "storefront.checkout.field.deliveryWindowPlaceholder":
    "Es. mattina, pomeriggio, ritiro su appuntamento",
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
  "storefront.checkout.option.card.description": "Metodo registrato nel gestionale.",
  "storefront.checkout.option.card.label": "Carta aziendale",
  "storefront.checkout.option.express.detail": "Gratis sopra 250 EUR imponibile",
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
  "storefront.checkout.submit.button.success": "Ordine inviato",
  "storefront.checkout.submit.cartEmptyReason":
    "Il carrello è vuoto: aggiungi almeno un prodotto prima di confermare l'ordine.",
  "storefront.checkout.submit.cartLoadingReason":
    "Caricamento carrello salvato nel browser...",
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
  "storefront.checkout.submit.unresolvedItemsReason":
    "Alcuni articoli del carrello non sono più disponibili: torna al carrello e rimuovili prima di confermare l'ordine.",
  "storefront.checkout.success.openOrders": "Vai agli ordini",
  "storefront.checkout.success.total": "Totale ordine",
  "storefront.checkout.title": "Conferma ordine e dati fiscali",
  "storefront.product.backToCatalog": "Torna al catalogo",
  "storefront.product.card.accountReviewHint": "MOQ {moq} · verifica listino",
  "storefront.product.card.accountReviewLabel": "Account in revisione",
  "storefront.product.card.add": "Aggiungi",
  "storefront.product.card.addAria":
    "Aggiungi {name} al carrello. MOQ {moq}, stock {stock} pezzi.",
  "storefront.product.card.added": "Aggiunto",
  "storefront.product.card.addFailed": "Riprova",
  "storefront.product.card.extraModelsTitle":
    "{count} modelli compatibili aggiuntivi",
  "storefront.product.card.loginHint": "MOQ {moq} · login richiesto",
  "storefront.product.card.loginLabel": "Accedi per prezzo",
  "storefront.product.card.priceNeedsUpdate": "Listino da aggiornare",
  "storefront.product.card.priceUnset": "Prezzo non impostato",
  "storefront.product.card.previewImageAria": "Apri anteprima immagine {name}",
  "storefront.product.card.profileHint": "MOQ {moq} · riprova tra poco",
  "storefront.product.card.profileLabel": "Profilo in preparazione",
  "storefront.product.card.reviewBadgeTitle": "Account in revisione",
  "storefront.product.card.stockLine": "{status} · {count} pz",
  "storefront.product.card.suspendedHint": "MOQ {moq} · contatta supporto",
  "storefront.product.card.suspendedLabel": "Account sospeso",
  "storefront.product.card.unavailable": "Esaurito",
  "storefront.product.card.unavailableAria":
    "{name} non disponibile per il carrello",
  "storefront.product.card.visiblePriceHint": "IVA escl. · MOQ {moq}",
  "storefront.product.card.wholesaleHint": "MOQ {moq} · verifica cliente",
  "storefront.product.card.wholesaleLabel": "Listino da abilitare",
  "storefront.product.detail.customerConditions": "Condizioni cliente",
  "storefront.product.detail.invoice": "Fattura",
  "storefront.product.detail.invoiceText": "PEC / Codice Destinatario",
  "storefront.product.detail.lot": "Lotto",
  "storefront.product.detail.lotTracked": "Tracciato",
  "storefront.product.purchase.add": "Aggiungi al carrello",
  "storefront.product.purchase.addAria":
    "Aggiungi {quantity} pezzi di {name} al carrello",
  "storefront.product.purchase.added": "Aggiunto",
  "storefront.product.purchase.addFailed": "Riprova",
  "storefront.product.purchase.orderNow": "Ordina ora",
  "storefront.product.purchase.orderNowAria":
    "Ordina ora {quantity} pezzi di {name}",
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
  "storefront.logo.tagline": "Ricambi smartphone B2B Italia",
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
  "storefront.home.hero.badge": "Forniture B2B Italia",
  "storefront.home.hero.browseCatalog": "Sfoglia catalogo",
  "storefront.home.hero.catalogFallback": "Catalogo B2B",
  "storefront.home.hero.description":
    "PartsPro unisce catalogo B2B, disponibilità locale, prezzi riservati, fatturazione elettronica e RMA tracciabile in un unico flusso per il mercato italiano.",
  "storefront.home.hero.loginForPrices": "Accedi ai prezzi",
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
  "storefront.home.productCard.extraModels": "+{count} modelli",
  "storefront.home.productCard.loginPrice": "Prezzo dopo login",
  "storefront.home.productCard.open": "Apri",
  "storefront.home.productCard.openAria": "Apri scheda prodotto {name}",
  "storefront.home.productCard.pendingHint": "In revisione · MOQ {moq}",
  "storefront.home.productCard.pendingPrice": "In revisione",
  "storefront.home.productCard.priceHint": "MOQ {moq} · login richiesto",
  "storefront.home.productCard.priceVisibleHint": "IVA escl. · MOQ {moq}",
  "storefront.home.productCard.profileHint": "MOQ {moq} · riprova tra poco",
  "storefront.home.productCard.profilePrice": "Profilo in preparazione",
  "storefront.home.productCard.stockLine": "{status} · {count} pz",
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
  "storefront.home.rightRail.invoice.title": "Documenti B2B",
  "storefront.home.rightRail.invoice.trace": "SKU e lotti tracciati in ordine",
  "storefront.home.searchPlaceholder": "Cerca prodotto, SKU, brand, modello...",
  "storefront.home.sidebar.subtitle": "Brand e modelli",
  "storefront.home.sidebar.title": "Catalogo rapido",
  "storefront.home.trust.delivery.title": "Logistica Italia",
  "storefront.home.trust.delivery.value": "24/48h sui ricambi disponibili",
  "storefront.home.trust.invoice.title": "Fattura B2B",
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
  "storefront.home.workflow.eyebrow": "Flusso B2B",
  "storefront.home.workflow.order.text":
    "Aggiungi MOQ, conferma IVA e spedizione, poi invia l'ordine.",
  "storefront.home.workflow.order.title": "Prepara l'ordine",
  "storefront.home.workflow.title": "Dalla ricerca al post-vendita senza passaggi manuali",
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
  "storefront.data.orderStatus.cancelled": "已取消",
  "storefront.data.orderStatus.delivered": "已送达",
  "storefront.data.orderStatus.draft": "草稿",
  "storefront.data.orderStatus.paid": "已付款",
  "storefront.data.orderStatus.pendingPayment": "待付款",
  "storefront.data.orderStatus.picking": "备货中",
  "storefront.data.orderStatus.shipped": "已发货",
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
  "storefront.catalog.allProducts": "全部目录",
  "storefront.catalog.availableOnly": "仅看有货",
  "storefront.catalog.availableOnlyAria": "仅筛选有货商品",
  "storefront.account.menuLabel": "账户区域",
  "storefront.account.openAccount": "个人中心",
  "storefront.account.openAdmin": "后台面板",
  "storefront.account.signOut": "退出账号",
  "storefront.account.staffRole": "员工权限",
  "storefront.common.b2bAccount": "个人中心",
  "storefront.common.checkout": "结账",
  "storefront.common.continueShopping": "继续采购",
  "storefront.common.free": "免费",
  "storefront.common.pieces": "件",
  "storefront.common.piecesShort": "件",
  "storefront.common.shipping": "配送",
  "storefront.common.subtotal": "小计",
  "storefront.common.total": "总计",
  "storefront.common.unitEach": "每件",
  "storefront.common.vat": "增值税",
  "storefront.cart.badge": "客户购物车",
  "storefront.cart.checkoutLabel": "前往结账",
  "storefront.cart.clear": "清空购物车",
  "storefront.cart.clearConfirm": "确定清空购物车中的所有商品吗？",
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
  "storefront.cart.lineCountMany": "{count} 行",
  "storefront.cart.lineCountOne": "1 行",
  "storefront.cart.loadingDescription": "正在读取此浏览器中保存的商品选择。",
  "storefront.cart.loadingProductsDescription":
    "正在获取已保存商品的可用库存、起订量和价格。",
  "storefront.cart.loadingProductsTitle": "正在加载商品",
  "storefront.cart.loadingTitle": "正在加载购物车",
  "storefront.cart.localReadyDescription":
    "数量和删除操作会更新浏览器中保存的选择，并用于结账 payload。后端保存只在确认订单时发生。",
  "storefront.cart.localReadyShort": "修改会保存在当前浏览器中。",
  "storefront.cart.localReadyTitle": "本地购物车已可用于结账",
  "storefront.cart.minimumTitle": "最低起订量 MOQ {minimum}",
  "storefront.cart.priceEach": "{price} / 件",
  "storefront.cart.quantityAria": "{sku} 的数量",
  "storefront.cart.removeLineAria": "移除 {sku} 这一行",
  "storefront.cart.removeLineTitle": "从购物车移除此行",
  "storefront.cart.removeUnavailable": "移除不可用商品",
  "storefront.cart.rows": "行数",
  "storefront.cart.summaryLoading": "正在加载浏览器中保存的购物车...",
  "storefront.cart.summaryNote":
    "合计金额根据浏览器中保存的选择计算。结账会将这些商品发送到现有的 /api/orders endpoint。",
  "storefront.cart.summaryNoteSynced":
    "合计金额已根据浏览器中保存的选择更新。结账会将这些行发送到 /api/orders endpoint。",
  "storefront.cart.summaryTitle": "订单摘要",
  "storefront.cart.title": "确认商品与数量",
  "storefront.cart.decreaseAria": "减少 {sku} 的数量",
  "storefront.cart.decreaseTitle": "减少数量",
  "storefront.cart.stockLimitTitle": "已达到可用库存上限",
  "storefront.cart.unresolvedDescription": "请刷新目录，或重新添加当前可用商品。",
  "storefront.cart.unresolvedTitle": "购物车中的商品当前不可用",
  "storefront.checkout.badge": "客户结账",
  "storefront.checkout.companyLinkedDescription":
    "{name} 将作为 /api/orders 的税务资料使用。",
  "storefront.checkout.companyLinkedTitle": "客户已关联",
  "storefront.checkout.companyMissingDescription":
    "当前会话没有关联客户。请先在客户管理中创建或补全客户资料，再进行结账。",
  "storefront.checkout.companyMissingTitle": "缺少客户资料",
  "storefront.checkout.confirm.address": "我确认配送地址和首选配送时段已更新。",
  "storefront.checkout.confirm.invoice":
    "我确认增值税号、税号、PEC 和收件代码可用于电子发票。",
  "storefront.checkout.confirm.stockPolicy":
    "我接受库存、起订量和发货时间以结账页显示的仓库状态为准。",
  "storefront.checkout.confirmTitle": "提交前确认",
  "storefront.checkout.description":
    "这些资料会作为订单快照，用于发票、配送和 RMA 管理。提交会使用现有 /api/orders endpoint，并发送本地购物车中保存的行。",
  "storefront.checkout.disabledCompanyReason":
    "结账已禁用：请将 Supabase 用户关联到客户资料。",
  "storefront.checkout.field.codiceDestinatario": "收件代码",
  "storefront.checkout.field.codiceFiscale": "税号",
  "storefront.checkout.field.companyName": "公司名称",
  "storefront.checkout.field.deliveryWindow": "首选配送时段",
  "storefront.checkout.field.deliveryWindowPlaceholder":
    "例如上午、下午、预约自提",
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
  "storefront.checkout.option.card.description": "后台中已登记的付款方式。",
  "storefront.checkout.option.card.label": "公司卡",
  "storefront.checkout.option.express.detail": "未税金额超过 250 EUR 免运费",
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
  "storefront.checkout.submit.button.success": "订单已提交",
  "storefront.checkout.submit.cartEmptyReason":
    "购物车为空：请至少添加一个商品后再确认订单。",
  "storefront.checkout.submit.cartLoadingReason": "正在加载浏览器中保存的购物车...",
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
  "storefront.checkout.submit.unresolvedItemsReason":
    "购物车中有商品当前不可用：请返回购物车移除后再确认订单。",
  "storefront.checkout.success.openOrders": "查看订单",
  "storefront.checkout.success.total": "订单总计",
  "storefront.checkout.title": "确认订单与税务资料",
  "storefront.product.backToCatalog": "返回目录",
  "storefront.product.card.accountReviewHint": "起订量 {moq} · 价目表审核",
  "storefront.product.card.accountReviewLabel": "账户审核中",
  "storefront.product.card.add": "添加",
  "storefront.product.card.addAria":
    "将 {name} 加入购物车。起订量 {moq}，库存 {stock} 件。",
  "storefront.product.card.added": "已添加",
  "storefront.product.card.addFailed": "重试",
  "storefront.product.card.extraModelsTitle": "另有 {count} 个兼容机型",
  "storefront.product.card.loginHint": "起订量 {moq} · 需要登录",
  "storefront.product.card.loginLabel": "登录查看价格",
  "storefront.product.card.priceNeedsUpdate": "价目表待更新",
  "storefront.product.card.priceUnset": "价格未设置",
  "storefront.product.card.previewImageAria": "打开 {name} 图片预览",
  "storefront.product.card.profileHint": "起订量 {moq} · 请稍后重试",
  "storefront.product.card.profileLabel": "资料准备中",
  "storefront.product.card.reviewBadgeTitle": "账户审核中",
  "storefront.product.card.stockLine": "{status} · {count} 件",
  "storefront.product.card.suspendedHint": "起订量 {moq} · 联系支持",
  "storefront.product.card.suspendedLabel": "账户已暂停",
  "storefront.product.card.unavailable": "缺货",
  "storefront.product.card.unavailableAria": "{name} 当前不能加入购物车",
  "storefront.product.card.visiblePriceHint": "未税价 · 起订量 {moq}",
  "storefront.product.card.wholesaleHint": "起订量 {moq} · 客户资料审核",
  "storefront.product.card.wholesaleLabel": "价目表待启用",
  "storefront.product.detail.customerConditions": "客户条件",
  "storefront.product.detail.invoice": "发票",
  "storefront.product.detail.invoiceText": "PEC / 收件代码",
  "storefront.product.detail.lot": "批次",
  "storefront.product.detail.lotTracked": "可追踪",
  "storefront.product.purchase.add": "添加到购物车",
  "storefront.product.purchase.addAria": "将 {quantity} 件 {name} 加入购物车",
  "storefront.product.purchase.added": "已添加",
  "storefront.product.purchase.addFailed": "重试",
  "storefront.product.purchase.orderNow": "立即下单",
  "storefront.product.purchase.orderNowAria": "立即下单 {quantity} 件 {name}",
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
  "storefront.logo.tagline": "意大利 B2B 手机配件",
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
  "storefront.home.hero.badge": "意大利 B2B 供货",
  "storefront.home.hero.browseCatalog": "浏览目录",
  "storefront.home.hero.catalogFallback": "B2B 目录",
  "storefront.home.hero.description":
    "PartsPro 将 B2B 目录、本地库存、登录后专属价格、电子发票和可追踪 RMA 统一到一个面向意大利市场的采购流程中。",
  "storefront.home.hero.loginForPrices": "登录查看价格",
  "storefront.home.hero.stats.brands": "品牌与系列",
  "storefront.home.hero.stats.delivery": "意大利物流",
  "storefront.home.hero.stats.sku": "目录 SKU",
  "storefront.home.hero.title": "面向维修店和经销商的手机配件供货",
  "storefront.home.hero.visualText": "SKU、库存、起订量和兼容性信息都围绕高频补货采购设计。",
  "storefront.home.hero.visualTitle": "可操作目录，不是静态展示页",
  "storefront.home.notifications": "通知",
  "storefront.home.mobileMenuDescription": "移动菜单包含首页、目录和账户。",
  "storefront.home.mobileSearch": "搜索 SKU / 商品",
  "storefront.home.productCard.extraModels": "+{count} 个机型",
  "storefront.home.productCard.loginPrice": "登录后查看价格",
  "storefront.home.productCard.open": "查看",
  "storefront.home.productCard.openAria": "打开商品详情 {name}",
  "storefront.home.productCard.pendingHint": "审核中 · 起订量 {moq}",
  "storefront.home.productCard.pendingPrice": "审核",
  "storefront.home.productCard.priceHint": "起订量 {moq} · 需要登录",
  "storefront.home.productCard.priceVisibleHint": "未税价 · 起订量 {moq}",
  "storefront.home.productCard.profileHint": "起订量 {moq} · 请稍后重试",
  "storefront.home.productCard.profilePrice": "资料准备中",
  "storefront.home.productCard.stockLine": "{status} · {count} 件",
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
  "storefront.home.rightRail.invoice.title": "B2B 单据",
  "storefront.home.rightRail.invoice.trace": "订单中追踪 SKU 与批次",
  "storefront.home.searchPlaceholder": "搜索商品、SKU、品牌、机型...",
  "storefront.home.sidebar.subtitle": "品牌与机型",
  "storefront.home.sidebar.title": "快速目录",
  "storefront.home.trust.delivery.title": "意大利物流",
  "storefront.home.trust.delivery.value": "有货配件 24/48 小时配送",
  "storefront.home.trust.invoice.title": "B2B 发票",
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
  "storefront.home.workflow.eyebrow": "B2B 流程",
  "storefront.home.workflow.order.text": "设置起订量，确认增值税与配送，然后提交订单。",
  "storefront.home.workflow.order.title": "准备订单",
  "storefront.home.workflow.title": "从搜索到售后，减少手动沟通",
};

export const storefrontDictionaries = {
  "it-IT": storefrontItIT,
  "zh-CN": storefrontZhCN,
};
