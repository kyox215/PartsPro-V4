"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
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
  formatAdminMessage,
  getAdminDictionary,
} from "@/i18n/dictionaries/admin";
import { sanitizeSupplierText, toPublicSku } from "@/lib/partspro-sku";
import { useI18n } from "./i18n-provider";
import { PartVisual as ProductVisual } from "./part-visual";

const adminProductsEndpoint = "/api/admin/products";
const productImagesBucket = "product-images";
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
  modelSeries: string;
  model: string;
  catalogStatus: FilterValue<CatalogStatus>;
  stockStatus: FilterValue<StockStatus>;
  grade: FilterValue<ProductGrade>;
  sort: ProductSort;
  page: number;
  pageSize: number;
};

type AdminProductRow = PartProduct & {
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
  reason: string | null;
  createdAt: string;
};

const defaultFilters: ProductListFilters = {
  q: "",
  brand: "all",
  modelSeries: "all",
  model: "all",
  catalogStatus: "all",
  stockStatus: "all",
  grade: "all",
  sort: "updated_desc",
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
    filters: "筛选",
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
    details: "商品详情",
    edit: "编辑商品",
    duplicate: "复制为草稿",
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
    netPrice: "B2B 净价",
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
    modelCode: "型号代码",
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
    stockReadonly: "库存只能通过库存动作调整",
    storefrontVisible: "前台可见",
    auditLoading: "正在读取审计记录...",
    auditEmpty: "暂无审计记录。",
    auditError: "审计记录暂时无法读取。",
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
    filters: "Filtri",
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
    details: "Dettagli",
    edit: "Modifica",
    duplicate: "Duplica bozza",
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
    modelCode: "Codice modello",
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
    stockReadonly: "Lo stock si modifica solo con movimento stock",
    storefrontVisible: "Visibile in storefront",
    auditLoading: "Caricamento audit...",
    auditEmpty: "Nessun audit registrato.",
    auditError: "Audit non disponibile.",
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
    label: productSourceLabel("empty", text),
  }));
  const [modelGroups, setModelGroups] = React.useState<DeviceModelGroup[]>([]);
  const [selectedSkus, setSelectedSkus] = React.useState<Set<string>>(() => new Set());
  const [notice, setNotice] = React.useState<ProductNotice | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [isLoadingModelGroups, setIsLoadingModelGroups] = React.useState(true);
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
          label: productSourceLabel(result.source, text),
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

        setProducts([]);
        setDataSource({
          source: "empty",
          label: productSourceLabel("empty", text),
          syncedAt: formatTimestamp(),
          total: 0,
          returned: 0,
          error: getErrorMessage(error),
        });
        setSelectedSkus(new Set());
        setNotice({ tone: "error", message: formatNoticeError(text.syncError, error) });
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [filters, text]
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
  const metrics = React.useMemo(
    () => buildProductMetrics(products, dataSource.total),
    [dataSource.total, products]
  );
  const selectedBrandGroup = modelGroups.find((group) => group.brand === filters.brand);
  const seriesOptions = selectedBrandGroup?.series ?? [];
  const selectedSeriesGroup =
    filters.modelSeries === "all"
      ? null
      : seriesOptions.find((group) => group.series === filters.modelSeries) ?? null;
  const modelOptions =
    filters.brand === "all"
      ? Array.from(new Set(modelGroups.flatMap((group) => group.models))).sort(compareModelNames)
      : selectedSeriesGroup?.models ?? selectedBrandGroup?.models ?? [];
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
          current.source === "empty" ? productSourceLabel("api", text) : current.label,
        total: current.total + 1,
        returned: current.returned + 1,
      }));
      setNotice({
        tone: "success",
        message: formatAdminMessage(text.createSuccess, { sku: saved.sku }),
      });

      return saved;
    } catch {
      setNotice({ tone: "error", message: text.saveError });
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
    } catch {
      setNotice({ tone: "error", message: text.saveError });
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleProductAction(product: AdminProductRow, action: ProductAction) {
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
      setIsMutating(false);
    }
  }

  async function handleHideProducts(skus: string[]) {
    if (skus.length === 0) {
      return;
    }

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

        <div className="border-b border-slate-200 bg-slate-50/70 px-2.5 py-2 sm:px-4 sm:py-3">
          <ProductCascadeMenu
            filters={filters}
            modelGroups={modelGroups}
            isLoadingModelGroups={isLoadingModelGroups}
            text={text}
            onChange={updateFilters}
          />
          <ProductFilters
            filters={filters}
            modelGroups={modelGroups}
            seriesOptions={seriesOptions}
            modelOptions={modelOptions}
            isLoadingModelGroups={isLoadingModelGroups}
            text={text}
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
                  <EyeOff className="size-4" />
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
          products={products}
          selectedSkus={selectedSkus}
          isLoading={isLoading}
          isMutating={isMutating}
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
      </div>

      <ProductPagination
        filters={filters}
        pageCount={pageCount}
        total={dataSource.total}
        returned={products.length}
        text={text}
        onChange={updateFilters}
      />

      <ProductDrawer
        mode={drawerMode}
        product={drawerProduct}
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
    { label: text.missingImage, value: metrics.missingImage, icon: ImageIcon, tone: "cyan" },
    { label: text.missingPrice, value: metrics.missingPrice, icon: Euro, tone: "violet" },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-4 xl:grid-cols-8">
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

function ProductFilters({
  filters,
  modelGroups,
  seriesOptions,
  modelOptions,
  isLoadingModelGroups,
  text,
  onChange,
  onReset,
}: {
  filters: ProductListFilters;
  modelGroups: DeviceModelGroup[];
  seriesOptions: NonNullable<DeviceModelGroup["series"]>;
  modelOptions: string[];
  isLoadingModelGroups: boolean;
  text: typeof panelText.zh | typeof panelText.it;
  onChange: (patch: Partial<ProductListFilters>) => void;
  onReset: () => void;
}) {
  const hasFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "page" || key === "pageSize" || key === "sort") {
      return false;
    }

    return value !== defaultFilters[key as keyof ProductListFilters];
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_160px_180px_200px_180px]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={filters.q}
            onChange={(event) => onChange({ q: event.target.value })}
            className="h-9 bg-white pl-9"
            placeholder={text.searchPlaceholder}
          />
        </div>
        <Select
          value={filters.brand}
          onValueChange={(value) => onChange({ brand: value, modelSeries: "all", model: "all" })}
        >
          <SelectTrigger size="sm" className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{text.allBrands}</SelectItem>
            {modelGroups.map((group) => (
              <SelectItem key={group.brand} value={group.brand}>
                {group.brand}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.modelSeries}
          onValueChange={(value) => onChange({ modelSeries: value, model: "all" })}
          disabled={filters.brand === "all" || isLoadingModelGroups || seriesOptions.length === 0}
        >
          <SelectTrigger size="sm" className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{text.allSeries}</SelectItem>
            {seriesOptions.map((group) => (
              <SelectItem key={group.series} value={group.series}>
                {group.series}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.model}
          onValueChange={(value) => onChange({ model: value })}
          disabled={isLoadingModelGroups || modelOptions.length === 0}
        >
          <SelectTrigger size="sm" className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{text.allModels}</SelectItem>
            {modelOptions.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CatalogStatusSelect
          value={filters.catalogStatus}
          text={text}
          onChange={(value) => onChange({ catalogStatus: value })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[180px_160px_190px_auto]">
        <StockStatusSelect
          value={filters.stockStatus}
          text={text}
          onChange={(value) => onChange({ stockStatus: value })}
        />
        <Select
          value={filters.grade}
          onValueChange={(value) =>
            onChange({ grade: value as ProductListFilters["grade"] })
          }
        >
          <SelectTrigger size="sm" className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{text.allGrades}</SelectItem>
            {productGrades.map((grade) => (
              <SelectItem key={grade} value={grade}>
                {grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.sort}
          onValueChange={(value) => onChange({ sort: value as ProductSort })}
        >
          <SelectTrigger size="sm" className="w-full bg-white">
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
        <Button
          variant="outline"
          className="bg-white"
          onClick={onReset}
          disabled={!hasFilters}
        >
          <Filter className="size-4" />
          {text.reset}
        </Button>
      </div>
    </div>
  );
}

function ProductCascadeMenu({
  filters,
  modelGroups,
  isLoadingModelGroups,
  text,
  onChange,
}: {
  filters: ProductListFilters;
  modelGroups: DeviceModelGroup[];
  isLoadingModelGroups: boolean;
  text: typeof panelText.zh | typeof panelText.it;
  onChange: (patch: Partial<ProductListFilters>) => void;
}) {
  const groups = React.useMemo(
    () => buildCascadeModelGroups(modelGroups),
    [modelGroups]
  );
  const selectedBrand = filters.brand === "all" ? "" : filters.brand;
  const selectedSeries = filters.modelSeries === "all" ? "" : filters.modelSeries;
  const selectedModel = filters.model === "all" ? "" : filters.model;
  const selectedGroup = selectedBrand
    ? groups.find((group) => group.brand === selectedBrand)
    : null;
  const selectedSeriesGroup =
    selectedGroup && selectedSeries
      ? selectedGroup.series?.find((group) => group.series === selectedSeries) ?? null
      : null;
  const seriesGroups = selectedGroup?.series ?? [];
  const modelList = selectedSeriesGroup?.models ?? selectedGroup?.models ?? [];

  return (
    <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(130px,0.8fr)_minmax(150px,0.95fr)_minmax(180px,1fr)_minmax(220px,1.15fr)]">
      <CascadeColumn
        title="1"
        label={text.accessoryRoot}
        icon={Package}
      >
        <button
          type="button"
          className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-left text-sm font-bold text-primary"
          onClick={() => onChange({ q: "", brand: "all", modelSeries: "all", model: "all" })}
        >
          <span className="truncate">{text.accessoryRoot}</span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
      </CascadeColumn>

      <CascadeColumn
        title="2"
        label={text.cascadeBrand}
        icon={Tag}
      >
        <CascadeScrollArea empty={isLoadingModelGroups ? text.loading : text.noCascadeOptions}>
          {groups.map((group) => (
            <CascadeOption
              key={group.brand}
              selected={group.brand === selectedBrand}
              label={group.brand}
              meta={`${group.series?.length || group.models.length}`}
              onClick={() => onChange({ q: "", brand: group.brand, modelSeries: "all", model: "all" })}
            />
          ))}
        </CascadeScrollArea>
      </CascadeColumn>

      <CascadeColumn
        title="3"
        label={text.cascadeSeries}
        icon={Boxes}
      >
        {selectedGroup ? (
          seriesGroups.length > 0 ? (
            <CascadeScrollArea empty={text.noCascadeOptions}>
              <CascadeOption
                key="all-series"
                selected={!selectedSeries}
                label={text.allSeries}
                meta={`${selectedGroup.models.length}`}
                onClick={() => onChange({ q: "", modelSeries: "all", model: "all" })}
              />
              {seriesGroups.map((group) => (
                <CascadeOption
                  key={group.series}
                  selected={group.series === selectedSeries}
                  label={group.series}
                  meta={`${group.models.length}`}
                  onClick={() => onChange({ q: "", modelSeries: group.series, model: "all" })}
                />
              ))}
            </CascadeScrollArea>
          ) : (
            <CascadePlaceholder>{text.noCascadeOptions}</CascadePlaceholder>
          )
        ) : (
          <CascadePlaceholder>{text.pickBrand}</CascadePlaceholder>
        )}
      </CascadeColumn>

      <CascadeColumn
        title="4"
        label={text.cascadeModel}
        icon={Smartphone}
      >
        {modelList.length > 0 ? (
          <CascadeScrollArea empty={text.noCascadeOptions}>
            <CascadeOption
              key="all-models"
              selected={!selectedModel}
              label={text.allModels}
              meta={`${modelList.length}`}
              onClick={() => onChange({ q: "", model: "all" })}
            />
            {modelList.map((model) => (
              <CascadeOption
                key={model}
                selected={model === selectedModel}
                label={model}
                onClick={() => onChange({ q: "", model })}
              />
            ))}
          </CascadeScrollArea>
        ) : (
          <CascadePlaceholder>
            {selectedGroup && seriesGroups.length > 0 ? text.pickSeries : text.pickBrand}
          </CascadePlaceholder>
        )}
      </CascadeColumn>
    </div>
  );
}

function CascadeColumn({
  title,
  label,
  icon: Icon,
  meta,
  children,
}: {
  title: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
      <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-slate-100 text-[11px] font-black text-slate-600">
            {title}
          </span>
          <Icon className="size-4 shrink-0 text-slate-500" />
          <span className="truncate text-xs font-bold text-slate-700">{label}</span>
        </div>
        {meta && <span className="shrink-0 text-[11px] font-semibold text-slate-400">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function CascadeScrollArea({
  empty,
  children,
}: {
  empty: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);

  if (items.length === 0) {
    return <CascadePlaceholder>{empty}</CascadePlaceholder>;
  }

  return <div className="grid max-h-48 gap-1 overflow-y-auto pr-1">{items}</div>;
}

function CascadeOption({
  selected,
  label,
  meta,
  onClick,
}: {
  selected: boolean;
  label: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100",
        selected && "bg-slate-900 text-white hover:bg-slate-900"
      )}
      onClick={onClick}
    >
      <span className="min-w-0 truncate">{label}</span>
      {meta && (
        <span className={cn("shrink-0 text-[11px] font-bold text-slate-400", selected && "text-white/70")}>
          {meta}
        </span>
      )}
    </button>
  );
}

function CascadePlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-24 place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-400">
      {children}
    </div>
  );
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
      <SelectTrigger size="sm" className="w-full bg-white">
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
      <SelectTrigger size="sm" className="w-full bg-white">
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
    <div className="overflow-hidden bg-white">
      <div className="lg:hidden">
        {products.length ? (
          <div className="grid gap-2 p-2">
            {products.map((product) => (
              <ProductMobileCard
                key={product.sku}
                product={product}
                selected={selectedSkus.has(product.sku)}
                isMutating={isMutating}
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
        ) : (
          <ProductEmptyState isLoading={isLoading} text={text} />
        )}
      </div>
      <div className="hidden lg:block">
        <div className="max-w-full overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected || (someSelected && "indeterminate")}
                    onCheckedChange={(value) => toggleAll(value === true)}
                    aria-label="Select all products"
                  />
                </TableHead>
                <TableHead>{text.tableProduct}</TableHead>
                <TableHead>{text.tableBrandModel}</TableHead>
                <TableHead>{text.tableCatalog}</TableHead>
                <TableHead>{text.tableStock}</TableHead>
                <TableHead>{text.tablePrice}</TableHead>
                <TableHead>{text.tableUpdated}</TableHead>
                <TableHead className="text-right">{text.tableActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length ? (
                products.map((product) => (
                  <TableRow
                    key={product.sku}
                    className="cursor-pointer"
                    data-state={selectedSkus.has(product.sku) ? "selected" : undefined}
                    onClick={() => onView(product)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selectedSkus.has(product.sku)}
                        onCheckedChange={(value) => toggleOne(product.sku, value === true)}
                        aria-label={`Select ${product.sku}`}
                      />
                    </TableCell>
                    <TableCell>
                      <ProductIdentity product={product} />
                    </TableCell>
                    <TableCell>
                      <ProductBrandModel product={product} />
                    </TableCell>
                    <TableCell>
                      <Badge className={catalogStatusBadgeClass(product.catalogStatus)}>
                        {adminText.enums.catalogStatus[product.catalogStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ProductStockSummary product={product} adminText={adminText} />
                    </TableCell>
                    <TableCell>
                      <ProductPriceSummary product={product} text={text} />
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-xs font-medium text-slate-500">
                        {product.updatedAt}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      <ProductActionsMenu
                        product={product}
                        isMutating={isMutating}
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
                  <TableCell colSpan={8}>
                    <ProductEmptyState isLoading={isLoading} text={text} />
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

function ProductMobileCard({
  product,
  selected,
  isMutating,
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
        selected && "border-primary/40 bg-primary/5"
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
          <div className="line-clamp-2 min-h-9 text-[13px] font-black leading-[18px] text-slate-950">
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
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
        <MetricPill label={text.brand} value={product.brand} />
        <MetricPill label={text.stock} value={product.availableQty ?? product.stock} />
        <MetricPill label={text.netPrice} value={formatEuro(product.price)} />
      </div>
    </div>
  );
}

function ProductIdentity({ product }: { product: AdminProductRow }) {
  return (
    <div className="flex min-w-[280px] items-center gap-3">
      <ProductImageThumb product={product} className="size-11" sizes="44px" />
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm font-bold leading-snug text-slate-950">
          {product.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="break-all font-mono text-[11px] font-semibold text-slate-500">
            {product.sku}
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
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
    <div className="space-y-1">
      <div className="text-sm font-bold text-slate-900">{product.brand}</div>
      {product.modelSeries && (
        <div className="max-w-[220px] truncate text-[11px] font-bold text-slate-400">
          {product.modelSeries}
        </div>
      )}
      <div className="max-w-[220px] truncate text-xs font-medium text-slate-500">
        {firstModel}
      </div>
      {product.modelCode && (
        <div className="font-mono text-[11px] text-slate-400">{product.modelCode}</div>
      )}
    </div>
  );
}

function ProductStockSummary({
  product,
  adminText,
}: {
  product: AdminProductRow;
  adminText: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  return (
    <div className="space-y-1">
      <Badge className={stockStatusBadgeClass(product.status)}>
        {adminText.enums.stockStatus[product.status]}
      </Badge>
      <div className="text-xs font-semibold text-slate-600">
        {product.availableQty ?? product.stock} / {product.actualQty ?? product.stock}
      </div>
      <div className="text-[11px] text-slate-400">
        locked {product.lockedQty ?? 0}
      </div>
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
    <div className="space-y-1">
      <div className="text-sm font-black text-slate-950">{formatEuro(product.price)}</div>
      <div className="text-xs font-semibold text-slate-500">
        {text.margin} {(product.margin ?? 0).toFixed(1)}%
      </div>
      <div className="text-[11px] text-slate-400">
        {text.costPrice} {formatEuro(product.costPrice ?? 0)}
      </div>
    </div>
  );
}

function ProductActionsMenu({
  product,
  isMutating,
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
  text: typeof panelText.zh | typeof panelText.it;
  onView: (product: AdminProductRow) => void;
  onEdit: (product: AdminProductRow) => void;
  onDuplicate: (product: AdminProductRow) => void;
  onAction: (product: AdminProductRow, action: ProductAction) => void;
  onHide: (product: AdminProductRow) => void;
  onStockAdjust: (product: AdminProductRow) => void;
}) {
  const storefrontUrl = product.storefrontVisible ? product.storefrontUrl : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="bg-white/60">
          <MoreHorizontal className="size-4" />
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
            <PackageCheck className="size-4" />
            {text.publish}
          </DropdownMenuItem>
        )}
        {product.catalogStatus !== "draft" && (
          <DropdownMenuItem disabled={isMutating} onClick={() => onAction(product, "restore")}>
            <RotateCcw className="size-4" />
            {text.restore}
          </DropdownMenuItem>
        )}
        {product.catalogStatus !== "blocked" && (
          <DropdownMenuItem disabled={isMutating} onClick={() => onAction(product, "block")}>
            <Ban className="size-4" />
            {text.block}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={isMutating} onClick={() => onStockAdjust(product)}>
          <SlidersHorizontal className="size-4" />
          {text.stockAdjust}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isMutating}
          className="text-amber-700 focus:text-amber-700"
          onClick={() => onHide(product)}
        >
          <EyeOff className="size-4" />
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
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
      <div className="font-medium text-slate-500">
        {formatAdminMessage(text.pageInfo, { page, pages: pageCount })} · {returned}/{total}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          className="bg-white"
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
          disabled={filters.page >= pageCount - 1}
          onClick={() => onChange({ page: Math.min(pageCount - 1, filters.page + 1) })}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Select
          value={String(filters.pageSize)}
          onValueChange={(value) => onChange({ pageSize: Number(value), page: 0 })}
        >
          <SelectTrigger className="w-28 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((pageSize) => (
              <SelectItem key={pageSize} value={String(pageSize)}>
                {pageSize} / 页
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
              isMutating={isMutating}
              text={text}
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

    const saved = await onSave(product.sku, editValues);

    if (saved) {
      onSaved(saved);
      stopInlineEdit();
      return;
    }

    setEditorState((current) => (
      current?.sku === product.sku ? { ...current, isSubmitting: false } : current
    ));
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
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <ProductHeroMetric label={text.netPrice} value={formatEuro(displayPrice)} />
              <ProductHeroMetric label={text.availableStock} value={product.availableQty ?? product.stock} />
              <ProductHeroMetric label={text.actualStock} value={product.actualQty ?? product.stock} />
              <ProductHeroMetric label={text.margin} value={`${(product.margin ?? 0).toFixed(1)}%`} />
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
                          {grade}
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
                <DetailItem label={text.quality} value={product.grade} />
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
  isMutating,
  text,
  onCreate,
  onSave,
  onSaved,
  onCancel,
  onStockAdjust,
}: {
  mode: ProductDrawerMode;
  product: AdminProductRow | null;
  isMutating: boolean;
  text: typeof panelText.zh | typeof panelText.it;
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
    const nextErrors = validateProductForm(values, isEdit, text);

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const saved =
      isEdit && product
        ? await onSave(product.sku, values)
        : await onCreate(values);
    setIsSubmitting(false);

    if (saved) {
      onSaved(saved);
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
            <Input
              value={values.sku}
              readOnly={isEdit}
              className={cn(isEdit && "bg-slate-50 text-slate-500")}
              onChange={(event) => setValue("sku", event.target.value)}
            />
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
                    {grade}
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
      {events.map((event) => (
        <div key={event.id} className="rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold text-slate-900">{event.action}</div>
            <div className="text-xs font-medium text-slate-500">{event.createdAt}</div>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {event.actorEmail ?? event.actorRole ?? text.none}
          </div>
          {event.reason && (
            <div className="mt-2 text-sm font-medium text-slate-700">
              {event.reason}
            </div>
          )}
        </div>
      ))}
    </div>
  );
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
  const response = await fetch(adminProductsEndpoint, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ product: payload }),
  });

  if (!response.ok) {
    throw new Error(`POST ${adminProductsEndpoint} responded ${response.status}`);
  }

  return readSavedProduct(await readJsonResponse(response));
}

async function updateAdminProduct(sku: string, values: ProductFormValues) {
  const payload = buildProductWritePayload(values, "update");
  const response = await fetch(adminProductsEndpoint, {
    method: "PATCH",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sku, product: payload }),
  });

  if (!response.ok) {
    throw new Error(`PATCH ${adminProductsEndpoint} responded ${response.status}`);
  }

  return readSavedProduct(await readJsonResponse(response));
}

async function runAdminProductAction(sku: string, action: ProductAction) {
  const response = await fetch(`${adminProductsEndpoint}/${encodeURIComponent(sku)}/${action}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason: `Product ${action} from admin products panel.` }),
  });

  if (!response.ok) {
    throw new Error(`POST ${action} responded ${response.status}`);
  }

  return readSavedProduct(await readJsonResponse(response));
}

async function hideAdminProducts(skus: string[]) {
  const response = await fetch(adminProductsEndpoint, {
    method: "DELETE",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ skus }),
  });

  if (!response.ok) {
    throw new Error(`DELETE ${adminProductsEndpoint} responded ${response.status}`);
  }

  return readProductsRows(await readJsonResponse(response))
    .map(normalizeProductApiRow)
    .filter(isDefined);
}

async function saveAdminProductStockAdjustment(
  sku: string,
  adjustment: StockAdjustmentPayload
) {
  const response = await fetch(`${adminProductsEndpoint}/${encodeURIComponent(sku)}/stock-adjustments`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(adjustment),
  });

  if (!response.ok) {
    throw new Error(`POST stock adjustment responded ${response.status}`);
  }

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

  const response = await fetch(`${adminProductsEndpoint}/${encodeURIComponent(sku)}/images`, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`POST image upload responded ${response.status}`);
  }

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
  };
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
    reason: readString(row.reason) ?? null,
    createdAt: readString(row.createdAt) ?? readString(row.created_at) ?? formatTimestamp(),
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
    payload.sku = toPublicSku(values.sku);
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

      return metrics;
    },
    {
      total,
      active: 0,
      draft: 0,
      hidden: 0,
      blocked: 0,
      lowStock: 0,
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
  text: typeof panelText.zh | typeof panelText.it
) {
  if (source === "supabase") {
    return "Supabase";
  }

  if (source === "api") {
    return "API";
  }

  return text.sourcePending;
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
    return (
      readString(details.message) ??
      readString(details.details) ??
      readString(details.hint) ??
      readString(details.code)
    );
  }

  return readString(details);
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
