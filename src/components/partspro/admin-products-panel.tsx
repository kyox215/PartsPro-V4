"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit,
  Euro,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Tag,
  Upload,
  Warehouse,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  categories,
  formatEuro,
  type DeviceModelGroup,
  type PartProduct,
  type PartVisual,
  type ProductGrade,
  type StockStatus,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import {
  adminSourceLabel,
  formatAdminMessage,
  getAdminDictionary,
  type AdminText,
} from "@/i18n/dictionaries/admin";
import {
  buildAdminProductSkuCandidate,
  isValidAdminSku,
  sanitizeSupplierText,
  toPublicSku,
} from "@/lib/partspro-sku";
import { AdminSkeletonRows } from "./admin-feedback";
import { useI18n } from "./i18n-provider";
import { PartVisual as ProductVisual } from "./part-visual";

const adminProductsEndpoint = "/api/admin/products";
const productImagesBucket = "product-images";
const adminProductWriteTimeoutMs = 25_000;
const lowStockThreshold = 10;
const productGrades = ["A+", "A", "B", "Refurbished"] as const;
const defaultWarehouse: PartProduct["warehouse"] = "Milano";
const stockStatuses = ["In Stock", "Low Stock", "Out of Stock"] as const;
const catalogStatuses = ["active", "draft", "hidden", "blocked"] as const;
const productSorts = ["updated_desc", "created_desc", "stock_desc", "name"] as const;
const productVisuals = [
  "screen",
  "battery",
  "cover",
  "port",
  "camera",
  "flex",
  "speaker",
  "frame",
] as const satisfies readonly PartVisual[];
const stockAdjustmentActions = [
  "receive",
  "cycle_count",
  "release",
  "scrap",
  "rma_return",
] as const;

type CatalogStatus = (typeof catalogStatuses)[number];
type ProductSort = (typeof productSorts)[number];
type ProductAction = "publish" | "hide" | "block" | "restore";
type ProductDrawerMode = "view" | "edit" | "create";
type ProductSource = "supabase" | "api" | "empty";
type StockAdjustmentAction = (typeof stockAdjustmentActions)[number];
type FilterValue<T extends string> = "all" | T;
type ProductListFilters = {
  q: string;
  brand: string;
  batchCode: string;
  modelSeries: string;
  model: string;
  catalogStatus: FilterValue<CatalogStatus>;
  stockStatus: FilterValue<StockStatus>;
  grade: FilterValue<ProductGrade>;
  sort: ProductSort;
  supplier: string;
  page: number;
  pageSize: number;
};

type AdminProductRow = PartProduct & {
  activeRestockRequestCount?: number;
  actualQty?: number;
  availableQty?: number;
  batchCode?: string | null;
  catalogUrl?: string;
  catalogStatus: CatalogStatus;
  costPrice?: number;
  galleryImagePaths?: string[];
  imagePath?: string | null;
  lockedQty?: number;
  margin?: number;
  model?: string | null;
  modelSeries?: string | null;
  modelCode?: string | null;
  modelCodes?: string[];
  stockQty?: number;
  storefrontUrl?: string | null;
  storefrontVisible?: boolean;
  supplier?: string | null;
};

type ProductDataSource = {
  source: ProductSource;
  label: string;
  syncedAt: string | null;
  total: number;
  returned: number;
  error?: string;
};

type ProductNotice = {
  tone: "success" | "info" | "warning" | "error";
  message: string;
};

type AdminRestockRequestStatus = "active" | "notified" | "cancelled";

type AdminRestockRequest = {
  createdAt: string;
  customerId: string | null;
  id: string;
  productName: string;
  sku: string;
  status: AdminRestockRequestStatus;
  updatedAt: string;
  userId: string | null;
};

type ProductsApiResult = {
  products: AdminProductRow[];
  source: ProductSource;
  total: number;
  returned: number;
};

type ProductModelGroupsResult = {
  modelGroups: DeviceModelGroup[];
  source: ProductSource;
};

type ProductFormValues = {
  sku: string;
  skuMode: "auto" | "manual";
  name: string;
  category: string;
  brand: string;
  grade: ProductGrade;
  price: string;
  retailPrice: string;
  costPrice: string;
  stock: string;
  moq: string;
  leadTime: string;
  compatibleWith: string;
  tags: string;
  model: string;
  modelCode: string;
  batchCode: string;
  supplier: string;
  imagePath: string;
  imageAlt: string;
};

type ProductWritePayload = {
  sku?: string;
  name: string;
  category: string;
  brand: string;
  grade: ProductGrade;
  price: number;
  retailPrice?: number;
  costPrice?: number;
  stock?: number;
  moq: number;
  warehouse?: PartProduct["warehouse"];
  compatibleWith: string[];
  tags: string[];
  model?: string;
  modelCode?: string;
  batchCode?: string;
  supplier?: string;
  imagePath?: string;
  imageAlt?: string;
};

type StockAdjustmentPayload = {
  action: StockAdjustmentAction;
  quantity: number;
  reason: string;
  warehouse?: PartProduct["warehouse"];
  batchCode?: string;
  supplier?: string;
};

type ProductAuditEvent = {
  id: string;
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  afterData: Record<string, unknown>;
  beforeData: Record<string, unknown>;
  reason: string | null;
  result: string;
  requestMetadata: Record<string, unknown>;
  createdAt: string;
  createdAtRaw: string | null;
};

const defaultFilters: ProductListFilters = {
  q: "",
  brand: "all",
  batchCode: "",
  modelSeries: "all",
  model: "all",
  catalogStatus: "all",
  stockStatus: "all",
  grade: "all",
  sort: "updated_desc",
  supplier: "",
  page: 0,
  pageSize: 20,
};

const emptyProductSource: ProductDataSource = {
  source: "empty",
  label: "空状态",
  syncedAt: null,
  total: 0,
  returned: 0,
};

const panelText = {
  zh: {
    title: "商品管理",
    subtitle: "B2B 商品运营工作台",
    queryTotal: "查询总数",
    currentPage: "当前页",
    active: "已上架",
    drafts: "草稿",
    hidden: "隐藏",
    blocked: "阻塞",
    lowStock: "低库存",
    restockRequests: "补货提醒",
    restockOnly: "仅看提醒",
    restockManage: "处理提醒",
    restockActiveCount: "{count} 个提醒",
    restockEmpty: "暂无待处理补货提醒。",
    restockDialogDescription: "客户提交的 active 补货提醒；处理后可标记为已通知或取消。",
    restockMarkNotified: "已通知",
    restockCancel: "取消提醒",
    restockUpdateSuccess: "补货提醒已更新。",
    restockUpdateError: "补货提醒更新失败。",
    missingImage: "缺主图",
    missingPrice: "缺价格",
    searchPlaceholder: "搜索 SKU / 商品 / 品牌 / 型号",
    accessoryRoot: "手机配件",
    cascadeBrand: "品牌",
    cascadeSeries: "系列",
    cascadeModel: "型号",
    pickBrand: "选择品牌",
    pickSeries: "选择系列",
    pickModel: "选择型号",
    noCascadeOptions: "暂无选项",
    allBrands: "全部品牌",
    allSeries: "全部系列",
    allModels: "全部型号",
    allCatalogStatuses: "全部发布状态",
    allStockStatuses: "全部库存状态",
    allWarehouses: "全部仓库",
    allGrades: "全部品质",
    supplierFilter: "供应商",
    supplierFilterPlaceholder: "供应商，例如 UTOPYA",
    batchFilter: "批次",
    batchFilterPlaceholder: "批次，例如 UTOPYA-7086282",
    filters: "筛选",
    catalogTree: "分类目录",
    mobileFilters: "目录 / 筛选",
    mobileFiltersDescription: "选择品牌、系列、型号和其他筛选条件。",
    selectedCatalogPath: "已选路径",
    reset: "重置",
    sync: "同步",
    exportView: "导出当前视图",
    exportSelection: "导出所选",
    create: "新建商品",
    selectedCount: "已选择 {count} 个商品",
    hideSelected: "批量隐藏",
    sourceStats: "{returned}/{total} 个商品 · {time}",
    sourcePending: "等待同步",
    syncSuccess: "商品列表已同步。",
    syncEmpty: "当前没有匹配商品。",
    syncError: "商品列表暂时不可用。",
    saveSuccess: "商品 {sku} 已保存。",
    createSuccess: "商品 {sku} 已创建为草稿。",
    actionSuccess: "商品 {sku} 已更新为 {status}。",
    hideSuccess: "{count} 个商品已隐藏。",
    stockSuccess: "商品 {sku} 的库存动作已入账。",
    mediaSuccess: "商品 {sku} 的媒体信息已保存。",
    saveError: "保存失败，商品未修改。",
    actionError: "商品动作失败。",
    stockError: "库存动作失败。",
    mediaError: "媒体保存失败。",
    emptyTitle: "没有匹配的商品",
    emptyBody: "调整搜索或筛选条件后再试。",
    tableProduct: "商品 / SKU",
    tableBrandModel: "品牌 / 型号",
    tableCatalog: "发布",
    tableStock: "库存",
    tablePrice: "价格 / 毛利",
    tableMedia: "媒体",
    tableUpdated: "更新",
    tableActions: "操作",
    pageInfo: "第 {page} / {pages} 页",
    pageSizeLabel: "每页商品数",
    pageSizeOption: "{count} / 页",
    previousPage: "上一页",
    nextPage: "下一页",
    details: "商品详情",
    edit: "编辑商品",
    duplicate: "复制为草稿",
    moreActions: "更多商品操作",
    publish: "发布",
    restore: "恢复草稿",
    block: "阻塞",
    hide: "隐藏",
    stockAdjust: "库存动作",
    quickActions: "快捷操作",
    copySku: "复制 SKU",
    copied: "已复制",
    imagePreview: "图片预览",
    imageCount: "{count} 张图片",
    viewCatalog: "前台列表查看",
    previewStorefront: "前台商品页预览",
    publishForStorefront: "发布后前台可见",
    drawerCreateTitle: "新建商品",
    drawerEditTitle: "编辑商品",
    drawerViewTitle: "商品详情",
    tabBase: "基础信息",
    tabPrice: "价格",
    tabInventory: "库存",
    tabMedia: "媒体",
    tabCompatibility: "适配型号",
    tabAudit: "审计记录",
    sectionBase: "基础信息",
    sectionPrice: "价格",
    sectionInventory: "库存摘要",
    sectionCatalog: "发布与目录",
    sectionMedia: "媒体管理",
    name: "商品名称",
    sku: "SKU",
    category: "分类",
    brand: "品牌",
    quality: "品质",
    warehouse: "仓库",
    netPrice: "批发价",
    retailPrice: "零售价",
    costPrice: "成本价",
    margin: "毛利",
    stock: "库存",
    availableStock: "可售库存",
    lockedStock: "锁定库存",
    actualStock: "实物库存",
    moq: "MOQ",
    leadTime: "交期",
    compatibility: "适配型号",
    tags: "标签",
    modelSeries: "系列",
    model: "主型号",
    modelCode: "外部码 / EAN / 型号代码",
    batchCode: "批次",
    supplier: "供应商",
    imagePath: "主图路径",
    imageAlt: "图片 Alt",
    gallery: "图库路径",
    uploadImage: "上传图片",
    setPrimary: "设为主图",
    reason: "原因",
    quantity: "数量",
    none: "无",
    open: "打开",
    save: "保存",
    cancel: "取消",
    close: "关闭",
    saving: "正在保存...",
    loading: "正在加载...",
    skuReadonly: "编辑时 SKU 只读",
    skuAutoHint: "新增时由外部码优先生成；未填写外部码时按品牌、型号、分类和品质生成。",
    skuAutoPreview: "自动生成 SKU",
    skuManualEnable: "手动覆盖",
    skuManualDisable: "恢复自动",
    skuManualHint: "仅特殊情况手动输入；保存时后端仍会校验唯一性。",
    skuExternalInvalid: "外部码格式不适合作为 SKU，系统会改用商品信息生成。",
    stockReadonly: "库存只能通过库存动作调整",
    storefrontVisible: "前台可见",
    auditLoading: "正在读取审计记录...",
    auditEmpty: "暂无审计记录。",
    auditError: "审计记录暂时无法读取。",
    auditActorFallback: "未知操作者",
    auditChangesTitle: "变更",
    auditDetailsTitle: "详情",
    auditUnknownTime: "-",
    auditChangedField: "{field}: {before} → {after}",
    auditResultLabels: {
      success: "成功",
      failed: "失败",
    },
    auditCatalogStatusLabels: {
      active: "已上架",
      blocked: "已阻塞",
      draft: "草稿",
      hidden: "已隐藏",
    },
    auditActionLabels: {
      "product.update": "商品资料更新",
      "product.stock_adjust": "库存调整",
      "product.images_update": "图片更新",
      "product.publish": "发布商品",
      "product.hide": "隐藏商品",
      "product.block": "阻塞商品",
      "product.restore_draft": "恢复草稿",
      "product.audit": "商品审计",
    },
    auditDefaultReasons: {
      "Updated from admin product API.": "后台保存了商品资料。",
      "Published from admin product API.": "后台发布了商品。",
      "Hidden from admin product API.": "后台隐藏了商品。",
      "Blocked from admin product API.": "后台阻塞了商品。",
      "Restored to draft from admin product API.": "后台恢复为草稿。",
      "Uploaded product image for": "后台上传了商品图片。",
    },
    auditMetadataLabels: {
      action: "动作",
      batch_code: "批次",
      delta: "库存变化",
      gallery_count: "图库数量",
      image_path: "主图路径",
      location: "仓库",
      quantity: "数量",
      supplier: "供应商",
    },
    auditFieldLabels: {
      actual_qty: "实物库存",
      available_qty: "可售库存",
      b2b_price: "批发价",
      brand: "品牌",
      category: "分类",
      cost_price: "成本价",
      gallery_image_paths: "图库路径",
      image_alt: "图片 Alt",
      image_path: "主图路径",
      lead_time: "交期",
      model: "主型号",
      model_code: "外部码 / EAN / 型号代码",
      moq: "MOQ",
      name: "商品名称",
      quality_grade: "品质",
      retail_price: "零售价",
      status: "发布状态",
      stock_qty: "库存",
      supplier: "供应商",
      tags: "标签",
    },
    formRequired: "请补全必填字段。",
    invalidNumber: "请输入有效数字。",
    sortLabels: {
      updated_desc: "最近更新",
      created_desc: "最近创建",
      stock_desc: "库存从高到低",
      name: "商品名称",
    } satisfies Record<ProductSort, string>,
    stockActions: {
      receive: "入库",
      cycle_count: "盘点",
      release: "释放锁定",
      scrap: "报废",
      rma_return: "RMA 回补",
    } satisfies Record<StockAdjustmentAction, string>,
  },
  it: {
    title: "Prodotti",
    subtitle: "Workspace operativo B2B",
    queryTotal: "Totale query",
    currentPage: "Pagina",
    active: "Pubblicati",
    drafts: "Bozze",
    hidden: "Nascosti",
    blocked: "Bloccati",
    lowStock: "Stock basso",
    restockRequests: "Avvisi stock",
    restockOnly: "Solo avvisi",
    restockManage: "Gestisci avvisi",
    restockActiveCount: "{count} avvisi",
    restockEmpty: "Nessun avviso di riassortimento attivo.",
    restockDialogDescription:
      "Avvisi active salvati dai clienti; dopo la gestione puoi marcarli notificati o annullati.",
    restockMarkNotified: "Notificato",
    restockCancel: "Annulla avviso",
    restockUpdateSuccess: "Avviso di riassortimento aggiornato.",
    restockUpdateError: "Aggiornamento avviso non riuscito.",
    missingImage: "Senza immagine",
    missingPrice: "Senza prezzo",
    searchPlaceholder: "Cerca SKU / prodotto / brand / modello",
    accessoryRoot: "Ricambi smartphone",
    cascadeBrand: "Brand",
    cascadeSeries: "Serie",
    cascadeModel: "Modello",
    pickBrand: "Seleziona brand",
    pickSeries: "Seleziona serie",
    pickModel: "Seleziona modello",
    noCascadeOptions: "Nessuna opzione",
    allBrands: "Tutti i brand",
    allSeries: "Tutte le serie",
    allModels: "Tutti i modelli",
    allCatalogStatuses: "Tutti stati catalogo",
    allStockStatuses: "Tutti stati stock",
    allWarehouses: "Tutti magazzini",
    allGrades: "Tutte qualita",
    supplierFilter: "Fornitore",
    supplierFilterPlaceholder: "Fornitore, es. UTOPYA",
    batchFilter: "Lotto",
    batchFilterPlaceholder: "Lotto, es. UTOPYA-7086282",
    filters: "Filtri",
    catalogTree: "Catalogo",
    mobileFilters: "Catalogo / filtri",
    mobileFiltersDescription: "Seleziona brand, serie, modello e altri filtri.",
    selectedCatalogPath: "Percorso selezionato",
    reset: "Reset",
    sync: "Sincronizza",
    exportView: "Esporta vista",
    exportSelection: "Esporta selezione",
    create: "Nuovo prodotto",
    selectedCount: "{count} prodotti selezionati",
    hideSelected: "Nascondi selezionati",
    sourceStats: "{returned}/{total} prodotti · {time}",
    sourcePending: "In attesa",
    syncSuccess: "Prodotti sincronizzati.",
    syncEmpty: "Nessun prodotto trovato.",
    syncError: "Prodotti non disponibili.",
    saveSuccess: "Prodotto {sku} salvato.",
    createSuccess: "Prodotto {sku} creato come bozza.",
    actionSuccess: "Prodotto {sku} aggiornato a {status}.",
    hideSuccess: "{count} prodotti nascosti.",
    stockSuccess: "Movimento stock registrato per {sku}.",
    mediaSuccess: "Media salvati per {sku}.",
    saveError: "Salvataggio non riuscito.",
    actionError: "Azione prodotto non riuscita.",
    stockError: "Movimento stock non riuscito.",
    mediaError: "Salvataggio media non riuscito.",
    emptyTitle: "Nessun prodotto corrispondente",
    emptyBody: "Modifica ricerca o filtri.",
    tableProduct: "Prodotto / SKU",
    tableBrandModel: "Brand / Modello",
    tableCatalog: "Catalogo",
    tableStock: "Stock",
    tablePrice: "Prezzo / Margine",
    tableMedia: "Media",
    tableUpdated: "Aggiornato",
    tableActions: "Azioni",
    pageInfo: "Pagina {page} / {pages}",
    pageSizeLabel: "Prodotti per pagina",
    pageSizeOption: "{count} / pag.",
    previousPage: "Pagina precedente",
    nextPage: "Pagina successiva",
    details: "Dettagli",
    edit: "Modifica",
    duplicate: "Duplica bozza",
    moreActions: "Altre azioni prodotto",
    publish: "Pubblica",
    restore: "Ripristina bozza",
    block: "Blocca",
    hide: "Nascondi",
    stockAdjust: "Movimento stock",
    quickActions: "Azioni rapide",
    copySku: "Copia SKU",
    copied: "Copiato",
    imagePreview: "Anteprima immagine",
    imageCount: "{count} immagini",
    viewCatalog: "Vista catalogo",
    previewStorefront: "Anteprima prodotto",
    publishForStorefront: "Visibile dopo pubblicazione",
    drawerCreateTitle: "Nuovo prodotto",
    drawerEditTitle: "Modifica prodotto",
    drawerViewTitle: "Dettagli prodotto",
    tabBase: "Base",
    tabPrice: "Prezzi",
    tabInventory: "Stock",
    tabMedia: "Media",
    tabCompatibility: "Compatibilita",
    tabAudit: "Audit",
    sectionBase: "Base",
    sectionPrice: "Prezzi",
    sectionInventory: "Riepilogo stock",
    sectionCatalog: "Catalogo",
    sectionMedia: "Media",
    name: "Nome prodotto",
    sku: "SKU",
    category: "Categoria",
    brand: "Brand",
    quality: "Qualita",
    warehouse: "Magazzino",
    netPrice: "Prezzo B2B",
    retailPrice: "Prezzo retail",
    costPrice: "Costo",
    margin: "Margine",
    stock: "Stock",
    availableStock: "Disponibile",
    lockedStock: "Bloccato",
    actualStock: "Fisico",
    moq: "MOQ",
    leadTime: "Lead time",
    compatibility: "Modelli compatibili",
    tags: "Tag",
    modelSeries: "Serie",
    model: "Modello principale",
    modelCode: "Codice esterno / EAN / modello",
    batchCode: "Lotto",
    supplier: "Fornitore",
    imagePath: "Percorso immagine",
    imageAlt: "Alt immagine",
    gallery: "Galleria",
    uploadImage: "Carica immagine",
    setPrimary: "Imposta primaria",
    reason: "Motivo",
    quantity: "Quantita",
    none: "Nessuno",
    open: "Apri",
    save: "Salva",
    cancel: "Annulla",
    close: "Chiudi",
    saving: "Salvataggio...",
    loading: "Caricamento...",
    skuReadonly: "SKU in sola lettura in modifica",
    skuAutoHint: "In creazione usa prima il codice esterno; se manca, genera da brand, modello, categoria e qualita.",
    skuAutoPreview: "SKU generato",
    skuManualEnable: "Modifica manuale",
    skuManualDisable: "Ripristina automatico",
    skuManualHint: "Usa il manuale solo per casi speciali; il backend controlla comunque l'univocita.",
    skuExternalInvalid: "Il codice esterno non e valido come SKU; verra usata la scheda prodotto.",
    stockReadonly: "Lo stock si modifica solo con movimento stock",
    storefrontVisible: "Visibile in storefront",
    auditLoading: "Caricamento audit...",
    auditEmpty: "Nessun audit registrato.",
    auditError: "Audit non disponibile.",
    auditActorFallback: "Operatore sconosciuto",
    auditChangesTitle: "Modifiche",
    auditDetailsTitle: "Dettagli",
    auditUnknownTime: "-",
    auditChangedField: "{field}: {before} → {after}",
    auditResultLabels: {
      success: "Riuscito",
      failed: "Fallito",
    },
    auditCatalogStatusLabels: {
      active: "Pubblicato",
      blocked: "Bloccato",
      draft: "Bozza",
      hidden: "Nascosto",
    },
    auditActionLabels: {
      "product.update": "Aggiornamento prodotto",
      "product.stock_adjust": "Movimento stock",
      "product.images_update": "Aggiornamento immagini",
      "product.publish": "Pubblicazione prodotto",
      "product.hide": "Prodotto nascosto",
      "product.block": "Prodotto bloccato",
      "product.restore_draft": "Ripristino bozza",
      "product.audit": "Audit prodotto",
    },
    auditDefaultReasons: {
      "Updated from admin product API.": "Scheda prodotto salvata dal backend.",
      "Published from admin product API.": "Prodotto pubblicato dal backend.",
      "Hidden from admin product API.": "Prodotto nascosto dal backend.",
      "Blocked from admin product API.": "Prodotto bloccato dal backend.",
      "Restored to draft from admin product API.": "Prodotto riportato in bozza dal backend.",
      "Uploaded product image for": "Immagine prodotto caricata dal backend.",
    },
    auditMetadataLabels: {
      action: "Azione",
      batch_code: "Lotto",
      delta: "Variazione stock",
      gallery_count: "Immagini galleria",
      image_path: "Percorso immagine",
      location: "Magazzino",
      quantity: "Quantita",
      supplier: "Fornitore",
    },
    auditFieldLabels: {
      actual_qty: "Stock fisico",
      available_qty: "Stock disponibile",
      b2b_price: "Prezzo wholesale",
      brand: "Brand",
      category: "Categoria",
      cost_price: "Costo",
      gallery_image_paths: "Galleria",
      image_alt: "Alt immagine",
      image_path: "Immagine principale",
      lead_time: "Lead time",
      model: "Modello principale",
      model_code: "Codice esterno / EAN / modello",
      moq: "MOQ",
      name: "Nome prodotto",
      quality_grade: "Qualita",
      retail_price: "Prezzo retail",
      status: "Stato pubblicazione",
      stock_qty: "Stock",
      supplier: "Fornitore",
      tags: "Tag",
    },
    formRequired: "Completa i campi obbligatori.",
    invalidNumber: "Inserisci un numero valido.",
    sortLabels: {
      updated_desc: "Aggiornati di recente",
      created_desc: "Creati di recente",
      stock_desc: "Stock decrescente",
      name: "Nome prodotto",
    } satisfies Record<ProductSort, string>,
    stockActions: {
      receive: "Ricezione",
      cycle_count: "Inventario",
      release: "Rilascio blocco",
      scrap: "Scarto",
      rma_return: "Rientro RMA",
    } satisfies Record<StockAdjustmentAction, string>,
  },
} as const;

export function AdminProductsPanel() {
  const { locale } = useI18n();
  const text = locale.toLowerCase().startsWith("it") ? panelText.it : panelText.zh;
  const adminText = getAdminDictionary(locale).admin;
  const [filters, setFilters] = React.useState<ProductListFilters>(defaultFilters);
  const [products, setProducts] = React.useState<AdminProductRow[]>([]);
  const [dataSource, setDataSource] = React.useState<ProductDataSource>(() => ({
    ...emptyProductSource,
    label: productSourceLabel("empty", adminText),
  }));
  const [modelGroups, setModelGroups] = React.useState<DeviceModelGroup[]>([]);
  const [selectedSkus, setSelectedSkus] = React.useState<Set<string>>(() => new Set());
  const [notice, setNotice] = React.useState<ProductNotice | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [pendingProductActionKey, setPendingProductActionKey] =
    React.useState<string | null>(null);
  const [isLoadingModelGroups, setIsLoadingModelGroups] = React.useState(true);
  const [showRestockOnly, setShowRestockOnly] = React.useState(false);
  const [isRestockDialogOpen, setIsRestockDialogOpen] = React.useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = React.useState(false);
  const [drawerMode, setDrawerMode] = React.useState<ProductDrawerMode | null>(null);
  const [drawerProduct, setDrawerProduct] = React.useState<AdminProductRow | null>(null);
  const [drawerInlineEditSku, setDrawerInlineEditSku] = React.useState<string | null>(null);
  const [stockAdjustProduct, setStockAdjustProduct] =
    React.useState<AdminProductRow | null>(null);

  const refreshProducts = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);

      try {
        const result = await fetchAdminProducts(filters, signal);

        if (signal?.aborted) {
          return;
        }

        setProducts(result.products);
        setDataSource({
          source: result.source,
          label: productSourceLabel(result.source, adminText),
          syncedAt: formatTimestamp(),
          total: result.total,
          returned: result.returned,
        });
        setSelectedSkus(new Set());
        setNotice(null);
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        setDataSource((current) => ({
          ...current,
          error: getErrorMessage(error),
          syncedAt: formatTimestamp(),
        }));
        setNotice({ tone: "error", message: formatNoticeError(text.syncError, error) });
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [adminText, filters, text]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void refreshProducts(controller.signal);
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refreshProducts]);

  React.useEffect(() => {
    const controller = new AbortController();

    fetchAdminProductModelGroups(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setModelGroups(result.modelGroups);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setModelGroups([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingModelGroups(false);
        }
      });

    return () => controller.abort();
  }, []);

  const selectedProducts = React.useMemo(
    () => products.filter((product) => selectedSkus.has(product.sku)),
    [products, selectedSkus]
  );
  const visibleProducts = React.useMemo(
    () =>
      showRestockOnly
        ? products.filter((product) => (product.activeRestockRequestCount ?? 0) > 0)
        : products,
    [products, showRestockOnly]
  );
  const metrics = React.useMemo(
    () => buildProductMetrics(products, dataSource.total),
    [dataSource.total, products]
  );
  const pageCount = Math.max(1, Math.ceil(dataSource.total / filters.pageSize));

  function updateFilters(patch: Partial<ProductListFilters>) {
    setFilters((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? 0,
    }));
  }

  function replaceProduct(product: AdminProductRow) {
    setProducts((current) => {
      const exists = current.some((item) => item.sku === product.sku);

      if (!exists) {
        return [product, ...current];
      }

      return current.map((item) => (item.sku === product.sku ? product : item));
    });
    setDrawerProduct((current) => (current?.sku === product.sku ? product : current));
    setStockAdjustProduct((current) => (current?.sku === product.sku ? product : current));
    setDataSource((current) => ({ ...current, syncedAt: formatTimestamp() }));
  }

  async function handleCreateProduct(values: ProductFormValues) {
    setIsMutating(true);

    try {
      const saved = await createAdminProduct(values);
      replaceProduct(saved);
      setDataSource((current) => ({
        ...current,
        source: current.source === "empty" ? "api" : current.source,
        label:
          current.source === "empty" ? productSourceLabel("api", adminText) : current.label,
        total: current.total + 1,
        returned: current.returned + 1,
      }));
      setNotice({
        tone: "success",
        message: formatAdminMessage(text.createSuccess, { sku: saved.sku }),
      });

      return saved;
    } catch (error) {
      setNotice({ tone: "error", message: formatNoticeError(text.saveError, error) });
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleUpdateProduct(sku: string, values: ProductFormValues) {
    setIsMutating(true);

    try {
      const saved = await updateAdminProduct(sku, values);
      replaceProduct(saved);
      setNotice({
        tone: "success",
        message: formatAdminMessage(text.saveSuccess, { sku: saved.sku }),
      });

      return saved;
    } catch (error) {
      setNotice({ tone: "error", message: formatNoticeError(text.saveError, error) });
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleProductAction(product: AdminProductRow, action: ProductAction) {
    setPendingProductActionKey(`${product.sku}:${action}`);
    setIsMutating(true);

    try {
      const saved = await runAdminProductAction(product.sku, action);
      replaceProduct(saved);
      setNotice({
        tone: "success",
        message: formatAdminMessage(text.actionSuccess, {
          sku: saved.sku,
          status: adminText.enums.catalogStatus[saved.catalogStatus],
        }),
      });
    } catch {
      setNotice({ tone: "error", message: text.actionError });
    } finally {
      setPendingProductActionKey(null);
      setIsMutating(false);
    }
  }

  async function handleHideProducts(skus: string[]) {
    if (skus.length === 0) {
      return;
    }

    setPendingProductActionKey("bulk:hide");
    setIsMutating(true);

    try {
      const savedProducts = await hideAdminProducts(skus);

      savedProducts.forEach(replaceProduct);
      setSelectedSkus(new Set());
      setNotice({
        tone: "info",
        message: formatAdminMessage(text.hideSuccess, { count: savedProducts.length }),
      });
    } catch {
      setNotice({ tone: "error", message: text.actionError });
    } finally {
      setPendingProductActionKey(null);
      setIsMutating(false);
    }
  }

  async function handleDuplicateProduct(product: AdminProductRow) {
    const duplicatedValues = productFormDefaults({
      ...product,
      sku: ensureUniqueSku(`${product.sku}-COPY`, products),
      name: `${product.name} 副本`,
      catalogStatus: "draft",
    });
    const saved = await handleCreateProduct(duplicatedValues);

    if (saved) {
      setDrawerProduct(saved);
      setDrawerMode("view");
    }
  }

  async function handleStockAdjustment(sku: string, payload: StockAdjustmentPayload) {
    setPendingProductActionKey(`${sku}:stock`);
    setIsMutating(true);

    try {
      const saved = await saveAdminProductStockAdjustment(sku, payload);
      replaceProduct(saved);
      setStockAdjustProduct(null);
      setNotice({
        tone: "success",
        message: formatAdminMessage(text.stockSuccess, { sku: saved.sku }),
      });
      return true;
    } catch {
      setNotice({ tone: "error", message: text.stockError });
      return false;
    } finally {
      setPendingProductActionKey(null);
      setIsMutating(false);
    }
  }

  async function handleMediaSaved(product: AdminProductRow) {
    replaceProduct(product);
    setNotice({
      tone: "success",
      message: formatAdminMessage(text.mediaSuccess, { sku: product.sku }),
    });
  }

  function openDrawer(mode: ProductDrawerMode, product: AdminProductRow | null = null) {
    if (mode === "edit" && product) {
      setDrawerMode("view");
      setDrawerProduct(product);
      setDrawerInlineEditSku(product.sku);
      return;
    }

    setDrawerMode(mode);
    setDrawerProduct(product);
    setDrawerInlineEditSku(null);
  }

  function closeDrawer() {
    setDrawerMode(null);
    setDrawerProduct(null);
    setDrawerInlineEditSku(null);
  }

  return (
    <section className="min-w-0 space-y-2 sm:space-y-4">
      <ProductMetricGrid metrics={metrics} text={text} />

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:rounded-lg sm:shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold tracking-normal text-slate-950">
                {text.title}
              </h1>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600 sm:px-2 sm:py-1">
                {dataSource.returned}/{dataSource.total}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11px] font-medium leading-4 text-slate-500 sm:mt-1 sm:text-xs">
              {dataSource.syncedAt
                ? formatAdminMessage(text.sourceStats, {
                    returned: dataSource.returned,
                    total: dataSource.total,
                    time: dataSource.syncedAt,
                  })
                : text.sourcePending}
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
            <Button
              variant="outline"
              size="xs"
              className="h-8 min-w-0 bg-white px-2 sm:h-9 sm:px-3"
              onClick={() => void refreshProducts()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
              <span className="min-w-0 truncate">{text.sync}</span>
            </Button>
            <Button
              variant={showRestockOnly ? "default" : "outline"}
              size="xs"
              className="h-8 min-w-0 px-2 sm:h-9 sm:px-3"
              onClick={() => setShowRestockOnly((current) => !current)}
            >
              <Bell className="size-4" />
              <span className="min-w-0 truncate">{text.restockOnly}</span>
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="h-8 min-w-0 bg-white px-2 sm:h-9 sm:px-3"
              onClick={() => setIsRestockDialogOpen(true)}
            >
              <Bell className="size-4" />
              <span className="min-w-0 truncate">
                {formatAdminMessage(text.restockActiveCount, {
                  count: metrics.restockRequests,
                })}
              </span>
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="h-8 min-w-0 bg-white px-2 sm:h-9 sm:px-3"
              onClick={() => downloadProductsCsv(products, "view")}
              disabled={products.length === 0}
            >
              <Download className="size-4" />
              <span className="min-w-0 truncate">{text.exportView}</span>
            </Button>
            <Button size="xs" className="h-8 min-w-0 px-2 sm:h-9 sm:px-3" onClick={() => openDrawer("create")}>
              <Plus className="size-4" />
              <span className="min-w-0 truncate">{text.create}</span>
            </Button>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50/70 px-2.5 py-2 sm:px-4 sm:py-3 lg:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <ProductSearchField
              value={filters.q}
              text={text}
              onChange={(value) => updateFilters({ q: value })}
            />
            <Button
              variant="outline"
              size="sm"
              aria-label={text.mobileFilters}
              className="h-8 bg-white px-2 sm:h-9 sm:px-3"
              onClick={() => setIsMobileFiltersOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
              <span className="hidden sm:inline">{text.mobileFilters}</span>
            </Button>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="hidden border-r border-slate-200 bg-slate-50/70 p-2.5 lg:block">
            <ProductCatalogTree
              className="sticky top-3 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-1"
              filters={filters}
              modelGroups={modelGroups}
              isLoadingModelGroups={isLoadingModelGroups}
              text={text}
              onChange={updateFilters}
            />
          </aside>

          <div className="min-w-0">
            <div className="hidden border-b border-slate-200 bg-slate-50/70 px-3 py-2 lg:block">
              <ProductFilters
                filters={filters}
                text={text}
                adminText={adminText}
                onChange={updateFilters}
                onReset={() => setFilters(defaultFilters)}
              />
            </div>

            {notice && (
              <div className="px-3 pt-3 sm:px-4">
                <div className={cn("flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium", noticeClassName(notice.tone))}>
                  {notice.tone === "error" ? (
                    <XCircle className="size-4 shrink-0" />
                  ) : notice.tone === "warning" ? (
                    <AlertTriangle className="size-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">{notice.message}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-current hover:bg-white/60"
                    onClick={() => setNotice(null)}
                  >
                    {text.close}
                  </Button>
                </div>
              </div>
            )}

            {selectedProducts.length > 0 && (
              <div className="px-3 pt-3 sm:px-4">
                <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-semibold text-slate-800">
                    {formatAdminMessage(text.selectedCount, { count: selectedProducts.length })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white"
                      onClick={() => downloadProductsCsv(selectedProducts, "selected")}
                    >
                      <Download className="size-4" />
                      {text.exportSelection}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white text-amber-700 hover:text-amber-700"
                      disabled={isMutating}
                      onClick={() => void handleHideProducts(selectedProducts.map((item) => item.sku))}
                    >
                      {pendingProductActionKey === "bulk:hide" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <EyeOff className="size-4" />
                      )}
                      {text.hideSelected}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedSkus(new Set())}
                    >
                      {adminText.common.deselect}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <ProductTable
              products={visibleProducts}
              selectedSkus={selectedSkus}
              isLoading={isLoading}
              isMutating={isMutating}
              pendingActionKey={pendingProductActionKey}
              text={text}
              adminText={adminText}
              onSelectChange={setSelectedSkus}
              onView={(product) => openDrawer("view", product)}
              onEdit={(product) => openDrawer("edit", product)}
              onDuplicate={(product) => void handleDuplicateProduct(product)}
              onAction={(product, action) => void handleProductAction(product, action)}
              onHide={(product) => void handleProductAction(product, "hide")}
              onStockAdjust={setStockAdjustProduct}
            />

            <ProductPagination
              filters={filters}
              pageCount={pageCount}
              total={dataSource.total}
              returned={visibleProducts.length}
              text={text}
              onChange={updateFilters}
            />
          </div>
        </div>
      </div>

      <ProductMobileFiltersSheet
        open={isMobileFiltersOpen}
        filters={filters}
        modelGroups={modelGroups}
        isLoadingModelGroups={isLoadingModelGroups}
        text={text}
        adminText={adminText}
        onOpenChange={setIsMobileFiltersOpen}
        onChange={updateFilters}
        onReset={() => setFilters(defaultFilters)}
      />

      <ProductDrawer
        mode={drawerMode}
        product={drawerProduct}
        products={products}
        isMutating={isMutating}
        text={text}
        adminText={adminText}
        initialEditSku={drawerInlineEditSku}
        onInitialEditHandled={() => setDrawerInlineEditSku(null)}
        onClose={closeDrawer}
        onCreate={handleCreateProduct}
        onSave={handleUpdateProduct}
        onSaved={(product) => {
          setDrawerProduct(product);
          setDrawerMode("view");
          setDrawerInlineEditSku(null);
        }}
        onStockAdjust={setStockAdjustProduct}
        onMediaSaved={handleMediaSaved}
      />

      <ProductRestockRequestsDialog
        open={isRestockDialogOpen}
        text={text}
        onHandled={(sku) => {
          setProducts((current) =>
            current.map((product) =>
              product.sku === sku
                ? {
                    ...product,
                    activeRestockRequestCount: Math.max(
                      0,
                      (product.activeRestockRequestCount ?? 0) - 1
                    ),
                  }
                : product
            )
          );
        }}
        onNotice={setNotice}
        onOpenChange={setIsRestockDialogOpen}
      />

      <StockAdjustmentDialog
        product={stockAdjustProduct}
        open={Boolean(stockAdjustProduct)}
        text={text}
        onOpenChange={(open) => !open && setStockAdjustProduct(null)}
        onSave={handleStockAdjustment}
      />
    </section>
  );
}

function ProductRestockRequestsDialog({
  open,
  text,
  onHandled,
  onNotice,
  onOpenChange,
}: {
  open: boolean;
  text: typeof panelText.zh | typeof panelText.it;
  onHandled: (sku: string) => void;
  onNotice: (notice: ProductNotice) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [requests, setRequests] = React.useState<AdminRestockRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();

    const loadingTimer = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        setIsLoading(true);
      }
    }, 0);
    fetchAdminRestockRequests(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setRequests(items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRequests([]);
          onNotice({ tone: "error", message: text.syncError });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
      window.clearTimeout(loadingTimer);
    };
  }, [onNotice, open, text.syncError]);

  async function markRequest(
    request: AdminRestockRequest,
    status: Exclude<AdminRestockRequestStatus, "active">
  ) {
    setUpdatingId(request.id);

    try {
      await updateAdminRestockRequestStatus(request.id, status);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      onHandled(request.sku);
      onNotice({ tone: "success", message: text.restockUpdateSuccess });
    } catch {
      onNotice({ tone: "error", message: text.restockUpdateError });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{text.restockRequests}</DialogTitle>
          <DialogDescription>{text.restockDialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[56vh] space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              {text.loading}
            </div>
          ) : requests.length > 0 ? (
            requests.map((request) => (
              <div
                key={request.id}
                className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-black text-slate-950">
                    {request.productName}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                    <span className="font-mono">{request.sku}</span>
                    <span>{request.createdAt}</span>
                    {request.customerId ? <span>{request.customerId}</span> : null}
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    size="xs"
                    className="bg-emerald-600 text-white hover:bg-emerald-600"
                    disabled={Boolean(updatingId)}
                    onClick={() => void markRequest(request, "notified")}
                  >
                    {updatingId === request.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3" />
                    )}
                    {text.restockMarkNotified}
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="bg-white text-slate-600"
                    disabled={Boolean(updatingId)}
                    onClick={() => void markRequest(request, "cancelled")}
                  >
                    <XCircle className="size-3" />
                    {text.restockCancel}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              {text.restockEmpty}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {text.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductMetricGrid({
  metrics,
  text,
}: {
  metrics: ReturnType<typeof buildProductMetrics>;
  text: typeof panelText.zh | typeof panelText.it;
}) {
  const cards = [
    { label: text.queryTotal, value: metrics.total, icon: Package, tone: "blue" },
    { label: text.active, value: metrics.active, icon: PackageCheck, tone: "green" },
    { label: text.drafts, value: metrics.draft, icon: Edit, tone: "amber" },
    { label: text.hidden, value: metrics.hidden, icon: EyeOff, tone: "slate" },
    { label: text.blocked, value: metrics.blocked, icon: Ban, tone: "red" },
    { label: text.lowStock, value: metrics.lowStock, icon: Boxes, tone: "orange" },
    { label: text.restockRequests, value: metrics.restockRequests, icon: Bell, tone: "amber" },
    { label: text.missingImage, value: metrics.missingImage, icon: ImageIcon, tone: "cyan" },
    { label: text.missingPrice, value: metrics.missingPrice, icon: Euro, tone: "violet" },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-5 xl:grid-cols-9">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <div
          key={label}
          className="min-h-[58px] min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.035)] sm:min-h-[68px] sm:rounded-lg sm:px-3 sm:py-2 sm:shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0 truncate text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs">{label}</div>
            <Icon className={cn("mt-0.5 size-3.5 shrink-0 sm:size-4", metricIconClass(tone))} />
          </div>
          <div className="mt-0.5 truncate text-lg font-black leading-6 text-slate-950 sm:mt-1 sm:text-xl">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ProductSearchField({
  className,
  value,
  text,
  onChange,
}: {
  className?: string;
  value: string;
  text: typeof panelText.zh | typeof panelText.it;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md bg-white pl-9 text-sm sm:h-9"
        placeholder={text.searchPlaceholder}
      />
    </div>
  );
}

function ProductFilters({
  filters,
  text,
  adminText,
  onChange,
  onReset,
}: {
  filters: ProductListFilters;
  text: typeof panelText.zh | typeof panelText.it;
  adminText: ReturnType<typeof getAdminDictionary>["admin"];
  onChange: (patch: Partial<ProductListFilters>) => void;
  onReset: () => void;
}) {
  const hasFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "page" || key === "pageSize" || key === "sort") {
      return false;
    }

    return value !== defaultFilters[key as keyof ProductListFilters];
  });
  const selectTriggerClass = "h-8 w-full rounded-md bg-white text-sm sm:h-9";
  const inputClass = "h-8 rounded-md bg-white text-sm sm:h-9";

  return (
    <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-12 2xl:grid-cols-[minmax(220px,1.35fr)_minmax(145px,0.9fr)_minmax(145px,0.9fr)_minmax(120px,0.75fr)_minmax(145px,0.9fr)_minmax(190px,1.1fr)_minmax(145px,0.9fr)_auto]">
      <ProductSearchField
        className="col-span-2 sm:col-span-4 lg:col-span-3 2xl:col-auto"
        value={filters.q}
        text={text}
        onChange={(value) => onChange({ q: value })}
      />
      <div className="min-w-0 lg:col-span-2 2xl:col-auto">
        <CatalogStatusSelect
          value={filters.catalogStatus}
          text={text}
          onChange={(value) => onChange({ catalogStatus: value })}
        />
      </div>
      <div className="min-w-0 lg:col-span-2 2xl:col-auto">
        <StockStatusSelect
          value={filters.stockStatus}
          text={text}
          onChange={(value) => onChange({ stockStatus: value })}
        />
      </div>
      <div className="min-w-0 lg:col-span-1 2xl:col-auto">
        <Select
          value={filters.grade}
          onValueChange={(value) =>
            onChange({ grade: value as ProductListFilters["grade"] })
          }
        >
          <SelectTrigger size="sm" className={selectTriggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{text.allGrades}</SelectItem>
            {productGrades.map((grade) => (
              <SelectItem key={grade} value={grade}>
                {adminText.enums.productGrade[grade]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 lg:col-span-2 2xl:col-auto">
        <Input
          value={filters.supplier}
          aria-label={text.supplierFilter}
          className={inputClass}
          placeholder={text.supplierFilterPlaceholder}
          onChange={(event) => onChange({ supplier: event.target.value })}
        />
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-2 lg:col-span-2 2xl:col-auto">
        <Input
          value={filters.batchCode}
          aria-label={text.batchFilter}
          className={cn(inputClass, "font-mono text-xs")}
          placeholder={text.batchFilterPlaceholder}
          onChange={(event) => onChange({ batchCode: event.target.value })}
        />
      </div>
      <div className="min-w-0 lg:col-span-2 2xl:col-auto">
        <Select
          value={filters.sort}
          onValueChange={(value) => onChange({ sort: value as ProductSort })}
        >
          <SelectTrigger size="sm" className={selectTriggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {productSorts.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {text.sortLabels[sort]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 min-w-0 rounded-md bg-white px-2 sm:h-9 lg:col-span-1 2xl:col-auto"
        onClick={onReset}
        disabled={!hasFilters}
      >
        <Filter className="size-4" />
        <span className="min-w-0 truncate">{text.reset}</span>
      </Button>
    </div>
  );
}

function ProductMobileFiltersSheet({
  open,
  filters,
  modelGroups,
  isLoadingModelGroups,
  text,
  adminText,
  onOpenChange,
  onChange,
  onReset,
}: {
  open: boolean;
  filters: ProductListFilters;
  modelGroups: DeviceModelGroup[];
  isLoadingModelGroups: boolean;
  text: typeof panelText.zh | typeof panelText.it;
  adminText: ReturnType<typeof getAdminDictionary>["admin"];
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<ProductListFilters>) => void;
  onReset: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[92vw] max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="border-b border-slate-200 bg-white p-3 pr-12">
          <SheetTitle className="text-base font-black">{text.mobileFilters}</SheetTitle>
          <SheetDescription className="text-xs font-semibold">
            {text.mobileFiltersDescription}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">
          <ProductCatalogSelectionSummary filters={filters} text={text} />
          <ProductCatalogTree
            filters={filters}
            modelGroups={modelGroups}
            isLoadingModelGroups={isLoadingModelGroups}
            text={text}
            onChange={onChange}
          />
          <section className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
            <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-700">
              <SlidersHorizontal className="size-4 text-slate-500" />
              {text.filters}
            </div>
            <ProductFilters
              filters={filters}
              text={text}
              adminText={adminText}
              onChange={onChange}
              onReset={onReset}
            />
          </section>
        </div>
        <SheetFooter className="border-t border-slate-200 bg-white p-3">
          <Button variant="outline" className="bg-white" onClick={() => onOpenChange(false)}>
            {text.close}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ProductCatalogSelectionSummary({
  filters,
  text,
}: {
  filters: ProductListFilters;
  text: typeof panelText.zh | typeof panelText.it;
}) {
  const path = buildProductCatalogSelectionPath(filters);

  if (path.length === 0) {
    return null;
  }

  return (
    <section className="mb-2 min-w-0 rounded-lg border border-primary/15 bg-primary/5 px-2.5 py-2 text-xs">
      <div className="font-black text-primary">{text.selectedCatalogPath}</div>
      <div className="mt-1 break-words font-semibold leading-5 text-slate-700 [overflow-wrap:anywhere]">
        {path.join(" / ")}
      </div>
    </section>
  );
}

function buildProductCatalogSelectionPath(filters: ProductListFilters) {
  return [filters.brand, filters.modelSeries, filters.model].filter(
    (value): value is string =>
      typeof value === "string" && value.length > 0 && value !== "all"
  );
}

function ProductCatalogTree({
  className,
  filters,
  modelGroups,
  isLoadingModelGroups,
  text,
  onChange,
}: {
  className?: string;
  filters: ProductListFilters;
  modelGroups: DeviceModelGroup[];
  isLoadingModelGroups: boolean;
  text: typeof panelText.zh | typeof panelText.it;
  onChange: (patch: Partial<ProductListFilters>) => void;
}) {
  const treeId = React.useId();
  const groups = React.useMemo(
    () => buildCascadeModelGroups(modelGroups),
    [modelGroups]
  );
  const selectedBrand = filters.brand === "all" ? "" : filters.brand;
  const selectedSeries = filters.modelSeries === "all" ? "" : filters.modelSeries;
  const selectedModel = filters.model === "all" ? "" : filters.model;
  const selectedSeriesKey =
    selectedBrand && selectedSeries ? catalogTreeSeriesKey(selectedBrand, selectedSeries) : "";
  const [collapsedBrand, setCollapsedBrand] = React.useState<string | null>(null);
  const [collapsedSeriesKey, setCollapsedSeriesKey] = React.useState<string | null>(null);
  const expandedBrand = selectedBrand && collapsedBrand !== selectedBrand ? selectedBrand : "";
  const expandedSeriesKey =
    selectedSeriesKey && collapsedSeriesKey !== selectedSeriesKey ? selectedSeriesKey : "";

  return (
    <nav
      aria-label={text.catalogTree}
      className={cn(
        "min-w-0 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.03)]",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <Package className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-black text-slate-900">{text.catalogTree}</span>
        </div>
        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">
          {groups.length}
        </span>
      </div>

      <div className="grid gap-1">
        <CatalogTreeNodeButton
          icon={Package}
          label={text.accessoryRoot}
          meta={`${groups.length}`}
          selected={!selectedBrand}
          onClick={() => {
            setCollapsedBrand(null);
            setCollapsedSeriesKey(null);
            onChange({ q: "", brand: "all", modelSeries: "all", model: "all" });
          }}
        />

        {isLoadingModelGroups ? (
          <CatalogTreePlaceholder>{text.loading}</CatalogTreePlaceholder>
        ) : groups.length > 0 ? (
          groups.map((group, groupIndex) => {
            const isBrandExpanded = expandedBrand === group.brand;
            const isBrandSelected = selectedBrand === group.brand;
            const brandRegionId = `${treeId}-brand-${groupIndex}`;

            return (
              <div key={group.brand} className="min-w-0">
                <CatalogTreeNodeButton
                  icon={Tag}
                  label={group.brand}
                  meta={`${group.models.length}`}
                  selected={isBrandSelected && !selectedSeries && !selectedModel}
                  expanded={isBrandExpanded}
                  controls={brandRegionId}
                  onClick={() => {
                    setCollapsedBrand(
                      isBrandExpanded && isBrandSelected && !selectedSeries && !selectedModel
                        ? group.brand
                        : null
                    );
                    setCollapsedSeriesKey(null);
                    onChange({ q: "", brand: group.brand, modelSeries: "all", model: "all" });
                  }}
                />

                {isBrandExpanded && (
                  <div id={brandRegionId} className="ml-3 mt-1 grid gap-1 border-l border-slate-200 pl-2">
                    {group.series.length > 0 ? (
                      group.series.map((seriesGroup, seriesIndex) => {
                        const seriesKey = catalogTreeSeriesKey(group.brand, seriesGroup.series);
                        const isSeriesExpanded = expandedSeriesKey === seriesKey;
                        const isSeriesSelected =
                          isBrandSelected && selectedSeries === seriesGroup.series;
                        const seriesRegionId = `${treeId}-series-${groupIndex}-${seriesIndex}`;

                        return (
                          <div key={seriesGroup.series} className="min-w-0">
                            <CatalogTreeNodeButton
                              icon={Boxes}
                              label={seriesGroup.series}
                              meta={`${seriesGroup.models.length}`}
                              selected={isSeriesSelected && !selectedModel}
                              expanded={isSeriesExpanded}
                              controls={seriesRegionId}
                              compact
                              onClick={() => {
                                setCollapsedBrand(null);
                                setCollapsedSeriesKey(
                                  isSeriesExpanded && isSeriesSelected && !selectedModel
                                    ? seriesKey
                                    : null
                                );
                                onChange({
                                  q: "",
                                  brand: group.brand,
                                  modelSeries: seriesGroup.series,
                                  model: "all",
                                });
                              }}
                            />

                            {isSeriesExpanded && (
                              <div id={seriesRegionId} className="ml-3 mt-1 grid gap-1 border-l border-slate-100 pl-2">
                                {seriesGroup.models.map((model) => (
                                  <CatalogTreeNodeButton
                                    key={model}
                                    icon={Smartphone}
                                    label={model}
                                    selected={
                                      isSeriesSelected && selectedModel === model
                                    }
                                    compact
                                    leaf
                                    onClick={() => {
                                      setCollapsedBrand(null);
                                      setCollapsedSeriesKey(null);
                                      onChange({
                                        q: "",
                                        brand: group.brand,
                                        modelSeries: seriesGroup.series,
                                        model,
                                      });
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : group.models.length > 0 ? (
                      group.models.map((model) => (
                        <CatalogTreeNodeButton
                          key={model}
                          icon={Smartphone}
                          label={model}
                          selected={isBrandSelected && !selectedSeries && selectedModel === model}
                          compact
                          leaf
                          onClick={() => {
                            setCollapsedBrand(null);
                            setCollapsedSeriesKey(null);
                            onChange({
                              q: "",
                              brand: group.brand,
                              modelSeries: "all",
                              model,
                            });
                          }}
                        />
                      ))
                    ) : (
                      <CatalogTreePlaceholder>{text.noCascadeOptions}</CatalogTreePlaceholder>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <CatalogTreePlaceholder>{text.noCascadeOptions}</CatalogTreePlaceholder>
        )}
      </div>
    </nav>
  );
}

function CatalogTreeNodeButton({
  icon: Icon,
  label,
  meta,
  selected,
  expanded,
  controls,
  compact,
  leaf,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta?: string;
  selected: boolean;
  expanded?: boolean;
  controls?: string;
  compact?: boolean;
  leaf?: boolean;
  onClick: () => void;
}) {
  const hasChildren = typeof expanded === "boolean";

  const nodeButton = (
    <button
      type="button"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-controls={hasChildren ? controls : undefined}
      title={label}
      className={cn(
        "flex w-full min-w-0 items-center gap-2 rounded-md text-left font-bold transition hover:bg-slate-100",
        compact ? "min-h-8 px-2 py-1.5 text-xs" : "min-h-9 px-2.5 py-2 text-sm",
        selected ? "bg-primary text-primary-foreground hover:bg-primary" : "text-slate-700",
        leaf && "font-semibold"
      )}
      onClick={onClick}
    >
      {hasChildren ? (
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-current/60 transition-transform",
            expanded && "rotate-90"
          )}
        />
      ) : (
        <span className="size-3.5 shrink-0" />
      )}
      <Icon className="size-3.5 shrink-0 text-current/70" />
      <span
        className={cn(
          "min-w-0 flex-1",
          selected
            ? "line-clamp-2 break-words leading-snug [overflow-wrap:anywhere]"
            : "truncate"
        )}
      >
        {label}
      </span>
      {meta && (
        <span className="shrink-0 text-[11px] font-black text-current/55">{meta}</span>
      )}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{nodeButton}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={8}
        className="max-w-[min(320px,calc(100vw-2rem))] break-words text-xs font-semibold"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function CatalogTreePlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-16 place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-400">
      {children}
    </div>
  );
}

function catalogTreeSeriesKey(brand: string, series: string) {
  return `${brand}::${series}`;
}

function CatalogStatusSelect({
  value,
  text,
  onChange,
}: {
  value: FilterValue<CatalogStatus>;
  text: typeof panelText.zh | typeof panelText.it;
  onChange: (value: FilterValue<CatalogStatus>) => void;
}) {
  const { locale } = useI18n();
  const adminText = getAdminDictionary(locale).admin;

  return (
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue as FilterValue<CatalogStatus>)}>
      <SelectTrigger size="sm" className="h-8 w-full rounded-md bg-white text-sm sm:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{text.allCatalogStatuses}</SelectItem>
        {catalogStatuses.map((status) => (
          <SelectItem key={status} value={status}>
            {adminText.enums.catalogStatus[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StockStatusSelect({
  value,
  text,
  onChange,
}: {
  value: FilterValue<StockStatus>;
  text: typeof panelText.zh | typeof panelText.it;
  onChange: (value: FilterValue<StockStatus>) => void;
}) {
  const { locale } = useI18n();
  const adminText = getAdminDictionary(locale).admin;

  return (
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue as FilterValue<StockStatus>)}>
      <SelectTrigger size="sm" className="h-8 w-full rounded-md bg-white text-sm sm:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{text.allStockStatuses}</SelectItem>
        {stockStatuses.map((status) => (
          <SelectItem key={status} value={status}>
            {adminText.enums.stockStatus[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProductTable({
  products,
  selectedSkus,
  isLoading,
  isMutating,
  pendingActionKey,
  text,
  adminText,
  onSelectChange,
  onView,
  onEdit,
  onDuplicate,
  onAction,
  onHide,
  onStockAdjust,
}: {
  products: AdminProductRow[];
  selectedSkus: Set<string>;
  isLoading: boolean;
  isMutating: boolean;
  pendingActionKey: string | null;
  text: typeof panelText.zh | typeof panelText.it;
  adminText: ReturnType<typeof getAdminDictionary>["admin"];
  onSelectChange: (value: Set<string>) => void;
  onView: (product: AdminProductRow) => void;
  onEdit: (product: AdminProductRow) => void;
  onDuplicate: (product: AdminProductRow) => void;
  onAction: (product: AdminProductRow, action: ProductAction) => void;
  onHide: (product: AdminProductRow) => void;
  onStockAdjust: (product: AdminProductRow) => void;
}) {
  const allSelected = products.length > 0 && products.every((product) => selectedSkus.has(product.sku));
  const someSelected = products.some((product) => selectedSkus.has(product.sku));
  const showInitialSkeleton = isLoading && products.length === 0;
  const showRefreshBar = isLoading && products.length > 0;

  function toggleAll(checked: boolean) {
    onSelectChange(checked ? new Set(products.map((product) => product.sku)) : new Set());
  }

  function toggleOne(sku: string, checked: boolean) {
    const next = new Set(selectedSkus);

    if (checked) {
      next.add(sku);
    } else {
      next.delete(sku);
    }

    onSelectChange(next);
  }

  return (
    <div
      aria-busy={isLoading}
      aria-live="polite"
      className="min-w-0 overflow-hidden bg-white"
    >
      {showRefreshBar ? <ProductTableLoadingBar label={text.loading} /> : null}
      <div className="lg:hidden">
        {products.length ? (
          <div className="grid gap-2 p-2">
            {products.map((product) => (
              <ProductMobileCard
                key={product.sku}
                product={product}
                selected={selectedSkus.has(product.sku)}
                isMutating={isMutating}
                pendingActionKey={pendingActionKey}
                text={text}
                adminText={adminText}
                onSelect={(checked) => toggleOne(product.sku, checked)}
                onView={onView}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onAction={onAction}
                onHide={onHide}
                onStockAdjust={onStockAdjust}
              />
            ))}
          </div>
        ) : showInitialSkeleton ? (
          <div className="p-2">
            <AdminSkeletonRows rows={5} />
          </div>
        ) : (
          <ProductEmptyState isLoading={isLoading} text={text} />
        )}
      </div>
      <div className="hidden lg:block">
        <div className="max-w-full overflow-hidden">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-slate-50 text-xs">
              <TableRow>
                <TableHead className="w-9 whitespace-normal px-2">
                  <Checkbox
                    checked={allSelected || (someSelected && "indeterminate")}
                    onCheckedChange={(value) => toggleAll(value === true)}
                    aria-label="Select all products"
                  />
                </TableHead>
                <TableHead className="w-[38%] whitespace-normal 2xl:w-[32%]">
                  {text.tableProduct}
                </TableHead>
                <TableHead className="w-[16%] whitespace-normal 2xl:w-[14%]">
                  {text.tableBrandModel}
                </TableHead>
                <TableHead className="w-[9%] whitespace-normal 2xl:w-[8%]">
                  {text.tableCatalog}
                </TableHead>
                <TableHead className="w-[10%] whitespace-normal 2xl:w-[9%]">
                  {text.tableStock}
                </TableHead>
                <TableHead className="w-[11%] whitespace-normal 2xl:w-[10%]">
                  {text.tablePrice}
                </TableHead>
                <TableHead className="hidden w-[12%] whitespace-normal 2xl:table-cell">
                  {text.tableUpdated}
                </TableHead>
                <TableHead className="w-12 whitespace-normal text-right">
                  {text.tableActions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length ? (
                products.map((product) => (
                  <TableRow
                    key={product.sku}
                    className={cn(
                      "cursor-pointer",
                      pendingActionKey?.startsWith(`${product.sku}:`) &&
                        "ring-2 ring-primary/15"
                    )}
                    data-state={selectedSkus.has(product.sku) ? "selected" : undefined}
                    data-pending={pendingActionKey?.startsWith(`${product.sku}:`) ? "true" : undefined}
                    onClick={() => onView(product)}
                  >
                    <TableCell className="w-9 whitespace-normal px-2" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selectedSkus.has(product.sku)}
                        onCheckedChange={(value) => toggleOne(product.sku, value === true)}
                        aria-label={`Select ${product.sku}`}
                      />
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-normal">
                      <ProductIdentity product={product} />
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-normal">
                      <ProductBrandModel product={product} />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Badge className={cn(catalogStatusBadgeClass(product.catalogStatus), "max-w-full truncate")}>
                        {adminText.enums.catalogStatus[product.catalogStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-normal">
                      <ProductStockSummary
                        product={product}
                        adminText={adminText}
                        text={text}
                      />
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-normal">
                      <ProductPriceSummary product={product} text={text} />
                    </TableCell>
                    <TableCell className="hidden whitespace-normal 2xl:table-cell">
                      <span className="text-xs font-medium leading-tight text-slate-500">
                        {product.updatedAt}
                      </span>
                    </TableCell>
                    <TableCell className="w-12 whitespace-normal px-2 text-right" onClick={(event) => event.stopPropagation()}>
                      <ProductActionsMenu
                        product={product}
                        isMutating={isMutating}
                        pendingActionKey={pendingActionKey}
                        text={text}
                        onView={onView}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onAction={onAction}
                        onHide={onHide}
                        onStockAdjust={onStockAdjust}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="whitespace-normal p-3" colSpan={8}>
                    {showInitialSkeleton ? (
                      <AdminSkeletonRows rows={5} />
                    ) : (
                      <ProductEmptyState isLoading={isLoading} text={text} />
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function ProductTableLoadingBar({ label }: { label: string }) {
  return (
    <div
      className="border-b border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary"
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-primary/10">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/70" />
      </div>
    </div>
  );
}

function ProductMobileCard({
  product,
  selected,
  isMutating,
  pendingActionKey,
  text,
  adminText,
  onSelect,
  onView,
  onEdit,
  onDuplicate,
  onAction,
  onHide,
  onStockAdjust,
}: {
  product: AdminProductRow;
  selected: boolean;
  isMutating: boolean;
  pendingActionKey: string | null;
  text: typeof panelText.zh | typeof panelText.it;
  adminText: ReturnType<typeof getAdminDictionary>["admin"];
  onSelect: (checked: boolean) => void;
  onView: (product: AdminProductRow) => void;
  onEdit: (product: AdminProductRow) => void;
  onDuplicate: (product: AdminProductRow) => void;
  onAction: (product: AdminProductRow, action: ProductAction) => void;
  onHide: (product: AdminProductRow) => void;
  onStockAdjust: (product: AdminProductRow) => void;
}) {
  return (
    <div
      className={cn(
        "min-h-[124px] rounded-md border border-slate-200 bg-white p-2 shadow-[0_8px_22px_rgba(15,23,42,0.035)]",
        selected && "border-primary/40 bg-primary/5",
        pendingActionKey?.startsWith(`${product.sku}:`) &&
          "border-primary/30 ring-2 ring-primary/15"
      )}
    >
      <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)_auto] gap-2">
        <div className="relative">
          <ProductImageThumb product={product} className="size-16" sizes="64px" />
          <div className="absolute left-1 top-1 rounded bg-white/90 shadow-sm">
            <Checkbox
              checked={selected}
              onCheckedChange={(value) => onSelect(value === true)}
              aria-label={`Select ${product.sku}`}
              className="size-4 border-slate-300"
            />
          </div>
        </div>

        <button
          type="button"
          className="grid min-w-0 content-start text-left"
          onClick={() => onView(product)}
        >
          <div className="line-clamp-2 min-h-9 break-words text-[13px] font-black leading-[18px] text-slate-950 [overflow-wrap:anywhere]">
            {product.name}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] font-semibold leading-4 text-slate-500">
            {product.sku}
          </div>
          <div className="mt-0.5 truncate text-[10px] font-semibold leading-3 text-slate-400">
            {product.category} · {[product.modelSeries, product.model || product.compatibleWith[0] || text.none].filter(Boolean).join(" / ")}
          </div>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge className={cn(catalogStatusBadgeClass(product.catalogStatus), "h-5 px-1.5 text-[10px]")}>
            {adminText.enums.catalogStatus[product.catalogStatus]}
          </Badge>
          <ProductActionsMenu
            product={product}
            isMutating={isMutating}
            pendingActionKey={pendingActionKey}
            text={text}
            onView={onView}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onAction={onAction}
            onHide={onHide}
            onStockAdjust={onStockAdjust}
          />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5 text-xs">
        <MetricPill label={text.brand} value={product.brand} />
        <MetricPill label={text.stock} value={product.availableQty ?? product.stock} />
        <MetricPill label={text.restockRequests} value={product.activeRestockRequestCount ?? 0} />
        <MetricPill label={text.netPrice} value={formatEuro(product.price)} />
      </div>
    </div>
  );
}

function ProductIdentity({ product }: { product: AdminProductRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ProductImageThumb product={product} className="size-10 xl:size-11" sizes="44px" />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 break-words text-sm font-bold leading-snug text-slate-950 [overflow-wrap:anywhere]">
          {product.name}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="min-w-0 break-all font-mono text-[11px] font-semibold text-slate-500">
            {product.sku}
          </span>
          <span className="min-w-0 truncate text-[11px] font-semibold text-slate-400">
            {product.category}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProductImageThumb({
  product,
  className,
  sizes,
}: {
  product: AdminProductRow;
  className?: string;
  sizes: string;
}) {
  const candidates = React.useMemo(() => getProductImageCandidates(product), [product]);
  const [failedImageState, setFailedImageState] = React.useState<{
    sku: string;
    urls: string[];
  }>({ sku: product.sku, urls: [] });
  const failedUrls = failedImageState.sku === product.sku ? failedImageState.urls : [];
  const imageUrl = candidates.find((candidate) => !failedUrls.includes(candidate));
  const imageAlt = product.imageAlt || product.name;

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white",
        className
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          sizes={sizes}
          quality={75}
          loading="lazy"
          decoding="async"
          className="object-contain p-1"
          onError={() =>
            setFailedImageState((current) => {
              const urls = current.sku === product.sku ? current.urls : [];

              if (urls.includes(imageUrl)) {
                return current.sku === product.sku ? current : { sku: product.sku, urls };
              }

              return { sku: product.sku, urls: [...urls, imageUrl] };
            })
          }
        />
      ) : (
        <ProductVisual
          variant={product.visual}
          className="size-full rounded-none border-0"
        />
      )}
    </div>
  );
}

function ProductDetailImageGallery({
  product,
  text,
  sizes,
}: {
  product: AdminProductRow;
  text: typeof panelText.zh | typeof panelText.it;
  sizes: string;
}) {
  const candidates = React.useMemo(() => getProductImageCandidates(product), [product]);
  const assetUrls = React.useMemo(() => getProductImageAssetCandidates(product), [product]);
  const [selectedUrl, setSelectedUrl] = React.useState("");
  const [failedImageState, setFailedImageState] = React.useState<{
    sku: string;
    urls: string[];
  }>({ sku: product.sku, urls: [] });
  const failedUrls = failedImageState.sku === product.sku ? failedImageState.urls : [];
  const imageUrls = candidates.filter((candidate) => !failedUrls.includes(candidate));
  const thumbnailUrls = assetUrls.filter((candidate) => !failedUrls.includes(candidate));
  const activeUrl = selectedUrl && imageUrls.includes(selectedUrl) ? selectedUrl : imageUrls[0];
  const imageAlt = product.imageAlt || product.name;

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSelectedUrl("");
      setFailedImageState({ sku: product.sku, urls: [] });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [product.sku]);

  function markFailed(url: string) {
    setFailedImageState((current) => {
      const urls = current.sku === product.sku ? current.urls : [];

      if (urls.includes(url)) {
        return current.sku === product.sku ? current : { sku: product.sku, urls };
      }

      return { sku: product.sku, urls: [...urls, url] };
    });
  }

  return (
    <div className="min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {activeUrl ? (
          <Image
            src={activeUrl}
            alt={imageAlt}
            fill
            sizes={sizes}
            quality={85}
            loading="lazy"
            decoding="async"
            className="object-contain p-2"
            onError={() => markFailed(activeUrl)}
          />
        ) : (
          <ProductVisual
            variant={product.visual}
            className="size-full rounded-none border-0"
          />
        )}
        {assetUrls.length > 1 && (
          <div className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm">
            {formatAdminMessage(text.imageCount, { count: String(assetUrls.length) })}
          </div>
        )}
      </div>
      {thumbnailUrls.length > 1 && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {thumbnailUrls.slice(0, 8).map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              aria-label={`${text.imagePreview} ${index + 1}`}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border bg-white",
                activeUrl === url ? "border-primary ring-2 ring-primary/20" : "border-slate-200"
              )}
              onClick={() => setSelectedUrl(url)}
            >
              <Image
                src={url}
                alt={imageAlt}
                fill
                sizes="48px"
                quality={60}
                loading="lazy"
                decoding="async"
                className="object-contain p-1"
                onError={() => markFailed(url)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getProductImageCandidates(product: AdminProductRow) {
  const assetUrls = getProductImageAssetCandidates(product);
  const fallbackUrls = [
    getExternalProductImageFallbackUrl(product.imageUrl),
    getExternalProductImageFallbackUrl(product.imagePath),
    ...(product.galleryImageUrls ?? []).map(getExternalProductImageFallbackUrl),
    ...(product.galleryImagePaths ?? []).map(getExternalProductImageFallbackUrl),
  ];

  return Array.from(
    new Set([...assetUrls, ...fallbackUrls].map((candidate) => candidate?.trim()).filter(isNonEmptyString))
  );
}

function getProductImageAssetCandidates(product: AdminProductRow) {
  const imagePathUrl = resolveAdminProductImageUrl(product.imagePath);
  const galleryPathUrls = (product.galleryImagePaths ?? []).map(resolveAdminProductImageUrl);
  const candidates = [
    product.imageUrl,
    imagePathUrl,
    ...(product.galleryImageUrls ?? []),
    ...galleryPathUrls,
  ];

  return Array.from(
    new Set(candidates.map((candidate) => candidate?.trim()).filter(isNonEmptyString))
  );
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value && value.length > 0);
}

function resolveAdminProductImageUrl(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");

  return supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/${productImagesBucket}/${normalized.replace(/^\/+/, "")}`
    : "";
}

function getExternalProductImageFallbackUrl(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "";
  }

  const imageId = normalized.match(/-(\d+)\.(?:png|jpe?g|webp|gif)(?:$|\?)/i)?.[1];

  return imageId
    ? `https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/${imageId}?size=bg`
    : "";
}

function ProductBrandModel({ product }: { product: AdminProductRow }) {
  const firstModel = product.compatibleWith[0] ?? product.model ?? "—";

  return (
    <div className="min-w-0 space-y-1">
      <div className="truncate text-sm font-bold text-slate-900">{product.brand}</div>
      {product.modelSeries && (
        <div className="line-clamp-1 break-words text-[11px] font-bold text-slate-400 [overflow-wrap:anywhere]">
          {product.modelSeries}
        </div>
      )}
      <div className="line-clamp-2 break-words text-xs font-medium leading-snug text-slate-500 [overflow-wrap:anywhere]">
        {firstModel}
      </div>
      {product.modelCode && (
        <div className="break-all font-mono text-[11px] leading-tight text-slate-400">{product.modelCode}</div>
      )}
    </div>
  );
}

function ProductStockSummary({
  product,
  adminText,
  text,
}: {
  product: AdminProductRow;
  adminText: ReturnType<typeof getAdminDictionary>["admin"];
  text: typeof panelText.zh | typeof panelText.it;
}) {
  const restockCount = product.activeRestockRequestCount ?? 0;

  return (
    <div className="min-w-0 space-y-1">
      <Badge className={cn(stockStatusBadgeClass(product.status), "max-w-full truncate")}>
        {adminText.enums.stockStatus[product.status]}
      </Badge>
      <div className="text-xs font-semibold text-slate-600">
        {product.availableQty ?? product.stock} / {product.actualQty ?? product.stock}
      </div>
      <div className="text-[11px] text-slate-400">
        {formatAdminMessage(adminText.catalog.lockedStock, {
          count: product.lockedQty ?? 0,
        })}
      </div>
      {restockCount > 0 ? (
        <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
          <Bell className="size-3 shrink-0" />
          <span className="truncate">
            {formatAdminMessage(text.restockActiveCount, { count: restockCount })}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ProductPriceSummary({
  product,
  text,
}: {
  product: AdminProductRow;
  text: typeof panelText.zh | typeof panelText.it;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-sm font-black leading-tight text-slate-950">{formatEuro(product.price)}</div>
      <div className="break-words text-xs font-semibold leading-tight text-slate-500">
        {text.margin} {(product.margin ?? 0).toFixed(1)}%
      </div>
      <div className="break-words text-[11px] leading-tight text-slate-400">
        {text.costPrice} {formatEuro(product.costPrice ?? 0)}
      </div>
    </div>
  );
}

function ProductActionsMenu({
  product,
  isMutating,
  pendingActionKey,
  text,
  onView,
  onEdit,
  onDuplicate,
  onAction,
  onHide,
  onStockAdjust,
}: {
  product: AdminProductRow;
  isMutating: boolean;
  pendingActionKey: string | null;
  text: typeof panelText.zh | typeof panelText.it;
  onView: (product: AdminProductRow) => void;
  onEdit: (product: AdminProductRow) => void;
  onDuplicate: (product: AdminProductRow) => void;
  onAction: (product: AdminProductRow, action: ProductAction) => void;
  onHide: (product: AdminProductRow) => void;
  onStockAdjust: (product: AdminProductRow) => void;
}) {
  const storefrontUrl = product.storefrontVisible ? product.storefrontUrl : null;
  const isProductPending = pendingActionKey?.startsWith(`${product.sku}:`) ?? false;
  const isActionPending = (action: ProductAction | "stock") =>
    pendingActionKey === `${product.sku}:${action}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="bg-white/60"
          aria-label={`${text.moreActions}: ${product.sku}`}
          title={`${text.moreActions}: ${product.sku}`}
        >
          {isProductPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(product)}>
          <Eye className="size-4" />
          {text.details}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(product)}>
          <Edit className="size-4" />
          {text.edit}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isMutating} onClick={() => onDuplicate(product)}>
          <Copy className="size-4" />
          {text.duplicate}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={product.catalogUrl ?? "/catalogo"}>
            <ExternalLink className="size-4" />
            {text.viewCatalog}
          </Link>
        </DropdownMenuItem>
        {storefrontUrl ? (
          <DropdownMenuItem asChild>
            <Link href={storefrontUrl}>
              <Eye className="size-4" />
              {text.previewStorefront}
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <EyeOff className="size-4" />
            {text.publishForStorefront}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {product.catalogStatus !== "active" && (
          <DropdownMenuItem disabled={isMutating} onClick={() => onAction(product, "publish")}>
            {isActionPending("publish") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PackageCheck className="size-4" />
            )}
            {text.publish}
          </DropdownMenuItem>
        )}
        {product.catalogStatus !== "draft" && (
          <DropdownMenuItem disabled={isMutating} onClick={() => onAction(product, "restore")}>
            {isActionPending("restore") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            {text.restore}
          </DropdownMenuItem>
        )}
        {product.catalogStatus !== "blocked" && (
          <DropdownMenuItem disabled={isMutating} onClick={() => onAction(product, "block")}>
            {isActionPending("block") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Ban className="size-4" />
            )}
            {text.block}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={isMutating} onClick={() => onStockAdjust(product)}>
          {isActionPending("stock") ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SlidersHorizontal className="size-4" />
          )}
          {text.stockAdjust}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isMutating}
          className="text-amber-700 focus:text-amber-700"
          onClick={() => onHide(product)}
        >
          {isActionPending("hide") ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <EyeOff className="size-4" />
          )}
          {text.hide}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProductEmptyState({
  isLoading,
  text,
}: {
  isLoading: boolean;
  text: typeof panelText.zh | typeof panelText.it;
}) {
  return (
    <div className="grid min-h-52 place-items-center px-4 py-10 text-center">
      <div>
        <div className="mx-auto grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-500">
          {isLoading ? <Loader2 className="size-5 animate-spin" /> : <Package className="size-5" />}
        </div>
        <div className="mt-3 text-sm font-bold text-slate-900">
          {isLoading ? text.loading : text.emptyTitle}
        </div>
        {!isLoading && (
          <div className="mt-1 text-xs font-medium text-slate-500">{text.emptyBody}</div>
        )}
      </div>
    </div>
  );
}

function ProductPagination({
  filters,
  pageCount,
  total,
  returned,
  text,
  onChange,
}: {
  filters: ProductListFilters;
  pageCount: number;
  total: number;
  returned: number;
  text: typeof panelText.zh | typeof panelText.it;
  onChange: (patch: Partial<ProductListFilters>) => void;
}) {
  const page = filters.page + 1;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="font-medium text-slate-500">
        {formatAdminMessage(text.pageInfo, { page, pages: pageCount })} · {returned}/{total}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          className="bg-white"
          aria-label={text.previousPage}
          title={text.previousPage}
          disabled={filters.page <= 0}
          onClick={() => onChange({ page: Math.max(0, filters.page - 1) })}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {paginationButtonIndexes(pageCount, filters.page).map((index) => (
          <Button
            key={index}
            variant={index === filters.page ? "default" : "outline"}
            size="icon-sm"
            className={index === filters.page ? "" : "bg-white"}
            onClick={() => onChange({ page: index })}
          >
            {index + 1}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon-sm"
          className="bg-white"
          aria-label={text.nextPage}
          title={text.nextPage}
          disabled={filters.page >= pageCount - 1}
          onClick={() => onChange({ page: Math.min(pageCount - 1, filters.page + 1) })}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Select
          value={String(filters.pageSize)}
          onValueChange={(value) => onChange({ pageSize: Number(value), page: 0 })}
        >
          <SelectTrigger className="w-28 bg-white" aria-label={text.pageSizeLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((pageSize) => (
              <SelectItem key={pageSize} value={String(pageSize)}>
                {formatAdminMessage(text.pageSizeOption, { count: pageSize })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ProductDrawer({
  mode,
  product,
  products,
  isMutating,
  text,
  adminText,
  initialEditSku,
  onInitialEditHandled,
  onClose,
  onCreate,
  onSave,
  onSaved,
  onStockAdjust,
  onMediaSaved,
}: {
  mode: ProductDrawerMode | null;
  product: AdminProductRow | null;
  products: AdminProductRow[];
  isMutating: boolean;
  text: typeof panelText.zh | typeof panelText.it;
  adminText: ReturnType<typeof getAdminDictionary>["admin"];
  initialEditSku: string | null;
  onInitialEditHandled: () => void;
  onClose: () => void;
  onCreate: (values: ProductFormValues) => Promise<AdminProductRow | null>;
  onSave: (sku: string, values: ProductFormValues) => Promise<AdminProductRow | null>;
  onSaved: (product: AdminProductRow) => void;
  onStockAdjust: (product: AdminProductRow) => void;
  onMediaSaved: (product: AdminProductRow) => void;
}) {
  const open = Boolean(mode);
  const title =
    mode === "create"
      ? text.drawerCreateTitle
      : mode === "edit"
        ? text.drawerEditTitle
        : text.drawerViewTitle;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-screen max-w-none gap-0 overflow-hidden p-0"
        style={{ width: "min(960px, 100vw)", maxWidth: "min(960px, 100vw)" }}
      >
        <SheetHeader className="border-b border-slate-200 bg-white p-4 pr-12">
          <SheetTitle className="text-lg font-bold">{title}</SheetTitle>
          <SheetDescription className="break-all">
            {mode === "create" ? text.subtitle : product?.sku ?? ""}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3 lg:p-4">
          {mode === "view" && product ? (
            <ProductDetails
              product={product}
              isMutating={isMutating}
              text={text}
              adminText={adminText}
              initialEditSku={initialEditSku}
              onInitialEditHandled={onInitialEditHandled}
              onSave={onSave}
              onSaved={onSaved}
              onStockAdjust={() => onStockAdjust(product)}
              onMediaSaved={onMediaSaved}
            />
          ) : mode ? (
            <ProductEditorForm
              key={`${mode}-${product?.sku ?? "new"}`}
              mode={mode}
              product={product}
              products={products}
              isMutating={isMutating}
              text={text}
              adminText={adminText}
              onCreate={onCreate}
              onSave={onSave}
              onSaved={onSaved}
              onStockAdjust={onStockAdjust}
            />
          ) : null}
        </div>
        <SheetFooter className="border-t border-slate-200 bg-white p-3 sm:flex-row sm:justify-end">
          <Button variant="outline" className="bg-white" onClick={onClose}>
            {text.close}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ProductDetails({
  product,
  isMutating,
  text,
  adminText,
  initialEditSku,
  onInitialEditHandled,
  onSave,
  onSaved,
  onStockAdjust,
  onMediaSaved,
}: {
  product: AdminProductRow;
  isMutating: boolean;
  text: typeof panelText.zh | typeof panelText.it;
  adminText: ReturnType<typeof getAdminDictionary>["admin"];
  initialEditSku: string | null;
  onInitialEditHandled: () => void;
  onSave: (sku: string, values: ProductFormValues) => Promise<AdminProductRow | null>;
  onSaved: (product: AdminProductRow) => void;
  onStockAdjust: () => void;
  onMediaSaved: (product: AdminProductRow) => void;
}) {
  const [copiedSku, setCopiedSku] = React.useState<string | null>(null);
  const [editingSku, setEditingSku] = React.useState<string | null>(null);
  const [editorState, setEditorState] = React.useState<{
    sku: string;
    values: ProductFormValues;
    errors: Record<string, string>;
    isSubmitting: boolean;
  } | null>(null);
  const [activeTabState, setActiveTabState] = React.useState({
    sku: product.sku,
    value: "base",
  });
  const isSkuCopied = copiedSku === product.sku;
  const isEditing = editorState?.sku === product.sku || editingSku === product.sku || initialEditSku === product.sku;
  const activeTab = activeTabState.sku === product.sku ? activeTabState.value : "base";
  const editValues = editorState?.sku === product.sku ? editorState.values : productFormDefaults(product);
  const editErrors = editorState?.sku === product.sku ? editorState.errors : {};
  const isSubmittingEdit = editorState?.sku === product.sku ? editorState.isSubmitting : false;
  const displayName = isEditing ? editValues.name || product.name : product.name;
  const displayCategory = isEditing ? editValues.category || product.category : product.category;
  const displayBrand = isEditing ? editValues.brand || product.brand : product.brand;
  const displayModel = isEditing ? editValues.model || product.model : product.model;
  const displayPrice = isEditing ? (parseNumber(editValues.price) ?? product.price) : product.price;

  React.useEffect(() => {
    if (!copiedSku) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopiedSku(null), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [copiedSku]);

  async function copySku() {
    try {
      await navigator.clipboard.writeText(product.sku);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = product.sku;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
      } finally {
        textarea.remove();
      }
    }

    setCopiedSku(product.sku);
  }

  function setEditValue<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setEditorState((current) => {
      const nextState =
        current?.sku === product.sku
          ? current
          : {
              sku: product.sku,
              values: productFormDefaults(product),
              errors: {},
              isSubmitting: false,
            };
      const nextErrors = { ...nextState.errors };
      delete nextErrors[key];

      return {
        ...nextState,
        values: { ...nextState.values, [key]: value },
        errors: nextErrors,
      };
    });
  }

  function startInlineEdit(tabValue = "base") {
    setActiveTabState({ sku: product.sku, value: tabValue });
    setEditorState({
      sku: product.sku,
      values: productFormDefaults(product),
      errors: {},
      isSubmitting: false,
    });
    setEditingSku(product.sku);
    onInitialEditHandled();
  }

  function stopInlineEdit() {
    setEditingSku(null);
    setEditorState(null);
    onInitialEditHandled();
  }

  function setActiveTab(value: string) {
    setActiveTabState({ sku: product.sku, value });
  }

  async function saveInlineEdit() {
    const nextErrors = validateProductForm(editValues, true, text);

    if (Object.keys(nextErrors).length > 0) {
      setEditorState((current) => ({
        sku: product.sku,
        values: current?.sku === product.sku ? current.values : editValues,
        errors: nextErrors,
        isSubmitting: false,
      }));
      return;
    }

    setEditorState((current) => ({
      sku: product.sku,
      values: current?.sku === product.sku ? current.values : editValues,
      errors: {},
      isSubmitting: true,
    }));

    let saved: AdminProductRow | null = null;

    try {
      saved = await onSave(product.sku, editValues);
    } finally {
      if (!saved) {
        setEditorState((current) => (
          current?.sku === product.sku ? { ...current, isSubmitting: false } : current
        ));
      }
    }

    if (saved) {
      onSaved(saved);
      stopInlineEdit();
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 lg:grid-cols-[220px_minmax(0,1fr)_172px]">
          <ProductDetailImageGallery
            product={product}
            text={text}
            sizes="(min-width: 1024px) 220px, 112px"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className={catalogStatusBadgeClass(product.catalogStatus)}>
                {adminText.enums.catalogStatus[product.catalogStatus]}
              </Badge>
              <Badge className={stockStatusBadgeClass(product.status)}>
                {adminText.enums.stockStatus[product.status]}
              </Badge>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-500">
                {product.sku}
              </span>
            </div>
            <h3 className="mt-2 break-words text-base font-black leading-snug text-slate-950 lg:text-xl">
              {displayName}
            </h3>
            <div className="mt-2 text-xs font-semibold text-slate-500">
              {displayCategory} · {displayBrand}
              {displayModel ? ` · ${displayModel}` : ""}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
              <ProductHeroMetric label={text.netPrice} value={formatEuro(displayPrice)} />
              <ProductHeroMetric label={text.availableStock} value={product.availableQty ?? product.stock} />
              <ProductHeroMetric label={text.actualStock} value={product.actualQty ?? product.stock} />
              <ProductHeroMetric label={text.margin} value={`${(product.margin ?? 0).toFixed(1)}%`} />
              <ProductHeroMetric label={text.restockRequests} value={product.activeRestockRequestCount ?? 0} />
            </div>
          </div>
          <div className="col-span-2 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1 lg:content-start">
            <div className="col-span-2 text-[11px] font-bold text-slate-500 lg:col-span-1">
              {text.quickActions}
            </div>
            <Button variant="outline" size="sm" className="bg-white lg:w-full" onClick={onStockAdjust}>
              <SlidersHorizontal className="size-4" />
              {text.stockAdjust}
            </Button>
            <Button size="sm" className="lg:w-full" onClick={() => startInlineEdit("base")}>
              <Edit className="size-4" />
              {text.edit}
            </Button>
            <Button variant="outline" size="sm" className="bg-white lg:w-full" onClick={() => void copySku()}>
              {isSkuCopied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
              {isSkuCopied ? text.copied : text.copySku}
            </Button>
            <Button variant="outline" size="sm" className="bg-white lg:w-full" asChild>
              <Link href={product.catalogUrl ?? "/catalogo"}>
                <ExternalLink className="size-4" />
                {text.viewCatalog}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList variant="line" className="grid min-w-[660px] grid-cols-6 bg-transparent">
            <TabsTrigger value="base">{text.tabBase}</TabsTrigger>
            <TabsTrigger value="price">{text.tabPrice}</TabsTrigger>
            <TabsTrigger value="inventory">{text.tabInventory}</TabsTrigger>
            <TabsTrigger value="media">{text.tabMedia}</TabsTrigger>
            <TabsTrigger value="compatibility">{text.tabCompatibility}</TabsTrigger>
            <TabsTrigger value="audit">{text.tabAudit}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="base" className="mt-0">
          <div className="space-y-2">
            <DetailPanelToolbar title={isEditing ? text.drawerEditTitle : text.sectionBase}>
              {isEditing ? (
                <>
                  <Button variant="outline" size="xs" className="bg-white" onClick={stopInlineEdit}>
                    {text.cancel}
                  </Button>
                  <Button size="xs" onClick={() => void saveInlineEdit()} disabled={isSubmittingEdit || isMutating}>
                    {isSubmittingEdit || isMutating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    {isSubmittingEdit || isMutating ? text.saving : text.save}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="xs" className="bg-white" onClick={() => startInlineEdit("base")}>
                  <Edit className="size-3.5" />
                  {text.edit}
                </Button>
              )}
            </DetailPanelToolbar>
            {isEditing ? (
              <InfoGrid>
                <EditableDetailItem className="lg:col-span-2" label={text.name} error={editErrors.name}>
                  <Input value={editValues.name} onChange={(event) => setEditValue("name", event.target.value)} />
                </EditableDetailItem>
                <EditableDetailItem label={text.sku} error={editErrors.sku}>
                  <Input value={editValues.sku} readOnly className="bg-slate-50 font-mono text-slate-500" />
                </EditableDetailItem>
                <EditableDetailItem label={text.category} error={editErrors.category}>
                  <Select value={editValues.category} onValueChange={(value) => setEditValue("category", value)}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.label} value={category.label}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </EditableDetailItem>
                <EditableDetailItem label={text.brand} error={editErrors.brand}>
                  <Input value={editValues.brand} onChange={(event) => setEditValue("brand", event.target.value)} />
                </EditableDetailItem>
                <EditableDetailItem label={text.quality}>
                  <Select value={editValues.grade} onValueChange={(value) => setEditValue("grade", value as ProductGrade)}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {productGrades.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {adminText.enums.productGrade[grade]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </EditableDetailItem>
                <EditableDetailItem label={text.moq} error={editErrors.moq}>
                  <Input value={editValues.moq} type="number" min={1} onChange={(event) => setEditValue("moq", event.target.value)} />
                </EditableDetailItem>
                <EditableDetailItem label={text.leadTime} error={editErrors.leadTime}>
                  <Input value={editValues.leadTime} onChange={(event) => setEditValue("leadTime", event.target.value)} />
                </EditableDetailItem>
                <EditableDetailItem label={text.model}>
                  <Input value={editValues.model} onChange={(event) => setEditValue("model", event.target.value)} />
                </EditableDetailItem>
                <EditableDetailItem label={text.modelCode}>
                  <Input value={editValues.modelCode} onChange={(event) => setEditValue("modelCode", event.target.value)} />
                </EditableDetailItem>
                <EditableDetailItem label={text.batchCode}>
                  <Input value={editValues.batchCode} onChange={(event) => setEditValue("batchCode", event.target.value)} />
                </EditableDetailItem>
                <EditableDetailItem className="lg:col-span-2" label={text.supplier}>
                  <Input value={editValues.supplier} onChange={(event) => setEditValue("supplier", event.target.value)} />
                </EditableDetailItem>
              </InfoGrid>
            ) : (
              <InfoGrid>
                <DetailItem className="lg:col-span-2" label={text.name} value={product.name} />
                <DetailItem label={text.sku} value={<span className="font-mono">{product.sku}</span>} />
                <DetailItem label={text.category} value={product.category} />
                <DetailItem label={text.brand} value={product.brand} />
                <DetailItem label={text.quality} value={adminText.enums.productGrade[product.grade]} />
                <DetailItem label={text.moq} value={product.moq} />
                <DetailItem label={text.leadTime} value={product.leadTime} />
                <DetailItem label={text.modelSeries} value={product.modelSeries ?? text.none} />
                <DetailItem label={text.model} value={product.model ?? text.none} />
                <DetailItem label={text.modelCode} value={product.modelCode ?? text.none} />
                <DetailItem label={text.batchCode} value={product.batchCode ?? text.none} />
                <DetailItem className="lg:col-span-2" label={text.supplier} value={product.supplier ?? text.none} />
              </InfoGrid>
            )}
          </div>
        </TabsContent>
        <TabsContent value="price" className="mt-0">
          <div className="space-y-2">
            <DetailPanelToolbar title={text.sectionPrice}>
              {isEditing ? (
                <>
                  <Button variant="outline" size="xs" className="bg-white" onClick={stopInlineEdit}>
                    {text.cancel}
                  </Button>
                  <Button size="xs" onClick={() => void saveInlineEdit()} disabled={isSubmittingEdit || isMutating}>
                    {isSubmittingEdit || isMutating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    {isSubmittingEdit || isMutating ? text.saving : text.save}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="xs" className="bg-white" onClick={() => startInlineEdit("price")}>
                  <Edit className="size-3.5" />
                  {text.edit}
                </Button>
              )}
            </DetailPanelToolbar>
            {isEditing ? (
              <InfoGrid>
                <EditableDetailItem label={text.netPrice} error={editErrors.price}>
                  <Input
                    value={editValues.price}
                    type="number"
                    step="0.01"
                    min={0}
                    onChange={(event) => setEditValue("price", event.target.value)}
                  />
                </EditableDetailItem>
                <EditableDetailItem label={text.retailPrice}>
                  <Input
                    value={editValues.retailPrice}
                    type="number"
                    step="0.01"
                    min={0}
                    onChange={(event) => setEditValue("retailPrice", event.target.value)}
                  />
                </EditableDetailItem>
                <EditableDetailItem label={text.costPrice}>
                  <Input
                    value={editValues.costPrice}
                    type="number"
                    step="0.01"
                    min={0}
                    onChange={(event) => setEditValue("costPrice", event.target.value)}
                  />
                </EditableDetailItem>
                <DetailItem label={text.margin} value={`${(product.margin ?? 0).toFixed(2)}%`} />
              </InfoGrid>
            ) : (
              <InfoGrid>
                <DetailItem label={text.netPrice} value={formatEuro(product.price)} />
                <DetailItem label={text.retailPrice} value={formatEuro(product.retailPrice)} />
                <DetailItem label={text.costPrice} value={formatEuro(product.costPrice ?? 0)} />
                <DetailItem label={text.margin} value={`${(product.margin ?? 0).toFixed(2)}%`} />
              </InfoGrid>
            )}
          </div>
        </TabsContent>
        <TabsContent value="inventory" className="mt-0">
          <div className="space-y-2">
            <DetailPanelToolbar title={text.sectionInventory}>
              <Button variant="outline" size="xs" className="bg-white" onClick={onStockAdjust}>
                <SlidersHorizontal className="size-3.5" />
                {text.stockAdjust}
              </Button>
            </DetailPanelToolbar>
            <InfoGrid>
              <DetailItem label={text.stock} value={<Badge className={stockStatusBadgeClass(product.status)}>{adminText.enums.stockStatus[product.status]}</Badge>} />
              <DetailItem label={text.availableStock} value={product.availableQty ?? product.stock} />
              <DetailItem label={text.lockedStock} value={product.lockedQty ?? 0} />
              <DetailItem label={text.actualStock} value={product.actualQty ?? product.stock} />
              <DetailItem className="lg:col-span-2" label={text.stockAdjust} value={text.stockReadonly} />
            </InfoGrid>
          </div>
        </TabsContent>
        <TabsContent value="media" className="mt-0">
          <ProductMediaManager product={product} text={text} onSaved={onMediaSaved} />
        </TabsContent>
        <TabsContent value="compatibility" className="mt-0">
          <div className="space-y-2">
            <DetailPanelToolbar title={text.sectionCatalog}>
              {isEditing ? (
                <>
                  <Button variant="outline" size="xs" className="bg-white" onClick={stopInlineEdit}>
                    {text.cancel}
                  </Button>
                  <Button size="xs" onClick={() => void saveInlineEdit()} disabled={isSubmittingEdit || isMutating}>
                    {isSubmittingEdit || isMutating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    {isSubmittingEdit || isMutating ? text.saving : text.save}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="xs" className="bg-white" onClick={() => startInlineEdit("compatibility")}>
                  <Edit className="size-3.5" />
                  {text.edit}
                </Button>
              )}
            </DetailPanelToolbar>
            {isEditing ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <EditableDetailItem label={text.compatibility} error={editErrors.compatibleWith}>
                  <Textarea
                    value={editValues.compatibleWith}
                    className="min-h-24"
                    onChange={(event) => setEditValue("compatibleWith", event.target.value)}
                  />
                </EditableDetailItem>
                <EditableDetailItem label={text.tags}>
                  <Textarea
                    value={editValues.tags}
                    className="min-h-24"
                    onChange={(event) => setEditValue("tags", event.target.value)}
                  />
                </EditableDetailItem>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <TokenPanel
                  title={text.compatibility}
                  empty={text.none}
                  items={product.compatibleWith}
                />
                <TokenPanel title={text.tags} empty={text.none} items={product.tags} />
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="audit" className="mt-0">
          <ProductAuditPanel sku={product.sku} text={text} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductEditorForm({
  mode,
  product,
  products,
  isMutating,
  text,
  adminText,
  onCreate,
  onSave,
  onSaved,
  onCancel,
  onStockAdjust,
}: {
  mode: ProductDrawerMode;
  product: AdminProductRow | null;
  products: AdminProductRow[];
  isMutating: boolean;
  text: typeof panelText.zh | typeof panelText.it;
  adminText: ReturnType<typeof getAdminDictionary>["admin"];
  onCreate: (values: ProductFormValues) => Promise<AdminProductRow | null>;
  onSave: (sku: string, values: ProductFormValues) => Promise<AdminProductRow | null>;
  onSaved: (product: AdminProductRow) => void;
  onCancel?: () => void;
  onStockAdjust: (product: AdminProductRow) => void;
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = React.useState<ProductFormValues>(() =>
    product ? productFormDefaults(product) : defaultProductFormValues()
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isManualSku = values.skuMode === "manual";
  const generatedSku = buildProductFormSkuCandidate(values, products);
  const displayedSku = isEdit || isManualSku ? values.sku : generatedSku.sku;
  const externalCodeIsInvalid =
    !isEdit && values.modelCode.trim().length > 0 && !isValidAdminSku(values.modelCode);

  function setValue<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitValues =
      !isEdit && !isManualSku ? { ...values, sku: generatedSku.sku } : values;
    const nextErrors = validateProductForm(submitValues, isEdit, text);

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const saved =
        isEdit && product
          ? await onSave(product.sku, submitValues)
          : await onCreate(submitValues);

      if (saved) {
        onSaved(saved);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormSection title={text.sectionBase} icon={Package}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={text.name} error={errors.name}>
            <Input value={values.name} onChange={(event) => setValue("name", event.target.value)} />
          </Field>
          <Field label={text.sku} error={errors.sku} hint={isEdit ? text.skuReadonly : undefined}>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={displayedSku}
                  readOnly={isEdit || !isManualSku}
                  className={cn(
                    "font-mono",
                    (isEdit || !isManualSku) && "bg-slate-50 text-slate-500"
                  )}
                  onChange={(event) => setValue("sku", event.target.value)}
                />
                {!isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 bg-white"
                    onClick={() => {
                      setValues((current) => ({
                        ...current,
                        sku: isManualSku ? current.sku : displayedSku,
                        skuMode: isManualSku ? "auto" : "manual",
                      }));
                      setErrors((current) => {
                        if (!current.sku) {
                          return current;
                        }

                        const next = { ...current };
                        delete next.sku;
                        return next;
                      });
                    }}
                  >
                    {isManualSku ? text.skuManualDisable : text.skuManualEnable}
                  </Button>
                )}
              </div>
              {!isEdit && (
                <div className="space-y-1 text-xs font-semibold text-slate-500">
                  <div>
                    {isManualSku ? text.skuManualHint : `${text.skuAutoPreview}: ${generatedSku.sku}`}
                  </div>
                  <div>{text.skuAutoHint}</div>
                  {externalCodeIsInvalid && (
                    <div className="text-amber-700">{text.skuExternalInvalid}</div>
                  )}
                </div>
              )}
            </div>
          </Field>
          <Field label={text.category} error={errors.category}>
            <Select value={values.category} onValueChange={(value) => setValue("category", value)}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.label} value={category.label}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={text.brand} error={errors.brand}>
            <Input value={values.brand} onChange={(event) => setValue("brand", event.target.value)} />
          </Field>
          <Field label={text.quality}>
            <Select value={values.grade} onValueChange={(value) => setValue("grade", value as ProductGrade)}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {productGrades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {adminText.enums.productGrade[grade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={text.moq} error={errors.moq}>
            <Input value={values.moq} type="number" min={1} onChange={(event) => setValue("moq", event.target.value)} />
          </Field>
          <Field label={text.leadTime} error={errors.leadTime}>
            <Input value={values.leadTime} onChange={(event) => setValue("leadTime", event.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={text.sectionPrice} icon={Euro}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={text.netPrice} error={errors.price}>
            <Input value={values.price} type="number" step="0.01" min={0} onChange={(event) => setValue("price", event.target.value)} />
          </Field>
          <Field label={text.retailPrice}>
            <Input value={values.retailPrice} type="number" step="0.01" min={0} onChange={(event) => setValue("retailPrice", event.target.value)} />
          </Field>
          <Field label={text.costPrice}>
            <Input value={values.costPrice} type="number" step="0.01" min={0} onChange={(event) => setValue("costPrice", event.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={text.sectionInventory} icon={Warehouse}>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field label={text.stock} error={errors.stock} hint={isEdit ? text.stockReadonly : undefined}>
            <Input
              value={values.stock}
              type="number"
              min={0}
              readOnly={isEdit}
              className={cn(isEdit && "bg-slate-50 text-slate-500")}
              onChange={(event) => setValue("stock", event.target.value)}
            />
          </Field>
          {isEdit && product && (
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="bg-white"
                onClick={() => onStockAdjust(product)}
              >
                <SlidersHorizontal className="size-4" />
                {text.stockAdjust}
              </Button>
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={text.sectionCatalog} icon={Tag}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={text.compatibility} error={errors.compatibleWith}>
            <Textarea
              value={values.compatibleWith}
              className="min-h-24"
              onChange={(event) => setValue("compatibleWith", event.target.value)}
            />
          </Field>
          <Field label={text.tags}>
            <Textarea
              value={values.tags}
              className="min-h-24"
              onChange={(event) => setValue("tags", event.target.value)}
            />
          </Field>
          <Field label={text.model}>
            <Input value={values.model} onChange={(event) => setValue("model", event.target.value)} />
          </Field>
          <Field label={text.modelCode}>
            <Input value={values.modelCode} onChange={(event) => setValue("modelCode", event.target.value)} />
          </Field>
          <Field label={text.batchCode}>
            <Input value={values.batchCode} onChange={(event) => setValue("batchCode", event.target.value)} />
          </Field>
          <Field label={text.supplier}>
            <Input value={values.supplier} onChange={(event) => setValue("supplier", event.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={text.sectionMedia} icon={ImageIcon}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={text.imagePath}>
            <Input value={values.imagePath} onChange={(event) => setValue("imagePath", event.target.value)} />
          </Field>
          <Field label={text.imageAlt}>
            <Input value={values.imageAlt} onChange={(event) => setValue("imageAlt", event.target.value)} />
          </Field>
        </div>
      </FormSection>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" className="bg-white" onClick={onCancel}>
            {text.cancel}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || isMutating}>
          {isSubmitting || isMutating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {isSubmitting || isMutating ? text.saving : text.save}
        </Button>
      </div>
    </form>
  );
}

function ProductMediaManager({
  product,
  text,
  onSaved,
}: {
  product: AdminProductRow;
  text: typeof panelText.zh | typeof panelText.it;
  onSaved: (product: AdminProductRow) => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFile(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [product]);

  async function uploadMedia() {
    if (!file) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const saved = await uploadAdminProductImage(product.sku, {
        file,
        imageAlt: product.imageAlt ?? product.name,
        reason: `Uploaded product image for ${product.sku}.`,
        setPrimary: true,
      });
      onSaved(saved);
      setFile(null);
    } catch {
      setError(text.mediaError);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <ProductDetailImageGallery
          product={product}
          text={text}
          sizes="(min-width: 1024px) 240px, 160px"
        />
        <div className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Upload className="size-4 text-primary" />
            {text.uploadImage}
          </div>
          <Field label={text.uploadImage}>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          {error && <div className="text-sm font-semibold text-red-600">{error}</div>}
          <div className="flex justify-end">
            <Button type="button" onClick={() => void uploadMedia()} disabled={!file || isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {text.uploadImage}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StockAdjustmentDialog({
  product,
  open,
  text,
  onOpenChange,
  onSave,
}: {
  product: AdminProductRow | null;
  open: boolean;
  text: typeof panelText.zh | typeof panelText.it;
  onOpenChange: (open: boolean) => void;
  onSave: (sku: string, adjustment: StockAdjustmentPayload) => Promise<boolean>;
}) {
  const [action, setAction] = React.useState<StockAdjustmentAction>("receive");
  const [quantity, setQuantity] = React.useState("1");
  const [reason, setReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!product || !open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAction("receive");
      setQuantity("1");
      setReason("");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [open, product]);

  if (!product) {
    return null;
  }

  const parsedQuantity = Number(quantity);
  const canSubmit =
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 0 &&
    reason.trim().length > 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || !product) {
      return;
    }

    setIsSubmitting(true);
    const saved = await onSave(product.sku, {
      action,
      quantity: parsedQuantity,
      reason: reason.trim(),
    });
    setIsSubmitting(false);

    if (saved) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{text.stockAdjust}</DialogTitle>
          <DialogDescription>{product.sku}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={text.stockAdjust}>
              <Select value={action} onValueChange={(value) => setAction(value as StockAdjustmentAction)}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stockAdjustmentActions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {text.stockActions[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={text.quantity}>
              <Input value={quantity} type="number" min={0} step={1} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
            <DetailItem label={text.availableStock} value={product.availableQty ?? product.stock} />
          </div>
          <Field label={text.reason}>
            <Textarea
              className="min-h-24"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" className="bg-white" onClick={() => onOpenChange(false)}>
              {text.cancel}
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {isSubmitting ? text.saving : text.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductAuditPanel({
  sku,
  text,
}: {
  sku: string;
  text: typeof panelText.zh | typeof panelText.it;
}) {
  const { locale } = useI18n();
  const [state, setState] = React.useState<{
    events: ProductAuditEvent[];
    sku: string;
    status: "loading" | "ready" | "error";
  }>(() => ({ events: [], sku, status: "loading" }));

  React.useEffect(() => {
    const controller = new AbortController();

    fetchAdminProductAudit(sku, controller.signal)
      .then((events) => {
        if (!controller.signal.aborted) {
          setState({ events, sku, status: "ready" });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ events: [], sku, status: "error" });
        }
      });

    return () => controller.abort();
  }, [sku]);

  const status = state.sku === sku ? state.status : "loading";
  const events = state.sku === sku ? state.events : [];

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-sm font-medium text-slate-500">
        {text.auditLoading}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-6 text-sm font-medium text-red-700">
        {text.auditError}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm font-medium text-slate-500">
        {text.auditEmpty}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const metadataItems = auditMetadataItems(event, text);
        const changeItems = auditChangeItems(event, text).slice(0, 6);
        const reason = auditReasonLabel(event.reason, text);

        return (
          <div key={event.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className="text-sm font-black text-slate-950">
                  {auditActionLabel(event.action, text)}
                </div>
                <Badge className={cn("px-2 py-0.5 text-[11px]", auditResultBadgeClass(event.result))}>
                  {auditResultLabel(event.result, text)}
                </Badge>
              </div>
              <time className="text-xs font-bold text-slate-500">
                {formatAuditDateTime(event.createdAtRaw ?? event.createdAt, locale, text)}
              </time>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {event.actorEmail ?? event.actorRole ?? text.auditActorFallback}
            </div>
            {metadataItems.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {metadataItems.map((item) => (
                  <span
                    key={`${item.label}-${item.value}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600"
                  >
                    {item.label}: <span className="text-slate-950">{item.value}</span>
                  </span>
                ))}
              </div>
            )}
            {changeItems.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  {text.auditChangesTitle}
                </div>
                {changeItems.map((item) => (
                  <div key={item} className="text-xs font-semibold text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            )}
            {reason && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700">
                {reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const auditChangeFieldKeys = [
  "name",
  "category",
  "brand",
  "quality_grade",
  "b2b_price",
  "retail_price",
  "cost_price",
  "stock_qty",
  "available_qty",
  "actual_qty",
  "status",
  "moq",
  "lead_time",
  "model",
  "model_code",
  "supplier",
  "image_path",
  "image_alt",
  "gallery_image_paths",
  "tags",
] as const;

const auditMetadataKeys = [
  "action",
  "quantity",
  "delta",
  "location",
  "batch_code",
  "supplier",
  "image_path",
  "gallery_count",
] as const;

const auditPriceFields = new Set(["b2b_price", "retail_price", "cost_price"]);

function auditActionLabel(
  action: string,
  text: typeof panelText.zh | typeof panelText.it
) {
  return readTextMap(text.auditActionLabels)[action] ?? action;
}

function auditResultLabel(
  result: string,
  text: typeof panelText.zh | typeof panelText.it
) {
  return readTextMap(text.auditResultLabels)[result] ?? result;
}

function auditResultBadgeClass(result: string) {
  return result === "failed"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function auditReasonLabel(
  reason: string | null,
  text: typeof panelText.zh | typeof panelText.it
) {
  if (!reason) {
    return null;
  }

  const defaultReasons = readTextMap(text.auditDefaultReasons);
  const exact = defaultReasons[reason];

  if (exact) {
    return exact;
  }

  const prefix = Object.keys(defaultReasons).find((key) => reason.startsWith(key));

  return prefix ? defaultReasons[prefix] : reason;
}

function auditMetadataItems(
  event: ProductAuditEvent,
  text: typeof panelText.zh | typeof panelText.it
) {
  const labels = readTextMap(text.auditMetadataLabels);

  return auditMetadataKeys
    .map((key) => {
      const rawValue = event.requestMetadata[key];

      if (!hasDisplayValue(rawValue)) {
        return null;
      }

      const value =
        key === "action"
          ? text.stockActions[String(rawValue) as StockAdjustmentAction] ?? String(rawValue)
          : formatAuditValue(key, rawValue, text);

      return {
        label: labels[key] ?? key,
        value,
      };
    })
    .filter(isDefined);
}

function auditChangeItems(
  event: ProductAuditEvent,
  text: typeof panelText.zh | typeof panelText.it
) {
  const fieldLabels = readTextMap(text.auditFieldLabels);

  return auditChangeFieldKeys
    .map((key) => {
      const beforeValue = event.beforeData[key];
      const afterValue = event.afterData[key];

      if (!hasDisplayValue(beforeValue) && !hasDisplayValue(afterValue)) {
        return null;
      }

      if (auditValuesEqual(beforeValue, afterValue)) {
        return null;
      }

      return formatPanelTemplate(text.auditChangedField, {
        after: formatAuditValue(key, afterValue, text),
        before: formatAuditValue(key, beforeValue, text),
        field: fieldLabels[key] ?? key,
      });
    })
    .filter(isDefined);
}

function formatAuditDateTime(
  value: string | null | undefined,
  locale: string,
  text: typeof panelText.zh | typeof panelText.it
) {
  if (!value) {
    return text.auditUnknownTime;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return text.auditUnknownTime;
  }

  if (locale.toLowerCase().startsWith("zh")) {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? "";

    return `${part("year")}年${part("month")}月${part("day")}日 ${part("hour")}:${part("minute")}`;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatAuditValue(
  key: string,
  value: unknown,
  text: typeof panelText.zh | typeof panelText.it
) {
  if (!hasDisplayValue(value)) {
    return text.none;
  }

  if (key === "status") {
    return readTextMap(text.auditCatalogStatusLabels)[String(value)] ?? String(value);
  }

  if (auditPriceFields.has(key)) {
    const amount = readNumber(value);

    return amount === undefined ? String(value) : formatEuro(amount);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => String(item)).filter(Boolean);

    if (items.length === 0) {
      return text.none;
    }

    return items.length <= 3 ? items.join(", ") : String(items.length);
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatPanelTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, value),
    template
  );
}

function auditValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(normalizeAuditComparableValue(left)) === JSON.stringify(normalizeAuditComparableValue(right));
}

function normalizeAuditComparableValue(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return value;
}

function hasDisplayValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  return typeof value !== "string" || value.trim().length > 0;
}

function readTextMap(value: Record<string, string>) {
  return value;
}

function FormSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs font-medium text-slate-500">{hint}</p>}
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

function DetailPanelToolbar({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
      <div className="truncate text-sm font-black text-slate-950">{title}</div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  );
}

function InfoGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

function DetailItem({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("min-h-[72px] rounded-md border border-slate-200 bg-white p-2.5", className)}>
      <div className="text-[11px] font-semibold leading-4 text-slate-500">{label}</div>
      <div className={cn("mt-1 break-words text-[13px] font-bold leading-snug text-slate-950", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

function EditableDetailItem({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-[72px] rounded-md border border-primary/25 bg-primary/5 p-2.5",
        className
      )}
    >
      <div className="text-[11px] font-semibold leading-4 text-primary">{label}</div>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

function ProductHeroMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="truncate text-[10px] font-semibold leading-3 text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-black leading-4 text-slate-950">{value}</div>
    </div>
  );
}

function TokenPanel({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <Badge key={item} variant="outline" className="bg-white">
              {item}
            </Badge>
          ))
        ) : (
          <span className="text-sm font-medium text-slate-500">{empty}</span>
        )}
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-h-[38px] rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1">
      <div className="truncate text-[10px] font-semibold leading-3 text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-black leading-4 text-slate-900">{value}</div>
    </div>
  );
}

async function fetchAdminProducts(
  filters: ProductListFilters,
  signal?: AbortSignal
): Promise<ProductsApiResult> {
  const params = new URLSearchParams({
    limit: String(filters.pageSize),
    offset: String(filters.page * filters.pageSize),
    sort: filters.sort,
  });
  const q = filters.q.trim();

  if (q.length >= 2) {
    params.set("q", q);
  }

  if (filters.brand !== "all") {
    params.set("brand", filters.brand);
  }

  if (filters.modelSeries !== "all") {
    params.set("modelSeries", filters.modelSeries);
  }

  if (filters.model !== "all") {
    params.set("model", filters.model);
  }

  if (filters.catalogStatus !== "all") {
    params.set("catalogStatus", filters.catalogStatus);
  }

  if (filters.stockStatus !== "all") {
    params.set("stockStatus", filters.stockStatus);
  }

  if (filters.grade !== "all") {
    params.set("grade", filters.grade);
  }

  if (filters.supplier.trim()) {
    params.set("supplier", filters.supplier.trim());
  }

  if (filters.batchCode.trim()) {
    params.set("batchCode", filters.batchCode.trim());
  }

  const response = await fetch(`${adminProductsEndpoint}?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(
        response,
        `GET ${adminProductsEndpoint} responded ${response.status}`
      )
    );
  }

  return parseProductsApiPayload(await readJsonResponse(response));
}

async function fetchAdminRestockRequests(
  signal?: AbortSignal
): Promise<AdminRestockRequest[]> {
  const params = new URLSearchParams({
    limit: "100",
    offset: "0",
    status: "active",
  });
  const response = await fetch(`/api/admin/restock-requests?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(
        response,
        `GET /api/admin/restock-requests responded ${response.status}`
      )
    );
  }

  return readRestockRequestRows(await readJsonResponse(response));
}

async function updateAdminRestockRequestStatus(
  id: string,
  status: Exclude<AdminRestockRequestStatus, "active">
) {
  const response = await fetch(`/api/admin/restock-requests/${encodeURIComponent(id)}`, {
    body: JSON.stringify({ status }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(
        response,
        `PATCH /api/admin/restock-requests/${id} responded ${response.status}`
      )
    );
  }

  return parseRestockRequestRow(readPayloadDataObject(await readJsonResponse(response)));
}

async function fetchAdminProductModelGroups(
  signal?: AbortSignal
): Promise<ProductModelGroupsResult> {
  const response = await fetch(`${adminProductsEndpoint}/model-groups`, {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET ${adminProductsEndpoint}/model-groups responded ${response.status}`);
  }

  const payload = await readJsonResponse(response);
  const meta = readProductsMeta(payload);
  const rows = readProductsRows(payload);

  return {
    modelGroups: rows.map(normalizeDeviceModelGroup).filter(isDefined),
    source: readProductsSource(readString(meta.source), rows.length),
  };
}

async function createAdminProduct(values: ProductFormValues) {
  const payload = buildProductWritePayload(values, "create");
  const response = await fetchAdminWriteResponse(
    adminProductsEndpoint,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product: payload }),
    },
    `POST ${adminProductsEndpoint} failed`
  );

  return readSavedProduct(await readJsonResponse(response));
}

async function updateAdminProduct(sku: string, values: ProductFormValues) {
  const payload = buildProductWritePayload(values, "update");
  const response = await fetchAdminWriteResponse(
    adminProductsEndpoint,
    {
      method: "PATCH",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sku, product: payload }),
    },
    `PATCH ${adminProductsEndpoint} failed`
  );

  return readSavedProduct(await readJsonResponse(response));
}

async function runAdminProductAction(sku: string, action: ProductAction) {
  const response = await fetchAdminWriteResponse(
    `${adminProductsEndpoint}/${encodeURIComponent(sku)}/${action}`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: `Product ${action} from admin products panel.` }),
    },
    `POST ${action} failed`
  );

  return readSavedProduct(await readJsonResponse(response));
}

async function hideAdminProducts(skus: string[]) {
  const response = await fetchAdminWriteResponse(
    adminProductsEndpoint,
    {
      method: "DELETE",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ skus }),
    },
    `DELETE ${adminProductsEndpoint} failed`
  );

  return readProductsRows(await readJsonResponse(response))
    .map(normalizeProductApiRow)
    .filter(isDefined);
}

async function saveAdminProductStockAdjustment(
  sku: string,
  adjustment: StockAdjustmentPayload
) {
  const response = await fetchAdminWriteResponse(
    `${adminProductsEndpoint}/${encodeURIComponent(sku)}/stock-adjustments`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(adjustment),
    },
    "POST stock adjustment failed"
  );

  return readSavedProduct(await readJsonResponse(response));
}

async function uploadAdminProductImage(
  sku: string,
  payload: {
    file: File;
    imageAlt: string;
    reason: string;
    setPrimary: boolean;
  }
) {
  const formData = new FormData();
  formData.set("file", payload.file);
  formData.set("imageAlt", payload.imageAlt);
  formData.set("reason", payload.reason);
  formData.set("setPrimary", String(payload.setPrimary));

  const response = await fetchAdminWriteResponse(
    `${adminProductsEndpoint}/${encodeURIComponent(sku)}/images`,
    {
      method: "POST",
      cache: "no-store",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      body: formData,
    },
    "POST image upload failed"
  );

  return readSavedProduct(await readJsonResponse(response));
}

async function fetchAdminProductAudit(sku: string, signal?: AbortSignal) {
  const response = await fetch(
    `${adminProductsEndpoint}/${encodeURIComponent(sku)}/audit?limit=30`,
    {
      cache: "no-store",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(`GET audit responded ${response.status}`);
  }

  const rows = readProductsRows(await readJsonResponse(response));
  return rows.map(normalizeProductAuditEvent).filter(isDefined);
}

function parseProductsApiPayload(payload: unknown): ProductsApiResult {
  const rows = readProductsRows(payload);
  const products = rows.map(normalizeProductApiRow).filter(isDefined);
  const meta = readProductsMeta(payload);
  const source = readProductsSource(readString(meta.source), products.length);

  return {
    products,
    source,
    total: readNumber(meta.total) ?? products.length,
    returned: readNumber(meta.returned) ?? products.length,
  };
}

function readSavedProduct(payload: unknown) {
  const candidates = readSavedProductCandidates(payload);

  for (const candidate of candidates) {
    const product = normalizeProductApiRow(candidate);

    if (product) {
      return product;
    }
  }

  throw new Error("Product response did not contain a product.");
}

function readSavedProductCandidates(payload: unknown) {
  if (isRecord(payload)) {
    if (Array.isArray(payload.data)) {
      return payload.data;
    }

    if (payload.data) {
      return [payload.data];
    }

    if (payload.product) {
      return [payload.product];
    }
  }

  return [payload];
}

function readProductsRows(payload: unknown) {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.products)) {
    return payload.data.products;
  }

  if (Array.isArray(payload.products)) {
    return payload.products;
  }

  return [];
}

function readRestockRequestRows(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return [];
  }

  return payload.data.map(parseRestockRequestRow).filter(isDefined);
}

function readPayloadDataObject(payload: unknown) {
  return isRecord(payload) && isRecord(payload.data) ? payload.data : {};
}

function readProductsMeta(payload: unknown) {
  if (!isRecord(payload)) {
    return {};
  }

  if (isRecord(payload.meta)) {
    return payload.meta;
  }

  return {};
}

function normalizeProductApiRow(row: unknown): AdminProductRow | null {
  if (!isRecord(row)) {
    return null;
  }

  const rawSku = readString(row.sku) ?? readString(row.sku_code);
  const sku = rawSku ? toPublicSku(rawSku) : null;

  if (!sku) {
    return null;
  }

  const name = readString(row.name) ?? sku;
  const category = readString(row.category) ?? "Schermi";
  const categoryVisual = categories.find((item) => item.label === category || item.value === category)?.visual;
  const stock =
    readNumber(row.stockQty) ??
    readNumber(row.stock_qty) ??
    readNumber(row.stock) ??
    readNumber(row.availableQty) ??
    0;
  const stockStatus =
    normalizeStockStatus(row.stockStatus) ??
    normalizeStockStatus(row.stock_status) ??
    stockStatusFromStock(stock);
  const catalogStatus =
    normalizeCatalogStatus(row.catalogStatus) ??
    normalizeCatalogStatus(row.catalog_status) ??
    normalizeCatalogStatus(row.status) ??
    "draft";

  return {
    sku,
    slug: readString(row.slug) ?? slugify(sku),
    name,
    category,
    brand: readString(row.brand) ?? "OEM",
    grade: normalizeProductGrade(row.grade ?? row.quality_grade),
    price: readNumber(row.b2bPrice) ?? readNumber(row.b2b_price) ?? readNumber(row.price) ?? 0,
    retailPrice:
      readNumber(row.retailPrice) ??
      readNumber(row.retail_price) ??
      readNumber(row.price) ??
      0,
    stock,
    status: stockStatus,
    updatedAt: readString(row.updatedAt) ?? readString(row.updated_at) ?? formatTimestamp(),
    visual: normalizeProductVisual(row.visual) ?? categoryVisual ?? "screen",
    compatibleWith:
      readStringArray(row.compatibleWith) ??
      readStringArray(row.compatibility_models) ??
      readStringArray(row.compatibility) ??
      [],
    warehouse: normalizeWarehouse(row.warehouse ?? row.location),
    moq: readNumber(row.moq) ?? 1,
    vatRate: readNumber(row.vatRate) ?? readNumber(row.vat_rate) ?? 22,
    rmaDays: readNumber(row.rmaDays) ?? readNumber(row.rma_days) ?? 30,
    leadTime: readString(row.leadTime) ?? readString(row.lead_time) ?? "24/48h",
    tags: (readStringArray(row.tags) ?? []).map(sanitizeSupplierText).filter(Boolean),
    imageUrl: readString(row.imageUrl) ?? readString(row.image_url) ?? undefined,
    imageAlt: readString(row.imageAlt) ?? readString(row.image_alt) ?? undefined,
    galleryImageUrls:
      readStringArray(row.galleryImageUrls) ??
      readStringArray(row.gallery_image_urls) ??
      [],
    actualQty: readNumber(row.actualQty) ?? readNumber(row.actual_qty),
    availableQty: readNumber(row.availableQty) ?? readNumber(row.available_qty),
    batchCode: sanitizeSupplierText(readString(row.batchCode) ?? readString(row.batch_code)),
    catalogUrl: readString(row.catalogUrl) ?? readString(row.catalog_url),
    catalogStatus,
    costPrice: readNumber(row.costPrice) ?? readNumber(row.cost_price),
    galleryImagePaths:
      readStringArray(row.galleryImagePaths) ??
      readStringArray(row.gallery_image_paths) ??
      [],
    imagePath: readString(row.imagePath) ?? readString(row.image_path),
    lockedQty: readNumber(row.lockedQty) ?? readNumber(row.locked_qty),
    margin: readNumber(row.margin),
    model: readString(row.model),
    modelSeries: readString(row.modelSeries) ?? readString(row.model_series),
    modelCode: sanitizeSupplierText(readString(row.modelCode) ?? readString(row.model_code)),
    modelCodes:
      (readStringArray(row.modelCodes) ?? readStringArray(row.model_codes) ?? [])
        .map(sanitizeSupplierText)
        .filter(Boolean),
    stockQty: readNumber(row.stockQty) ?? readNumber(row.stock_qty),
    storefrontUrl: readString(row.storefrontUrl) ?? readString(row.storefront_url),
    storefrontVisible: readBoolean(row.storefrontVisible) ?? readBoolean(row.storefront_visible) ?? false,
    supplier: sanitizeSupplierText(readString(row.supplier)),
    activeRestockRequestCount:
      readNumber(row.activeRestockRequestCount) ??
      readNumber(row.active_restock_request_count) ??
      readNumber(row.restockRequestCount) ??
      0,
  };
}

function parseRestockRequestRow(row: unknown): AdminRestockRequest | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = readString(row.id);
  const sku = readString(row.sku) ?? readString(row.sku_code);
  const productName = readString(row.productName) ?? readString(row.product_name) ?? sku;
  const status = normalizeRestockRequestStatus(readString(row.status));

  if (!id || !sku || !productName || !status) {
    return null;
  }

  return {
    createdAt: readString(row.createdAt) ?? readString(row.created_at) ?? "",
    customerId: readString(row.customerId) ?? readString(row.customer_id) ?? null,
    id,
    productName,
    sku: toPublicSku(sku),
    status,
    updatedAt: readString(row.updatedAt) ?? readString(row.updated_at) ?? "",
    userId: readString(row.userId) ?? readString(row.user_id) ?? null,
  };
}

function normalizeRestockRequestStatus(
  value: string | null | undefined
): AdminRestockRequestStatus | null {
  return value === "active" || value === "notified" || value === "cancelled"
    ? value
    : null;
}

function normalizeDeviceModelGroup(row: unknown): DeviceModelGroup | null {
  if (!isRecord(row)) {
    return null;
  }

  const brand = readString(row.brand);
  const models = readStringArray(row.models);
  const series = Array.isArray(row.series)
    ? row.series.map(normalizeDeviceModelSeriesGroup).filter(isDefined)
    : undefined;

  if (!brand || !models?.length) {
    return null;
  }

  return { brand, models, ...(series?.length ? { series } : {}) };
}

function normalizeDeviceModelSeriesGroup(row: unknown) {
  if (!isRecord(row)) {
    return null;
  }

  const series = readString(row.series);
  const models = readStringArray(row.models);

  if (!series || !models?.length) {
    return null;
  }

  return { series, models };
}

function normalizeProductAuditEvent(row: unknown): ProductAuditEvent | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = readString(row.id) ?? crypto.randomUUID();

  return {
    id,
    action: readString(row.action) ?? "product_update",
    actorEmail: readString(row.actorEmail) ?? readString(row.actor_email) ?? null,
    actorRole: readString(row.actorRole) ?? readString(row.actor_role) ?? null,
    afterData: readRecordObject(row.afterData) ?? readRecordObject(row.after_data) ?? {},
    beforeData: readRecordObject(row.beforeData) ?? readRecordObject(row.before_data) ?? {},
    reason: readString(row.reason) ?? null,
    result: readString(row.result) ?? "success",
    requestMetadata: readRecordObject(row.requestMetadata) ?? readRecordObject(row.request_metadata) ?? {},
    createdAt: readString(row.createdAt) ?? readString(row.created_at) ?? formatTimestamp(),
    createdAtRaw:
      readString(row.createdAtRaw) ??
      readString(row.created_at_raw) ??
      readString(row.created_at) ??
      null,
  };
}

function buildProductWritePayload(values: ProductFormValues, mode: "create" | "update") {
  const price = parseNumber(values.price) ?? 0;
  const retailPrice = parseNumber(values.retailPrice);
  const costPrice = parseNumber(values.costPrice);
  const payload: ProductWritePayload = {
    name: values.name.trim(),
    category: values.category.trim(),
    brand: values.brand.trim(),
    grade: values.grade,
    price,
    retailPrice: retailPrice ?? Number((price * 1.35).toFixed(2)),
    moq: parseInteger(values.moq) ?? 1,
    compatibleWith: splitList(values.compatibleWith),
    tags: splitList(values.tags),
  };

  if (mode === "create") {
    const sku = toPublicSku(values.sku);

    if (sku && (values.skuMode === "manual" || isValidAdminSku(values.modelCode))) {
      payload.sku = sku;
    }

    payload.stock = parseInteger(values.stock) ?? 0;
    payload.warehouse = defaultWarehouse;
  }

  assignOptional(payload, "costPrice", costPrice);
  assignOptional(payload, "model", values.model.trim());
  assignOptional(payload, "modelCode", sanitizeSupplierText(values.modelCode));
  assignOptional(payload, "batchCode", sanitizeSupplierText(values.batchCode));
  assignOptional(payload, "supplier", sanitizeSupplierText(values.supplier));
  assignOptional(payload, "imagePath", values.imagePath.trim());
  assignOptional(payload, "imageAlt", values.imageAlt.trim());

  return payload;
}

function defaultProductFormValues(): ProductFormValues {
  return {
    sku: "",
    skuMode: "auto",
    name: "",
    category: "Schermi",
    brand: "OEM",
    grade: "A+",
    price: "",
    retailPrice: "",
    costPrice: "",
    stock: "0",
    moq: "1",
    leadTime: "24/48h Italia",
    compatibleWith: "",
    tags: "",
    model: "",
    modelCode: "",
    batchCode: "",
    supplier: "",
    imagePath: "",
    imageAlt: "",
  };
}

function productFormDefaults(product: AdminProductRow): ProductFormValues {
  return {
    sku: product.sku,
    skuMode: "manual",
    name: product.name,
    category: product.category,
    brand: product.brand,
    grade: product.grade,
    price: String(product.price),
    retailPrice: product.retailPrice ? String(product.retailPrice) : "",
    costPrice: product.costPrice ? String(product.costPrice) : "",
    stock: String(product.stock),
    moq: String(product.moq),
    leadTime: product.leadTime,
    compatibleWith: product.compatibleWith.join(", "),
    tags: product.tags.join(", "),
    model: product.model ?? "",
    modelCode: product.modelCode ?? "",
    batchCode: product.batchCode ?? "",
    supplier: product.supplier ?? "",
    imagePath: product.imagePath ?? "",
    imageAlt: product.imageAlt ?? "",
  };
}

function buildProductFormSkuCandidate(
  values: ProductFormValues,
  products: AdminProductRow[]
) {
  const candidate = buildAdminProductSkuCandidate({
    brand: values.brand,
    category: values.category,
    grade: values.grade,
    model: values.model,
    modelCode: values.modelCode,
    name: values.name,
  });

  if (candidate.source === "external") {
    return candidate;
  }

  return {
    ...candidate,
    sku: ensureUniqueSku(candidate.sku, products),
  };
}

function validateProductForm(
  values: ProductFormValues,
  isEdit: boolean,
  text: typeof panelText.zh | typeof panelText.it
) {
  const errors: Record<string, string> = {};

  if (!values.name.trim() || !values.category.trim() || !values.brand.trim() || !values.leadTime.trim()) {
    errors.name = text.formRequired;
  }

  if (!isEdit && values.sku.trim().length < 2) {
    errors.sku = text.formRequired;
  }

  if (splitList(values.compatibleWith).length === 0) {
    errors.compatibleWith = text.formRequired;
  }

  if (!Number.isFinite(parseNumber(values.price)) || (parseNumber(values.price) ?? 0) < 0) {
    errors.price = text.invalidNumber;
  }

  if (!Number.isInteger(parseInteger(values.moq)) || (parseInteger(values.moq) ?? 0) < 1) {
    errors.moq = text.invalidNumber;
  }

  if (!isEdit && (!Number.isInteger(parseInteger(values.stock)) || (parseInteger(values.stock) ?? -1) < 0)) {
    errors.stock = text.invalidNumber;
  }

  return errors;
}

function buildProductMetrics(products: AdminProductRow[], total: number) {
  return products.reduce(
    (metrics, product) => {
      metrics[product.catalogStatus] += 1;

      if (product.stock > 0 && product.stock < lowStockThreshold) {
        metrics.lowStock += 1;
      }

      if (!product.imagePath && !product.imageUrl) {
        metrics.missingImage += 1;
      }

      if (product.price <= 0) {
        metrics.missingPrice += 1;
      }

      metrics.restockRequests += product.activeRestockRequestCount ?? 0;

      return metrics;
    },
    {
      total,
      active: 0,
      draft: 0,
      hidden: 0,
      blocked: 0,
      lowStock: 0,
      restockRequests: 0,
      missingImage: 0,
      missingPrice: 0,
    }
  );
}

function stockStatusFromStock(stock: number): StockStatus {
  if (stock === 0) {
    return "Out of Stock";
  }

  if (stock < lowStockThreshold) {
    return "Low Stock";
  }

  return "In Stock";
}

function normalizeProductGrade(value: unknown): ProductGrade {
  const grade = readString(value);
  return productGrades.find((item) => item === grade) ?? "A+";
}

function normalizeStockStatus(value: unknown): StockStatus | null {
  const status = readString(value);
  return stockStatuses.find((item) => item === status) ?? null;
}

function normalizeCatalogStatus(value: unknown): CatalogStatus | null {
  const status = readString(value);
  return catalogStatuses.find((item) => item === status) ?? null;
}

function normalizeWarehouse(value: unknown): PartProduct["warehouse"] {
  void value;
  return defaultWarehouse;
}

function normalizeProductVisual(value: unknown): PartVisual | null {
  const visual = readString(value);
  return productVisuals.find((item) => item === visual) ?? null;
}

function readProductsSource(value: string | undefined, productCount: number): ProductSource {
  if (value === "supabase" || value === "api" || value === "empty") {
    return value;
  }

  return productCount > 0 ? "api" : "empty";
}

function productSourceLabel(
  source: ProductSource,
  adminText: AdminText
) {
  return adminSourceLabel(adminText, source, source);
}

function paginationButtonIndexes(pageCount: number, pageIndex: number) {
  const indexes = new Set<number>([0, pageCount - 1, pageIndex]);

  for (let index = pageIndex - 1; index <= pageIndex + 1; index += 1) {
    if (index >= 0 && index < pageCount) {
      indexes.add(index);
    }
  }

  return Array.from(indexes).sort((left, right) => left - right);
}

function ensureUniqueSku(sku: string, products: AdminProductRow[]) {
  const requestedSku = sku.trim();
  const knownSkus = new Set(products.map((product) => product.sku.toLowerCase()));

  if (!knownSkus.has(requestedSku.toLowerCase())) {
    return requestedSku;
  }

  let index = 2;
  let nextSku = `${requestedSku}-${index}`;

  while (knownSkus.has(nextSku.toLowerCase())) {
    index += 1;
    nextSku = `${requestedSku}-${index}`;
  }

  return nextSku;
}

function buildCascadeModelGroups(modelGroups: DeviceModelGroup[]) {
  const groups = new Map<string, { models: Set<string>; series: Map<string, Set<string>> }>();

  for (const group of modelGroups) {
    const existing = groups.get(group.brand) ?? {
      models: new Set<string>(),
      series: new Map<string, Set<string>>(),
    };

    group.models.forEach((model) => existing.models.add(model));

    for (const seriesGroup of group.series ?? []) {
      const models = existing.series.get(seriesGroup.series) ?? new Set<string>();
      seriesGroup.models.forEach((model) => {
        models.add(model);
        existing.models.add(model);
      });
      existing.series.set(seriesGroup.series, models);
    }

    groups.set(group.brand, existing);
  }

  return Array.from(groups.entries())
    .map(([brand, group]) => ({
      brand,
      models: Array.from(group.models).sort(compareModelNames),
      series: Array.from(group.series.entries())
        .map(([series, models]) => ({
          series,
          models: Array.from(models).sort(compareModelNames),
        }))
        .filter((item) => item.models.length > 0)
        .sort((left, right) => left.series.localeCompare(right.series, undefined, { numeric: true })),
    }))
    .filter((group) => group.models.length > 0)
    .sort((left, right) => left.brand.localeCompare(right.brand, undefined, { numeric: true }));
}

function downloadProductsCsv(products: AdminProductRow[], scope: "selected" | "view") {
  if (products.length === 0) {
    return;
  }

  const headers = [
    "sku",
    "name",
    "category",
    "brand",
    "grade",
    "catalogStatus",
    "stock",
    "stockStatus",
    "price",
    "retailPrice",
    "updatedAt",
  ];
  const rows = products.map((product) => [
    product.sku,
    product.name,
    product.category,
    product.brand,
    product.grade,
    product.catalogStatus,
    product.stock,
    product.status,
    product.price.toFixed(2),
    product.retailPrice.toFixed(2),
    product.updatedAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => csvEscape(value)).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `partspro-prodotti-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function splitList(value?: string) {
  return (value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function assignOptional<T extends Record<string, unknown>, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined | null | ""
) {
  if (value !== undefined && value !== null && value !== "") {
    target[key] = value;
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = Number(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : undefined;
  }

  return undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(readString).filter(isDefined);
  }

  if (typeof value === "string") {
    return splitList(value);
  }

  return undefined;
}

function readRecordObject(value: unknown) {
  return isRecord(value) ? value : undefined;
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readJsonResponse(response: Response) {
  return (await response.json()) as unknown;
}

async function fetchAdminWriteResponse(
  input: RequestInfo | URL,
  init: RequestInit,
  fallback: string
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), adminProductWriteTimeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });

    if (!response.ok) {
      throw new Error(
        await readApiErrorMessage(
          response,
          `${fallback}: HTTP ${response.status}`
        )
      );
    }

    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("请求超时，请刷新后重试，或检查当前账号的商品权限。");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readApiErrorMessage(response: Response, fallback: string) {
  let payload: unknown;

  try {
    payload = await readJsonResponse(response);
  } catch {
    return fallback;
  }

  if (!isRecord(payload) || !isRecord(payload.error)) {
    return fallback;
  }

  const code = readString(payload.error.code);
  const message = readString(payload.error.message);
  const details = readApiErrorDetail(payload.error.details);
  const parts = [code, message, details].filter(Boolean);

  return parts.length > 0 ? parts.join(": ") : fallback;
}

function readApiErrorDetail(details: unknown) {
  if (isRecord(details)) {
    const missing = readMissingPermissionDetails(details.missing);

    if (missing) {
      return missing;
    }

    return (
      readString(details.message) ??
      readString(details.details) ??
      readString(details.hint) ??
      readString(details.code)
    );
  }

  return readString(details);
}

function readMissingPermissionDetails(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const permissions = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const permission = readString(item.permission);
      const fields = Array.isArray(item.fields)
        ? item.fields.map(readString).filter(Boolean)
        : [];

      if (!permission) {
        return null;
      }

      return fields.length > 0 ? `${permission} (${fields.join(", ")})` : permission;
    })
    .filter(isDefined);

  return permissions.length > 0 ? `缺少权限：${permissions.join("; ")}` : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function formatNoticeError(baseMessage: string, error: unknown) {
  const detail = getErrorMessage(error);

  return detail === "Unknown error" ? baseMessage : `${baseMessage} ${detail}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function formatTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function compareModelNames(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function metricIconClass(tone: string) {
  if (tone === "green") {
    return "text-emerald-600";
  }

  if (tone === "amber" || tone === "orange") {
    return "text-amber-600";
  }

  if (tone === "red") {
    return "text-red-600";
  }

  if (tone === "cyan") {
    return "text-cyan-600";
  }

  if (tone === "violet") {
    return "text-violet-600";
  }

  return "text-primary";
}

function stockStatusBadgeClass(status: StockStatus) {
  if (status === "In Stock") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Low Stock") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function catalogStatusBadgeClass(status: CatalogStatus) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "hidden") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  if (status === "blocked") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function noticeClassName(tone: ProductNotice["tone"]) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (tone === "error") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-sky-200 bg-sky-50 text-sky-800";
}
