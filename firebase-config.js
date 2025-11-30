// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANedM3dtDHdaD7a86mxDQeMc_-S7Q8gc8",
  authDomain: "que-hago-mvp.firebaseapp.com",
  projectId: "que-hago-mvp",
  storageBucket: "que-hago-mvp.firebasestorage.app",
  messagingSenderId: "1014152641904",
  appId: "1:1014152641904:web:18b91bb72b7564eb94e3b5",
};

// Inicializar Firebase
export const app = initializeApp(firebaseConfig);

// Firestore + colección
const db = getFirestore(app);
const planesCol = collection(db, "planes");

// Leer todos los planes UNA VEZ (para recarga manual)
export async function getAllPlanes() {
  const q = query(planesCol, orderBy("fecha"), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      titulo: data.titulo || "",
      descripcion: data.descripcion || "",
      provincia: data.provincia || "",
      ciudad: data.ciudad || "",
      fecha: data.fecha || "",
      hora: data.hora || "",
      minimo: data.minimo ?? null,
      maximo: data.maximo ?? null,
      enlace: data.enlace || "",
      createdAt:
        data.createdAt && data.createdAt.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
      source: "api",
    };
  });
}

// Crear un nuevo plan en Firestore
export async function addPlanToApi(plan) {
  const docRef = await addDoc(planesCol, {
    titulo: plan.titulo,
    descripcion: plan.descripcion,
    provincia: plan.provincia,
    ciudad: plan.ciudad,
    fecha: plan.fecha,
    hora: plan.hora || null,
    minimo: plan.minimo ?? null,
    maximo: plan.maximo ?? null,
    enlace: plan.enlace,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

// Suscripción en tiempo real a la colección "planes"
export function subscribeToPlanes(callback) {
  const q = query(planesCol, orderBy("fecha"), orderBy("createdAt", "asc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const planes = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          titulo: data.titulo || "",
          descripcion: data.descripcion || "",
          provincia: data.provincia || "",
          ciudad: data.ciudad || "",
          fecha: data.fecha || "",
          hora: data.hora || "",
          minimo: data.minimo ?? null,
          maximo: data.maximo ?? null,
          enlace: data.enlace || "",
          createdAt:
            data.createdAt && data.createdAt.toDate
              ? data.createdAt.toDate().toISOString()
              : null,
          source: "api",
        };
      });

      callback(planes);
    },
    (error) => {
      console.error("Error en suscripción de planes:", error);
      callback(null, error);
    }
  );

  return unsubscribe;
}
