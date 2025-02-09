import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/router";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Explore() {
  const { user, loading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const router = useRouter();

  const handleSearch = async () => {
    if (!user) {
      alert("You must be logged in to search.");
      return;
    }

    if (!searchTerm.trim()) {
      alert("Please enter a username or diary ID.");
      return;
    }

    setResults([]); // Limpiar resultados previos

    // 📌 Buscar por `diaryId` (si el input es un ID exacto)
    const diaryRef = doc(db, "diaries", searchTerm);
    const diarySnap = await getDoc(diaryRef);

    if (diarySnap.exists()) {
      const diaryData = diarySnap.data();
      const userRef = doc(db, "users", diaryData.userId);
      const userSnap = await getDoc(userRef);
      const username = userSnap.exists() ? userSnap.data().username : "Unknown User";

      setResults([{ username, diaries: [{ id: diarySnap.id, ...diaryData }] }]);
      return;
    }

    // 📌 Buscar por `username`
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", searchTerm));
    const usersSnap = await getDocs(q);

    if (usersSnap.empty) {
      alert("No users or diaries found.");
      return;
    }

    let usersWithDiaries = [];
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const diariesQuery = query(collection(db, "diaries"), where("userId", "==", userDoc.id));
      const diariesSnap = await getDocs(diariesQuery);
      const diaries = diariesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      if (diaries.length > 0) {
        usersWithDiaries.push({ username: userData.username, diaries });
      }
    }

    setResults(usersWithDiaries);
  };

  const requestSubscription = async (diaryId) => {
    if (!user) {
      alert("You must be logged in to request a subscription.");
      return;
    }

    const requestsRef = collection(db, "diaries", diaryId, "subscription_requests");
    await addDoc(requestsRef, {
      userId: user.uid,
      username: user.displayName || user.email,
      status: "pending",
    });

    alert("Subscription request sent!");
  };

  const subscribeToDiary = async (diaryId) => {
    if (!user) {
      alert("You must be logged in to subscribe.");
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    let subscriptions = userSnap.exists() ? userSnap.data().subscriptions || [] : [];

    if (!subscriptions.includes(diaryId)) {
      subscriptions.push(diaryId);
      await setDoc(userRef, { subscriptions }, { merge: true });
      alert("Subscribed!");
      router.push("/diary");
    } else {
      alert("You are already subscribed to this diary.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {/* 🔥 MENÚ SUPERIOR 🔥 */}
      <nav style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#eee" }}>
        <h2>🔍 Explore Diaries</h2>
        <div>
          <button onClick={() => router.push("/diary")}>📖 My Diary</button>
          <button onClick={() => router.push("/user")}>⚙️ Settings</button>
          <button onClick={handleLogout} style={{ background: "red", color: "white" }}>🚪 Logout</button>
        </div>
      </nav>

      <h3>Find Diaries</h3>
      <input
        type="text"
        placeholder="Enter a username or diary ID"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <button onClick={handleSearch}>Search</button>

      {/* 🔥 Resultados de búsqueda 🔥 */}
      {results.length > 0 ? (
        results.map((userResult, index) => (
          <div key={index} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
            <h3>👤 {userResult.username}</h3>
            <h4>📖 Diaries:</h4>
            {userResult.diaries.map((diary) => (
              <div key={diary.id} style={{ marginBottom: "10px", padding: "10px", border: "1px solid #ddd" }}>
                <p><strong>Title:</strong> {diary.title}</p>
                <p>{diary.private ? "🔒 Private" : "🌍 Public"}</p>

                {diary.private ? (
                  <button onClick={() => requestSubscription(diary.id)}>Request Subscription</button>
                ) : (
                  <>
                    <button onClick={() => router.push(`/diary/${diary.id}`)}>View Diary</button>
                    <button onClick={() => subscribeToDiary(diary.id)}>Subscribe</button>
                  </>
                )}
              </div>
            ))}
          </div>
        ))
      ) : (
        <p>No results found.</p>
      )}
    </div>
  );
}
