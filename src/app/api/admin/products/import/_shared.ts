import { ProductImportError } from "@/lib/partspro-product-import";

export async function readProductImportForm(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ProductImportError("请求必须包含 Excel、CSV 或粘贴生成的表格文件。");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ProductImportError("请选择文件或粘贴表格资料。");
  }

  return { file, form };
}

export function productImportDownloadName(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
