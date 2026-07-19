import {
  tx,
  txFormat,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import type {
  PriceVisibilityReason,
  RequiredAccountProfileField,
  StorefrontCartGateReason,
} from "@/lib/partspro-account-context";

type AccountGateCopyOptions = {
  loginNextPath?: string;
  missingFields?: RequiredAccountProfileField[];
  moq?: number;
};

export type AccountGateReason =
  | PriceVisibilityReason
  | StorefrontCartGateReason
  | "price_unavailable";

export type AccountGateCopy = {
  actionHref: string | null;
  actionLabel: string | null;
  cardDescription: string;
  cardTitle: string;
  description: string;
  hint: string;
  label: string;
  steps: string[];
  stepsTitle?: string;
  title: string;
  tone: "error" | "info" | "warning";
};

export function getAccountGateCopy(
  t: StorefrontTranslator,
  reason: AccountGateReason,
  options: AccountGateCopyOptions = {}
): AccountGateCopy {
  const moq = options.moq ?? 1;
  const missingFieldSteps = (options.missingFields ?? []).map((field) =>
    accountProfileFieldLabel(t, field)
  );

  switch (reason) {
    case "customer_profile_required":
      return {
        actionHref: "/account?setup=1",
        actionLabel: tx(t, "storefront.accountGate.profile.action", "Completa profilo"),
        cardDescription: tx(
          t,
          "storefront.accountGate.profile.cardDescription",
          "Completa i dati richiesti nel centro personale per sbloccare prezzi, carrello e checkout."
        ),
        cardTitle: tx(t, "storefront.accountGate.profile.cardTitle", "Dati cliente da completare"),
        description: tx(
          t,
          "storefront.accountGate.profile.description",
          "Il tuo account e riconosciuto, ma mancano dati obbligatori. Completa azienda, telefono, codice fiscale, indirizzo di fatturazione e spedizione."
        ),
        hint: txFormat(
          t,
          "storefront.accountGate.profile.hint",
          "MOQ {moq} - completa dati",
          { moq }
        ),
        label: tx(t, "storefront.accountGate.profile.label", "Completa profilo"),
        steps: [
          tx(t, "storefront.accountGate.profile.stepContact", "Dati azienda e telefono"),
          tx(t, "storefront.accountGate.profile.stepTax", "Codice fiscale o Partita IVA"),
          tx(t, "storefront.accountGate.profile.stepAddress", "Indirizzo spedizione e fatturazione"),
        ],
        title: tx(t, "storefront.accountGate.profile.title", "Completa il profilo cliente"),
        tone: "warning",
      };
    case "account_sync_failed":
      return {
        actionHref: "/account?setup=1",
        actionLabel: tx(t, "storefront.accountGate.sync.action", "Apri account"),
        cardDescription: tx(
          t,
          "storefront.accountGate.sync.cardDescription",
          "La sessione e valida, ma non abbiamo potuto sincronizzare il profilo cliente."
        ),
        cardTitle: tx(t, "storefront.accountGate.sync.cardTitle", "Sincronizzazione account richiesta"),
        description: tx(
          t,
          "storefront.accountGate.sync.description",
          "Aggiorna la pagina o apri il centro personale. Se il problema continua, contatta PartsPro per controllare il collegamento account."
        ),
        hint: txFormat(t, "storefront.accountGate.sync.hint", "MOQ {moq} - sincronizza account", {
          moq,
        }),
        label: tx(t, "storefront.accountGate.sync.label", "Account da sincronizzare"),
        steps: [
          tx(t, "storefront.accountGate.sync.stepRefresh", "Aggiorna la pagina"),
          tx(t, "storefront.accountGate.sync.stepAccount", "Controlla il centro personale"),
          tx(t, "storefront.accountGate.sync.stepSupport", "Contatta PartsPro se resta bloccato"),
        ],
        title: tx(t, "storefront.accountGate.sync.title", "Account non sincronizzato"),
        tone: "warning",
      };
    case "customer_needs_assignment":
      return {
        actionHref: "/account",
        actionLabel: tx(t, "storefront.accountGate.review.action", "Vedi stato account"),
        cardDescription: tx(
          t,
          "storefront.accountGate.review.cardDescription",
          "I dati sono presenti. PartsPro deve completare la verifica e abilitare il listino prima dell'ordine."
        ),
        cardTitle: tx(t, "storefront.accountGate.review.cardTitle", "Account in revisione"),
        description: tx(
          t,
          "storefront.accountGate.review.description",
          "Il profilo e stato inviato. Appena il team attiva cliente e listino, potrai aggiungere prodotti al carrello e confermare ordini."
        ),
        hint: txFormat(
          t,
          "storefront.accountGate.review.hint",
          "MOQ {moq} - verifica listino",
          { moq }
        ),
        label: tx(t, "storefront.accountGate.review.label", "Account in revisione"),
        steps: [
          tx(t, "storefront.accountGate.review.stepWait", "Attendi l'approvazione PartsPro"),
          tx(t, "storefront.accountGate.review.stepStatus", "Controlla lo stato nel centro personale"),
        ],
        title: tx(t, "storefront.accountGate.review.title", "Account in revisione"),
        tone: "info",
      };
    case "wholesale_required":
      return {
        actionHref: "/account",
        actionLabel: tx(t, "storefront.accountGate.wholesale.action", "Vedi account"),
        cardDescription: tx(
          t,
          "storefront.accountGate.wholesale.cardDescription",
          "Il profilo esiste, ma il listino professionale non e ancora abilitato per questo account."
        ),
        cardTitle: tx(t, "storefront.accountGate.wholesale.cardTitle", "Listino da abilitare"),
        description: tx(
          t,
          "storefront.accountGate.wholesale.description",
          "Completa o fai verificare il profilo cliente. Dopo l'abilitazione del listino potrai usare carrello e checkout."
        ),
        hint: txFormat(t, "storefront.accountGate.wholesale.hint", "MOQ {moq} - listino da abilitare", {
          moq,
        }),
        label: tx(t, "storefront.accountGate.wholesale.label", "Listino da abilitare"),
        steps: [
          tx(t, "storefront.accountGate.wholesale.stepProfile", "Verifica che il profilo sia completo"),
          tx(t, "storefront.accountGate.wholesale.stepApproval", "Attendi abilitazione listino"),
        ],
        title: tx(t, "storefront.accountGate.wholesale.title", "Prezzi professionali non ancora abilitati"),
        tone: "warning",
      };
    case "customer_suspended":
      return {
        actionHref: null,
        actionLabel: null,
        cardDescription: tx(
          t,
          "storefront.accountGate.suspended.cardDescription",
          "Il listino e temporaneamente bloccato per questo account."
        ),
        cardTitle: tx(t, "storefront.accountGate.suspended.cardTitle", "Account sospeso"),
        description: tx(
          t,
          "storefront.accountGate.suspended.description",
          "Contatta PartsPro per riattivare il profilo cliente prima di usare prezzi, carrello o checkout."
        ),
        hint: txFormat(t, "storefront.accountGate.suspended.hint", "MOQ {moq} - contatta supporto", {
          moq,
        }),
        label: tx(t, "storefront.accountGate.suspended.label", "Account sospeso"),
        steps: [tx(t, "storefront.accountGate.suspended.stepSupport", "Contatta PartsPro")],
        title: tx(t, "storefront.accountGate.suspended.title", "Account sospeso"),
        tone: "error",
      };
    case "employee_self_profile_required":
      return {
        actionHref: "/account?setup=1",
        actionLabel: tx(
          t,
          "storefront.accountGate.employeeSelfProfile.action",
          "Completa i dati"
        ),
        cardDescription: tx(
          t,
          "storefront.accountGate.employeeSelfProfile.cardDescription",
          "Completa il profilo di acquisto personale per usare carrello e checkout."
        ),
        cardTitle: tx(
          t,
          "storefront.accountGate.employeeSelfProfile.cardTitle",
          "Dati acquisto personale da completare"
        ),
        description: tx(
          t,
          "storefront.accountGate.employeeSelfProfile.description",
          "Questo account staff può vedere i prezzi, ma non può ancora ordinare con i propri dati. Completa il profilo di acquisto personale per usare carrello e checkout."
        ),
        hint: txFormat(
          t,
          "storefront.accountGate.employeeSelfProfile.hint",
          "MOQ {moq} - completa i dati",
          { moq }
        ),
        label: tx(
          t,
          "storefront.accountGate.employeeSelfProfile.label",
          "Profilo incompleto"
        ),
        steps:
          missingFieldSteps.length > 0
            ? missingFieldSteps
            : [
                tx(
                  t,
                  "storefront.accountGate.employeeSelfProfile.stepAccount",
                  "Controlla i dati nel centro personale"
                ),
              ],
        stepsTitle: tx(
          t,
          "storefront.accountGate.employeeSelfProfile.missingTitle",
          "Da completare"
        ),
        title: tx(
          t,
          "storefront.accountGate.employeeSelfProfile.title",
          "Dati acquisto personale dipendente incompleti"
        ),
        tone: "warning",
      };
    case "employee_self_suspended":
      return {
        actionHref: null,
        actionLabel: null,
        cardDescription: tx(
          t,
          "storefront.accountGate.employeeSelfSuspended.cardDescription",
          "Il profilo di acquisto personale dello staff è sospeso."
        ),
        cardTitle: tx(
          t,
          "storefront.accountGate.employeeSelfSuspended.cardTitle",
          "Acquisti personali sospesi"
        ),
        description: tx(
          t,
          "storefront.accountGate.employeeSelfSuspended.description",
          "Contatta PartsPro per riattivare il profilo di acquisto personale prima di usare carrello e checkout."
        ),
        hint: txFormat(
          t,
          "storefront.accountGate.employeeSelfSuspended.hint",
          "MOQ {moq} - contatta PartsPro",
          { moq }
        ),
        label: tx(
          t,
          "storefront.accountGate.employeeSelfSuspended.label",
          "Profilo sospeso"
        ),
        steps: [
          tx(
            t,
            "storefront.accountGate.employeeSelfSuspended.stepSupport",
            "Contatta PartsPro"
          ),
        ],
        title: tx(
          t,
          "storefront.accountGate.employeeSelfSuspended.title",
          "Acquisti personali sospesi"
        ),
        tone: "error",
      };
    case "employee_self_needs_assignment":
      return {
        actionHref: "/account",
        actionLabel: tx(
          t,
          "storefront.accountGate.employeeSelfReview.action",
          "Vedi account"
        ),
        cardDescription: tx(
          t,
          "storefront.accountGate.employeeSelfReview.cardDescription",
          "Il profilo di acquisto personale deve essere abilitato prima dell'ordine."
        ),
        cardTitle: tx(
          t,
          "storefront.accountGate.employeeSelfReview.cardTitle",
          "Profilo acquisti da abilitare"
        ),
        description: tx(
          t,
          "storefront.accountGate.employeeSelfReview.description",
          "PartsPro deve completare l'abilitazione del profilo di acquisto personale prima di usare carrello e checkout."
        ),
        hint: txFormat(
          t,
          "storefront.accountGate.employeeSelfReview.hint",
          "MOQ {moq} - profilo da abilitare",
          { moq }
        ),
        label: tx(
          t,
          "storefront.accountGate.employeeSelfReview.label",
          "Da abilitare"
        ),
        steps: [
          tx(
            t,
            "storefront.accountGate.employeeSelfReview.stepStatus",
            "Controlla lo stato nel centro personale"
          ),
        ],
        title: tx(
          t,
          "storefront.accountGate.employeeSelfReview.title",
          "Profilo acquisti da abilitare"
        ),
        tone: "info",
      };
    case "delegated_checkout_forbidden":
      return {
        actionHref: null,
        actionLabel: null,
        cardDescription: tx(
          t,
          "storefront.accountGate.delegatedForbidden.cardDescription",
          "Questo account non può creare ordini assistiti per altri clienti."
        ),
        cardTitle: tx(
          t,
          "storefront.accountGate.delegatedForbidden.cardTitle",
          "Ordine assistito non autorizzato"
        ),
        description: tx(
          t,
          "storefront.accountGate.delegatedForbidden.description",
          "Sono necessarie le autorizzazioni ordini e clienti per usare il carrello con un cliente selezionato."
        ),
        hint: txFormat(
          t,
          "storefront.accountGate.delegatedForbidden.hint",
          "MOQ {moq} - autorizzazione richiesta",
          { moq }
        ),
        label: tx(
          t,
          "storefront.accountGate.delegatedForbidden.label",
          "Non autorizzato"
        ),
        steps: [
          tx(
            t,
            "storefront.accountGate.delegatedForbidden.stepSupport",
            "Contatta un amministratore PartsPro"
          ),
        ],
        title: tx(
          t,
          "storefront.accountGate.delegatedForbidden.title",
          "Ordine assistito non autorizzato"
        ),
        tone: "error",
      };
    case "price_unavailable":
      return {
        actionHref: null,
        actionLabel: null,
        cardDescription: tx(
          t,
          "storefront.accountGate.priceUnavailable.cardDescription",
          "Il prezzo di questo prodotto non è ancora disponibile."
        ),
        cardTitle: tx(
          t,
          "storefront.accountGate.priceUnavailable.cardTitle",
          "Prezzo non impostato"
        ),
        description: tx(
          t,
          "storefront.accountGate.priceUnavailable.description",
          "Il tuo account è abilitato, ma il prezzo di questo prodotto deve ancora essere aggiornato prima dell'acquisto."
        ),
        hint: txFormat(
          t,
          "storefront.accountGate.priceUnavailable.hint",
          "MOQ {moq} - prezzo da aggiornare",
          { moq }
        ),
        label: tx(
          t,
          "storefront.accountGate.priceUnavailable.label",
          "Prezzo non disponibile"
        ),
        steps: [
          tx(
            t,
            "storefront.accountGate.priceUnavailable.stepSupport",
            "Contatta PartsPro per verificare il prezzo"
          ),
        ],
        title: tx(
          t,
          "storefront.accountGate.priceUnavailable.title",
          "Prezzo non disponibile"
        ),
        tone: "warning",
      };
    case "customer":
    case "employee":
      return {
        actionHref: null,
        actionLabel: null,
        cardDescription: tx(
          t,
          "storefront.accountGate.ready.cardDescription",
          "Prezzi, carrello e checkout sono disponibili per questo account."
        ),
        cardTitle: tx(t, "storefront.accountGate.ready.cardTitle", "Account abilitato"),
        description: tx(
          t,
          "storefront.accountGate.ready.description",
          "Prezzi, carrello e checkout sono disponibili per questo account."
        ),
        hint: txFormat(t, "storefront.accountGate.ready.hint", "MOQ {moq}", { moq }),
        label: tx(t, "storefront.accountGate.ready.label", "Account abilitato"),
        steps: [],
        title: tx(t, "storefront.accountGate.ready.title", "Account abilitato"),
        tone: "info",
      };
    case "login_required":
    default:
      return {
        actionHref: `/login?${new URLSearchParams({
          next: options.loginNextPath ?? "/catalogo",
        }).toString()}`,
        actionLabel: tx(t, "storefront.accountGate.login.action", "Accedi"),
        cardDescription: tx(
          t,
          "storefront.accountGate.login.cardDescription",
          "Accedi con un account cliente per vedere prezzi, MOQ e disponibilita d'ordine."
        ),
        cardTitle: tx(t, "storefront.accountGate.login.cardTitle", "Prezzo protetto"),
        description: tx(
          t,
          "storefront.accountGate.login.description",
          "Accedi o richiedi un account cliente per sbloccare prezzi, carrello e checkout."
        ),
        hint: txFormat(t, "storefront.accountGate.login.hint", "MOQ {moq} - login richiesto", {
          moq,
        }),
        label: tx(t, "storefront.accountGate.login.label", "Accedi per prezzo"),
        steps: [
          tx(t, "storefront.accountGate.login.stepLogin", "Accedi con il tuo account"),
          tx(t, "storefront.accountGate.login.stepProfile", "Completa il profilo cliente se richiesto"),
        ],
        title: tx(t, "storefront.accountGate.login.title", "Accedi per continuare"),
        tone: "warning",
      };
  }
}

function accountProfileFieldLabel(
  t: StorefrontTranslator,
  field: RequiredAccountProfileField
) {
  switch (field) {
    case "billing_address":
      return tx(
        t,
        "storefront.accountGate.missingField.billingAddress",
        "Indirizzo di fatturazione"
      );
    case "company_name":
      return tx(t, "storefront.accountGate.missingField.companyName", "Azienda");
    case "email":
      return tx(t, "storefront.accountGate.missingField.email", "Email");
    case "fiscal_code":
      return tx(
        t,
        "storefront.accountGate.missingField.fiscalCode",
        "Codice fiscale"
      );
    case "phone":
      return tx(t, "storefront.accountGate.missingField.phone", "Telefono");
    case "shipping_address":
      return tx(
        t,
        "storefront.accountGate.missingField.shippingAddress",
        "Indirizzo di spedizione"
      );
  }
}

export function isCustomerActionRequiredReason(reason: PriceVisibilityReason) {
  return (
    reason === "account_sync_failed" ||
    reason === "customer_needs_assignment" ||
    reason === "customer_profile_required" ||
    reason === "customer_suspended" ||
    reason === "wholesale_required"
  );
}
