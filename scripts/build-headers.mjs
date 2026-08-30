/**
 * Gera dist/_headers, os cabecalhos HTTP que o Workers Static Assets aplica a
 * cada resposta.
 *
 * Roda depois do astro build, junto com o build-og, porque depende do HTML ja
 * gerado: a Content-Security-Policy nao usa 'unsafe-inline', ela lista o hash
 * sha256 de cada bloco <script> e <style> embutido na pagina. O Astro embute
 * todo o CSS por decisao (inlineStylesheets: "always") e todo o JS de
 * comportamento e inline, entao sem hash a unica saida seria 'unsafe-inline',
 * que e o mesmo que nao ter politica nenhuma para script.
 *
 * Escrever os hashes a mao seria pior do que nao ter: eles mudam a cada build
 * que toque uma linha de CSS ou JS, e uma politica desatualizada nao afrouxa,
 * ela QUEBRA a pagina, silenciosamente e so no navegador do visitante. Por isso
 * o arquivo e derivado, nunca digitado.
 *
 * O que a politica permite, e por que:
 *
 *   default-src 'none'      nada e permitido por omissao. Tudo abaixo e excecao
 *                           declarada, e o que nao esta na lista nao carrega.
 *   script-src hashes       exatamente os blocos que este build gerou
 *   style-src-elem hashes   idem, para os <style> embutidos
 *   style-src-attr          o HTML gerado tem atributos style="", medidos: 36 na
 *     'unsafe-inline'       home. Atributo de estilo nao executa codigo
 *   img-src 'self' data:    os PNG da marca e os data: URI que o Astro embute
 *   font-src 'self' data:   parte das woff2 vem embutida no CSS como data URI
 *   connect-src 'self'      a pagina nao chama API nenhuma em runtime; fica
 *                           'self' apenas para nao quebrar prefetch do Astro
 *   manifest-src 'self'     site.webmanifest
 *   base-uri 'none'         impede que uma injecao mude a base de resolucao
 *   form-action 'none'      nao existe formulario nesta pagina, e nao deve
 *   frame-ancestors 'none'  ninguem embute selflabs.org num iframe
 *   object-src 'none'       sem plugin, sem embed
 *
 * Nao ha nenhuma origem externa a permitir: o site nao carrega CDN, fonte
 * remota, analytics nem script de terceiro. Os links para github.com e para os
 * subdominios sao navegacao, que a CSP nao restringe.
 *
 * A politica nao foi conferida a olho. Ela foi servida por http com estes
 * cabecalhos e carregada por um navegador de verdade nas duas rotas, ate o
 * console nao reportar nenhuma violacao. Foi assim que apareceram as duas
 * unicas excecoes acima, o data: em font-src e a separacao entre elem e attr:
 * as duas quebravam a pagina publica em silencio.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = path.join(ROOT, "dist");

/** Percorre dist/ e devolve todo arquivo .html. */
function paginas(dir) {
  const achados = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) achados.push(...paginas(completo));
    else if (entrada.name.endsWith(".html")) achados.push(completo);
  }
  return achados;
}

/**
 * Extrai o conteudo de cada bloco embutido.
 *
 * Um <script src="..."> nao entra: ele e carregado por URL e ja esta coberto
 * por 'self'. O que precisa de hash e apenas o codigo escrito dentro da tag.
 *
 * Os comentarios HTML saem ANTES da busca, e isso nao e limpeza: os
 * comentarios do projeto explicam decisoes de CSS e citam a propria tag
 * <style> no meio da prosa. Sem remove-los, a busca comeca dentro de um
 * comentario e termina no </style> real, produzindo um bloco que mistura texto
 * de comentario com CSS. Medido: gerava tres hashes onde o navegador esperava
 * quatro, e o bloco de @keyframes da home ficava sem hash nenhum, ou seja, a
 * politica bloqueava justamente a animacao da pagina.
 */
export function blocosEmbutidos(html, tag) {
  const semComentarios = html.replace(/<!--[\s\S]*?-->/g, "");
  const padrao = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, "gi");
  const blocos = [];
  for (const [, atributos, conteudo] of semComentarios.matchAll(padrao)) {
    if (/\bsrc\s*=/i.test(atributos)) continue;
    blocos.push(conteudo);
  }
  return blocos;
}

/** sha256 em base64, no formato que a CSP espera. */
export function hashCsp(conteudo) {
  return `'sha256-${crypto.createHash("sha256").update(conteudo, "utf8").digest("base64")}'`;
}

export function montarCsp(hashesScript, hashesEstilo) {
  return [
    "default-src 'none'",
    `script-src ${hashesScript.join(" ")}`,

    /*
     * style-src-elem e style-src-attr separados, sem um style-src generico.
     *
     * Medido com a politica aplicada de verdade num navegador: com
     * "style-src <hashes>; style-src-attr 'unsafe-inline'", o Chrome recusou os
     * 36 atributos style="" da home citando style-src, e nao style-src-attr.
     * Declarar as duas diretivas especificas e nao declarar a generica remove a
     * ambiguidade: bloco embutido casa por hash, atributo casa pela regra de
     * atributo. Um atributo style nao executa codigo, entao a permissao ali
     * custa muito menos do que afrouxar script.
     *
     * Nao adianta juntar 'unsafe-inline' aos hashes: pela especificacao, a
     * presenca de um hash faz o navegador ignorar 'unsafe-inline'.
     */
    `style-src-elem ${hashesEstilo.join(" ")}`,
    "style-src-attr 'unsafe-inline'",

    "img-src 'self' data:",

    /*
     * data: em font-src nao e enfeite. O Astro embute parte das woff2 como data
     * URI dentro do CSS inline, e com "font-src 'self'" o navegador recusou o
     * carregamento de duas familias, medido. Sem isso a pagina publica cai para
     * a fonte de sistema sem nenhum erro visivel do lado de ca.
     */
    "font-src 'self' data:",

    "connect-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error("dist/ nao existe. Rode o astro build antes.");
    process.exit(1);
  }

  const arquivos = paginas(DIST_DIR);
  if (arquivos.length === 0) {
    console.error("Nenhum .html em dist/. Build incompleto?");
    process.exit(1);
  }

  const scripts = new Set();
  const estilos = new Set();

  for (const arquivo of arquivos) {
    const html = fs.readFileSync(arquivo, "utf8");
    for (const bloco of blocosEmbutidos(html, "script")) scripts.add(hashCsp(bloco));
    for (const bloco of blocosEmbutidos(html, "style")) estilos.add(hashCsp(bloco));
  }

  if (scripts.size === 0 || estilos.size === 0) {
    // Uma pagina sem style embutido significa que inlineStylesheets mudou, e a
    // politica gerada aqui deixaria de bater com a realidade. Melhor falhar o
    // build do que publicar uma CSP que quebra o site no navegador de quem
    // visita, onde ninguem ve o erro.
    console.error(
      `Esperava blocos embutidos e encontrei ${scripts.size} script(s) e ${estilos.size} style(s). ` +
        "Se a configuracao de bundling mudou, ajuste este script antes de publicar.",
    );
    process.exit(1);
  }

  const csp = montarCsp([...scripts].sort(), [...estilos].sort());

  /*
   * O parser de _headers corta em 2.000 caracteres por linha, contando a
   * indentacao e o nome do cabecalho. Cada hash custa cerca de 52, entao o teto
   * chega antes do que parece: com uns trinta blocos embutidos a politica
   * estoura e o excedente e descartado em silencio, o que na pratica publica uma
   * CSP truncada e provavelmente invalida. Falhar aqui e o unico jeito de
   * descobrir isso antes do visitante.
   */
  const linhaCsp = `  Content-Security-Policy: ${csp}`;
  if (linhaCsp.length > 1900) {
    console.error(
      `A linha da CSP tem ${linhaCsp.length} caracteres e o limite do _headers e 2000. ` +
        "Reduza os blocos embutidos, ou passe o CSS para arquivo externo e use 'self'.",
    );
    process.exit(1);
  }

  const conteudo = `# GERADO por scripts/build-headers.mjs. Nao edite a mao.
#
# Os hashes da CSP mudam a cada build que toque CSS ou JS embutido, entao este
# arquivo e derivado do dist/ recem gerado, nunca escrito por uma pessoa.
#
# O HSTS aqui vale so para o apex, sem includeSubDomains e sem preload, de
# proposito. A zona selflabs.org carrega dezenas de subdominios apontando para
# tuneis do homelab e da VPS, e includeSubDomains ordena ao navegador exigir
# HTTPS valido em TODOS eles a partir da primeira visita ao apex: qualquer
# tunel em http ou com certificado proprio para de abrir, e a memoria do
# navegador dura um ano. preload piora, porque entra numa lista embutida nos
# navegadores e sair dela leva meses. Se um dia todos os subdominios estiverem
# em HTTPS valido, essa decisao pode ser revista de propria vontade.

/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  X-Frame-Options: DENY

# Fontes e bitmaps carregam hash no nome ou nao mudam: cache longo e imutavel.
/_assets/*
  Cache-Control: public, max-age=31536000, immutable

# O security.txt precisa ser legivel como texto, nao baixado como arquivo.
/.well-known/security.txt
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=86400
`;

  fs.writeFileSync(path.join(DIST_DIR, "_headers"), conteudo);

  console.log("Gerando cabecalhos:");
  console.log(`  _headers                   ${(conteudo.length / 1024).toFixed(1)} KB`);
  console.log(
    `  CSP com ${scripts.size} hash(es) de script e ${estilos.size} de estilo, em ${arquivos.length} pagina(s)`,
  );

  copiarWellKnown();
}

/**
 * Copia public/.well-known para dist/.well-known.
 *
 * Copiar a mao em vez de confiar no publicDir: diretorio que comeca com ponto
 * e caso de borda em ferramenta de build, e o custo de descobrir errado e alto,
 * porque a falha e silenciosa. O security.txt simplesmente nao existiria no ar,
 * e ninguem repara na ausencia de um arquivo que so e buscado por quem esta
 * tentando avisar de um problema.
 */
function copiarWellKnown() {
  const origem = path.join(ROOT, "public", ".well-known");
  if (!fs.existsSync(origem)) return;

  const destino = path.join(DIST_DIR, ".well-known");
  fs.mkdirSync(destino, { recursive: true });

  for (const arquivo of fs.readdirSync(origem)) {
    fs.copyFileSync(path.join(origem, arquivo), path.join(destino, arquivo));
    console.log(`  .well-known/${arquivo}`);
  }
}

/*
 * So roda quando chamado direto. Importado, entrega apenas as funcoes, que e
 * o que tests/cabecalhos.test.mjs exercita sem depender de um dist/ construido.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
