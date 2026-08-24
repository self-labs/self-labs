// @ts-check
import os from "node:os";
import path from "node:path";
import { defineConfig } from "astro/config";

/**
 * Onde o Vite guarda as dependencias pre-empacotadas.
 *
 * No Windows todos os diretorios deste projeto carregam o atributo ReadOnly,
 * medido: 345 de 345 sob node_modules, e a propria raiz. O rmdir do Node falha
 * com EPERM num diretorio ReadOnly, e o Vite apaga e recria .vite/deps toda vez
 * que reotimiza, entao o servidor de desenvolvimento morria ali com
 * "EPERM: operation not permitted, rmdir" seguido de um assert do libuv.
 *
 * Apagar o atributo a mao resolve so ate a proxima vez que o diretorio nasce de
 * novo. Escrever o cache fora da arvore do projeto resolve sempre, e de quebra
 * ele passa a viver num disco local.
 *
 * Fora do Windows fica undefined, que e o mesmo que nao declarar: o CI segue com
 * o node_modules/.vite padrao.
 */
const cacheDir =
  process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA ?? os.tmpdir(), "vite-cache", "self-labs")
    : undefined;

// Saida 100% estatica: o site vira arquivos servidos pelo Workers Static Assets,
// sem runtime nenhum. Nao existe endpoint, sessao nem banco por tras desta pagina.
export default defineConfig({
  site: "https://selflabs.org",
  output: "static",
  trailingSlash: "ignore",
  i18n: {
    locales: ["pt", "en"],
    defaultLocale: "pt",
    routing: {
      // Portugues fica na raiz e o ingles em /en. Sem redirecionar por
      // Accept-Language: o visitante escolhe, e cada idioma tem URL propria e
      // indexavel.
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  build: {
    inlineStylesheets: "always",
    assets: "_assets",
  },
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: { cacheDir },
});
