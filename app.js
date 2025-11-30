// app.js (versión completa con TIEMPO REAL)

// Importar helpers de Firebase (incluye subscribeToPlanes)
import {
  getAllPlanes,
  addPlanToApi,
  subscribeToPlanes
} from "./firebase-config.js";

// =============================
//   Configuración general
// =============================

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
let unsubscribeFromPlans = null;

// =============================
//   Utilidades
// =============================

function tryParseInt(value, fallback = null) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function normalizePlan(raw) {
  return {
    id: raw.id || `local-${crypto.randomUUID?.() || Date.now()}`,
    titulo: (raw.titulo || "").trim(),
    descripcion: (raw.descripcion || "").trim(),
    provincia: (raw.provincia || "").trim(),
    ciudad: (raw.ciudad || "").trim(),
    fecha: raw.fecha || "",
    hora: raw.hora || "",
    minimo: tryParseInt(raw.minimo, null),
    maximo: tryParseInt(raw.maximo, null),
    enlace: (raw.enlace || "").trim(),
    createdAt: raw.createdAt || new Date().toISOString(),
    source: raw.source || "local",
  };
}

function sortPlans(plansList) {
  return [...plansList].sort((a, b) => {
    if (!a.fecha && !b.fecha) return 0;
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    const diff = a.fecha.localeCompare(b.fecha);
    if (diff !== 0) return diff;
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });
}

// =============================
//   localStorage (modo local)
// =============================

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

// =============================
//   WhatsApp share
// =============================

function buildWhatsAppMessage(plan) {
  return [
    `Plan: ${plan.titulo}`,
    `Cuándo: ${plan.fecha}${plan.hora ? " a las " + plan.hora : ""}`,
    `Dónde: ${plan.ciudad} (${plan.provincia})`,
    `Personas: ${
      plan.minimo && plan.maximo
        ? `${plan.minimo}-${plan.maximo}`
        : plan.minimo
        ? `Desde ${plan.minimo}`
        : plan.maximo
        ? `Hasta ${plan.maximo}`
        : "Por concretar"
    }`,
    "",
    plan.descripcion,
    "",
    plan.enlace ? `Únete aquí: ${plan.enlace}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function sharePlan(plan) {
  const text = encodeURIComponent(buildWhatsAppMessage(plan));
  window.open(`https://wa.me/?text=${text}`, "_blank");
}

// =============================
//   DOM
// =============================

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const apiMode = body.dataset.apiMode === "api";

  // ---- Form ----
  const form = document.getElementById("plan-form");
  const titulo = document.getElementById("titulo");
  const descripcion = document.getElementById("descripcion");
  const provincia = document.getElementById("provincia");
  const ciudad = document.getElementById("ciudad");
  const fecha = document.getElementById("fecha");
  const hora = document.getElementById("hora");
  const minimo = document.getElementById("minimo");
  const maximo = document.getElementById("maximo");
  const enlace = document.getElementById("enlace");

  const formError = document.getElementById("form-error");
  const formSuccess = document.getElementById("form-success");

  // ---- Lista ----
  const list = document.getElementById("plan-list");
  const template = document.getElementById("plan-card-template");
  const emptyState = document.getElementById("empty-state");
  const resultsCount = document.getElementById("results-count");

  // ---- Filtros ----
  const filtroProvincia = document.getElementById("filtro-provincia");
  const filtroFecha = document.getElementById("filtro-fecha");
  const filtroBusqueda = document.getElementById("filtro-busqueda");
  const btnLimpiar = document.getElementById("btn-limpiar-filtros");

  // ---- API status ----
  const apiStatus = document.getElementById("api-status");
  const btnRecargar = document.getElementById("btn-recargar");

  // =============================
  //   Render de planes
  // =============================

  function renderPlans(planesFiltrados) {
    list.innerHTML = "";

    const total = planesFiltrados.length;
    const totalGlobal = plans.length;

    if (resultsCount) {
      if (!totalGlobal) {
        resultsCount.textContent = "No hay planes todavía.";
      } else {
        resultsCount.textContent = `${total} planes filtrados de ${totalGlobal}`;
      }
    }

    if (total === 0) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    planesFiltrados.forEach((plan) => {
      const node = template.content.cloneNode(true);

      node.querySelector(".plan-title").textContent = plan.titulo;
      node.querySelector(".badge-province").textContent = plan.provincia;
      node.querySelector(".badge-city").textContent = plan.ciudad;
      node.querySelector(".plan-description").textContent = plan.descripcion;
      node.querySelector(".plan-date").textContent = plan.fecha;
      node.querySelector(".plan-time").textContent = plan.hora || "";

      const badgePeople = node.querySelector(".badge-people");
      badgePeople.textContent =
        plan.minimo && plan.maximo
          ? `${plan.minimo}-${plan.maximo} personas`
          : plan.minimo
          ? `Desde ${plan.minimo} personas`
          : plan.maximo
          ? `Hasta ${plan.maximo} personas`
          : "Personas por concretar";

      const joinBtn = node.querySelector(".btn-join");
      joinBtn.href = plan.enlace;

      node.querySelector(".btn-share").addEventListener("click", () =>
        sharePlan(plan)
      );

      list.appendChild(node);
    });
  }

  // =============================
  //   Filtros
  // =============================

  function applyFilters() {
    const prov = filtroProvincia.value;
    const day = filtroFecha.value;
    const text = filtroBusqueda.value.toLowerCase();

    const filtrados = plans.filter((p) => {
      if (prov !== "todas" && p.provincia !== prov) return false;
      if (day && p.fecha !== day) return false;
      if (
        text &&
        !`${p.titulo} ${p.descripcion} ${p.ciudad} ${p.provincia}`
          .toLowerCase()
          .includes(text)
      )
        return false;
      return true;
    });

    renderPlans(filtrados);
  }

  // =============================
  //   Form submit
  // =============================

  function clearMessages() {
    formError.style.display = "none";
    formSuccess.style.display = "none";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessages();

    const raw = {
      titulo: titulo.value,
      descripcion: descripcion.value,
      provincia: provincia.value,
      ciudad: ciudad.value,
      fecha: fecha.value,
      hora: hora.value,
      minimo: minimo.value,
      maximo: maximo.value,
      enlace: enlace.value,
    };

    if (!raw.titulo || !raw.provincia || !raw.ciudad || !raw.fecha || !raw.enlace) {
      formError.textContent = "Rellena todos los campos obligatorios.";
      formError.style.display = "block";
      return;
    }

    if (!/^https?:\/\//i.test(raw.enlace)) {
      raw.enlace = `https://${raw.enlace}`;
    }

    const plan = normalizePlan(raw);

    try {
      if (apiMode) {
        await addPlanToApi(plan);
      } else {
        plans.unshift(plan);
        saveToStorage(plans);
      }

      form.reset();
      formSuccess.textContent = "Plan publicado correctamente.";
      formSuccess.style.display = "block";
    } catch (err) {
      console.error(err);
      formError.textContent = "Error guardando el plan.";
      formError.style.display = "block";
    }
  });

  // =============================
  //   Tiempo real
  // =============================

  async function init() {
    if (apiMode) {
      apiStatus.textContent = "Conectando en tiempo real...";

      unsubscribeFromPlans = subscribeToPlanes((apiPlans, error) => {
        if (error) {
          apiStatus.textContent = "Error en tiempo real.";
          return;
        }

        plans = sortPlans(apiPlans.map(normalizePlan));
        apiStatus.textContent = `Conectado. ${plans.length} planes cargados.`;
        applyFilters();
      });
    } else {
      plans = loadFromStorage();
      if (!plans.length) plans = DEFAULT_PLANS.map(normalizePlan);
      plans = sortPlans(plans);
      applyFilters();
    }
  }

  init();

  // ====== Recargar manual ======
  if (btnRecargar) {
    btnRecargar.addEventListener("click", async () => {
      if (!apiMode) return;

      apiStatus.textContent = "Recargando...";
      const apiPlans = await getAllPlanes();
      plans = sortPlans(apiPlans.map(normalizePlan));
      apiStatus.textContent = "Planes actualizados.";
      applyFilters();
    });
  }

  // ====== Eventos de filtros ======
  filtroProvincia.addEventListener("change", applyFilters);
  filtroFecha.addEventListener("change", applyFilters);
  filtroBusqueda.addEventListener("input", applyFilters);
  btnLimpiar.addEventListener("click", () => {
    filtroProvincia.value = "todas";
    filtroFecha.value = "";
    filtroBusqueda.value = "";
    applyFilters();
  });
});
