import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyBb2BrGjHIzOnds-f-LtmsW0WocOh9SxEk",
    authDomain: "imssystem-38c4f.firebaseapp.com",
    projectId: "imssystem-38c4f",
    storageBucket: "imssystem-38c4f.firebasestorage.app",
    messagingSenderId: "1002447791463",
    appId: "1:1002447791463:web:e8f353def694c7d9013bc2",
    measurementId: "G-9Q8DYZH4LM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
