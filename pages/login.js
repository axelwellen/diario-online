import { useState } from "react";
import { auth, db } from "../lib/firebase"; // 🔥 Importamos db para buscar usuario
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore"; // 🔥 Necesario para buscar en Firestore
import { useRouter } from "next/router";

export default function Login() {
  const [identifier, setIdentifier] = useState(""); // Puede ser email o username
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    try {
      let email = identifier;

      // 🔥 Si el usuario no ingresó un email, buscar en Firestore el email asociado al username
      if (!identifier.includes("@")) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", identifier));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          alert("Username not found.");
          return;
        }

        const userData = querySnapshot.docs[0].data();
        email = userData.email; // 🔥 Obtener el email asociado al username
      }

      // 🔥 Iniciar sesión con el email obtenido (ya sea ingresado directamente o buscado por username)
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/diary"); // Redirigir al diario después del login
    } catch (error) {
      alert("Login failed: " + error.message);
    }
  };

  return (
    <div className="container">
      <h2>Login</h2>
      <input 
        type="text" 
        placeholder="Email or Username" 
        onChange={(e) => setIdentifier(e.target.value)} 
      />
      <input 
        type="password" 
        placeholder="Password" 
        onChange={(e) => setPassword(e.target.value)} 
      />
      <button onClick={handleLogin}>Login</button>

      <p>Don't have an account?</p>
      <button onClick={() => router.push("/register")}>Go to Register</button>
    </div>
  );
}
