# MatrixPro RH

Sistema web estático para gestão de RH, escalas, presenças, férias, documentos, banco de horas, capacitações e relatórios.

## Estrutura

- `index.html`: marcação principal, modais e estrutura de navegação.
- `styles.css`: design system, responsividade, estados visuais, impressão e componentes.
- `app.js`: estado da aplicação, persistência em `localStorage`, permissões por perfil, geração de escala, relatórios e exportações.
- `manifest.json`: metadados PWA para instalação do app.

## Execução local

Use um servidor estático para evitar diferenças entre navegadores ao carregar scripts e arquivos:

```bash
python -m http.server 8080
```

Acesse:

```text
http://localhost:8080
```

## Perfis de acesso

As permissões ficam centralizadas em `ROLE_PERMISSIONS`, no início de `app.js`.

- `rh`: perfil padrão para operação de Recursos Humanos.
- `admin`: acesso completo, incluindo limpeza do sistema.
- `coord`: operação de escala, presença, relatórios e módulos administrativos.
- `professor`: acesso limitado a relatórios.
- `financeiro`: relatórios e exportação de alunos.

## Manutenção

- O botão antigo de `Agenda Unificada` foi removido porque apontava para `agenda.html`, arquivo ausente no projeto.
- O menu hamburger abre o painel lateral com Equipe, ações rápidas, ferramentas, Gestão RH e indicadores.
- A Agenda Rápida possui prioridade, local, responsável, preview do dia, detecção de conflito, exportação `.ics` e consulta de feriados nacionais via BrasilAPI.
- O gerador de escala usa distribuição balanceada por semana, respeitando dias selecionados, feriados, férias e status do colaborador.
- O app foi separado em HTML, CSS e JS para reduzir acoplamento e facilitar revisão.
- Dados operacionais são salvos no navegador via `localStorage`.
- Bibliotecas externas usadas por CDN: Tailwind, Lucide, XLSX, Chart.js e PDFKit.

## Responsividade

O layout foi mantido compatível com os alvos principais de desktop e notebook: `1366x768`, `1440x900` e `1920x1080`, preservando adaptações existentes para tablets e celulares.
