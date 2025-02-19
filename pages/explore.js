import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/router";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, orderBy, limit } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
//checkpoint
export default function Explore() {
  const { user, loading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const router = useRouter();
  const [trendingDiaries, setTrendingDiaries] = useState([]); // 🔥 Para almacenar los diarios con más actividad
  
  useEffect(() => {
    if (!loading) {
      fetchTrendingDiaries();
    }
  }, [loading]);
  const fetchUserSubscriptions = async () => {
    if (!user) return [];
  
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
  
    if (userSnap.exists()) {
      return userSnap.data().subscriptions || [];
    }
  
    return [];
  };
  
  const fetchTrendingDiaries = async () => {
    if (!user) return; // Asegurar que el usuario está autenticado antes de continuar
  
    const userSubscriptions = await fetchUserSubscriptions(); // 🔥 Obtener suscripciones del usuario actual
  
    const diariesRef = collection(db, "diaries");
    const diariesSnap = await getDocs(diariesRef);
  
    let recentEntries = [];
  
    for (const diaryDoc of diariesSnap.docs) {
      const diaryData = diaryDoc.data();
  
      // 🔥 Consultar la última entrada publicada en cada diario
      const entriesRef = collection(db, "diaries", diaryDoc.id, "entries");
      const entriesQuery = query(entriesRef, orderBy("date", "desc"), limit(1)); 
      const entriesSnap = await getDocs(entriesQuery);
  
      if (!entriesSnap.empty) {
        const lastEntry = entriesSnap.docs[0].data();
  
        // 🔥 Obtener el usuario dueño del diario
        const ownerRef = doc(db, "users", diaryData.userId);
        const ownerSnap = await getDoc(ownerRef);
        const ownerName = ownerSnap.exists() ? ownerSnap.data().username : "Unknown User";
  
        recentEntries.push({
          diaryId: diaryDoc.id,
          userId: diaryData.userId,
          ownerName, // 🔥 Agregar el nombre del dueño del diario
          title: diaryData.title,
          description: diaryData.description || "No description available.",
          private: diaryData.private, 
          language: diaryData.language || "Unknown",
          lastUpdated: lastEntry.date?.toDate() || new Date(), 
          isSubscribed: userSubscriptions.includes(diaryDoc.id), // 🔥 Ahora sí verificamos correctamente
        });
      }
    }
  
    // 🔥 Ordenar por fecha de última actualización (más reciente primero)
    recentEntries.sort((a, b) => b.lastUpdated - a.lastUpdated);
  
    // 🔥 Guardar en el estado
    setTrendingDiaries(recentEntries.slice(0, 5)); 
  };
  
  
  
  
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
  
    // 🔥 Obtener las suscripciones del usuario actual
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userSubscriptions = userSnap.exists() ? userSnap.data().subscriptions || [] : [];
  
    // 📌 Buscar por `diaryId` (si el input es un ID exacto)
    const diaryRef = doc(db, "diaries", searchTerm);
    const diarySnap = await getDoc(diaryRef);
  
    if (diarySnap.exists()) {
      const diaryData = diarySnap.data();
      const userRef = doc(db, "users", diaryData.userId);
      const userSnap = await getDoc(userRef);
      const username = userSnap.exists() ? userSnap.data().username : "Unknown User";
  
      setResults([{ 
        username, 
        diaries: [{ 
          id: diarySnap.id, 
          title: diaryData.title, 
          description: diaryData.description || "No description available.", 
          private: diaryData.private,
          language: diaryData.language || "Unknown", // 🔥 Añadir idioma
          isSubscribed: userSubscriptions.includes(diarySnap.id) // 🔥 Verificar si ya está suscrito
        }] 
      }]);
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
      const diaries = diariesSnap.docs.map((doc) => ({ 
        id: doc.id, 
        title: doc.data().title, 
        description: doc.data().description || "No description available.",
        private: doc.data().private,
        language: doc.data().language || "Unknown", // 🔥 Añadir idioma
        isSubscribed: userSubscriptions.includes(doc.id) // 🔥 Verificar si ya está suscrito
      }));
  
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

    // 🔥 Obtener el username desde la base de datos
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
  
    let username = userSnap.exists() ? userSnap.data().username : user.email; // Preferir username si existe
  
    const requestsRef = collection(db, "diaries", diaryId, "subscription_requests");
    await addDoc(requestsRef, {
      userId: user.uid,
      username: username, // ✅ Ahora siempre guardamos el username correcto
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
    <div className="container">
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
          <p><strong>Language:</strong> {diary.language}</p> {/* 🔥 Mostrar el idioma */}
          <p><strong>Description:</strong> {diary.description}</p> {/* 🔥 Mostrar la descripción */}
          <p>{diary.private ? "🔒 Private" : "🌍 Public"}</p>

          {diary.private ? (
            diary.isSubscribed ? ( // 🔥 Si está suscrito, mostrar "View Diary"
              <button onClick={() => router.push(`/diary/${diary.id}`)}>View Diary</button>
            ) : (
              <button onClick={() => requestSubscription(diary.id)}>Request Subscription</button>
            )
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
<h3>🔥 Trending Diaries</h3>
{trendingDiaries.length > 0 ? (
  trendingDiaries.map((diary, index) => (
    <div key={index} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
      <h3>📖 {diary.title}</h3>
      <p><strong>👤 Owner:</strong> {diary.ownerName}</p> {/* 🔥 Mostrar el dueño del diario */}
      <p><strong>🌍 Language:</strong> {diary.language}</p>
      <p><strong>📄 Description:</strong> {diary.description || "No description available."}</p>
      <p>{diary.private ? "🔒 Private" : "🌍 Public"}</p>

      {diary.private ? (
        diary.isSubscribed ? ( // 🔥 Si el usuario está suscrito, permitir ver el diario
          <button onClick={() => router.push(`/diary/${diary.diaryId}`)}>View Diary</button>
        ) : (
          <button onClick={() => requestSubscription(diary.diaryId)}>Request Subscription</button>
        )
      ) : (
        <>
          <button onClick={() => router.push(`/diary/${diary.diaryId}`)}>View Diary</button>
          {!diary.isSubscribed && <button onClick={() => subscribeToDiary(diary.diaryId)}>Subscribe</button>}
        </>
      )}
    </div>
  ))
) : (
  <p>No trending diaries yet.</p>
)}


    </div>
  );
}
