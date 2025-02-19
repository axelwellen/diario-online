import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext"; 
import { useRouter } from "next/router";
import { db } from "../../lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function EntryEditor() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { entryId } = router.query;
  const [diaryId, setDiaryId] = useState(null);
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [corrections, setCorrections] = useState([]); // 🔥 Lista de correcciones
  const [title, setTitle] = useState(""); // 📌 Nuevo estado para el título


  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchDiaryId();
  }, [user, loading]);

  useEffect(() => {
    if (diaryId && entryId) {
      fetchEntry();
      fetchCorrections();
    }
  }, [diaryId, entryId]);

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
    if (!entryId || !diaryId) return;

    const entryRef = doc(db, "diaries", diaryId, "entries", entryId);
    const entrySnap = await getDoc(entryRef);
    
    if (entrySnap.exists()) {
      const entryData = entrySnap.data();
      setTitle(entryData.title || ""); // 📌 Cargar título si existe, si no dejar vacío
      setContent(entryData.content);
      setIsEditing(true);
    } else {
      alert("Entry not found.");
      router.push("/diary");
    }
};


  const fetchCorrections = async () => {
    if (!diaryId || !entryId) return;

    const correctionsRef = collection(db, "diaries", diaryId, "entries", entryId, "corrections");
    const correctionsSnap = await getDocs(correctionsRef);

    let correctionList = [];
    for (const correction of correctionsSnap.docs) {
      let correctionData = correction.data();
      
      // 🔎 Obtener nombre del corrector
      const correctorRef = doc(db, "users", correctionData.correctedBy);
      const correctorSnap = await getDoc(correctorRef);
      correctionData.correctorName = correctorSnap.exists() ? correctorSnap.data().username : "Unknown User";

      correctionList.push({
        id: correction.id,
        ...correctionData,
      });
    }

    setCorrections(correctionList);
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

    try {
      if (isEditing) {
        const entryRef = doc(db, "diaries", diaryId, "entries", entryId);
        await updateDoc(entryRef, { 
          title: title.trim() || "",  // 📌 Guardar título opcional
          content 
        });

        alert("Entry updated!");
      } else {
        await addDoc(collection(db, "diaries", diaryId, "entries"), {
          title: title.trim() || "",  // 📌 Guardar título opcional
          content,
          date: serverTimestamp(),
        });
        alert("Entry added!");
      }
      router.push("/diary");
    } catch (error) {
      console.error("Error saving entry:", error);
      alert("Failed to save entry.");
    }
};


  const handleDeleteEntry = async () => {
    if (!diaryId || !entryId) return;

    const confirmDelete = window.confirm("Are you sure you want to delete this entry?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "diaries", diaryId, "entries", entryId));
      alert("Entry deleted!");
      router.push("/diary");
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert("Failed to delete entry.");
    }
  };

  const markCorrectionAsRead = async (correctionId) => {
    const correctionRef = doc(db, "diaries", diaryId, "entries", entryId, "corrections", correctionId);
    await updateDoc(correctionRef, { read: true });

    // 🔄 Refrescar la lista de correcciones para actualizar el estado
    fetchCorrections();
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || !diaryId) return <p>Loading...</p>;

  return (
    <div className="container">
      {/* 🔥 MENÚ SUPERIOR 🔥 */}
      <nav style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#eee" }}>
        <h2>{isEditing ? "✏️ Edit Entry" : "📝 New Entry"}</h2>
        <div>
          <button onClick={() => router.push("/diary")}>📖 My Diary</button>
          <button onClick={() => router.push("/explore")}>🔍 Explore</button>
          <button onClick={() => router.push("/user")}>⚙️ Settings</button>
          <button onClick={handleLogout} style={{ background: "red", color: "white" }}>🚪 Logout</button>
        </div>
      </nav>

      <h3>Edit Your Entry</h3>
      {/* 📌 Nuevo campo para el título */}
      <input
        type="text"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ width: "100%", height: "150px", padding: "10px", marginBottom: "10px" }}
      />

      <button onClick={handleSaveEntry}>Save Changes</button>
      <button onClick={handleDeleteEntry} style={{ background: "red", color: "white", marginLeft: "10px" }}>🗑 Delete</button>

      {/* 🔥 Mostrar todas las correcciones recibidas */}
      {corrections.length > 0 && (
        <div style={{ marginTop: "20px", padding: "10px", border: "1px solid #ccc", background: "#f5f5f5" }}>
          <h3>💡 Suggested Corrections</h3>
          {corrections.map((correction) => (
            <div key={correction.id} style={{ borderTop: "1px solid #ddd", padding: "10px", marginBottom: "10px" }}>
              <p><strong>By:</strong> {correction.correctorName}</p>
              <textarea
                value={correction.content}
                readOnly
                style={{ width: "100%", height: "100px", padding: "10px", background: "#e6ffe6" }}
              />
              {!correction.read && (
                <button onClick={() => markCorrectionAsRead(correction.id)} style={{ marginTop: "10px" }}>
                  ✅ Mark as Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
