(function () {
  "use strict";

  const HOLIDAY_API_BASE = "https://brasilapi.com.br/api/feriados/v1";
  const HOLIDAY_MAX_YEAR = 2050;
  const HOLIDAY_MIN_YEAR = 1900;
  const STORAGE_PREFIX = "sistema-calendario-feriados-rj-v2:";
  const DRAFT_KEY = "sistema-calendario-draft-v1";
  const CUSTOM_HOLIDAY_KEY = "sistema-calendario-pontos-rj-v1";
  const BRANDING_KEY = "sistema-calendario-branding-v1";
  const DEFAULT_LOGO_SRC = "./assets/logo-calendario.png";
  const DEFAULT_TITLE_COLOR = "#fff200";
  const DEFAULT_TABLE_HEADER_COLOR = "#b7c7e4";
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const OWNER = {
    name: "Carlos Antonio de Oliveira Piquet",
    email: "carlos.piquet2016@gmail.com"
  };

  const HEADERS = [
    { key: "modulo", label: "Módulo", type: "textarea", className: "col-modulo" },
    { key: "coordenador", label: "Coordenador", type: "textarea", className: "col-coordenador" },
    { key: "codigo", label: "Código", type: "text", className: "col-codigo" },
    { key: "cargaHoraria", label: "carga horária", type: "text", className: "col-cargaHoraria" },
    { key: "diasAula", label: "nº de dias de aula", type: "number", className: "col-diasAula" },
    { key: "numeroAulas", label: "nº de aulas", type: "number", className: "col-numeroAulas" },
    { key: "numeroProfessores", label: "nº de prof.", type: "number", className: "col-numeroProfessores" },
    { key: "dataInicial", label: "data inicial", type: "date", className: "col-dataInicial" },
    { key: "dataFinal", label: "data final", type: "date", className: "col-dataFinal" },
    { key: "turno", label: "turno", type: "text", className: "col-turno" },
    { key: "hora", label: "hora", type: "text", className: "col-hora" },
    { key: "observacao", label: "observação", type: "textarea", className: "col-observacao" }
  ];

  const WEEKDAYS = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado"
  ];

  const STANDARD_MODULES = [
    "Princípios Institucionais da Advocacia de Estado",
    "Tópicos Avançados de Direito Constitucional",
    "Tópicos Avançados de Direito Administrativo",
    "Tópicos Fundamentais de Direito Civil",
    "Assessoria e Consultoria Jurídica em Projetos de Infraestrutura",
    "Direito e Política Públicas",
    "Direito Ambiental e Sustentabilidade",
    "Tópicos Avançados de Direito Financeiro e Tributário",
    "Sistemas de Integridade Pública e Privada",
    "Licitações e Contratos Administrativos",
    "Direito Empresarial Público",
    "Direito do Petróleo",
    "A Fazenda Pública em Juízo",
    "Métodos Extrajudiciais de Resolução de Conflitos",
    "Relações Contratuais de Trabalho da Administração Pública",
    "Regime Jurídico dos Servidores Públicos",
    "Regime Previdenciário dos Servidores Públicos",
    "Responsabilidade Civil do Estado",
    "Controle Externo da Administração Pública",
    "Direito Antidiscriminatório e Ações Afirmativas",
    "Metodologia do Trabalho Científico"
  ];

  const STANDARD_MODULE_CODES = {
    "Princípios Institucionais da Advocacia de Estado": "PAE",
    "Tópicos Avançados de Direito Constitucional": "TDC",
    "Tópicos Avançados de Direito Administrativo": "TDA",
    "Tópicos Fundamentais de Direito Civil": "TFDC",
    "Assessoria e Consultoria Jurídica em Projetos de Infraestrutura": "ACI",
    "Direito e Política Públicas": "DPP",
    "Direito Ambiental e Sustentabilidade": "DAS",
    "Tópicos Avançados de Direito Financeiro e Tributário": "DFT",
    "Sistemas de Integridade Pública e Privada": "SIP",
    "Licitações e Contratos Administrativos": "LCA",
    "Direito Empresarial Público": "DEP",
    "Direito do Petróleo": "DIP",
    "A Fazenda Pública em Juízo": "FPJ",
    "Métodos Extrajudiciais de Resolução de Conflitos": "MRC",
    "Relações Contratuais de Trabalho da Administração Pública": "RCT",
    "Regime Jurídico dos Servidores Públicos": "JSP",
    "Regime Previdenciário dos Servidores Públicos": "PSP",
    "Responsabilidade Civil do Estado": "RCE",
    "Controle Externo da Administração Pública": "CAP",
    "Direito Antidiscriminatório e Ações Afirmativas": "DAA",
    "Metodologia do Trabalho Científico": "MET"
  };

  const elements = {};
  const state = {
    title: "",
    expectedWeekday: "",
    fileName: "",
    rows: [],
    alerts: [],
    totalFromExcel: "",
    customHolidays: [],
    branding: {
      logoDataUrl: "",
      logoName: "",
      caption: "Sistema de Calendário",
      includeLogo: false,
      useDefaultLogo: true,
      titleColor: DEFAULT_TITLE_COLOR,
      tableHeaderColor: DEFAULT_TABLE_HEADER_COLOR
    },
    defaultLogoDataUrl: "",
    holidaysByYear: new Map(),
    holidaySource: new Map(),
    warmupRunning: false,
    analysisTimer: null,
    tableScrollControlsVisible: false
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    state.customHolidays = loadCustomHolidays();
    state.branding = loadBranding();
    bindEvents();
    renderTableShell();
    renderBranding();
    createManualTable(false);
    loadDefaultWorkbook();
    warmHolidayCache(new Date().getFullYear(), HOLIDAY_MAX_YEAR);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function cacheElements() {
    [
      "sourceStatus",
      "brandLogo",
      "exportPdfBtn",
      "exportTablePdfBtn",
      "printBtn",
      "openTermsFooterBtn",
      "closeTermsBtn",
      "termsDialog",
      "scheduleTitle",
      "expectedWeekday",
      "excelFile",
      "institutionLogoFile",
      "institutionLogoCaption",
      "includeLogoInPdf",
      "useDefaultLogo",
      "pdfTitleColor",
      "pdfTableHeaderColor",
      "pdfLogoPreview",
      "pdfLogoName",
      "dropZone",
      "loadDefaultBtn",
      "manualBtn",
      "addRowBtn",
      "refreshHolidaysBtn",
      "resetSystemBtn",
      "customHolidayDate",
      "customHolidayName",
      "addCustomHolidayBtn",
      "customHolidayList",
      "moduleCount",
      "workloadTotal",
      "dateRange",
      "holidayStatus",
      "alertSummary",
      "alertsList",
      "autosaveStatus",
      "tableWrap",
      "scrollTableLeftBtn",
      "scrollTableRightBtn",
      "modulesTable"
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements.excelFile.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        readExcelFile(file);
      }
    });

    elements.institutionLogoFile.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        readInstitutionLogo(file);
      }
    });

    elements.institutionLogoCaption.addEventListener("input", (event) => {
      state.branding.caption = event.target.value;
      persistBranding();
      renderBranding();
    });

    elements.includeLogoInPdf.addEventListener("change", (event) => {
      state.branding.includeLogo = event.target.checked;
      persistBranding();
      renderBranding();
    });

    elements.useDefaultLogo.addEventListener("change", (event) => {
      state.branding.useDefaultLogo = event.target.checked;
      persistBranding();
      renderBranding();
    });

    elements.pdfTitleColor.addEventListener("input", (event) => {
      state.branding.titleColor = sanitizeHexColor(event.target.value, DEFAULT_TITLE_COLOR);
      persistBranding();
      renderBranding();
    });

    elements.pdfTableHeaderColor.addEventListener("input", (event) => {
      state.branding.tableHeaderColor = sanitizeHexColor(event.target.value, DEFAULT_TABLE_HEADER_COLOR);
      persistBranding();
      renderBranding();
    });

    document.querySelectorAll(".color-swatch").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.target || button.parentElement.dataset.target;
        const color = sanitizeHexColor(button.dataset.color, DEFAULT_TABLE_HEADER_COLOR);
        if (!target || !elements[target]) {
          return;
        }
        elements[target].value = color;
        elements[target].dispatchEvent(new Event("input", { bubbles: true }));
      });
    });

    elements.openTermsFooterBtn.addEventListener("click", openTermsDialog);
    elements.closeTermsBtn.addEventListener("click", closeTermsDialog);
    elements.termsDialog.addEventListener("click", (event) => {
      if (event.target === elements.termsDialog) {
        closeTermsDialog();
      }
    });

    elements.loadDefaultBtn.addEventListener("click", loadDefaultWorkbook);
    elements.manualBtn.addEventListener("click", () => createManualTable(true));
    elements.addRowBtn.addEventListener("click", () => addRow());
    elements.exportPdfBtn.addEventListener("click", exportPdf);
    elements.exportTablePdfBtn.addEventListener("click", exportTableOnlyPdf);
    elements.printBtn.addEventListener("click", () => window.print());
    elements.refreshHolidaysBtn.addEventListener("click", async () => {
      await warmHolidayCache(new Date().getFullYear(), HOLIDAY_MAX_YEAR, true);
      queueAnalysis();
    });
    elements.resetSystemBtn.addEventListener("click", resetSystemData);

    elements.addCustomHolidayBtn.addEventListener("click", addCustomHoliday);

    elements.scheduleTitle.addEventListener("input", (event) => {
      state.title = event.target.value;
      const inferred = inferWeekdayFromTitle(state.title);
      if (inferred !== "" && elements.expectedWeekday.value === "") {
        state.expectedWeekday = String(inferred);
        elements.expectedWeekday.value = String(inferred);
      }
      persistDraft();
      queueAnalysis();
    });

    elements.expectedWeekday.addEventListener("change", (event) => {
      state.expectedWeekday = event.target.value;
      persistDraft();
      queueAnalysis();
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.add("dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove("dragging");
      });
    });

    elements.dropZone.addEventListener("drop", (event) => {
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) {
        readExcelFile(file);
      }
    });

    elements.dropZone.addEventListener("click", () => {
      elements.excelFile.click();
    });

    elements.dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        elements.excelFile.click();
      }
    });

    elements.scrollTableLeftBtn.addEventListener("click", () => scrollTableHorizontally(-1));
    elements.scrollTableRightBtn.addEventListener("click", () => scrollTableHorizontally(1));
    elements.tableWrap.addEventListener("scroll", updateTableScrollControls, { passive: true });
    window.addEventListener("resize", updateTableScrollControls);
    observeTableVisibility();
  }

  function observeTableVisibility() {
    if (!("IntersectionObserver" in window)) {
      state.tableScrollControlsVisible = true;
      updateTableScrollControls();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      state.tableScrollControlsVisible = entries.some((entry) => entry.isIntersecting);
      updateTableScrollControls();
    }, {
      root: null,
      threshold: 0.01
    });

    observer.observe(elements.tableWrap);
  }

  function scrollTableHorizontally(direction) {
    const amount = Math.max(320, Math.round(elements.tableWrap.clientWidth * 0.72));
    elements.tableWrap.scrollBy({
      left: direction * amount,
      behavior: "smooth"
    });
  }

  function updateTableScrollControls() {
    if (!elements.tableWrap || !elements.scrollTableLeftBtn || !elements.scrollTableRightBtn) {
      return;
    }

    const maxScrollLeft = elements.tableWrap.scrollWidth - elements.tableWrap.clientWidth;
    const hasHorizontalOverflow = maxScrollLeft > 2;
    const shouldShow = state.tableScrollControlsVisible && hasHorizontalOverflow;

    elements.scrollTableLeftBtn.hidden = !shouldShow;
    elements.scrollTableRightBtn.hidden = !shouldShow;

    if (!shouldShow) {
      return;
    }

    elements.scrollTableLeftBtn.disabled = elements.tableWrap.scrollLeft <= 2;
    elements.scrollTableRightBtn.disabled = elements.tableWrap.scrollLeft >= maxScrollLeft - 2;
  }

  function renderTableShell() {
    const thead = elements.modulesTable.querySelector("thead");
    thead.innerHTML = "";
    const tr = document.createElement("tr");
    tr.appendChild(createHeaderCell("Status", "status-cell"));
    HEADERS.forEach((header) => {
      tr.appendChild(createHeaderCell(header.label, header.className));
    });
    tr.appendChild(createHeaderCell("Ações", "actions-cell"));
    thead.appendChild(tr);
  }

  function createHeaderCell(label, className) {
    const th = document.createElement("th");
    th.textContent = label;
    th.className = className;
    return th;
  }

  async function loadDefaultWorkbook() {
    setSourceStatus("Carregando calendario.xlsx...");
    try {
      const response = await fetch("./calendario.xlsx", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Arquivo não encontrado via HTTP local.");
      }
      const buffer = await response.arrayBuffer();
      await importWorkbook(buffer, "calendario.xlsx");
    } catch (error) {
      setSourceStatus("Use o seletor ou arraste o Excel");
      restoreDraftIfAny();
    }
  }

  function readExcelFile(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      await importWorkbook(reader.result, file.name);
    };
    reader.onerror = () => {
      setSourceStatus("Falha ao ler o arquivo selecionado");
    };
    reader.readAsArrayBuffer(file);
  }

  function readInstitutionLogo(file) {
    if (!file.type.startsWith("image/")) {
      setSourceStatus("Selecione uma imagem válida para o logo");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result || "");
      state.branding.useDefaultLogo = false;
      normalizeLogoDataUrl(source)
        .then((normalized) => {
          state.branding.logoDataUrl = normalized || source;
          state.branding.logoName = file.name;
          persistBranding();
          renderBranding();
        })
        .catch(() => {
          state.branding.logoDataUrl = source;
          state.branding.logoName = file.name;
          persistBranding();
          renderBranding();
        });
    };
    reader.onerror = () => {
      setSourceStatus("Falha ao ler o logo institucional");
    };
    reader.readAsDataURL(file);
  }

  function normalizeLogoDataUrl(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 720;
        const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = reject;
      image.src = source;
    });
  }

  function renderBranding() {
    const hasCustomLogo = Boolean(state.branding.logoDataUrl);
    const useDefaultLogo = Boolean(state.branding.useDefaultLogo);
    const logoSrc = useDefaultLogo || !hasCustomLogo ? DEFAULT_LOGO_SRC : state.branding.logoDataUrl;
    const caption = state.branding.caption || "Sistema de Calendário";
    const titleColor = sanitizeHexColor(state.branding.titleColor, DEFAULT_TITLE_COLOR);
    const tableHeaderColor = sanitizeHexColor(state.branding.tableHeaderColor, DEFAULT_TABLE_HEADER_COLOR);
    const tableHeaderTextColor = getReadableTextHex(tableHeaderColor);

    elements.brandLogo.src = DEFAULT_LOGO_SRC;
    elements.pdfLogoPreview.src = logoSrc;
    elements.pdfLogoPreview.classList.toggle("is-muted", !useDefaultLogo && !hasCustomLogo);
    elements.pdfLogoName.textContent = useDefaultLogo
      ? "Logo padrão"
      : state.branding.logoName || "Sem logo selecionado";
    elements.institutionLogoCaption.value = caption;
    elements.includeLogoInPdf.checked = Boolean(state.branding.includeLogo);
    elements.useDefaultLogo.checked = useDefaultLogo;
    elements.pdfTitleColor.value = titleColor;
    elements.pdfTableHeaderColor.value = tableHeaderColor;
    document.documentElement.style.setProperty("--table-header-color", tableHeaderColor);
    document.documentElement.style.setProperty("--table-header-text-color", tableHeaderTextColor);
    updateSwatchSelection("pdfTitleColor", titleColor);
    updateSwatchSelection("pdfTableHeaderColor", tableHeaderColor);
  }

  function loadBranding() {
    const saved = readJson(BRANDING_KEY);
    const hasSavedLogo = Boolean(saved && saved.logoDataUrl);
    return {
      logoDataUrl: saved && typeof saved.logoDataUrl === "string" ? saved.logoDataUrl : "",
      logoName: saved && typeof saved.logoName === "string" ? saved.logoName : "",
      caption: saved && typeof saved.caption === "string" ? saved.caption : "Sistema de Calendário",
      includeLogo: Boolean(saved && saved.includeLogo),
      useDefaultLogo: saved && typeof saved.useDefaultLogo === "boolean" ? saved.useDefaultLogo : !hasSavedLogo,
      titleColor: sanitizeHexColor(saved && saved.titleColor, DEFAULT_TITLE_COLOR),
      tableHeaderColor: sanitizeHexColor(saved && saved.tableHeaderColor, DEFAULT_TABLE_HEADER_COLOR)
    };
  }

  function persistBranding() {
    writeJson(BRANDING_KEY, state.branding);
  }

  function openTermsDialog() {
    if (typeof elements.termsDialog.showModal === "function") {
      elements.termsDialog.showModal();
    } else {
      elements.termsDialog.setAttribute("open", "open");
    }
    refreshIcons();
  }

  function closeTermsDialog() {
    if (typeof elements.termsDialog.close === "function") {
      elements.termsDialog.close();
    } else {
      elements.termsDialog.removeAttribute("open");
    }
  }

  function resetSystemData() {
    const confirmed = window.confirm("Limpar a planilha carregada, rascunho e pontos facultativos manuais?");
    if (!confirmed) {
      return;
    }

    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(CUSTOM_HOLIDAY_KEY);
    state.title = "Nova tabela de módulos";
    state.expectedWeekday = "";
    state.fileName = "";
    state.rows = [createEmptyRow()];
    state.alerts = [];
    state.totalFromExcel = "";
    state.customHolidays = [];
    elements.scheduleTitle.value = state.title;
    elements.expectedWeekday.value = "";
    elements.excelFile.value = "";
    elements.customHolidayDate.value = "";
    elements.customHolidayName.value = "Ponto facultativo RJ";
    setSourceStatus("Sistema limpo");
    renderAll();
    queueAnalysis();
  }

  async function importWorkbook(buffer, fileName) {
    if (!window.XLSX) {
      setSourceStatus("Biblioteca de Excel indisponível");
      return;
    }

    try {
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const grid = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: true,
        blankrows: false
      });
      applyImportedGrid(grid, fileName, firstSheetName);
      await runAnalysis();
    } catch (error) {
      setSourceStatus("Não foi possível interpretar o Excel");
      console.error(error);
    }
  }

  function applyImportedGrid(grid, fileName, sheetName) {
    const title = findTitle(grid) || sheetName || "Calendário";
    const importedRows = [];
    let totalFromExcel = "";

    grid.slice(2).forEach((line) => {
      const hasValue = line.slice(0, HEADERS.length).some((value) => String(value || "").trim() !== "");
      if (!hasValue) {
        return;
      }

      const firstCell = String(line[0] || "").trim().toLowerCase();
      if (firstCell.startsWith("total")) {
        totalFromExcel = String(line[3] || "").trim();
        return;
      }

      const row = createEmptyRow();
      HEADERS.forEach((header, index) => {
        row[header.key] = normalizeImportedValue(line[index], header);
      });
      fillStandardModuleCode(row, false);
      importedRows.push(row);
    });

    state.title = title;
    state.fileName = fileName;
    state.rows = importedRows.length ? importedRows : [createEmptyRow()];
    state.totalFromExcel = totalFromExcel;
    state.expectedWeekday = inferWeekdayFromTitle(title);

    elements.scheduleTitle.value = state.title;
    elements.expectedWeekday.value = state.expectedWeekday;
    setSourceStatus(`${fileName} carregado`);
    renderAll();
    persistDraft();
  }

  function findTitle(grid) {
    if (!Array.isArray(grid) || !grid.length) {
      return "";
    }
    const firstLine = grid[0] || [];
    const first = firstLine.find((value) => String(value || "").trim() !== "");
    return String(first || "").trim();
  }

  function normalizeImportedValue(value, header) {
    if (header.type === "date") {
      return normalizeDate(value);
    }
    if (value == null) {
      return "";
    }
    if (value instanceof Date) {
      return formatDateBR(toIsoDate(value));
    }
    return String(value).trim();
  }

  function createManualTable(force) {
    if (!force && state.rows.length) {
      return;
    }
    state.title = "Nova tabela de módulos";
    state.expectedWeekday = "";
    state.fileName = "";
    state.totalFromExcel = "";
    state.rows = force
      ? STANDARD_MODULES.map((moduleName) => ({
        ...createEmptyRow(),
        modulo: moduleName,
        codigo: getStandardModuleCode(moduleName)
      }))
      : [createEmptyRow()];
    elements.scheduleTitle.value = state.title;
    elements.expectedWeekday.value = "";
    setSourceStatus("Tabela manual");
    renderAll();
    if (force) {
      persistDraft();
    }
    queueAnalysis();
  }

  function createEmptyRow() {
    return {
      id: makeId(),
      modulo: "",
      coordenador: "",
      codigo: "",
      cargaHoraria: "",
      diasAula: "",
      numeroAulas: "",
      numeroProfessores: "",
      dataInicial: "",
      dataFinal: "",
      turno: "",
      hora: "",
      observacao: "",
      _severity: "ok"
    };
  }

  function addRow() {
    state.rows.push(createEmptyRow());
    renderAll();
    persistDraft();
    queueAnalysis();
    requestAnimationFrame(() => {
      const lastRow = elements.modulesTable.querySelector("tbody tr:last-child textarea, tbody tr:last-child input");
      if (lastRow) {
        lastRow.focus();
      }
    });
  }

  function removeRow(rowId) {
    state.rows = state.rows.filter((row) => row.id !== rowId);
    if (!state.rows.length) {
      state.rows = [createEmptyRow()];
    }
    renderAll();
    persistDraft();
    queueAnalysis();
  }

  function renderAll() {
    renderRows();
    renderMetrics();
    renderAlerts();
    renderCustomHolidays();
    updateTableScrollControls();
    refreshIcons();
  }

  function renderRows() {
    const tbody = elements.modulesTable.querySelector("tbody");
    tbody.innerHTML = "";

    state.rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.dataset.rowId = row.id;
      tr.className = row._severity && row._severity !== "ok" ? row._severity : "";

      const statusTd = document.createElement("td");
      statusTd.className = "status-cell";
      const status = document.createElement("span");
      status.className = `row-status ${row._severity || "ok"}`;
      status.title = severityLabel(row._severity || "ok");
      statusTd.appendChild(status);
      tr.appendChild(statusTd);

      HEADERS.forEach((header) => {
        const td = document.createElement("td");
        td.className = header.className;
        const control = createCellControl(row, header);
        td.appendChild(control);
        tr.appendChild(td);
      });

      const actions = document.createElement("td");
      actions.className = "actions-cell";
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "icon-button";
      deleteBtn.title = "Remover módulo";
      deleteBtn.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';
      deleteBtn.addEventListener("click", () => removeRow(row.id));
      actions.appendChild(deleteBtn);
      tr.appendChild(actions);

      tbody.appendChild(tr);
    });
  }

  function createCellControl(row, header) {
    if (header.key === "modulo") {
      return createModuleControl(row, header);
    }

    const isLongText = header.type === "textarea";
    const control = document.createElement(isLongText ? "textarea" : "input");
    control.className = "cell-input";
    control.dataset.rowId = row.id;
    control.dataset.key = header.key;
    control.setAttribute("aria-label", header.label);

    if (!isLongText) {
      control.type = header.type;
      if (header.type === "number") {
        control.min = "0";
        control.step = "1";
      }
    }

    control.value = row[header.key] || "";
    control.addEventListener("input", (event) => {
      const targetRow = state.rows.find((item) => item.id === row.id);
      if (!targetRow) {
        return;
      }
      targetRow[header.key] = event.target.value;
      persistDraft();
      renderMetrics();
      queueAnalysis();
    });

    return control;
  }

  function createModuleControl(row, header) {
    const wrapper = document.createElement("div");
    wrapper.className = "module-picker";

    const select = document.createElement("select");
    select.className = "cell-input module-select";
    select.setAttribute("aria-label", "Selecionar módulo padrão");

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Selecionar módulo";
    select.appendChild(empty);

    STANDARD_MODULES.forEach((moduleName) => {
      const option = document.createElement("option");
      option.value = moduleName;
      option.textContent = moduleName;
      select.appendChild(option);
    });

    const matchedModule = findStandardModule(row.modulo);
    select.value = matchedModule || "";

    const textarea = document.createElement("textarea");
    textarea.className = "cell-input";
    textarea.dataset.rowId = row.id;
    textarea.dataset.key = header.key;
    textarea.setAttribute("aria-label", header.label);
    textarea.value = row.modulo || "";

    select.addEventListener("change", (event) => {
      const targetRow = state.rows.find((item) => item.id === row.id);
      if (!targetRow) {
        return;
      }
      syncModuleAndCode(targetRow, event.target.value);
      textarea.value = event.target.value;
      persistDraft();
      renderMetrics();
      queueAnalysis();
    });

    textarea.addEventListener("input", (event) => {
      const targetRow = state.rows.find((item) => item.id === row.id);
      if (!targetRow) {
        return;
      }
      syncModuleAndCode(targetRow, event.target.value);
      const match = findStandardModule(event.target.value);
      select.value = match || "";
      persistDraft();
      renderMetrics();
      queueAnalysis();
    });

    wrapper.appendChild(select);
    wrapper.appendChild(textarea);
    return wrapper;
  }

  function syncModuleAndCode(row, moduleName) {
    const previousCode = getStandardModuleCode(row.modulo);
    const nextCode = getStandardModuleCode(moduleName);

    row.modulo = moduleName;

    if (nextCode) {
      row.codigo = nextCode;
      updateCellControlValue(row.id, "codigo", nextCode);
      return;
    }

    if (previousCode && row.codigo === previousCode) {
      row.codigo = "";
      updateCellControlValue(row.id, "codigo", "");
    }
  }

  function fillStandardModuleCode(row, overwrite) {
    const code = getStandardModuleCode(row.modulo);
    if (!code) {
      return;
    }

    if (overwrite || !String(row.codigo || "").trim()) {
      row.codigo = code;
    }
  }

  function getStandardModuleCode(moduleName) {
    const standardName = findStandardModule(moduleName);
    return standardName ? STANDARD_MODULE_CODES[standardName] || "" : "";
  }

  function findStandardModule(moduleName) {
    const normalized = normalizeLookupText(moduleName);
    if (!normalized) {
      return "";
    }
    return STANDARD_MODULES.find((name) => normalizeLookupText(name) === normalized) || "";
  }

  function normalizeLookupText(value) {
    return normalizeText(value).replace(/\s+/g, " ").trim();
  }

  function updateCellControlValue(rowId, key, value) {
    const control = Array.from(elements.modulesTable.querySelectorAll(`[data-key="${key}"]`))
      .find((item) => item.dataset.rowId === rowId);
    if (control && control.value !== value) {
      control.value = value;
    }
  }

  function renderMetrics() {
    const nonEmptyRows = state.rows.filter((row) => hasRowContent(row));
    elements.moduleCount.textContent = String(nonEmptyRows.length);
    elements.workloadTotal.textContent = calculateWorkload(nonEmptyRows);
    elements.dateRange.textContent = calculateDateRange(nonEmptyRows);
    elements.autosaveStatus.textContent = state.fileName ? state.fileName : "Edições locais";
  }

  function renderAlerts() {
    const alerts = state.alerts;
    elements.alertsList.innerHTML = "";

    if (!alerts.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Nenhum alerta encontrado nas datas atuais.";
      elements.alertsList.appendChild(empty);
      elements.alertSummary.textContent = "Tudo certo";
      elements.alertSummary.className = "pill ok";
      return;
    }

    const criticalCount = alerts.filter((alert) => alert.severity === "critical").length;
    const warningCount = alerts.filter((alert) => alert.severity === "warn").length;
    elements.alertSummary.textContent = `${criticalCount} críticos · ${warningCount} avisos`;
    elements.alertSummary.className = `pill ${criticalCount ? "critical" : "warn"}`;

    alerts.forEach((alert) => {
      const item = document.createElement("article");
      item.className = `alert-item ${alert.severity}`;
      const severity = document.createElement("div");
      severity.className = "alert-severity";
      severity.textContent = severityLabel(alert.severity);
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = alert.title;
      const message = document.createElement("p");
      message.textContent = alert.message;
      content.appendChild(title);
      content.appendChild(message);
      item.appendChild(severity);
      item.appendChild(content);
      elements.alertsList.appendChild(item);
    });
  }

  function setSourceStatus(text) {
    elements.sourceStatus.textContent = text;
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function queueAnalysis() {
    window.clearTimeout(state.analysisTimer);
    state.analysisTimer = window.setTimeout(runAnalysis, 250);
  }

  async function runAnalysis() {
    const years = collectYearsForAnalysis();
    await ensureHolidayYears(years);

    const alerts = [];
    state.rows.forEach((row) => {
      row._severity = "ok";
    });

    state.rows.forEach((row, index) => {
      if (!hasRowContent(row)) {
        return;
      }
      validateRow(row, index, alerts);
    });

    state.alerts = alerts;
    renderAll();
  }

  function collectYearsForAnalysis() {
    const years = new Set();
    state.rows.forEach((row) => {
      [row.dataInicial, row.dataFinal].forEach((dateValue) => {
        const date = parseIsoDate(dateValue);
        if (date) {
          const year = date.getUTCFullYear();
          years.add(year);
          years.add(year - 1);
          years.add(year + 1);
        }
      });

      const start = parseIsoDate(row.dataInicial);
      const end = parseIsoDate(row.dataFinal);
      if (start && end && end >= start) {
        for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
          years.add(year);
        }
      }
    });
    state.customHolidays.forEach((holiday) => {
      const date = parseIsoDate(holiday.date);
      if (date) {
        years.add(date.getUTCFullYear());
      }
    });
    return Array.from(years).filter((year) => year >= HOLIDAY_MIN_YEAR && year <= HOLIDAY_MAX_YEAR);
  }

  async function ensureHolidayYears(years) {
    const uniqueYears = Array.from(new Set(years));
    await Promise.all(uniqueYears.map((year) => getHolidaysForYear(year)));
    updateHolidayStatus();
  }

  async function getHolidaysForYear(year, forceRefresh) {
    if (!forceRefresh && state.holidaysByYear.has(year)) {
      return state.holidaysByYear.get(year);
    }

    const storageKey = `${STORAGE_PREFIX}${year}`;
    if (!forceRefresh) {
      const cached = readJson(storageKey);
      if (cached && Array.isArray(cached.items)) {
        state.holidaysByYear.set(year, mergeHolidayItems(normalizeHolidayItems(cached.items)));
        state.holidaySource.set(year, cached.source || "cache");
        return state.holidaysByYear.get(year);
      }
    }

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 7000);
      const response = await fetch(`${HOLIDAY_API_BASE}/${year}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      window.clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const nationalItems = normalizeHolidayItems(await response.json(), {
        scope: "Brasil",
        source: "BrasilAPI",
        type: "nacional"
      });
      const items = mergeHolidayItems(nationalItems.concat(getRegionalHolidays(year)));
      state.holidaysByYear.set(year, items);
      state.holidaySource.set(year, "api+rj");
      writeJson(storageKey, {
        source: "api+rj",
        updatedAt: new Date().toISOString(),
        items
      });
      return items;
    } catch (error) {
      const fallback = mergeHolidayItems(getFallbackHolidays(year).concat(getRegionalHolidays(year)));
      state.holidaysByYear.set(year, fallback);
      state.holidaySource.set(year, "fallback+rj");
      writeJson(storageKey, {
        source: "fallback+rj",
        updatedAt: new Date().toISOString(),
        items: fallback
      });
      return fallback;
    }
  }

  async function warmHolidayCache(startYear, endYear, forceRefresh) {
    if (state.warmupRunning) {
      return;
    }
    state.warmupRunning = true;
    elements.refreshHolidaysBtn.disabled = true;

    const safeStart = Math.max(HOLIDAY_MIN_YEAR, Number(startYear) || new Date().getFullYear());
    const safeEnd = Math.min(HOLIDAY_MAX_YEAR, Number(endYear) || HOLIDAY_MAX_YEAR);

    for (let year = safeStart; year <= safeEnd; year += 1) {
      elements.holidayStatus.textContent = `Atualizando ${year}/${safeEnd}`;
      await getHolidaysForYear(year, forceRefresh);
    }

    state.warmupRunning = false;
    elements.refreshHolidaysBtn.disabled = false;
    updateHolidayStatus();
  }

  function updateHolidayStatus() {
    const years = Array.from(state.holidaySource.keys());
    if (!years.length) {
      elements.holidayStatus.textContent = `RJ capital até ${HOLIDAY_MAX_YEAR}`;
      return;
    }

    const fallbackCount = years.filter((year) => String(state.holidaySource.get(year)).includes("fallback")).length;
    const apiCount = years.filter((year) => String(state.holidaySource.get(year)).includes("api")).length;

    if (fallbackCount) {
      elements.holidayStatus.textContent = `RJ: ${apiCount} API · ${fallbackCount} fallback`;
    } else {
      elements.holidayStatus.textContent = `RJ + API até ${HOLIDAY_MAX_YEAR}`;
    }
  }

  function normalizeHolidayItems(items, defaults = {}) {
    return items
      .map((item) => ({
        date: item.date || item.data,
        name: item.name || item.nome || "Feriado",
        type: normalizeHolidayType(item.type || item.tipo || defaults.type || "feriado"),
        scope: item.scope || defaults.scope || "",
        source: item.source || defaults.source || ""
      }))
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date));
  }

  function normalizeHolidayType(type) {
    const normalized = normalizeText(type);
    if (normalized.includes("municip")) {
      return "municipal";
    }
    if (normalized.includes("estad")) {
      return "estadual";
    }
    if (normalized.includes("facult")) {
      return "facultativo";
    }
    if (normalized.includes("setorial")) {
      return "setorial";
    }
    if (normalized.includes("national") || normalized.includes("nacional")) {
      return "nacional";
    }
    return String(type || "feriado").trim() || "feriado";
  }

  function mergeHolidayItems(items) {
    const map = new Map();
    items.forEach((item) => {
      if (!item || !item.date || !item.name) {
        return;
      }
      const normalized = {
        date: item.date,
        name: String(item.name).trim(),
        type: normalizeHolidayType(item.type),
        scope: item.scope || "",
        source: item.source || ""
      };
      const key = `${normalized.date}|${normalizeText(normalized.name)}`;
      if (!map.has(key)) {
        map.set(key, normalized);
        return;
      }
      const current = map.get(key);
      current.scope = mergeText(current.scope, normalized.scope);
      current.type = mergeText(current.type, normalized.type);
      current.source = mergeText(current.source, normalized.source);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  }

  function mergeText(a, b) {
    const parts = String(a || "")
      .split("/")
      .concat(String(b || "").split("/"))
      .map((part) => part.trim())
      .filter(Boolean);
    return Array.from(new Set(parts)).join("/");
  }

  function validateRow(row, index, alerts) {
    const rowLabel = getRowLabel(row, index);
    const start = parseIsoDate(row.dataInicial);
    const end = parseIsoDate(row.dataFinal);

    if (!start) {
      pushAlert(alerts, row, "warn", rowLabel, "Data inicial ausente ou inválida.");
    }
    if (!end) {
      pushAlert(alerts, row, "warn", rowLabel, "Data final ausente ou inválida.");
    }

    [row.dataInicial, row.dataFinal].forEach((dateValue, dateIndex) => {
      const label = dateIndex === 0 ? "Data inicial" : "Data final";
      const date = parseIsoDate(dateValue);
      if (!date) {
        return;
      }
      if (date.getUTCFullYear() > HOLIDAY_MAX_YEAR) {
        pushAlert(alerts, row, "critical", rowLabel, `${label} passa de ${HOLIDAY_MAX_YEAR}. O calendário interno cobre até ${HOLIDAY_MAX_YEAR}.`);
      }
      validateSingleDate(row, alerts, rowLabel, label, date);
    });

    if (start && end) {
      if (end < start) {
        pushAlert(alerts, row, "critical", rowLabel, `Data final (${formatDateBR(row.dataFinal)}) está antes da data inicial (${formatDateBR(row.dataInicial)}).`);
      } else {
        validateRangeHolidays(row, alerts, rowLabel, start, end);
        validateClassDates(row, alerts, rowLabel, start, end);
      }
    }
  }

  function validateSingleDate(row, alerts, rowLabel, dateLabel, date) {
    const iso = toIsoDate(date);
    const weekday = date.getUTCDay();
    const expected = state.expectedWeekday === "" ? null : Number(state.expectedWeekday);

    if (expected !== null && weekday !== expected) {
      pushAlert(
        alerts,
        row,
        "warn",
        rowLabel,
        `${dateLabel} ${formatDateBR(iso)} cai em ${WEEKDAYS[weekday]}, mas a turma está configurada para ${WEEKDAYS[expected]}.`
      );
    }

    if (weekday === 0 || weekday === 6) {
      pushAlert(alerts, row, "warn", rowLabel, `${dateLabel} ${formatDateBR(iso)} cai em ${WEEKDAYS[weekday]}.`);
    }

    const holidays = findHolidays(iso);
    const confirmed = holidays.filter(isConfirmedHoliday);
    const advisory = holidays.filter((holiday) => !isConfirmedHoliday(holiday));

    if (confirmed.length) {
      pushAlert(alerts, row, "critical", rowLabel, `${dateLabel} ${formatDateBR(iso)} coincide com feriado: ${formatHolidayList(confirmed)}.`);
    }

    if (advisory.length) {
      pushAlert(alerts, row, "warn", rowLabel, `${dateLabel} ${formatDateBR(iso)} coincide com ponto facultativo/feriado setorial cadastrado: ${formatHolidayList(advisory)}.`);
    }

    validateBridgeForDate(row, alerts, rowLabel, dateLabel, date);
  }

  function validateRangeHolidays(row, alerts, rowLabel, start, end) {
    const days = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
    if (days > 3700) {
      pushAlert(alerts, row, "warn", rowLabel, "Intervalo maior que 10 anos. A checagem detalhada de feriados foi limitada.");
      return;
    }

    const hits = [];
    for (let offset = 0; offset <= days; offset += 1) {
      const iso = toIsoDate(new Date(start.getTime() + offset * MS_PER_DAY));
      const holidays = findHolidays(iso);
      if (holidays.length) {
        hits.push(`${formatDateBR(iso)} - ${formatHolidayList(holidays)}`);
      }
    }

    if (hits.length) {
      const firstHits = hits.slice(0, 6).join("\n");
      const suffix = hits.length > 6 ? `\n+ ${hits.length - 6} datas no intervalo` : "";
      pushAlert(alerts, row, "warn", rowLabel, `O período contém feriado(s)/ponto(s) de atenção:\n${firstHits}${suffix}`);
    }
  }

  function validateClassDates(row, alerts, rowLabel, start, end) {
    if (state.expectedWeekday === "") {
      return;
    }

    const expected = Number(state.expectedWeekday);
    const days = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
    if (!Number.isInteger(expected) || days > 3700) {
      return;
    }

    for (let offset = 0; offset <= days; offset += 1) {
      const date = new Date(start.getTime() + offset * MS_PER_DAY);
      if (date.getUTCDay() !== expected) {
        continue;
      }

      const iso = toIsoDate(date);
      const holidays = findHolidays(iso);
      const confirmed = holidays.filter(isConfirmedHoliday);
      const advisory = holidays.filter((holiday) => !isConfirmedHoliday(holiday));

      if (confirmed.length) {
        pushAlert(alerts, row, "critical", rowLabel, `Aula provável em ${formatDateBR(iso)} coincide com feriado: ${formatHolidayList(confirmed)}.`);
      }

      if (advisory.length) {
        pushAlert(alerts, row, "warn", rowLabel, `Aula provável em ${formatDateBR(iso)} coincide com ponto facultativo/feriado setorial: ${formatHolidayList(advisory)}.`);
      }

      validateBridgeForDate(row, alerts, rowLabel, "Aula provável", date);
    }
  }

  function validateBridgeForDate(row, alerts, rowLabel, dateLabel, date) {
    const weekday = date.getUTCDay();
    const checks = [];

    if (weekday === 1) {
      checks.push({
        holidayDate: addDays(date, 1),
        text: "segunda-feira imediatamente antes de feriado na terça-feira"
      });
    }

    if (weekday === 4) {
      checks.push({
        holidayDate: addDays(date, 1),
        text: "quinta-feira imediatamente antes de feriado na sexta-feira"
      });
    }

    if (weekday === 5) {
      checks.push({
        holidayDate: addDays(date, -1),
        text: "sexta-feira imediatamente após feriado na quinta-feira"
      });
    }

    checks.forEach((check) => {
      const holidayIso = toIsoDate(check.holidayDate);
      const confirmed = findHolidays(holidayIso).filter(isConfirmedHoliday);
      if (!confirmed.length) {
        return;
      }
      pushAlert(
        alerts,
        row,
        "warn",
        rowLabel,
        `${dateLabel} ${formatDateBR(toIsoDate(date))} cai em ${check.text}. Tem ponto facultativo? Confirmar decreto do Governo do RJ ou da Prefeitura do Rio para ${formatDateBR(toIsoDate(date))}. Feriado relacionado: ${formatDateBR(holidayIso)} - ${formatHolidayList(confirmed)}.`
      );
    });
  }

  function findHolidays(isoDate) {
    const year = Number(isoDate.slice(0, 4));
    const base = state.holidaysByYear.get(year) || [];
    const custom = getCustomHolidaysForYear(year);
    return mergeHolidayItems(base.concat(custom)).filter((holiday) => holiday.date === isoDate);
  }

  function isConfirmedHoliday(holiday) {
    const type = normalizeHolidayType(holiday.type);
    return !type.includes("facultativo") && !type.includes("setorial");
  }

  function formatHolidayList(holidays) {
    return holidays.map((holiday) => {
      const scope = holiday.scope ? ` (${holiday.scope})` : "";
      const type = holiday.type ? ` - ${holiday.type}` : "";
      return `${holiday.name}${scope}${type}`;
    }).join("; ");
  }

  function pushAlert(alerts, row, severity, title, message) {
    const duplicated = alerts.some((alert) => (
      alert.rowId === row.id &&
      alert.severity === severity &&
      alert.title === title &&
      alert.message === message
    ));
    if (duplicated) {
      return;
    }

    alerts.push({ rowId: row.id, severity, title, message });
    if (severity === "critical" || row._severity !== "critical") {
      row._severity = severity;
    }
  }

  async function exportPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      setSourceStatus("Biblioteca de PDF indisponível");
      return;
    }

    const doc = createPdfDocument();
    const title = state.title || "Calendário";
    const header = await addPdfHeader(doc, title, "Relatório completo");
    const margin = header.margin;

    const metrics = [
      ["Módulos", String(state.rows.filter((row) => hasRowContent(row)).length)],
      ["Carga horária", calculateWorkload(state.rows)],
      ["Período", calculateDateRange(state.rows)],
      ["Calendário", elements.holidayStatus.textContent || `até ${HOLIDAY_MAX_YEAR}`]
    ];

    doc.autoTable({
      startY: header.startY,
      head: [["Indicador", "Valor"]],
      body: metrics,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 4, lineColor: [190, 199, 213], lineWidth: 0.5 },
      headStyles: { fillColor: hexToRgb(state.branding.tableHeaderColor, DEFAULT_TABLE_HEADER_COLOR), textColor: getReadableTextRgb(state.branding.tableHeaderColor), halign: "center" },
      margin: { left: margin, right: margin },
      tableWidth: 260
    });

    const alertsBody = state.alerts.map((alert) => [
      severityLabel(alert.severity),
      alert.title,
      alert.message
    ]);

    if (alertsBody.length) {
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 12,
        head: [["Nível", "Módulo", "Alerta"]],
        body: alertsBody,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 7.4, cellPadding: 3, lineColor: [209, 215, 225], lineWidth: 0.4 },
        headStyles: { fillColor: hexToRgb(state.branding.titleColor, DEFAULT_TITLE_COLOR), textColor: getReadableTextRgb(state.branding.titleColor), halign: "center" },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 180 },
          2: { cellWidth: "auto" }
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 0) {
            const value = String(data.cell.raw || "").toLowerCase();
            if (value.includes("crítico")) {
              data.cell.styles.textColor = [180, 35, 24];
            } else if (value.includes("aviso")) {
              data.cell.styles.textColor = [164, 95, 0];
            }
          }
        },
        margin: { left: margin, right: margin }
      });
    }

    drawScheduleTable(doc, doc.lastAutoTable.finalY + 12, { margin, tableOnly: false });
    addPdfFooters(doc, margin);
    doc.save(`${slugify(title)}.pdf`);
  }

  async function exportTableOnlyPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      setSourceStatus("Biblioteca de PDF indisponível");
      return;
    }

    const doc = createPdfDocument();
    const title = state.title || "Calendário";
    const header = await addPdfHeader(doc, title, "Tabela de módulos");
    drawScheduleTable(doc, header.startY, { margin: header.margin, tableOnly: true });
    addPdfFooters(doc, header.margin);
    doc.save(`${slugify(title)}-tabela.pdf`);
  }

  function createPdfDocument() {
    const doc = new window.jspdf.jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4"
    });
    doc.setProperties({
      title: state.title || "Sistema de Calendário",
      subject: "Calendário de módulos com validação de feriados",
      author: `${OWNER.name} <${OWNER.email}>`,
      creator: `${OWNER.name} <${OWNER.email}>`
    });
    return doc;
  }

  async function addPdfHeader(doc, title, modeLabel) {
    const margin = 24;
    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedAt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date());
    const logoSize = 34;
    const logoX = margin;
    const logoY = 58;
    const titleX = margin;
    const titleY = 18;
    const titleHeight = 28;
    const titleWidth = pageWidth - margin * 2;
    const caption = state.branding.caption || "Sistema de Calendário";
    const includeLogo = Boolean(state.branding.includeLogo);

    if (includeLogo) {
      const logoDataUrl = await getActivePdfLogoDataUrl();
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), logoX, logoY, logoSize, logoSize, undefined, "FAST");
        } catch (error) {
          doc.setDrawColor(23, 75, 130);
          doc.rect(logoX, logoY, logoSize, logoSize);
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(62, 75, 94);
      const captionLines = doc.splitTextToSize(caption, 105).slice(0, 2);
      doc.text(captionLines, logoX, logoY + logoSize + 9);
    }

    doc.setFillColor(...hexToRgb(state.branding.titleColor, DEFAULT_TITLE_COLOR));
    doc.rect(titleX, titleY, titleWidth, titleHeight, "F");
    doc.setTextColor(...getReadableTextRgb(state.branding.titleColor));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, pageWidth / 2, titleY + 19, { align: "center", maxWidth: titleWidth - 16 });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(70, 83, 104);
    doc.text(modeLabel, includeLogo ? margin + 132 : margin, 76);
    doc.text(`Gerado em ${generatedAt}`, includeLogo ? margin + 250 : margin + 156, 76);
    doc.text(`Fonte: ${state.fileName || "tabela manual"}`, pageWidth - margin, 76, { align: "right" });

    return { margin, startY: 112 };
  }

  function drawScheduleTable(doc, startY, options) {
    const rows = state.rows.filter((row) => hasRowContent(row));
    const body = rows.map((row) => HEADERS.map((header) => formatPdfCell(row[header.key], header)));
    const tableOnly = Boolean(options.tableOnly);

    doc.autoTable({
      startY,
      head: [HEADERS.map((header) => header.label)],
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: tableOnly ? 6.2 : 6.7,
        cellPadding: tableOnly ? 2.6 : 3,
        overflow: "linebreak",
        lineColor: [70, 83, 104],
        lineWidth: 0.35,
        valign: "middle"
      },
      headStyles: {
        fillColor: hexToRgb(state.branding.tableHeaderColor, DEFAULT_TABLE_HEADER_COLOR),
        textColor: getReadableTextRgb(state.branding.tableHeaderColor),
        halign: "center",
        fontStyle: "bold",
        lineColor: [26, 43, 68],
        lineWidth: 0.55
      },
      alternateRowStyles: tableOnly ? { fillColor: [255, 249, 235] } : undefined,
      columnStyles: getPdfColumnStyles(tableOnly),
      didParseCell: (data) => {
        if (data.section !== "body") {
          return;
        }
        const row = rows[data.row.index];
        if (row && row._severity === "critical") {
          data.cell.styles.fillColor = [255, 241, 240];
        } else if (row && row._severity === "warn" && !tableOnly) {
          data.cell.styles.fillColor = [255, 247, 230];
        }
      },
      margin: { left: options.margin, right: options.margin, bottom: 30 }
    });
  }

  function getPdfColumnStyles(tableOnly) {
    if (tableOnly) {
      return {
        0: { cellWidth: 124 },
        1: { cellWidth: 88 },
        2: { cellWidth: 38, halign: "center" },
        3: { cellWidth: 42, halign: "center" },
        4: { cellWidth: 45, halign: "center" },
        5: { cellWidth: 38, halign: "center" },
        6: { cellWidth: 38, halign: "center" },
        7: { cellWidth: 54, halign: "center" },
        8: { cellWidth: 54, halign: "center" },
        9: { cellWidth: 42, halign: "center" },
        10: { cellWidth: 48, halign: "center" },
        11: { cellWidth: "auto" }
      };
    }

    return {
      0: { cellWidth: 118 },
      1: { cellWidth: 88 },
      2: { cellWidth: 38, halign: "center" },
      3: { cellWidth: 43, halign: "center" },
      4: { cellWidth: 45, halign: "center" },
      5: { cellWidth: 38, halign: "center" },
      6: { cellWidth: 38, halign: "center" },
      7: { cellWidth: 52, halign: "center" },
      8: { cellWidth: 52, halign: "center" },
      9: { cellWidth: 42, halign: "center" },
      10: { cellWidth: 48, halign: "center" },
      11: { cellWidth: "auto" }
    };
  }

  function addPdfFooters(doc, margin) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageCount = doc.internal.getNumberOfPages();
    const license = `Sistema licenciado por ${OWNER.name} · ${OWNER.email}`;

    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(90, 100, 116);
      doc.text(license, margin, pageHeight - 14);
      doc.text(`Página ${page}/${pageCount}`, pageWidth - margin, pageHeight - 14, { align: "right" });
    }
  }

  async function getActivePdfLogoDataUrl() {
    if (!state.branding.useDefaultLogo && state.branding.logoDataUrl) {
      return state.branding.logoDataUrl;
    }
    if (!state.branding.useDefaultLogo) {
      return "";
    }
    if (state.defaultLogoDataUrl) {
      return state.defaultLogoDataUrl;
    }

    try {
      const response = await fetch(DEFAULT_LOGO_SRC);
      const blob = await response.blob();
      state.defaultLogoDataUrl = await blobToDataUrl(blob);
      return state.defaultLogoDataUrl;
    } catch (error) {
      return "";
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function getImageFormat(dataUrl) {
    const prefix = String(dataUrl).slice(0, 40).toLowerCase();
    if (prefix.includes("image/jpeg") || prefix.includes("image/jpg")) {
      return "JPEG";
    }
    if (prefix.includes("image/webp")) {
      return "WEBP";
    }
    return "PNG";
  }

  function slugify(value) {
    return String(value || "calendario")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "calendario";
  }

  function sanitizeHexColor(value, fallback) {
    const color = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
  }

  function hexToRgb(value, fallback) {
    const color = sanitizeHexColor(value, fallback || "#000000").slice(1);
    return [
      parseInt(color.slice(0, 2), 16),
      parseInt(color.slice(2, 4), 16),
      parseInt(color.slice(4, 6), 16)
    ];
  }

  function getReadableTextRgb(backgroundColor) {
    const [red, green, blue] = hexToRgb(backgroundColor, DEFAULT_TABLE_HEADER_COLOR);
    const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
    return luminance < 135 ? [255, 255, 255] : [0, 0, 0];
  }

  function getReadableTextHex(backgroundColor) {
    const [red] = getReadableTextRgb(backgroundColor);
    return red === 255 ? "#ffffff" : "#051329";
  }

  function updateSwatchSelection(targetId, color) {
    document.querySelectorAll(`.swatches[data-target="${targetId}"] .color-swatch`).forEach((button) => {
      button.classList.toggle("active", sanitizeHexColor(button.dataset.color, "") === color);
    });
  }

  function formatPdfCell(value, header) {
    if (header.type === "date") {
      return formatDateBR(value);
    }
    return String(value || "");
  }

  function calculateWorkload(rows) {
    const numeric = rows.reduce((total, row) => total + parseWorkloadHours(row.cargaHoraria), 0);
    if (numeric > 0) {
      return `${numeric}h`;
    }
    return state.totalFromExcel || "0h";
  }

  function parseWorkloadHours(value) {
    const match = String(value || "").match(/(\d+(?:[,.]\d+)?)/);
    if (!match) {
      return 0;
    }
    return Number(match[1].replace(",", ".")) || 0;
  }

  function calculateDateRange(rows) {
    const dates = [];
    rows.forEach((row) => {
      [row.dataInicial, row.dataFinal].forEach((value) => {
        const parsed = parseIsoDate(value);
        if (parsed) {
          dates.push(parsed);
        }
      });
    });

    if (!dates.length) {
      return "-";
    }

    dates.sort((a, b) => a - b);
    return `${formatDateBR(toIsoDate(dates[0]))} a ${formatDateBR(toIsoDate(dates[dates.length - 1]))}`;
  }

  function normalizeDate(value) {
    if (!value) {
      return "";
    }

    if (value instanceof Date) {
      return toIsoDate(value);
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return excelSerialToIso(value);
    }

    const text = String(value).trim();
    if (!text) {
      return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
      const [day, month, year] = text.split("/").map(Number);
      return toIsoDate(new Date(Date.UTC(year, month - 1, day)));
    }

    if (/^\d+(\.\d+)?$/.test(text)) {
      return excelSerialToIso(Number(text));
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return toIsoDate(parsed);
    }

    return "";
  }

  function excelSerialToIso(serial) {
    const timestamp = Date.UTC(1899, 11, 30) + Math.round(Number(serial)) * MS_PER_DAY;
    return toIsoDate(new Date(timestamp));
  }

  function parseIsoDate(value) {
    const iso = normalizeDate(value);
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return null;
    }
    const date = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function formatDateBR(value) {
    const iso = normalizeDate(value);
    if (!iso) {
      return "";
    }
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }

  function inferWeekdayFromTitle(title) {
    const normalized = normalizeText(title);
    const options = [
      ["domingo", 0],
      ["segunda", 1],
      ["terca", 2],
      ["terça", 2],
      ["quarta", 3],
      ["quinta", 4],
      ["sexta", 5],
      ["sabado", 6],
      ["sábado", 6]
    ];
    const found = options.find(([name]) => normalized.includes(normalizeText(name)));
    return found ? String(found[1]) : "";
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function hasRowContent(row) {
    return HEADERS.some((header) => String(row[header.key] || "").trim() !== "");
  }

  function getRowLabel(row, index) {
    const moduleName = String(row.modulo || "").trim();
    const code = String(row.codigo || "").trim();
    if (moduleName && code) {
      return `${index + 1}. ${moduleName} (${code})`;
    }
    if (moduleName) {
      return `${index + 1}. ${moduleName}`;
    }
    return `${index + 1}. Módulo sem nome`;
  }

  function severityLabel(severity) {
    if (severity === "critical") {
      return "Crítico";
    }
    if (severity === "warn") {
      return "Aviso";
    }
    if (severity === "info") {
      return "Info";
    }
    return "OK";
  }

  function addCustomHoliday() {
    const date = normalizeDate(elements.customHolidayDate.value);
    const name = String(elements.customHolidayName.value || "Ponto facultativo RJ").trim();

    if (!date) {
      elements.customHolidayDate.focus();
      return;
    }

    const item = {
      id: makeId(),
      date,
      name,
      type: "facultativo",
      scope: "Rio de Janeiro/RJ",
      source: "manual"
    };

    const exists = state.customHolidays.some((holiday) => holiday.date === item.date && normalizeText(holiday.name) === normalizeText(item.name));
    if (!exists) {
      state.customHolidays.push(item);
      state.customHolidays.sort((a, b) => a.date.localeCompare(b.date));
      persistCustomHolidays();
    }

    elements.customHolidayDate.value = "";
    elements.customHolidayName.value = "Ponto facultativo RJ";
    renderCustomHolidays();
    queueAnalysis();
  }

  function removeCustomHoliday(id) {
    state.customHolidays = state.customHolidays.filter((holiday) => holiday.id !== id);
    persistCustomHolidays();
    renderCustomHolidays();
    queueAnalysis();
  }

  function renderCustomHolidays() {
    if (!elements.customHolidayList) {
      return;
    }

    elements.customHolidayList.innerHTML = "";
    if (!state.customHolidays.length) {
      return;
    }

    state.customHolidays.forEach((holiday) => {
      const chip = document.createElement("span");
      chip.className = "custom-chip";
      chip.textContent = `${formatDateBR(holiday.date)} · ${holiday.name}`;
      const button = document.createElement("button");
      button.type = "button";
      button.title = "Remover ponto facultativo";
      button.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
      button.addEventListener("click", () => removeCustomHoliday(holiday.id));
      chip.appendChild(button);
      elements.customHolidayList.appendChild(chip);
    });
  }

  function loadCustomHolidays() {
    const items = readJson(CUSTOM_HOLIDAY_KEY);
    if (!Array.isArray(items)) {
      return [];
    }
    return items
      .map((item) => ({
        id: item.id || makeId(),
        date: normalizeDate(item.date),
        name: String(item.name || "Ponto facultativo RJ").trim(),
        type: "facultativo",
        scope: "Rio de Janeiro/RJ",
        source: "manual"
      }))
      .filter((item) => item.date);
  }

  function persistCustomHolidays() {
    writeJson(CUSTOM_HOLIDAY_KEY, state.customHolidays);
  }

  function getCustomHolidaysForYear(year) {
    return state.customHolidays.filter((holiday) => Number(holiday.date.slice(0, 4)) === year);
  }

  function getRegionalHolidays(year) {
    const easter = calculateEaster(year);
    const thirdMondayOfOctober = getNthWeekdayOfMonth(year, 9, 1, 3);

    return [
      {
        date: `${year}-01-20`,
        name: "São Sebastião",
        type: "municipal",
        scope: "Rio de Janeiro/RJ",
        source: "calendario-local-rj"
      },
      {
        date: `${year}-04-23`,
        name: "Dia de São Jorge",
        type: "estadual/municipal",
        scope: "RJ/Rio de Janeiro",
        source: "calendario-local-rj"
      },
      {
        date: toIsoDate(addDays(easter, -47)),
        name: "Terça-feira de Carnaval",
        type: "estadual",
        scope: "RJ",
        source: "calendario-local-rj"
      },
      {
        date: toIsoDate(thirdMondayOfOctober),
        name: "Dia do Comércio",
        type: "setorial",
        scope: "RJ",
        source: "calendario-local-rj"
      },
      {
        date: `${year}-10-28`,
        name: "Dia do Servidor Público",
        type: "facultativo",
        scope: "RJ",
        source: "calendario-local-rj"
      }
    ];
  }

  function getFallbackHolidays(year) {
    const easter = calculateEaster(year);
    const fixed = [
      ["01-01", "Confraternização mundial"],
      ["04-21", "Tiradentes"],
      ["05-01", "Dia do trabalho"],
      ["09-07", "Independência do Brasil"],
      ["10-12", "Nossa Senhora Aparecida"],
      ["11-02", "Finados"],
      ["11-15", "Proclamação da República"],
      ["11-20", "Dia da consciência negra"],
      ["12-25", "Natal"]
    ].map(([monthDay, name]) => ({
      date: `${year}-${monthDay}`,
      name,
      type: "nacional",
      scope: "Brasil",
      source: "fallback"
    }));

    const movable = [
      [addDays(easter, -47), "Carnaval"],
      [addDays(easter, -2), "Sexta-feira Santa"],
      [easter, "Páscoa"],
      [addDays(easter, 60), "Corpus Christi"]
    ].map(([date, name]) => ({
      date: toIsoDate(date),
      name,
      type: "nacional",
      scope: "Brasil",
      source: "fallback"
    }));

    return fixed.concat(movable).sort((a, b) => a.date.localeCompare(b.date));
  }

  function calculateEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * MS_PER_DAY);
  }

  function getNthWeekdayOfMonth(year, monthIndex, weekday, occurrence) {
    const date = new Date(Date.UTC(year, monthIndex, 1));
    const firstWeekday = date.getUTCDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    return new Date(Date.UTC(year, monthIndex, 1 + offset + (occurrence - 1) * 7));
  }

  function makeId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function persistDraft() {
    writeJson(DRAFT_KEY, {
      title: state.title,
      expectedWeekday: state.expectedWeekday,
      fileName: state.fileName,
      totalFromExcel: state.totalFromExcel,
      rows: state.rows.map((row) => {
        const clean = {};
        HEADERS.forEach((header) => {
          clean[header.key] = row[header.key] || "";
        });
        clean.id = row.id;
        return clean;
      })
    });
  }

  function restoreDraftIfAny() {
    if (state.fileName || state.rows.some((row) => hasRowContent(row))) {
      return;
    }

    const draft = readJson(DRAFT_KEY);
    if (!draft || !Array.isArray(draft.rows) || !draft.rows.length) {
      return;
    }

    state.title = draft.title || "Calendário";
    state.expectedWeekday = draft.expectedWeekday || "";
    state.fileName = draft.fileName || "";
    state.totalFromExcel = draft.totalFromExcel || "";
    state.rows = draft.rows.map((row) => {
      const restoredRow = { ...createEmptyRow(), ...row, id: row.id || makeId() };
      fillStandardModuleCode(restoredRow, false);
      return restoredRow;
    });
    elements.scheduleTitle.value = state.title;
    elements.expectedWeekday.value = state.expectedWeekday;
    setSourceStatus("Rascunho restaurado");
    renderAll();
    queueAnalysis();
  }

  function readJson(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // LocalStorage pode estar bloqueado; a aplicação continua funcionando em memória.
    }
  }
})();
