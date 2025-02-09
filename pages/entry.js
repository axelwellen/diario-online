import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/router";
import { db } from "../lib/firebase";
import { doc, collection, addDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Entry() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { entryId } = router.query; // 🔥 Detectar si estamos en modo edición
  const [content, setContent] = useState("");
  const [diaryId, setDiaryId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchDiaryId();
  }, [user, loading]);

  useEffect(() => {
    if (entryId) {
      setIsEditing(true);
      fetchEntry();
    }
  }, [entryId]);

  const fetchDiaryId = async () => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().diaryId) {
      setDiaryId(userSnap.data().diaryId);
    } else {
      alert("Diary not found.");
      router.push("/diary");
    }
  };

  const fetchEntry = async () => {
    if (!diaryId || !entryId) return;
    const entryRef = doc(db, "diaries", diaryId, "entries", entryId);
    const entrySnap = await getDoc(entryRef);

    if (entrySnap.exists()) {
      setContent(entrySnap.data().content);
    } else {
      alert("Entry not found.");
      router.push("/diary");
    }
  };

  const handleSaveEntry = async () => {
    if (!user || !diaryId) {
      alert("Error: Diary ID not found.");
      return;
    }

    if (!content.trim()) {
      alert("Please write something before saving.");
      return;
    }

    if (isEditing) {
      // 🔥 Actualizar entrada existente
      const entryRef = doc(db, "diaries", diaryId, "entries", entryId);
      await updateDoc(entryRef, {
        content,
        date: serverTimestamp(),
      });
      alert("Entry updated!");
    } else {
      // 📝 Crear nueva entrada
      const diaryRef = doc(db, "diaries", diaryId);
      await addDoc(collection(diaryRef, "entries"), {
        content,
        date: serverTimestamp(),
      });
      alert("Entry added!");
    }

    router.push("/diary");
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || !diaryId) return <p>Loading...</p>;

  return (
    <div>
      <nav style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#eee" }}>
        <h2>{isEditing ? "✏️ Edit Entry" : "📝 New Entry"}</h2>
        <div>
          <button onClick={() => router.push("/diary")}>📖 My Diary</button>
          <button onClick={() => router.push("/explore")}>🔍 Explore</button>
          <button onClick={() => router.push("/user")}>⚙️ Settings</button>
          <button onClick={handleLogout} style={{ background: "red", color: "white" }}>🚪 Logout</button>
        </div>
      </nav>

      <h3>{isEditing ? "Edit Your Entry" : "Write a New Entry"}</h3>
      <textarea
        placeholder="Write your entry here..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ width: "100%", height: "150px", padding: "10px", marginBottom: "10px" }}
      />
      <button onClick={handleSaveEntry}>{isEditing ? "Update Entry" : "Save Entry"}</button>
      <button onClick={() => router.push("/diary")}>Cancel</button>
    </div>
  );
}
