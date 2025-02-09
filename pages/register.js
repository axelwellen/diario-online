import { useState } from "react";
import { auth, db } from "../lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, setDoc, addDoc, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/router";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // Nuevo campo
  const [diaryTitle, setDiaryTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const router = useRouter();

  const handleRegister = async () => {
    try {
      if (!username.trim()) {
        alert("Username is required.");
        return;
      }

      // 🔎 Verificar si el nombre de usuario ya existe en la base de datos
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        alert("Username already taken. Please choose another one.");
        return;
      }

      // 🔥 Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 🔥 Generar un ID único para el diario
      const diaryRef = await addDoc(collection(db, "diaries"), {
        userId: user.uid,
        title: diaryTitle || "My Diary",
        private: isPrivate,
      });

      // 🔥 Guardar el usuario en Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        username: username, // Guardar el nombre de usuario
        diaryId: diaryRef.id, // Vincular el diario
      });

      alert("User registered and diary created!");
      router.push("/diary");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div>
      <h2>Register</h2>
      <input type="text" placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
      <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />

      <h3>Choose a Diary Name</h3>
      <input type="text" placeholder="Diary Title" onChange={(e) => setDiaryTitle(e.target.value)} />

      <label>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={() => setIsPrivate(!isPrivate)}
        />
        Private Diary
      </label>

      <button onClick={handleRegister}>Register & Create Diary</button>
      <button onClick={() => router.push("/login")}>Go to Login</button>
    </div>
  );
}
