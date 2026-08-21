import { gunzipSync } from "node:zlib";
import panel01 from "@/assets/ocupacao/part-01.txt?raw";
import panel02 from "@/assets/ocupacao/part-02.txt?raw";
import panel03 from "@/assets/ocupacao/part-03.txt?raw";
import panel04 from "@/assets/ocupacao/part-04.txt?raw";
import panel05 from "@/assets/ocupacao/part-05.txt?raw";
import panel06 from "@/assets/ocupacao/part-06.txt?raw";

let cachedHtml: string | null = null;

export function getOccupationPanelHtmlServer() {
  if (cachedHtml) return cachedHtml;
  const encoded = [panel01, panel02, panel03, panel04, panel05, panel06].join("");
  cachedHtml = gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
  return cachedHtml;
}
