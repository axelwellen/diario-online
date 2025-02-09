// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Para imágenes en el futuro
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA6gGWqoSfm-l-OZkQIEnv_3-4hL7wdPdw",
  authDomain: "diarioonline-f3dcf.firebaseapp.com",
  projectId: "diarioonline-f3dcf",
  storageBucket: "diarioonline-f3dcf.firebasestorage.app",
  messagingSenderId: "976437100329",
  appId: "1:976437100329:web:948038aedf348c8e1c4138"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);