// @ts-check
import { defineConfig } from "astro/config";

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
});
