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
  const [diaryLanguage, setDiaryLanguage] = useState("en"); // 🔥 Default: Inglés

  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" },
    { code: "ja", name: "Japanese" },
    { code: "zh", name: "Chinese" },
    { code: "ar", name: "Arabic" },
    { code: "hi", name: "Hindi" },
    { code: "ko", name: "Korean" },
    { code: "tr", name: "Turkish" },
    { code: "nl", name: "Dutch" },
    { code: "sv", name: "Swedish" },
    { code: "cat", name: "Catalan"},
  ];

  const handleRegister = async () => {
    try {
      if (!username.trim()) {
        alert("Username is required.");
        return;
      }
  
      // 🔎 Verificar si el username ya existe
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
  
      // 🔥 Crear el diario en Firestore con el idioma seleccionado
      const diaryRef = await addDoc(collection(db, "diaries"), {
        userId: user.uid,
        title: diaryTitle || "My Diary",
        private: isPrivate,
        language: diaryLanguage, // 🔥 Guardar el idioma seleccionado
      });
  
      // 🔥 Guardar la referencia del diario en el usuario
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        username: username, // Guardar el username
        diaryId: diaryRef.id // Guardar la referencia del diario
      });
  
      alert("User registered and diary created!");
      router.push("/diary");
    } catch (error) {
      alert(error.message);
    }
  };
  

  return (
    <div className="container">
      <h2>Register</h2>
      <input type="text" placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
      <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />

      <h3>Choose a Diary Name</h3>
      <input type="text" placeholder="Diary Title" onChange={(e) => setDiaryTitle(e.target.value)} />

      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "10px 0" }}>
      <h3>Language for Your Diary</h3>
      <select value={diaryLanguage} onChange={(e) => setDiaryLanguage(e.target.value)}>
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
      <div></div>
        <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "1rem" }}>
    
  Private Diary: 
    <input
      type="checkbox"
      checked={isPrivate}
      onChange={() => setIsPrivate(!isPrivate)}
      style={{ width: "16px", height: "16px" }}
    />
    
  </label>
</div>

<button onClick={handleRegister} className="button-primary">Register & Create Diary</button>
<button onClick={() => router.push("/login")} className="button-secondary">Go to Login</button>

    </div>
  );
}
