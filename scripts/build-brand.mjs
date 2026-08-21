/**
 * Deriva os ativos de marca a partir do export do CorelDRAW.
 *
 * Fonte: src/assets/brand/selflabs-source.svg (nao editar a mao, e o export cru)
 * Saida: src/assets/brand/{isotipo,wordmark,lockup}.svg e public/favicon.svg
 *
 * O export do Corel traz tres coisas que atrapalham no navegador:
 *   1. um <rect> de fundo petroleo cobrindo a viewBox inteira
 *   2. classes opacas (fil0..fil5) que nao dizem qual cor da marca e qual
 *   3. um unico viewBox quadrado, com o wordmark e o simbolo empilhados
 *
 * Este script resolve os tres e ainda numera cada trilha por distancia do centro
 * (atributo style="--i"), que e o que permite a cascata de energizacao no hero.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "src/assets/brand/selflabs-source.svg");
const BRAND_DIR = path.join(ROOT, "src/assets/brand");
const PUBLIC_DIR = path.join(ROOT, "public");

/** Mapa das classes do Corel para os tokens de cor da marca. */
const CLASS_MAP = {
  fil0: null, // fundo petroleo, descartado
  fil2: "trace-cyan", // #0BE4EB
  fil5: "trace-teal", // #10E8D2
  fil4: "trace-aqua", // #2CEBCE
  fil1: "trace-mint", // #3AF2A8
  fil3: "trace-green", // #4BED9B
};

const PALETTE = {
  "trace-cyan": "#0BE4EB",
  "trace-teal": "#10E8D2",
  "trace-aqua": "#2CEBCE",
  "trace-mint": "#3AF2A8",
  "trace-green": "#4BED9B",
};

/**
 * Bounding box de um path SVG.
 *
 * Usa os pontos de controle das curvas em vez de resolver a bezier. Superestima
 * a caixa em alguns pixels, o que aqui e desejavel: vira margem de respiro.
 */
function pathBBox(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = "";
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const mark = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  const num = () => Number.parseFloat(toks[i++]);

  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const op = cmd.toUpperCase();

    if (op === "M") {
      const x = num();
      const y = num();
      cx = rel ? cx + x : x;
      cy = rel ? cy + y : y;
      sx = cx;
      sy = cy;
      mark(cx, cy);
      cmd = rel ? "l" : "L"; // um M seguido de pares vira lineto implicito
    } else if (op === "L") {
      const x = num();
      const y = num();
      cx = rel ? cx + x : x;
      cy = rel ? cy + y : y;
      mark(cx, cy);
    } else if (op === "H") {
      const x = num();
      cx = rel ? cx + x : x;
      mark(cx, cy);
    } else if (op === "V") {
      const y = num();
      cy = rel ? cy + y : y;
      mark(cx, cy);
    } else if (op === "C") {
      const [a, b, c, d2, e, f] = [num(), num(), num(), num(), num(), num()];
      const x = rel ? cx + e : e;
      const y = rel ? cy + f : f;
      mark(rel ? cx + a : a, rel ? cy + b : b);
      mark(rel ? cx + c : c, rel ? cy + d2 : d2);
      mark(x, y);
      cx = x;
      cy = y;
    } else if (op === "S" || op === "Q") {
      const [a, b, c, d2] = [num(), num(), num(), num()];
      const x = rel ? cx + c : c;
      const y = rel ? cy + d2 : d2;
      mark(rel ? cx + a : a, rel ? cy + b : b);
      mark(x, y);
      cx = x;
      cy = y;
    } else if (op === "T") {
      const a = num();
      const b = num();
      cx = rel ? cx + a : a;
      cy = rel ? cy + b : b;
      mark(cx, cy);
    } else if (op === "A") {
      num();
      num();
      num();
      num();
      num();
      const e = num();
      const f = num();
      cx = rel ? cx + e : e;
      cy = rel ? cy + f : f;
      mark(cx, cy);
    } else if (op === "Z") {
      cx = sx;
      cy = sy;
    } else {
      i++; // token inesperado, nao trava o parse
    }
  }

  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Recorta um grupo do SVG fonte, balanceando as tags <g>. */
function extractGroup(svg, id) {
  const start = svg.indexOf(`<g id="${id}">`);
  if (start < 0) throw new Error(`grupo "${id}" nao encontrado no SVG fonte`);

  let i = start;
  let depth = 0;
  while (i < svg.length) {
    const open = svg.indexOf("<g", i);
    const close = svg.indexOf("</g>", i);
    if (close < 0) break;
    if (open >= 0 && open < close) {
      depth++;
      i = open + 2;
    } else {
      depth--;
      i = close + 4;
      if (depth === 0) return svg.slice(start, i);
    }
  }
  throw new Error(`grupo "${id}" nao fecha`);
}

/** Le os paths de um trecho e os anota com bbox e classe de marca. */
function readPaths(chunk) {
  return [...chunk.matchAll(/<path class="([^"]*)" d="([^"]+)"\s*\/>/g)].map(
    ([, cls, d]) => {
      const token = CLASS_MAP[cls.trim()];
      if (!token)
        throw new Error(`classe "${cls}" sem cor de marca correspondente`);
      return { token, d, box: pathBBox(d) };
    },
  );
}

function unionBox(paths) {
  return paths.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.box.minX),
      minY: Math.min(acc.minY, p.box.minY),
      maxX: Math.max(acc.maxX, p.box.maxX),
      maxY: Math.max(acc.maxY, p.box.maxY),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

/**
 * Ordena as trilhas do centro para fora e devolve o markup ja com --i.
 *
 * A cascata de energizacao do hero le esse indice: quanto mais longe do nucleo,
 * mais tarde a trilha acende, entao o simbolo parece ligar de dentro para fora.
 */
function renderTraces(paths, box, { stagger }) {
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;

  const ordered = paths
    .map((p, sourceIndex) => {
      const pcx = (p.box.minX + p.box.maxX) / 2;
      const pcy = (p.box.minY + p.box.maxY) / 2;
      return { ...p, sourceIndex, dist: Math.hypot(pcx - cx, pcy - cy) };
    })
    .sort((a, b) => a.dist - b.dist);

  return ordered
    .map((p, rank) => {
      // A trilha mais central carrega a linha de ECG: ela ganha id proprio
      // porque pulsa continuamente, enquanto as outras so acendem uma vez.
      const isCore = stagger && rank === 0;
      const attrs = [
        isCore ? 'id="sl-core"' : null,
        `class="sl-trace sl-${p.token}"`,
        stagger ? `style="--i:${rank}"` : null,
        `d="${p.d}"`,
      ].filter(Boolean);
      return `  <path ${attrs.join(" ")}/>`;
    })
    .join("\n");
}

function styleBlock(indent = "  ") {
  const rules = Object.entries(PALETTE)
    .map(([token, hex]) => `${indent}  .sl-${token} { fill: ${hex}; }`)
    .join("\n");
  return `${indent}<style>\n${rules}\n${indent}</style>`;
}

function writeSvg(file, { viewBox, body, title, extraAttrs = "" }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${title}"${extraAttrs}>
${styleBlock()}
${body}
</svg>
`;
  fs.writeFileSync(file, svg, "utf8");
  const kb = (Buffer.byteLength(svg) / 1024).toFixed(1);
  console.log(`  ${path.relative(ROOT, file).replace(/\\/g, "/")}  ${kb} KB`);
}

function main() {
  const source = fs.readFileSync(SOURCE, "utf8");
  fs.mkdirSync(BRAND_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  console.log("Derivando ativos de marca a partir do export do CorelDRAW:");

  // --- Isotipo: a impressao digital sozinha, com a cascata numerada ---
  const markPaths = readPaths(extractGroup(source, "Digital"));
  const markBox = unionBox(markPaths);
  const pad =
    markBox.maxX - markBox.minX > 0 ? (markBox.maxX - markBox.minX) * 0.02 : 0;
  const markViewBox = [
    (markBox.minX - pad).toFixed(2),
    (markBox.minY - pad).toFixed(2),
    (markBox.maxX - markBox.minX + pad * 2).toFixed(2),
    (markBox.maxY - markBox.minY + pad * 2).toFixed(2),
  ].join(" ");

  writeSvg(path.join(BRAND_DIR, "isotipo.svg"), {
    viewBox: markViewBox,
    body: renderTraces(markPaths, markBox, { stagger: true }),
    title: "Self-Labs",
  });

  // --- Wordmark: SELF-LABS isolado, para navbar, rodape e assinatura ---
  const wordPaths = readPaths(extractGroup(source, "Self-Labs"));
  const wordBox = unionBox(wordPaths);
  const wordViewBox = [
    wordBox.minX.toFixed(2),
    wordBox.minY.toFixed(2),
    (wordBox.maxX - wordBox.minX).toFixed(2),
    (wordBox.maxY - wordBox.minY).toFixed(2),
  ].join(" ");

  writeSvg(path.join(BRAND_DIR, "wordmark.svg"), {
    viewBox: wordViewBox,
    body: renderTraces(wordPaths, wordBox, { stagger: false }),
    title: "SELF-LABS",
  });

  // --- Lockup horizontal: o que faltava para caber numa navbar ---
  // Todos os ativos originais sao empilhados na vertical (proporcao ~1:1).
  // Aqui o simbolo vai para a esquerda e o wordmark para a direita, ambos
  // centrados na mesma linha de base optica.
  const markW = markBox.maxX - markBox.minX;
  const markH = markBox.maxY - markBox.minY;
  const wordW = wordBox.maxX - wordBox.minX;
  const wordH = wordBox.maxY - wordBox.minY;

  const lockH = markH;
  const gap = markW * 0.24;
  /*
   * O wordmark tem proporcao 8.6:1, entao qualquer altura generosa o faz engolir
   * a largura do conjunto. A 33% da altura do simbolo ele ocupa cerca de dois
   * tercos do lockup, que e o equilibrio em que os dois ainda se leem como um
   * par. Acima disso o simbolo vira um enfeite ao lado do texto.
   */
  const wordScale = (lockH * 0.33) / wordH;
  const scaledWordW = wordW * wordScale;
  const scaledWordH = wordH * wordScale;
  const lockW = markW + gap + scaledWordW;

  const markShift = `translate(${(-markBox.minX).toFixed(2)} ${(-markBox.minY).toFixed(2)})`;
  const wordShift =
    `translate(${(markW + gap).toFixed(2)} ${((lockH - scaledWordH) / 2).toFixed(2)}) ` +
    `scale(${wordScale.toFixed(6)}) ` +
    `translate(${(-wordBox.minX).toFixed(2)} ${(-wordBox.minY).toFixed(2)})`;

  writeSvg(path.join(BRAND_DIR, "lockup.svg"), {
    viewBox: `0 0 ${lockW.toFixed(2)} ${lockH.toFixed(2)}`,
    body: [
      `  <g transform="${markShift}">`,
      renderTraces(markPaths, markBox, { stagger: false }).replace(/^/gm, "  "),
      "  </g>",
      `  <g transform="${wordShift}">`,
      renderTraces(wordPaths, wordBox, { stagger: false }).replace(/^/gm, "  "),
      "  </g>",
    ].join("\n"),
    title: "Self-Labs",
  });

  // --- Favicon: o isotipo dentro de um quadrado petroleo com respiro ---
  // Em 16px as trilhas viram uma mancha, e isso e aceitavel: o que sobrevive e
  // a silhueta oval em ciano e verde, que ja e reconhecivel na aba do navegador.
  const faviconPad = Math.max(markW, markH) * 0.14;
  const faviconSize = Math.max(markW, markH) + faviconPad * 2;
  const faviconShift = `translate(${((faviconSize - markW) / 2 - markBox.minX).toFixed(2)} ${((faviconSize - markH) / 2 - markBox.minY).toFixed(2)})`;

  writeSvg(path.join(PUBLIC_DIR, "favicon.svg"), {
    viewBox: `0 0 ${faviconSize.toFixed(2)} ${faviconSize.toFixed(2)}`,
    body: [
      `  <rect width="${faviconSize.toFixed(2)}" height="${faviconSize.toFixed(2)}" rx="${(faviconSize * 0.18).toFixed(2)}" fill="#20292E"/>`,
      `  <g transform="${faviconShift}">`,
      renderTraces(markPaths, markBox, { stagger: false }).replace(/^/gm, "  "),
      "  </g>",
    ].join("\n"),
    title: "Self-Labs",
  });

  console.log(
    `\nIsotipo  ${markW.toFixed(0)} x ${markH.toFixed(0)} (${(markW / markH).toFixed(3)}:1), ${markPaths.length} trilhas`,
  );
  console.log(
    `Wordmark ${wordW.toFixed(0)} x ${wordH.toFixed(0)} (${(wordW / wordH).toFixed(3)}:1), ${wordPaths.length} letras`,
  );
  console.log(
    `Lockup   ${lockW.toFixed(0)} x ${lockH.toFixed(0)} (${(lockW / lockH).toFixed(3)}:1)`,
  );
}

main();
