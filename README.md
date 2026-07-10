# Suite Academica Piquet

Sistema web estatico que unifica ferramentas academicas e operacionais em uma unica entrada.

## Entrada principal

Abra `index.html` por um servidor local. A tela principal carrega as ferramentas em um painel unico:

- Presenca Moodle: geracao de CSV, ZIP e PDFs de aula/modulo.
- Calendario: planejamento academico, feriados, tabela editavel e PDF.
- Organizador: organizador de documentos, conversor Moodle CSV e relatorio de logs.
- MatrixPro RH: gestao de RH, escalas, presencas, ferias, documentos e relatorios.

## Execucao local

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Depois acesse:

```text
http://127.0.0.1:8000/
```

## Privacidade

As ferramentas processam os arquivos no navegador. Dados importados ficam no dispositivo do usuario, usando download local, `localStorage` ou `IndexedDB` conforme a ferramenta.

## Arquitetura

A decisao tecnica, limpeza realizada e referencias pesquisadas estao em:

`docs/ARQUITETURA-SUITE.md`
