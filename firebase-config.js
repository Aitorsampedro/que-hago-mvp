// firebase-config.js — versión completa y corregida

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// -------------------- CONFIGURACIÓN FIREBASE --------------------

const firebaseConfig = {
  apiKey: "AIzaSyANedM3dtDHdaD7a86mxDQeMc_-S7Q8gc8",
  authDomain: "que-hago-mvp.firebaseapp.com",
  projectId: "que-hago-mvp",
  storageBucket: "que-hago-mvp.firebasestorage.app",
  messagingSenderId: "1014152641904",
  appId: "1:1014152641904:web:18b91bb72b7564eb94e3b5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const planesRef = collection(db, "planes");

// -------------------- OBTENER PLANES --------------------

export async function getAllPlanes() {
  const q = query(planesRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  const results = [];
  snapshot.forEach((doc) => {
    results.push({ id: doc.id, ...doc.data() });
  });

  return results;
}

// -------------------- SUBSCRIBIR A TIEMPO REAL --------------------

export function subscribeToPlanes(callback) {
  return onSnapshot(
    query(planesRef, orderBy("createdAt", "desc")),
    (snapshot) => {
      const results = [];
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      callback(results, null);
    },
    (error) => callback([], error)
  );
}

// -------------------- CREAR NUEVO PLAN --------------------

export async function addPlanToApi(plan) {
  const payload = {
    titulo: plan.titulo,
    descripcion: plan.descripcion,
    provincia: plan.provincia,
    ciudad: plan.ciudad,
    fecha: plan.fecha,
    enlace: plan.enlace,

    // convertir hora vacía a null
    hora: plan.hora ? plan.hora : null,

    // convertir mínimo y máximo a número real o null
    minimo: plan.minimo != null ? Number(plan.minimo) : null,
    maximo: plan.maximo != null ? Number(plan.maximo) : null,

    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(planesRef, payload);
  return docRef.id;
}
