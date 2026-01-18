// app.js — versión final optimizada + IDs deterministas

import {
  getAllPlanes,
  addPlanToApi,
  subscribeToPlanes
} from "./firebase-config.js";

// ----------------------------
// Variables globales
// ----------------------------
let plans = [];
let unsubscribe = null;

// ----------------------------
// Utils
// ----------------------------
function parseOrNull(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

// Normalización flexible
function normalizePlan(raw) {
  return {
    id: raw.id,
    titulo: raw.titulo || "",
    descripcion: raw.descripcion || "",
    provincia: raw.provincia || "",
    ciudad: raw.ciudad || "",
    fecha: raw.fecha || "",
    hora: raw.hora || null,
    minimo: raw.minimo ?? null,
    maximo: raw.maximo ?? null,
    enlace: raw.enlace || "",
    createdAt: raw.createdAt || null
  };
}

// Ordenación robusta
function sortPlans(list) {
  const getTime = (val) => {
    if (!val) return 0;

    if (typeof val === "object" && "seconds" in val) {
      return val.seconds * 1000;
    }

    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  };

  return [...list].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    return getTime(a.createdAt) - getTime(b.createdAt);
  });
}

// ----------------------------
// Render
// ----------------------------
function renderPlans(plans) {
  const list = document.getElementById("plan-list");
  const template = document.getElementById("plan-card-template");
  const emptyState = document.getElementById("empty-state");

  list.innerHTML = "";

  if (!plans.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  plans.forEach((p) => {
    const node = template.content.cloneNode(true);

    node.querySelector(".plan-title").textContent = p.titulo;
    node.querySelector(".badge-province").textContent = p.provincia;
    node.querySelector(".badge-city").textContent = p.ciudad;
    node.querySelector(".plan-description").textContent = p.descripcion;
    node.querySelector(".plan-date").textContent = p.fecha;
    node.querySelector(".plan-time").textContent = p.hora || "—";

    const people = node.querySelector(".badge-people");
    if (p.minimo && p.maximo) people.textContent = `${p.minimo}-${p.maximo} personas`;
    else people.textContent = "Personas indefinidas";

    node.querySelector(".btn-join").href = p.enlace;

    list.appendChild(node);
  });
}

// ----------------------------
// Filtros (incluye ocultar pasados)
// ----------------------------
function applyFilters() {
  const prov = document.getElementById("filtro-provincia").value;
  const fecha = document.getElementById("filtro-fecha").value;
  const text = document.getElementById("filtro-busqueda").value.toLowerCase();

  const today = new Date().toISOString().slice(0, 10);

  const filtered = plans.filter((p) => {
    if (p.fecha < today) return false; // Ocultar pasados
    if (prov !== "todas" && p.provincia !== prov) return false;
    if (fecha && p.fecha !== fecha) return false;

    const haystack = `${p.titulo} ${p.descripcion} ${p.provincia} ${p.ciudad}`.toLowerCase();
    return haystack.includes(text);
  });

  renderPlans(filtered);
}

// ----------------------------
// Crear plan
// ----------------------------
async function handleSubmit(e) {
  e.preventDefault();

  const titulo = document.getElementById("titulo").value.trim();
  const descripcion = document.getElementById("descripcion").value.trim();
  const provincia = document.getElementById("provincia").value;
  const ciudad = document.getElementById("ciudad").value;
  const fecha = document.getElementById("fecha").value;
  const hora = document.getElementById("hora").value || null;
  const minimo = parseOrNull(document.getElementById("minimo").value);
  const maximo = parseOrNull(document.getElementById("maximo").value);
  let enlace = document.getElementById("enlace").value.trim();

  if (!/^https?:\/\//i.test(enlace)) enlace = "https://" + enlace;

  const wa = enlace.startsWith("https://wa.me/") || enlace.startsWith("https://chat.whatsapp.com/");
  const tg = enlace.startsWith("https://t.me/") || enlace.startsWith("https://telegram.me/");
  if (!wa && !tg) {
    alert("El enlace debe ser de WhatsApp o Telegram.");
    return;
  }

  const newPlan = {
    titulo,
    descripcion,
    provincia,
    ciudad,
    fecha,
    hora,
    minimo,
    maximo,
    enlace,
    createdAt: new Date().toISOString()
  };

  await addPlanToApi(newPlan);

  document.getElementById("plan-form").reset();
}

// ----------------------------
// Inicialización
// ----------------------------
async function init() {
  unsubscribe = subscribeToPlanes((docs) => {
    plans = sortPlans(docs.map(normalizePlan));
    applyFilters();
  });

  document.getElementById("filtro-provincia").addEventListener("change", applyFilters);
  document.getElementById("filtro-fecha").addEventListener("change", applyFilters);
  document.getElementById("filtro-busqueda").addEventListener("input", applyFilters);
  document.getElementById("btn-limpiar-filtros").addEventListener("click", () => {
    document.getElementById("filtro-provincia").value = "todas";
    document.getElementById("filtro-fecha").value = "";
    document.getElementById("filtro-busqueda").value = "";
    applyFilters();
  });

  document.getElementById("plan-form").addEventListener("submit", handleSubmit);
}

document.addEventListener("DOMContentLoaded", init);
