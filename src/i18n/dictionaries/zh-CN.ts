import type itDictionary from "./it-IT";
import { storefrontZhCN } from "./storefront";

const dictionary = {
  "metadata.title": "PartsPro | 意大利专业客户手机配件平台",
  "metadata.description":
    "PartsPro 平台用于专业客户配件目录、订单、RMA 和手机维修配件管理。",
  "language.label": "语言",
  "language.switchTo": "切换语言",
  "language.current": "当前语言",
  "language.it-IT": "Italiano",
  "language.zh-CN": "中文",
  "nav.home": "首页",
  "nav.catalog": "目录",
  "nav.cart": "购物车",
  "nav.account": "个人中心",
  "nav.admin": "后台",
  "nav.orders": "订单",
  "nav.customers": "客户",
  "nav.inventory": "库存",
  "common.search": "搜索",
  "common.loading": "加载中...",
  "common.save": "保存",
  "common.cancel": "取消",
  "common.close": "关闭",
  ...storefrontZhCN,
} satisfies typeof itDictionary;

export default dictionary;
