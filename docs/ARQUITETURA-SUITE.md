# Arquitetura da Suite Acadêmica Piquet

## Objetivo

Unificar ferramentas acadêmicas e operacionais em uma entrada única (`index.html`), mantendo cada motor funcional isolado para reduzir regressões.

## Decisão principal

A suíte usa um shell leve (`index.html`, `suite.css`, `suite.js`) e carrega ferramentas por `iframe`:

- `presenca.html`: geração de CSV/ZIP/PDF para presença Moodle.
- `tools/calendario/index.html`: calendário acadêmico com feriados, edição e PDF.
- `organizadorzip_compactador-main/index.html`: organizador/conversor/relatórios.
- `organizadorzip_compactador-main/extrator_qr/index.html`: QR em PDF.
- `organizadorzip_compactador-main/extrator_qr/mescla_qrcode_v1.html`: variação de mescla QR.
- `organizadorzip_compactador-main/escala_presença.html`: escala e RH.
- `organizadorzip_compactador-main/agenda.html`: agenda local.

Essa abordagem evita colisão de IDs globais, CSS global, `localStorage`, eventos e bibliotecas duplicadas entre sistemas legados.

## Camadas

1. Shell da suíte
   - Roteamento por hash.
   - Busca de ferramentas.
   - Botões de abrir/recarregar.
   - Transição nativa por View Transition API quando disponível.

2. Ferramentas isoladas
   - Cada ferramenta mantém seus próprios scripts, estilos e dependências.
   - O shell não invade DOM interno das ferramentas.

3. Persistência local
   - Ferramentas usam downloads locais, `localStorage` e `IndexedDB` conforme necessidade.
   - Arquivos importados não são enviados para servidor pelo shell.

## Refatorações e limpeza

- O gerador de presença original foi preservado em `presenca.html`.
- O `index.html` da raiz virou o shell único.
- O calendário foi copiado para `tools/calendario/` para remover dependência do `.git` interno de `sistema_calend`.
- `sistema_calend/`, builds, executáveis, cache Python e instaladores foram ignorados no Git.
- A rota quebrada de manifesto em `agenda.html` foi corrigida de `/manifest.json` para `./manifest.json`.
- O shell agora usa `history.pushState`/`popstate`, evitando recarregamento duplicado em troca de ferramenta.

## Padrões de qualidade

- HTML/CSS/JS estático, sem framework obrigatório.
- Preferência por APIs nativas modernas.
- Sem copiar código externo sem analisar licença.
- Dependências de terceiros ficam dentro das ferramentas que já as usam.
- Arquivos pesados de build/instalador ficam fora do repositório web.

## Responsividade

A suíte foi ajustada para os viewports mais importantes em notebook e desktop:

- `max-width: 480px`: celular pequeno.
- `max-width: 768px`: celular grande.
- `max-width: 1024px`: tablet/notebook pequeno.
- `max-width: 1366px`: notebook comum, incluindo 1366x768.
- `max-width: 1440px`: desktop/notebook 1440x900.
- `min-width: 1600px`: monitores grandes.

O shell reduz a largura da navegação lateral em 1366px para preservar largura útil do iframe. O gerador de presença também reduz espaçamentos, largura do painel de controles e alturas de tabela para funcionar melhor dentro da suíte em 1366x768.

## Referências pesquisadas

- MDN View Transition API: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- MDN CSS scroll-driven animations: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- web.dev View Transitions for SPA: https://web.dev/learn/css/view-transitions-spas
- Chrome cross-document View Transitions: https://developer.chrome.com/docs/web-platform/view-transitions/cross-document
- jsQR no GitHub: https://github.com/cozmo/jsQR
- Mozilla PDF.js no GitHub: https://github.com/mozilla/pdf.js/
- Awesome JavaScript: https://github.com/sorrycc/awesome-javascript

## Próximos cortes técnicos recomendados

- Debundlar `organizadorzip_compactador-main/index.html`, hoje muito grande por conter bibliotecas embutidas.
- Migrar dependências externas críticas para arquivos locais quando for preciso rodar 100% offline.
- Criar testes Playwright de fumaça para abrir cada ferramenta pelo shell.
- Padronizar telemetria local de erro com `window.onerror` no shell, sem coletar dados pessoais.
