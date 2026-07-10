(() => {
  "use strict";

  const tools = {
    presenca: {
      title: "Presença Moodle",
      src: "presenca.html",
      status: "Gerador de CSV, ZIP e PDF para Moodle",
    },
    calendario: {
      title: "Calendário",
      src: "tools/calendario/index.html",
      status: "Calendário acadêmico e exportação PDF",
    },
    organizador: {
      title: "Organizador",
      src: "organizadorzip_compactador-main/index.html",
      status: "Organizador de alunos, CSV Moodle e relatorios",
    },
    matrixpro: {
      title: "MatrixPro RH",
      src: "Matrixpro-main/index.html",
      status: "MatrixPro RH carregado",
    },
  };

  const dom = {};
  let activeToolId = "presenca";

  document.addEventListener("DOMContentLoaded", () => {
    cacheDom();
    bindEvents();
    activateTool(getToolFromHash(), { replaceHash: true });
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

  function cacheDom() {
    [
      "suiteStatus",
      "menuToggleBtn",
      "menuCloseBtn",
      "drawerBackdrop",
      "toolDrawer",
      "reloadToolBtn",
      "openToolBtn",
      "toolSearchInput",
      "toolNav",
      "toolEmpty",
      "toolFrame",
    ].forEach((id) => {
      dom[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    dom.toolNav.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        activateTool(button.dataset.tool);
        closeToolMenu();
      });
    });

    dom.menuToggleBtn.addEventListener("click", toggleToolMenu);
    dom.menuCloseBtn.addEventListener("click", closeToolMenu);
    dom.drawerBackdrop.addEventListener("click", closeToolMenu);
    dom.toolSearchInput.addEventListener("input", filterTools);
    dom.reloadToolBtn.addEventListener("click", reloadActiveTool);
    dom.openToolBtn.addEventListener("click", openActiveTool);
    dom.toolFrame.addEventListener("load", () => {
      const tool = tools[activeToolId] || tools.presenca;
      dom.suiteStatus.textContent = `${tool.title} pronto`;
    });

    window.addEventListener("hashchange", () => activateTool(getToolFromHash(), { replaceHash: true }));
    window.addEventListener("popstate", () => activateTool(getToolFromHash(), { replaceHash: true, skipTransition: true }));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeToolMenu();
      }
    });
  }

  function getToolFromHash() {
    const id = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
    return tools[id] ? id : "presenca";
  }

  function activateTool(id, options = {}) {
    const tool = tools[id] || tools.presenca;
    const nextToolId = tools[id] ? id : "presenca";
    const update = () => renderActiveTool(nextToolId, tool, options);

    if (document.startViewTransition && !options.skipTransition) {
      document.startViewTransition(update);
      return;
    }

    update();
  }

  function renderActiveTool(nextToolId, tool, options = {}) {
    activeToolId = nextToolId;

    dom.toolNav.querySelectorAll("[data-tool]").forEach((button) => {
      const active = button.dataset.tool === activeToolId;
      button.classList.toggle("active", active);
      button.toggleAttribute("aria-current", active);
    });

    dom.suiteStatus.textContent = tool.status;

    if (dom.toolFrame.getAttribute("src") !== tool.src) {
      dom.toolFrame.src = tool.src;
    }

    syncHash(activeToolId, options.replaceHash);
  }

  function syncHash(toolId, replaceHash) {
    const nextHash = `#${encodeURIComponent(toolId)}`;
    if (window.location.hash === nextHash) {
      return;
    }

    if (replaceHash) {
      history.replaceState(null, "", nextHash);
      return;
    }

    history.pushState(null, "", nextHash);
  }

  function toggleToolMenu() {
    setToolMenu(!document.body.classList.contains("menu-open"));
  }

  function closeToolMenu() {
    setToolMenu(false);
  }

  function setToolMenu(open) {
    document.body.classList.toggle("menu-open", open);
    dom.menuToggleBtn.setAttribute("aria-expanded", String(open));
    dom.menuToggleBtn.setAttribute("aria-label", open ? "Fechar menu de ferramentas" : "Abrir menu de ferramentas");
    dom.toolDrawer.setAttribute("aria-hidden", String(!open));
    dom.toolDrawer.inert = !open;
    dom.drawerBackdrop.hidden = !open;

    if (open) {
      window.setTimeout(() => dom.toolSearchInput.focus(), 120);
      return;
    }

    if (dom.toolDrawer.contains(document.activeElement)) {
      dom.menuToggleBtn.focus();
    }
  }

  function filterTools() {
    const query = normalize(dom.toolSearchInput.value);
    let visible = 0;
    dom.toolNav.querySelectorAll("[data-tool]").forEach((button) => {
      const text = normalize(`${button.textContent} ${button.dataset.keywords || ""}`);
      const hidden = Boolean(query && !text.includes(query));
      button.hidden = hidden;
      if (!hidden) {
        visible += 1;
      }
    });
    dom.toolEmpty.hidden = visible > 0;
  }

  function reloadActiveTool() {
    const tool = tools[activeToolId] || tools.presenca;
    try {
      if (dom.toolFrame.contentWindow && dom.toolFrame.getAttribute("src") === tool.src) {
        dom.toolFrame.contentWindow.location.reload();
        return;
      }
    } catch (error) {
      // Fall back to replacing src when browser policies block direct reload.
    }
    dom.toolFrame.src = tool.src;
  }

  function openActiveTool() {
    const tool = tools[activeToolId] || tools.presenca;
    window.open(tool.src, "_blank", "noopener");
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }
})();
