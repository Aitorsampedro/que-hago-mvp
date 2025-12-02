// firebase-config.js – versión tiempo real sencilla y estable
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANedM3dtDHdaD7a86mxDQeMc_-S7Q8gc8",
  authDomain: "que-hago-mvp.firebaseapp.com",
  projectId: "que-hago-mvp",
  storageBucket: "que-hago-mvp.firebasestorage.app",
  messagingSenderId: "1014152641904",
  appId: "1:1014152641904:web:18b91bb72b7564eb94e3b5",
};

export const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const planesCol = collection(db, "planes");

// Leer TODOS los planes (para recarga manual)
export async function getAllPlanes() {
  const snapshot = await getDocs(planesCol);
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

// Suscripción TIEMPO REAL a la colección "planes"
export function subscribeToPlanes(callback) {
  const unsubscribe = onSnapshot(
    planesCol,
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

      callback(planes, null);
    },
    (error) => {
      console.error("Error en onSnapshot:", error);
      callback(null, error);
    }
  );

  return unsubscribe;
}
