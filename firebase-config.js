// firebase-config.js — versión definitiva con IDs deterministas (no duplicados)

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  getDocs,
  query,
  orderBy
} from "firebase/firestore";

// ----------------------------
// CONFIG FIREBASE
// ----------------------------
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

// ----------------------------
// ID determinista (evita duplicados 100%)
// ----------------------------
async function generatePlanId(plan) {
  const base = `${plan.titulo}__${plan.fecha}__${plan.ciudad}__${plan.provincia}`.toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(base);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 20);
}

// ----------------------------
// Añadir plan SIN duplicados
// ----------------------------
export async function addPlanToApi(plan) {
  const id = await generatePlanId(plan);
  const docRef = doc(planesRef, id);

  await setDoc(docRef, {
    ...plan,
    createdAt: plan.createdAt || new Date().toISOString()
  });

  return id;
}

// ----------------------------
// Obtener planes (lector único)
// ----------------------------
export async function getAllPlanes() {
  const q = query(planesRef, orderBy("fecha", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ----------------------------
// Listener realtime
// ----------------------------
export function subscribeToPlanes(callback) {
  return onSnapshot(planesRef, (snapshot) => {
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(docs);
  });
}
