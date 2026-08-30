# Changelog

Todas as mudanças relevantes deste projeto ficam registradas aqui.

O formato segue [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
e a versão usa CalVer `ANO.MES.REVISAO`, declarada em `package.json` e exibida no
rodapé da página. As versões anteriores a este arquivo foram reconstruídas a
partir do histórico do repositório, então descrevem o efeito de cada entrega, e
não a lista de commits.

## [Unreleased]

### Added

- Cabeçalhos de segurança em toda resposta, gerados por `scripts/build-headers.mjs`
  e servidos pelo Workers Static Assets através de `dist/_headers`. A
  Content-Security-Policy não usa `unsafe-inline`: ela carrega o hash sha256 de
  cada bloco embutido, calculado a partir do HTML recém-construído.
- `/.well-known/security.txt` no formato RFC 9116, com canal de contato para
  quem encontrar uma vulnerabilidade.
- `tests/cabecalhos.test.mjs`, que trava as invariantes da política: nenhum
  `unsafe-inline` em script, `data:` presente em `font-src`, elemento e atributo
  de estilo separados, nenhuma origem externa, e todo bloco embutido do `dist`
  com hash correspondente.
- `.github/dependabot.yml` para npm e github-actions, semanal e com minor e patch
  agrupados.

### Changed

- `npm run build` passou a gerar os cabeçalhos como último passo, depois do
  `build-og`, porque a política depende do HTML já construído.
- A action `cloudflare/wrangler-action` passou a ser referenciada por SHA de
  commit em vez de pela tag `v3`. Ela recebe o token que publica em produção, e
  tag é referência mutável.
- O checkout do deploy não persiste mais a credencial no runner: nada naquele
  workflow escreve no repositório.
- O token da Cloudflare saiu da linha de comando do `curl` de verificação e
  passa por stdin, fora do `argv` visível a outros processos.
- O portão de versão do deploy passou a isentar `.gitignore` e `CHANGELOG.md`,
  ao lado dos arquivos que já estavam na lista. Nenhum dos dois altera um byte
  do que o visitante recebe, e exigir revisão neles fazia o rodapé anunciar uma
  mudança que o site não teve, justamente o contrário do que o passo protege.
  Levantamento das vinte e seis execuções do workflow: das nove que falharam,
  quatro foram este portão, mais do que qualquer outra causa. A isenção não
  vaza, porque continua bastando um arquivo de código no mesmo commit para a
  revisão voltar a ser exigida.

### Security

- `scripts/fetch-stats.mjs` parou de imprimir o nome de repositórios privados.
  O repositório é público, portanto o log do Actions também é, e a execução
  semanal publicava o inventário completo: nome de cada repositório privado com
  a contagem exata de commits. Medido em uma execução real: quatorze nomes, três
  deles sem qualquer relação com o portfólio. O número da página sempre precisou
  apenas da soma. Para depurar localmente existe `SELFLABS_VERBOSE=1`, que o CI
  nunca define.
- O HSTS publicado cobre apenas o apex, sem `includeSubDomains` e sem `preload`.
  A zona carrega dezenas de subdomínios apontando para túneis do homelab e da
  VPS, e `includeSubDomains` ordenaria ao navegador exigir HTTPS válido em todos
  eles por um ano a partir da primeira visita à página.

## [2026.8.10] - 2026-08-30

### Fixed

- O passo de build do deploy voltou a rodar. A revisão anterior levou junto, sem
  querer, uma alteração que já estava na árvore de trabalho: o script `build` do
  `package.json` passou a chamar `scripts/build-headers.mjs`, que ainda não está
  versionado. No CI o arquivo não existe, e o build morria com `MODULE_NOT_FOUND`
  depois de já ter gerado todos os bitmaps. A linha voltou ao que era, e o passo
  de headers entra junto com o próprio script, no commit dele.

## [2026.8.9] - 2026-08-30

### Added

- `email-lockup.png`, gerado por `scripts/build-og.mjs` e publicado no apex. É o
  lockup de 440 pixels que o cabeçalho dos e-mails transacionais passa a usar.
  Até aqui `ISOTIPO_URL` apontava para o `apple-touch-icon.png`, um ícone
  quadrado de 180 pixels fazendo papel de lockup, porque era o único bitmap de
  formato aproximado que o domínio publicava. O arquivo sai achatado sobre o
  petróleo e sem canal alfa: o Outlook recompõe PNG transparente sobre o próprio
  fundo, e o wordmark ciano sobre branco mede 1,45:1, ou seja, desaparece.
  Medido: 440 x 146, três canais, 6,5 KB.

### Changed

- O `.gitignore` foi reorganizado no padrão de seções comentadas da casa, com as
  regras do Wrangler distribuídas entre build e ambiente, e nenhuma linha
  anterior descartada. O verificador acusa dezessete seções e trinta e cinco
  regras, sem nenhum arquivo já versionado afetado.

### Security

- `propostas/` e `relatorios/` passaram a ser ignorados. Documentos gerados a
  partir do modelo Self-Labs carregam nome de cliente, endereço do local,
  valores negociados e a topologia da rede instalada, e este repositório é
  público. A regra entrou antes do primeiro documento existir, porque um arquivo
  que alcança o histórico continua nele depois de apagado.
- `selflabs-assets/` também é ignorado. O gerador de documentos copia a marca ao
  lado de cada arquivo, e esses SVGs já são versionados uma vez em
  `src/assets/brand`.

## [2026.8.8] - 2026-08-24

### Fixed

- O ECG do topo voltou a pulsar sob `prefers-reduced-motion`, na metade da
  cadência. O Chromium zera a duração de toda animação declarada em CSS quando a
  preferência está ligada, então a animação passou a ser redirigida por
  JavaScript pela Web Animations API, que não sofre esse corte.
- A contagem de projetos deixou de existir escrita à mão em qualquer lugar: ela
  é derivada dos arquivos da vitrine.

## [2026.8.7] - 2026-08-24

### Added

- Os pull requests aceitos em projetos de outras pessoas passaram a ser contados
  mesmo quando o merge não deixou botão, via API de busca.
- O Home Assistant entrou na vitrine.

### Changed

- Os números de prova passaram a contar repositórios privados. Só o público
  subestimava de forma silenciosa: de 501 commits em 13 repositórios para 1397
  em 28, dos quais 14 privados.

### Fixed

- O ECG foi reconstruído como varredura, com a fita parada e o cabeçote correndo
  por cima, e a máscara passou a terminar no mesmo valor que define o percurso.
  O ponto deixou de sumir antes do fim.
- O fio da trilha lateral passou a medir as vias, e não a janela.
- Contraste, âncoras e justificação corrigidos conforme auditoria.
- O commit do robô de números voltou a disparar o deploy: sem autenticar o
  checkout com um token próprio, o Actions não dispara workflow para evento
  criado com o `GITHUB_TOKEN` padrão, e a página seguia servindo números velhos.

## [2026.8.6] - 2026-08-23

### Changed

- Migração para o Astro 7, com o cache do Vite escrito fora da árvore do
  projeto no Windows. Todo diretório deste checkout carrega o atributo ReadOnly,
  e o `rmdir` do Node falha com EPERM nele, o que matava o servidor de
  desenvolvimento a cada reotimização.

## [2026.8.3] - 2026-08-21

### Fixed

- Formatação aplicada ao arquivo de textos da interface.

## [2026.8.2] - 2026-08-21

### Added

- Navegação em telas estreitas por `<dialog>`, rolagem suave nativa e corpo de
  texto justificado a partir de 48rem.

### Fixed

- O filtro da vitrine passou a esconder os cartões de fato.
- O encaixe de rolagem parou de brigar com a rolagem suave em telas de toque.
- O respeito a `prefers-reduced-motion` na rolagem ficou a cargo do navegador.

## [2026.8.1] - 2026-08-21

### Added

- Primeira publicação da página institucional: estática, bilíngue em `/` e
  `/en`, com vitrine de projetos, princípios de engenharia e quatro números
  derivados da API do GitHub. Servida pelo Cloudflare Workers Static Assets no
  apex de `selflabs.org`, sem runtime, sem banco e sem endpoint.

[Unreleased]: https://github.com/self-labs/self-labs/compare/692b481...HEAD
[2026.8.10]: https://github.com/self-labs/self-labs/compare/5a561db...692b481
[2026.8.9]: https://github.com/self-labs/self-labs/compare/0c9bc7e...5a561db
[2026.8.8]: https://github.com/self-labs/self-labs/compare/a57399e...0c9bc7e
[2026.8.7]: https://github.com/self-labs/self-labs/compare/7caccba...a57399e
[2026.8.6]: https://github.com/self-labs/self-labs/compare/68ee685...7caccba
[2026.8.3]: https://github.com/self-labs/self-labs/compare/7ceb477...68ee685
[2026.8.2]: https://github.com/self-labs/self-labs/compare/60733ee...7ceb477
[2026.8.1]: https://github.com/self-labs/self-labs/compare/42626ac...60733ee
