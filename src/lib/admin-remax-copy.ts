import { englishUiCopy } from "@/i18n/english-ui-copy";
const zh: Record<string,string> = {
 "Torna al pannello":"返回总览","REMAX esclusiva":"REMAX 专属预购","Centro preordini REMAX":"REMAX 预购中心","Quattro passaggi guidati. L&apos;importazione apre le prenotazioni ma non aumenta lo stock; solo “Registra arrivo” trasforma la merce in giacenza reale.":"按四步处理预购。导入会开启预订，不会增加库存；清点实物并登记到货后才增加真实库存。","1. Scarica modello":"1 · 下载模板","2. Compila lotto e carica file":"2 · 填写批次并上传文件","Codice lotto *":"批次编号 *","ETA inizio *":"预计到货起始 *","ETA fine *":"预计到货结束 *","Chiusura prenotazioni":"预订截止时间","Numero ordine fornitore":"供应商订单号","Deposito":"仓库","Condizioni mostrate al cliente *":"客户可见预购说明 *","File REMAX (.xlsx o .csv, massimo 5 MB / 500 righe)":"REMAX 文件（xlsx/csv，最多5MB/500行）","Selezionato:":"已选择：","3. Controlla prima di importare":"3 · 导入前检查","3. Anteprima file":"3 · 文件预览","Pronte":"可导入","Bozze":"草稿","Bloccate":"已阻塞","Riga":"行号","Stato":"状态","SKU / prodotto":"SKU / 商品","Q.tà":"数量","Prezzi C / B2B / retail":"成本 / 批发 / 零售价格","Controllo":"检查结果","- buffer":"- 预留量","Ho controllato quantità, costi, prezzi, immagini, ETA e righe da pubblicare. Confermo la creazione del lotto.":"我已核对数量、成本、价格、图片、预计到货和待发布行，确认创建此批次。","Conferma e apri preordini":"确认并开启预购","Il tuo ruolo non possiede tutti i permessi richiesti per creare, prezzare e pubblicare.":"当前角色未具备创建、定价和发布所需的全部权限。","Situazione REMAX":"REMAX 当前情况","Prodotti":"商品","Lotti aperti":"开放批次","Pezzi in attesa":"待到货件数","Preordini clienti":"客户预购订单","4. Registra arrivo":"4 · 登记到货","Usa questa sezione solo quando hai contato fisicamente la merce. Il sistema assegna prima i preordini più vecchi (FIFO).":"仅在实际清点商品后使用。系统优先分配给最早的预购订单。","Lotto arrivato":"到货批次","Seleziona lotto":"选择批次","· residuo":"· 剩余","Residuo":"剩余","· clienti in attesa":"· 等待客户","Anteprima arrivo":"到货预览","Totale ricevuto:":"到货总数：","ricevuti ·":"到货 ·","ai preordini ·":"分配预购 ·","liberi":"可售","Ho contato la merce fisica e confermo queste quantità. Questa operazione aumenta lo stock reale.":"我已清点实物并确认这些数量，此操作会增加真实库存。","Registra arrivo reale":"登记实物到货","Il tuo ruolo non può modificare lo stock.":"当前角色不能修改库存。","Pronta":"就绪","Bozza":"草稿","Bloccata":"阻塞",
 "Dati REMAX caricati.":"REMAX 数据已加载。","Aggiornamento dati REMAX...":"正在更新 REMAX 数据…","Dati aggiornati.":"数据已更新。","Dati modificati: esegui di nuovo il controllo.":"资料已修改，请重新检查。","Seleziona un file prima di continuare.":"请先选择文件。","Inserisci almeno una quantità ricevuta.":"请至少填写一项到货数量。","Calcolo assegnazioni ai preordini...":"正在计算预购分配…","Anteprima pronta. Controlla e conferma una sola volta.":"预览已就绪，核对后确认一次。","Registrazione arrivo e assegnazione FIFO...":"正在登记到货并按预购时间分配…",
 "Seleziona prima il file REMAX.":"请先选择 REMAX 文件。",
 "Controllo righe, prezzi e pubblicazione...":"正在检查商品行、价格和发布条件…",
 "Controllo completato. Ora puoi confermare l'importazione.":"检查完成，现在可以核对并确认导入。",
 "Creazione lotto e prodotti in corso...":"正在创建批次和商品…",
 "Ci sono {count} righe da correggere.":"有 {count} 行需要修正。",
 "Lotto {batchCode} importato. Le quantità sono ancora “in arrivo”, non stock fisico.":"批次 {batchCode} 已导入。数量仍为“在途”，尚未增加真实库存。",
 "Arrivo registrato: {received} pezzi, {allocated} assegnati ai preordini.":"到货已登记：共 {received} 件，其中 {allocated} 件已分配给预购订单。",
 "Quantità ricevuta":"实收数量",
 "Operazione non riuscita.":"操作未完成，请核对后重试。",
 "Permessi insufficienti per importare REMAX.":"当前角色缺少导入 REMAX 所需权限。",
 "Il file o i dati del lotto sono cambiati. Ripeti il controllo.":"文件或批次资料已变化，请重新检查。",
 "Correggi tutte le righe bloccate prima di importare.":"请修正所有阻塞行后再导入。",
 "Manca il permesso di pubblicazione prodotti.":"当前角色缺少商品发布权限。",
 "Le impostazioni del lotto non sono valide.":"批次设置无效，请检查输入字段。",
 "I dati di arrivo non sono validi.":"到货资料无效，请检查批次和数量。",
 "REMAX preorder batch could not be imported.":"REMAX 预购批次导入未完成。",
 "REMAX arrival preview could not be generated.":"REMAX 到货预览读取失败。",
 "File, impostazioni e conferma anteprima sono obbligatori.":"请提供文件、批次设置和已确认的预览。",
 "Il file non contiene righe prodotto.":"文件中没有商品行。",
 "Carica un file .xlsx oppure .csv.":"请上传 xlsx 或 csv 文件。",
 "Il file deve essere compreso tra 1 byte e 5 MB.":"文件大小须为 1 字节至 5 MB。",
 "Il file Excel non contiene fogli.":"Excel 文件中没有工作表。",
 "Il file non contiene una riga intestazione.":"文件缺少表头。",
 "Mancano colonne obbligatorie nel file.":"文件缺少必填列。",
 "REMAX preorder dashboard could not be loaded.":"REMAX 预购数据读取失败。",
 "REMAX arrival could not be registered.":"REMAX 到货登记未完成。",
 "name è obbligatorio":"商品名称为必填项",
 "sku non può essere generato":"无法生成 SKU",
 "buffer_qty deve essere inferiore a qty_ordered":"预留量须小于订购数量",
 "publish=yes richiede modello, immagine e prezzi retail/B2B maggiori di zero":"发布需要型号、图片和大于零的零售/批发价格",
 "publish deve essere yes oppure no":"发布值须为 yes 或 no",
};
export function remaxText(value: string, locale: string, values: Record<string, string | number> = {}) {
  let template = value;
  if (locale.startsWith("zh")) {
    template = zh[value] ?? value
      .replace(/^Il file supera il limite di (\d+) righe\.$/, "文件超过 $1 行的上限。")
      .replace(/^(.+) duplicato \(già presente alla riga (\d+)\)$/, "$1 重复（已出现在第 $2 行）")
      .replace(/^(.+) deve essere un intero tra (\d+) e (\d+)$/, "$1 须为 $2 至 $3 的整数")
      .replace(/^(.+) deve essere un numero valido maggiore o uguale a (\d+)$/, "$1 须为不小于 $2 的有效数字");
  } else if (locale.startsWith("en")) {
    template = value
      .replace(/^Il file supera il limite di (\d+) righe\.$/, "The file exceeds the limit of $1 rows.")
      .replace(/^(.+) duplicato \(già presente alla riga (\d+)\)$/, "$1 is duplicated (already present on row $2)")
      .replace(/^(.+) deve essere un intero tra (\d+) e (\d+)$/, "$1 must be an integer between $2 and $3")
      .replace(/^(.+) deve essere un numero valido maggiore o uguale a (\d+)$/, "$1 must be a valid number greater than or equal to $2");
  } else {
    const italian: Record<string, string> = {
      "REMAX preorder dashboard could not be loaded.": "Lettura dati preordini REMAX non riuscita.",
      "REMAX preorder batch could not be imported.": "Importazione lotto REMAX non riuscita.",
      "REMAX arrival preview could not be generated.": "Anteprima arrivo REMAX non disponibile.",
      "REMAX arrival could not be registered.": "Registrazione arrivo REMAX non riuscita.",
    };
    template = italian[value] ?? value;
  }
  if (locale.startsWith("en")) template = englishUiCopy(template);
  return template.replace(/\{(\w+)\}/g, (token, key: string) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
