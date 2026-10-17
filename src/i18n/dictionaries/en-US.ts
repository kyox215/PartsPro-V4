import { storefrontEnUS } from "./storefront-en";
import { englishLiteralCopy } from "../english-literals";

const dictionary = {
  "metadata.title": "PartsPro | Smartphone parts for professional customers in Italy",
  "metadata.description": "PartsPro platform for professional catalogs, orders, after-sales support and smartphone parts management.",
  "language.label": "Language",
  "language.switchTo": "Change language",
  "language.current": "Current language",
  "language.it-IT": "Italiano",
  "language.zh-CN": "中文",
  "language.en-US": "English",
  "nav.home": "Home",
  "nav.catalog": "Catalog",
  "nav.cart": "Cart",
  "nav.account": "Account",
  "nav.admin": "Admin",
  "nav.orders": "Orders",
  "nav.customers": "Customers",
  "nav.inventory": "Inventory",
  "common.search": "Search",
  "common.loading": "Loading...",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Close",
  ...storefrontEnUS,
  ...Object.fromEntries(Object.entries(englishLiteralCopy).map(([source, english]) => [`literal.${source}`, english])),
};

export default dictionary;
