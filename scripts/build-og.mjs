/**
 * Gera os bitmaps que o SVG sozinho nao resolve: preview de compartilhamento,
 * icones de app e o favicon.ico legado.
 *
 * Roda depois do astro build, porque grava direto em dist/ e tambem em public/,
 * para que o proximo build ja encontre os arquivos prontos.
 *
 * Decisao consciente: a imagem de Open Graph nao tem texto. O wordmark do
 * proprio logo ja esta em curvas dentro do SVG, entao a peca fica legivel sem
 * carregar fonte nenhuma no renderizador, que e onde esse tipo de script
 * costuma quebrar em CI (fonte ausente vira retangulo vazio, sem erro).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DIST_DIR = path.join(ROOT, "dist");

const PETROLEO = "#20292E";
const POCO = "#171E22";
const CICLO =
  "M0 20 H30 l4 -1 3 2 4 -14 5 27 4 -14 3 3 4 -3 H72 q6 0 9 -7 3 -7 6 0 3 7 9 7 H120";

/**
 * Recupera o miolo de um SVG derivado, sem a casca <svg>.
 *
 * O minX e o minY importam: o isotipo herdou do CorelDRAW um viewBox que comeca
 * longe da origem (algo como "4313 1775 8723 11231"), e os paths carregam essas
 * coordenadas absolutas. Reaproveitar o miolo dentro de outro viewBox sem
 * descontar esse deslocamento joga o desenho para fora do quadro, que foi
 * exatamente o que aconteceu com os icones antes desta correcao.
 */
function corpoDe(arquivo) {
  const svg = fs.readFileSync(
    path.join(ROOT, "src/assets/brand", arquivo),
    "utf8",
  );
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error(`${arquivo} sem viewBox`);
  const interno = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  const [minX, minY, w, h] = viewBox.split(/\s+/).map(Number);
  return { interno, viewBox, minX, minY, w, h };
}

/**
 * Monta o transform que encaixa um miolo herdado numa caixa nova.
 * A ordem importa: primeiro leva o desenho para a origem, depois escala, depois
 * posiciona. Em SVG os transforms sao aplicados da direita para a esquerda.
 */
function encaixar({ x, y, escala, minX, minY }) {
  return `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${escala.toFixed(6)}) translate(${(-minX).toFixed(2)} ${(-minY).toFixed(2)})`;
}

function renderizar(svg, largura) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: largura } });
  return resvg.render().asPng();
}

/**
 * Preview de compartilhamento, 1200 x 630.
 * Lockup centrado sobre a mesma reticula de bancada da pagina, com um traco de
 * ECG atravessando embaixo: a peca inteira e a linguagem da marca, sem texto.
 */
function imagemOpenGraph() {
  const { interno, minX, minY, w, h } = corpoDe("lockup.svg");
  const larguraAlvo = 820;
  const escala = larguraAlvo / w;
  const x = (1200 - larguraAlvo) / 2;
  const y = (630 - h * escala) / 2 - 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="reticula" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0v40" fill="none" stroke="#0BE4EB" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
    <radialGradient id="brilho" cx="50%" cy="42%" r="58%">
      <stop offset="0%" stop-color="#0BE4EB" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0BE4EB" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="18%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="82%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="mascaraEcg">
      <rect width="1200" height="630" fill="url(#fade)"/>
    </mask>
  </defs>

  <rect width="1200" height="630" fill="${PETROLEO}"/>
  <rect width="1200" height="630" fill="url(#reticula)"/>
  <rect width="1200" height="630" fill="url(#brilho)"/>

  <g transform="${encaixar({ x, y, escala, minX, minY })}">
${interno}
  </g>

  <g mask="url(#mascaraEcg)" transform="translate(0 500)">
    <g fill="none" stroke="#3AF2A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7">
${Array.from({ length: 10 }, (_, i) => `      <path d="${CICLO}" transform="translate(${i * 120} 0)"/>`).join("\n")}
    </g>
  </g>

  <rect x="0" y="626" width="1200" height="4" fill="#0BE4EB"/>
</svg>`;
}

/** Icone de app: o isotipo com respiro, sobre o petroleo. */
function icone({ maskable = false } = {}) {
  const { interno, minX, minY, w, h } = corpoDe("isotipo.svg");
  // Icone maskable precisa de 40% de zona segura: o desenho encolhe para caber.
  const ocupacao = maskable ? 0.56 : 0.72;
  const escala = (512 * ocupacao) / Math.max(w, h);
  const x = (512 - w * escala) / 2;
  const y = (512 - h * escala) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${maskable ? 0 : 96}" fill="${maskable ? POCO : PETROLEO}"/>
  <g transform="${encaixar({ x, y, escala, minX, minY })}">
${interno}
  </g>
</svg>`;
}

/**
 * Lockup do cabecalho dos e-mails transacionais, 440px de largura.
 *
 * Fundo solido, nunca transparente. O Outlook compoe PNG com alfa sobre branco,
 * e o wordmark ciano sobre branco mede 1.45:1: some. Gravando o petroleo dentro
 * do proprio bitmap a peca sobrevive a qualquer fundo que o cliente aplique.
 *
 * 440 para uma coluna de 600: cabe com folga e ainda entrega 2x de densidade na
 * largura de 220 que o html declara, que e o que salva a marca em tela retina.
 *
 * Isto e reforco, nao muleta: o cabecalho tambem escreve SELF-LABS como texto
 * vivo, porque cliente de e-mail bloqueia imagem por padrao e um cabecalho que
 * so tem logo aparece como faixa vazia.
 */
function lockupEmail() {
  const { interno, minX, minY, w, h } = corpoDe("lockup.svg");
  const largura = 440;
  const larguraAlvo = 340;
  const escala = larguraAlvo / w;
  const respiro = 28;
  const altura = Math.round(h * escala + respiro * 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">
  <rect width="${largura}" height="${altura}" fill="${PETROLEO}"/>
  <g transform="${encaixar({ x: (largura - larguraAlvo) / 2, y: respiro, escala, minX, minY })}">
${interno}
  </g>
</svg>`;
}

/**
 * Empacota um PNG dentro de um container ICO.
 *
 * O formato aceita PNG embutido desde o Vista, entao nao ha bitmap a converter:
 * basta o cabecalho de 6 bytes, uma entrada de diretorio de 16 e o PNG cru.
 */
function empacotarIco(png, lado) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // tipo 1: icone
  cabecalho.writeUInt16LE(1, 4); // uma imagem

  const entrada = Buffer.alloc(16);
  entrada.writeUInt8(lado >= 256 ? 0 : lado, 0); // 0 significa 256
  entrada.writeUInt8(lado >= 256 ? 0 : lado, 1);
  entrada.writeUInt8(0, 2); // paleta
  entrada.writeUInt8(0, 3); // reservado
  entrada.writeUInt16LE(1, 4); // planos
  entrada.writeUInt16LE(32, 6); // bits por pixel
  entrada.writeUInt32LE(png.length, 8);
  entrada.writeUInt32LE(22, 12); // deslocamento: 6 + 16

  return Buffer.concat([cabecalho, entrada, png]);
}

function gravar(nome, conteudo) {
  for (const destino of [PUBLIC_DIR, DIST_DIR]) {
    if (!fs.existsSync(destino)) continue;
    fs.writeFileSync(path.join(destino, nome), conteudo);
  }
  const kb = (conteudo.length / 1024).toFixed(1);
  console.log(`  ${nome.padEnd(26)} ${kb.padStart(7)} KB`);
}

async function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  console.log("Gerando bitmaps de marca:");

  // Open Graph. O PNG do resvg passa pelo sharp so para compressao.
  const og = await sharp(renderizar(imagemOpenGraph(), 1200))
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();
  gravar("og.png", og);

  const iconeBase = icone();
  const png512 = await sharp(renderizar(iconeBase, 512))
    .png({ compressionLevel: 9 })
    .toBuffer();
  const png192 = await sharp(png512)
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const png180 = await sharp(png512)
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const png32 = await sharp(png512)
    .resize(32, 32)
    .png({ compressionLevel: 9 })
    .toBuffer();

  gravar("icon-512.png", png512);
  gravar("icon-192.png", png192);
  gravar("apple-touch-icon.png", png180);
  gravar("favicon.ico", empacotarIco(png32, 32));

  const maskable = await sharp(renderizar(icone({ maskable: true }), 512))
    .png({ compressionLevel: 9 })
    .toBuffer();
  gravar("icon-maskable-512.png", maskable);

  // flatten remove o canal alfa que o resvg sempre entrega. O rect ja cobre a
  // peca inteira, entao nenhum pixel e transparente de verdade, mas um PNG32
  // ainda convida o Outlook a recompor a imagem sobre o proprio fundo dele.
  const lockup = await sharp(renderizar(lockupEmail(), 440))
    .flatten({ background: PETROLEO })
    .png({ compressionLevel: 9 })
    .toBuffer();
  gravar("email-lockup.png", lockup);

  // O favicon.svg e o manifest sao estaticos: copiados de public/ para dist/.
  if (fs.existsSync(DIST_DIR)) {
    for (const arquivo of ["favicon.svg", "site.webmanifest", "robots.txt"]) {
      const origem = path.join(PUBLIC_DIR, arquivo);
      if (fs.existsSync(origem))
        fs.copyFileSync(origem, path.join(DIST_DIR, arquivo));
    }
  }
}

await main();
