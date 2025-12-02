// app.js – versión con tiempo real estable

import {
  getAllPlanes,
  addPlanToApi,
  subscribeToPlanes,
} from "./firebase-config.js";

const STORAGE_KEY = "qhago:planes:v1";

const DEFAULT_PLANS = [
  {
    id: "mock-1",
    titulo: "Ruta nocturna por las Fragas",
    descripcion: "Paseo fácil, traer frontal. Después cañas en Pontedeume.",
    provincia: "A Coruña",
    ciudad: "Pontedeume",
    fecha: "2025-11-03",
    hora: "21:00",
    minimo: 2,
    maximo: 8,
    enlace: "https://chat.whatsapp.com/ejemplo1",
    createdAt: new Date().toISOString(),
    source: "mock",
  },
  {
    id: "mock-2",
    titulo: "Ir al cine en Vigo (sábado tarde)",
    descripcion: "Busco 2-3 personas para ver estreno y luego tomar algo.",
    provincia: "Pontevedra",
    ciudad: "Vigo",
    fecha: "2025-11-02",
    hora: "18:30",
    minimo: 2,
    maximo: 4,
    enlace: "https://chat.whatsapp.com/ejemplo2",
    createdAt: new Date().toISOString(),
    source: "mock",
  },
];

let plans = [];
let unsubscribeFromRealtime = null;

// ===== Utils =====

function tryParseInt(value, fallback = null) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function normalizePlan(raw) {
  const fecha = raw.fecha || "";
  const hora = raw.hora || "";
  return {
    id: raw.id || `local-${crypto.randomUUID?.() || Date.now()}`,
    titulo: (raw.titulo || "").trim(),
    descripcion: (raw.descripcion || "").trim(),
    provincia: (raw.provincia || "").trim(),
    ciudad: (raw.ciudad || "").trim(),
    fecha,
    hora,
    minimo: tryParseInt(raw.minimo, null),
    maximo: tryParseInt(raw.maximo, null),
    enlace: (raw.enlace || "").trim(),
    createdAt: raw.createdAt || new Date().toISOString(),
    source: raw.source || "local",
  };
}

function sortPlans(list) {
  return [...list].sort((a, b) => {
    if (!a.fecha && !b.fecha) return 0;
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    const diff = a.fecha.localeCompare(b.fecha);
    if (diff !== 0) return diff;
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });
}

// ===== localStorage solo para modo local (por si lo usas en el futuro) =====

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePlan);
  } catch {
    return [];
  }
}

function saveToStorage(plansList) {
  const clean = plansList.map((p) => ({
    id: p.id,
    titulo: p.titulo,
    descripcion: p.descripcion,
    provincia: p.provincia,
    ciudad: p.ciudad,
    fecha: p.fecha,
    hora: p.hora,
    minimo: p.minimo,
    maximo: p.maximo,
    enlace: p.enlace,
    createdAt: p.createdAt,
    source: p.source,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
}

// ===== WhatsApp =====

function buildWhatsAppMessage(plan) {
  const fechaText = plan.fecha || "Fecha por concretar";
  const horaText = plan.hora ? ` a las ${plan.hora}` : "";
  const personasText =
    plan.minimo && plan.maximo
      ? `${plan.minimo}-${plan.maximo} personas`
      : plan.minimo
      ? `Desde ${plan.minimo} personas`
      : plan.maximo
      ? `Hasta ${plan.maximo} personas`
      : "Personas por concretar";

  return [
    `Plan: ${plan.titulo}`,
    `Cuándo: ${fechaText}${horaText}`,
    `Dónde: ${plan.ciudad} (${plan.provincia})`,
    `Personas: ${personasText}`,
    "",
    plan.descripcion,
    "",
    plan.enlace ? `Únete aquí: ${plan.enlace}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function sharePlanByWhatsApp(plan) {
  const text = encodeURIComponent(buildWhatsAppMessage(plan));
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
}

// ===== DOM principal =====

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const apiMode = body.dataset.apiMode === "api";

  // Formulario
  const form = document.getElementById("plan-form");
  const inputTitulo = document.getElementById("titulo");
  const inputDescripcion = document.getElementById("descripcion");
  const selectProvincia = document.getElementById("provincia");
  const inputCiudad = document.getElementById("ciudad");
  const inputFecha = document.getElementById("fecha");
  const inputHora = document.getElementById("hora");
  const inputMinimo = document.getElementById("minimo");
  const inputMaximo = document.getElementById("maximo");
  const inputEnlace = document.getElementById("enlace");
  const formError = document.getElementById("form-error");
  const formSuccess = document.getElementById("form-success");

  // Filtros
  const filtroProvincia = document.getElementById("filtro-provincia");
  const filtroFecha = document.getElementById("filtro-fecha");
  const filtroBusqueda = document.getElementById("filtro-busqueda");
  const btnLimpiarFiltros = document.getElementById("btn-limpiar-filtros");

  // Lista
  const list = document.getElementById("plan-list");
  const template = document.getElementById("plan-card-template");
  const emptyState = document.getElementById("empty-state");
  const resultsCount = document.getElementById("results-count");

  // API status
  const apiStatus = document.getElementById("api-status");
  const btnRecargar = document.getElementById("btn-recargar");

  // Limitar fechas mínimas
  const today = new Date().toISOString().slice(0, 10);
  if (inputFecha) inputFecha.min = today;
  if (filtroFecha) filtroFecha.min = today;

  // ===== Render =====

  function renderPlans(filtered) {
    list.innerHTML = "";

    const total = filtered.length;
    const totalGlobal = plans.length;

    if (resultsCount) {
      if (!totalGlobal) {
        resultsCount.textContent = "No hay ningún plan creado todavía.";
      } else if (!total) {
        resultsCount.textContent = `0 planes con estos filtros (${totalGlobal} en total).`;
      } else if (total === totalGlobal) {
        resultsCount.textContent = `${total} planes disponibles.`;
      } else {
        resultsCount.textContent = `${total} planes con estos filtros de ${totalGlobal} en total.`;
      }
    }

    if (!total) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    filtered.forEach((plan) => {
      const node = template.content.cloneNode(true);
      const article = node.querySelector(".plan");
      const title = node.querySelector(".plan-title");
      const badgeProvince = node.querySelector(".badge-province");
      const badgeCity = node.querySelector(".badge-city");
      const badgePeople = node.querySelector(".badge-people");
      const desc = node.querySelector(".plan-description");
      const dateSpan = node.querySelector(".plan-date");
      const timeSpan = node.querySelector(".plan-time");
      const joinLink = node.querySelector(".btn-join");
      const shareBtn = node.querySelector(".btn-share");

      if (article) article.dataset.planId = plan.id;
      if (title) title.textContent = plan.titulo || "Plan sin título";
      if (badgeProvince) badgeProvince.textContent = plan.provincia || "Provincia";
      if (badgeCity) badgeCity.textContent = plan.ciudad || "Ubicación";

      if (badgePeople) {
        const min = plan.minimo ?? null;
        const max = plan.maximo ?? null;
        let label = "Personas por concretar";
        if (min && max) label = `${min}-${max} personas`;
        else if (min) label = `Desde ${min} personas`;
        else if (max) label = `Hasta ${max} personas`;
        badgePeople.textContent = label;
      }

      if (desc) desc.textContent = plan.descripcion || "";
      if (dateSpan) dateSpan.textContent = plan.fecha || "Fecha por concretar";
      if (timeSpan) timeSpan.textContent = plan.hora || "";

      if (joinLink) {
        const href =
          plan.enlace && /^https?:\/\//i.test(plan.enlace)
            ? plan.enlace
            : plan.enlace
            ? `https://${plan.enlace}`
            : "#";
        joinLink.href = href;
        if (!plan.enlace) {
          joinLink.classList.add("btn-secondary");
          joinLink.textContent = "Sin enlace todavía";
          joinLink.removeAttribute("target");
        }
      }

      if (shareBtn) {
        shareBtn.addEventListener("click", () => sharePlanByWhatsApp(plan));
      }

      list.appendChild(node);
    });
  }

  // ===== Filtros =====

  function applyFilters() {
  const provSel = filtroProvincia?.value || "todas";
  const fechaSel = filtroFecha?.value || "";
  const text = (filtroBusqueda?.value || "").trim().toLowerCase();

  // Hoy a las 00:00, para comparar solo por día
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const filtered = plans.filter((p) => {
    // 1) Ocultar planes con fecha pasada (solo si la fecha es válida)
    if (p.fecha) {
      const planDate = new Date(p.fecha);
      if (!Number.isNaN(planDate.getTime())) {
        planDate.setHours(0, 0, 0, 0);
        const planMs = planDate.getTime();
        if (planMs < todayMs) return false;
      }
    }

    // 2) Filtro por provincia
    if (provSel !== "todas" && p.provincia !== provSel) return false;

    // 3) Filtro por fecha exacta seleccionada en el filtro
    if (fechaSel && p.fecha !== fechaSel) return false;

    // 4) Búsqueda por texto
    if (text) {
      const haystack = [
        p.titulo,
        p.descripcion,
        p.provincia,
        p.ciudad,
        p.fecha,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(text)) return false;
    }

    return true;
  });

  renderPlans(filtered);
}




  function resetFilters() {
    if (filtroProvincia) filtroProvincia.value = "todas";
    if (filtroFecha) filtroFecha.value = "";
    if (filtroBusqueda) filtroBusqueda.value = "";
    applyFilters();
  }

  // ===== Mensajes formulario =====

  function clearFormMessages() {
    if (formError) {
      formError.textContent = "";
      formError.style.display = "none";
    }
    if (formSuccess) {
      formSuccess.textContent = "";
      formSuccess.style.display = "none";
    }
  }

  function showError(msg) {
    if (!formError) return;
    formError.textContent = msg;
    formError.style.display = "block";
    if (formSuccess) {
      formSuccess.textContent = "";
      formSuccess.style.display = "none";
    }
  }

  function showSuccess(msg) {
    if (!formSuccess) return;
    formSuccess.textContent = msg;
    formSuccess.style.display = "block";
    if (formError) {
      formError.textContent = "";
      formError.style.display = "none";
    }
  }

  // ===== Crear plan =====

  async function handleCreatePlan(e) {
    e.preventDefault();
    clearFormMessages();

    const raw = {
      titulo: inputTitulo?.value,
      descripcion: inputDescripcion?.value,
      provincia: selectProvincia?.value,
      ciudad: inputCiudad?.value,
      fecha: inputFecha?.value,
      hora: inputHora?.value,
      minimo: inputMinimo?.value,
      maximo: inputMaximo?.value,
      enlace: inputEnlace?.value,
    };

    if (!raw.titulo || !raw.provincia || !raw.ciudad || !raw.fecha || !raw.enlace) {
      showError("Rellena todos los campos obligatorios marcados con *.");
      return;
    }

    const min = tryParseInt(raw.minimo, null);
    const max = tryParseInt(raw.maximo, null);
    if (min !== null && max !== null && max < min) {
      showError("El máximo de personas no puede ser menor que el mínimo.");
      return;
    }

    if (!/^https?:\/\//i.test(raw.enlace)) {
      raw.enlace = `https://${raw.enlace}`;
    }

    const newPlan = normalizePlan({
      ...raw,
      source: apiMode ? "api-local" : "local",
    });

    try {
      if (apiMode) {
        if (apiStatus) apiStatus.textContent = "Guardando plan en la nube...";
        const newId = await addPlanToApi(newPlan);
        newPlan.id = newId;
        if (apiStatus) apiStatus.textContent = "Plan guardado en la nube.";
        // No hace falta meterlo a mano en `plans`: onSnapshot lo traerá solo
      } else {
        plans.unshift(newPlan);
        saveToStorage(plans);
        plans = sortPlans(plans);
        applyFilters();
      }

      form.reset();
      showSuccess("Plan publicado correctamente.");
    } catch (err) {
      console.error(err);
      showError("Error al guardar el plan. Inténtalo de nuevo.");
      if (apiStatus) apiStatus.textContent = "Error al guardar en la API.";
    }
  }

  // ===== Recargar manual (por si acaso) =====

  async function reloadFromApi() {
    if (!apiStatus) return;
    apiStatus.textContent = "Cargando planes desde la API...";

    try {
      const apiPlans = await getAllPlanes();
      plans = sortPlans(apiPlans.map(normalizePlan));
      apiStatus.textContent = `Cargados ${plans.length} planes desde la API.`;
      applyFilters();
    } catch (err) {
      console.error(err);
      apiStatus.textContent =
        "Error al cargar desde la API. Revisa la conexión o las reglas.";
    }
  }

  // ===== Init (incluye tiempo real) =====

  (async function init() {
    if (apiMode) {
      if (apiStatus) apiStatus.textContent = "Conectando en tiempo real...";

      unsubscribeFromRealtime = subscribeToPlanes((apiPlans, error) => {
        if (error) {
          if (apiStatus) apiStatus.textContent = "Error en tiempo real.";
          console.error(error);
          return;
        }

        plans = sortPlans(apiPlans.map(normalizePlan));
        if (apiStatus) {
          apiStatus.textContent = `Conectado. ${plans.length} planes cargados.`;
        }
        applyFilters();
      });
    } else {
      const stored = loadFromStorage();
      plans = stored.length ? stored : DEFAULT_PLANS.map(normalizePlan);
      plans = sortPlans(plans);
      applyFilters();
    }
  })();

  // ===== Listeners =====

  if (form) form.addEventListener("submit", handleCreatePlan);
  if (filtroProvincia) filtroProvincia.addEventListener("change", applyFilters);
  if (filtroFecha) filtroFecha.addEventListener("change", applyFilters);
  if (filtroBusqueda) filtroBusqueda.addEventListener("input", applyFilters);
  if (btnLimpiarFiltros) btnLimpiarFiltros.addEventListener("click", resetFilters);

  if (btnRecargar) {
    btnRecargar.addEventListener("click", () => {
      if (apiMode) reloadFromApi();
      else {
        const storedAgain = loadFromStorage();
        plans = storedAgain.length ? storedAgain : DEFAULT_PLANS.map(normalizePlan);
        plans = sortPlans(plans);
        if (apiStatus)
          apiStatus.textContent = "Datos recargados desde almacenamiento local.";
        applyFilters();
      }
    });
  }
});
