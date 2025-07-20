// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAVHcire7EkFqZiIl05DdMFhwXpT4KY18A",
  authDomain: "controle-de-vagas-8b628.firebaseapp.com",
  projectId: "controle-de-vagas-8b628",
  storageBucket: "controle-de-vagas-8b628.firebasestorage.app",
  messagingSenderId: "861426269071",
  appId: "1:861426269071:web:ecd1d313b5dbc66d9069fa"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
