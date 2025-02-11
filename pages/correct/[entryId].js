import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { doc, collection, getDoc, getDocs, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function CorrectEntry() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { entryId } = router.query;
  const [diaryId, setDiaryId] = useState(null);
  const [originalContent, setOriginalContent] = useState("");
  const [correctedContent, setCorrectedContent] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    findDiaryId();
  }, [user, loading, entryId]);

  const findDiaryId = async () => {
    if (!entryId) return;

    // 🔎 Buscar en Firestore en qué diario está la entrada
    const diariesRef = collection(db, "diaries");
    const diariesSnapshot = await getDocs(diariesRef);

    let foundDiaryId = null;
    for (const docSnap of diariesSnapshot.docs) {
      const entriesRef = collection(docSnap.ref, "entries");
      const entrySnap = await getDoc(doc(entriesRef, entryId));

      if (entrySnap.exists()) {
        foundDiaryId = docSnap.id;
        break;
      }
    }

    if (!foundDiaryId) {
      alert("Entry not found.");
      router.push("/diary");
      return;
    }

    setDiaryId(foundDiaryId);
    fetchEntry(foundDiaryId);
  };

  const fetchEntry = async (diaryId) => {
    if (!diaryId || !entryId) return;

    const entryRef = doc(db, "diaries", diaryId, "entries", entryId);
    const entrySnap = await getDoc(entryRef);

    if (entrySnap.exists()) {
      setOriginalContent(entrySnap.data().content);

      // Buscar si este usuario ya ha hecho una corrección
      const correctionRef = doc(db, "diaries", diaryId, "entries", entryId, "corrections", user.uid);
      const correctionSnap = await getDoc(correctionRef);

      if (correctionSnap.exists()) {
        setCorrectedContent(correctionSnap.data().content);
      }
    } else {
      alert("Entry not found.");
      router.push("/diary");
    }
  };

  const sendEmailNotification = async (to, subject, message) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message }),
      });
    } catch (error) {
      console.error("Error sending email:", error);
    }
  };
  
  const handleSaveCorrection = async () => {
    if (!diaryId || !entryId || !correctedContent.trim()) return;
  
    const correctionRef = doc(db, "diaries", diaryId, "entries", entryId, "corrections", user.uid);
    await setDoc(correctionRef, {
      content: correctedContent,
      correctedBy: user.uid,
      correctedAt: new Date(),
    });
  
    // 🔥 Obtener el email del dueño del diario
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);
  
    if (!diarySnap.exists()) return;
    const diaryOwnerId = diarySnap.data().userId;
  
    const ownerRef = doc(db, "users", diaryOwnerId);
    const ownerSnap = await getDoc(ownerRef);
  
    if (!ownerSnap.exists()) return;
    const ownerEmail = ownerSnap.data().email;
  
    // 🔥 Enviar el correo al dueño del diario
    await sendEmailNotification(
      ownerEmail,
      "Someone corrected your diary entry!",
      `User ${user.email} corrected your entry. Log in to see the changes.`
    );
  
    alert("Correction saved and email sent!");
    router.push(`/diary/${diaryId}`);
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
        <h2>✏️ Correct Entry</h2>
        <div>
          <button onClick={() => router.push(`/diary/${diaryId}`)}>📖 Back to Diary</button>
          <button onClick={() => router.push("/explore")}>🔍 Explore</button>
          <button onClick={() => router.push("/user")}>⚙️ Settings</button>
          <button onClick={handleLogout} style={{ background: "red", color: "white" }}>🚪 Logout</button>
        </div>
      </nav>

      <h3>Original Entry</h3>
      <textarea
        value={originalContent}
        readOnly
        style={{ width: "100%", height: "150px", padding: "10px", background: "#f0f0f0", marginBottom: "10px" }}
      />

      <h3>Your Correction</h3>
      <textarea
        placeholder="Write your correction here..."
        value={correctedContent}
        onChange={(e) => setCorrectedContent(e.target.value)}
        style={{ width: "100%", height: "150px", padding: "10px", marginBottom: "10px" }}
      />

      <button onClick={handleSaveCorrection}>Save Correction</button>
      <button onClick={() => router.push(`/diary/${diaryId}`)} style={{ marginLeft: "10px" }}>Cancel</button>
    </div>
  );
}
