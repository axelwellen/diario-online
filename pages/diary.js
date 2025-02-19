import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/router";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { doc, collection, getDoc, getDocs, setDoc } from "firebase/firestore";
import { query, orderBy } from "firebase/firestore";

export default function Diary() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [diary, setDiary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [diaryId, setDiaryId] = useState("");
  const [hasPendingRequests, setHasPendingRequests] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState([]); // 🔥 Guardar info de diarios suscritos
  const [unreadCorrections, setUnreadCorrections] = useState([]); // 🔥 Correcciones no leídas
// voy a intentar animar las entradas
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSubIndex, setCurrentSubIndex] = useState(0);
  const itemsPerPage = 5; // 🔥 Número de diarios por página
  
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchDiary();
    fetchSubscriptions();
  }, [user, loading]);

  const fetchDiary = async () => {
    if (!user) return;
  
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
  
    if (!userSnap.exists() || !userSnap.data().diaryId) {
      alert("No diary found for this user.");
      return;
    }
  
    const diaryId = userSnap.data().diaryId;
    setDiaryId(diaryId);
  
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);
  
    if (diarySnap.exists()) {
      setDiary({
        id: diarySnap.id,
        title: diarySnap.data().title,
        description: diarySnap.data().description || "No description available.", // 🔥 Añadir descripción
        language: diarySnap.data().language || "Unknown", // 🔥 Guardamos el idioma
        ...diarySnap.data(),
      });
  
      fetchEntries(diarySnap.id);
      checkPendingRequests(diaryId);
      checkUnreadCorrections(diarySnap.id);
    } else {
      alert("Diary not found.");
    }
  };
  

  const fetchEntries = async (diaryId) => {
    const entriesRef = collection(db, "diaries", diaryId, "entries");
    const q = query(entriesRef, orderBy("date", "desc")); // 🔥 Ordenar por fecha descendente
    const entriesSnap = await getDocs(q);

    let entriesList = entriesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        likedBy: doc.data().likedBy || [],
        comments: [] // ✅ Inicializamos los comentarios
    }));

    // 🔥 Obtener comentarios para cada entrada
    for (let entry of entriesList) {
        const commentsRef = collection(db, "diaries", diaryId, "entries", entry.id, "comments");
        const commentsSnap = await getDocs(commentsRef);

        entry.comments = commentsSnap.docs.map(commentDoc => ({
            id: commentDoc.id,
            ...commentDoc.data()
        }));
    }

    setEntries(entriesList);
};

  

  const checkUnreadCorrections = async (diaryId) => {
    const entriesRef = collection(db, "diaries", diaryId, "entries");
    const entriesSnap = await getDocs(entriesRef);

    let unreadEntries = [];
    for (const entry of entriesSnap.docs) {
      const correctionsRef = collection(entry.ref, "corrections");
      const correctionsSnap = await getDocs(correctionsRef);

      const hasUnreadCorrections = correctionsSnap.docs.some(correction => !correction.data().read);
      
      if (hasUnreadCorrections) {
        unreadEntries.push(entry.id);
      }
    }
    setUnreadCorrections(unreadEntries);
  };

  const fetchSubscriptions = async () => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
  
    if (userSnap.exists() && userSnap.data().subscriptions) {
      const subscriptionIds = userSnap.data().subscriptions;
      setSubscriptions(subscriptionIds);
  
      let details = [];
      for (const diaryId of subscriptionIds) {
        const diaryRef = doc(db, "diaries", diaryId);
        const diarySnap = await getDoc(diaryRef);
        if (diarySnap.exists()) {
          const diaryData = diarySnap.data();
  
          // 🔥 Buscar notificaciones en la colección correcta
          const notificationRef = doc(db, "users", user.uid, "notifications", diaryId);
          const notificationSnap = await getDoc(notificationRef);
          const hasUnreadEntries = notificationSnap.exists() ? notificationSnap.data().unread : false;
  
          // 🔥 Obtener el nombre del usuario dueño del diario
          const diaryOwnerRef = doc(db, "users", diaryData.userId);
          const diaryOwnerSnap = await getDoc(diaryOwnerRef);
          const username = diaryOwnerSnap.exists() ? diaryOwnerSnap.data().username : "Unknown User";
  
          details.push({
            id: diarySnap.id,
            title: diaryData.title,
            description: diaryData.description || "",
            language: diarySnap.data().language || "Unknown",
            username,
            hasUnreadEntries, // 🔥 Agregar si hay entradas no leídas
          });
        }
      }
  
      // 🔥 Ordenar los diarios: primero los que tienen nuevas entradas
      details.sort((a, b) => b.hasUnreadEntries - a.hasUnreadEntries);
  
      setSubscriptionDetails(details);
    }
  };
  
  
  

  const checkPendingRequests = async (diaryId) => {
    const requestsRef = collection(db, "diaries", diaryId, "subscription_requests");
    const requestsSnap = await getDocs(requestsRef);

    if (!requestsSnap.empty) {
      setHasPendingRequests(true);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };
  const handleViewDiary = async (diaryId) => {
    // 🔥 Marcar notificación como leída
    const notificationRef = doc(db, "users", user.uid, "notifications", diaryId);
    await setDoc(notificationRef, { unread: false }, { merge: true });
  
    // 🔄 Actualizar la lista de suscripciones para quitar la marca de nuevas entradas
    fetchSubscriptions();
  
    // 📌 Redirigir al diario
    router.push(`/diary/${diaryId}`);
  };
  
  const cancelSubscription = async (diaryId) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      let subscriptions = userSnap.data().subscriptions || [];
      subscriptions = subscriptions.filter(id => id !== diaryId);

      await setDoc(userRef, { subscriptions }, { merge: true });
      alert("Subscription canceled!");
      fetchSubscriptions();
    }
  };
  const nextSubscriptions = () => {
    if (currentSubIndex + itemsPerPage < subscriptionDetails.length) {
      setCurrentSubIndex(currentSubIndex + itemsPerPage);
    }
  };
  
  const prevSubscriptions = () => {
    if (currentSubIndex > 0) {
      setCurrentSubIndex(currentSubIndex - itemsPerPage);
    }
  };
  
  const nextEntry = () => {
    if (currentIndex < entries.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const prevEntry = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(diaryId);
    alert("Diary ID copied to clipboard!");
  };
  const navigateToLatestUnreadCorrection = () => {
    if (unreadCorrections.length > 0) {
      router.push(`/entry/${unreadCorrections[0]}`); // 🔥 Ir a la primera entrada con corrección no leída
    }
  };
  if (loading) return <p>Loading session...</p>;

  return (
    <div className="container">
      {/* 🔥 MENÚ SUPERIOR CON NOTIFICACIÓN 🔥 */}
      <nav>
        <h2>📖 My Diary</h2>
        <div>
          <button onClick={() => router.push("/explore")}>🔍 Explore</button>
          <button onClick={() => router.push("/user")}>
            ⚙️ Settings {hasPendingRequests && "🛎️"}
          </button>
          <button onClick={handleLogout} className="logout-btn">🚪 Logout</button>
        </div>
      </nav>
  
      {/* 🔥 Notificación de correcciones pendientes 🔥 */}
      {unreadCorrections.length > 0 && (
        <div className="alert alert-info">
          📌 You have unread corrections! <button onClick={navigateToLatestUnreadCorrection}>Review now</button>
        </div>
      )}
  
      {/* 🔥 Mostrar Alerta de Peticiones de Suscripción 🔥 */}
      {hasPendingRequests && (
        <div className="alert alert-warning">
          🛎️ You have pending subscription requests! Check your <button onClick={() => router.push("/user")}>Settings</button>
        </div>
      )}
  
      {diary ? (
        <>
          <h3>
            {diary.title} <span style={{ fontSize: "0.8em", color: "#666" }}>({diary.language || "Unknown"})</span>
          </h3>

          <p className="diary-description">{diary.description}</p> {/* 🔥 Mostrar la descripción */}
          <button onClick={() => router.push("/entry")}>📝 New Entry</button>
          <h4>Diary ID: {diaryId}</h4>
          <button onClick={copyToClipboard}>📋 Copy ID</button>
  
          <h3>Entries:</h3>
          {entries.length === 0 ? (
          <p>No entries yet.</p>
        ) : (
          <div className="entry-slider">
            {/* 🔥 Botón para ir a la entrada anterior */}
            <button onClick={prevEntry} disabled={currentIndex === 0} className="arrow left-arrow"></button>

            {/* 🔥 Entrada actual */}
            <div key={entries[currentIndex].id} className={`card ${unreadCorrections.includes(entries[currentIndex].id) ? "highlight" : ""}`}>
              <p><strong>Date:</strong> {entries[currentIndex].date?.toDate().toLocaleString()}</p>

              {/* 🔥 Mostrar el título si existe */}
              {entries[currentIndex].title && <h3>{entries[currentIndex].title}</h3>}

              {/* 🔥 Mostrar el contenido de la entrada */}
              <p className="entry-content">{entries[currentIndex].content}</p>

              {/* 🔥 Mostrar cantidad de likes */}
              <h4>❤️ {entries[currentIndex].likedBy.length} Likes</h4>

              {/* 🔥 Mostrar comentarios si existen */}
              <h4>💬 Comments</h4>
              {entries[currentIndex].comments.length === 0 ? (
                <p>No comments yet.</p>
              ) : (
                entries[currentIndex].comments.map(comment => (
                  <div key={comment.id} className="comment-box">
                    <p><strong>{comment.username}:</strong> {comment.text}</p>
                  </div>
                ))
              )}

              <button onClick={() => router.push(`/entry/${entries[currentIndex].id}`)}>✏️ Edit</button>
              {unreadCorrections.includes(entries[currentIndex].id) && <span className="pending-review">🔔 Pending Review</span>}
            </div>

            {/* 🔥 Botón para ir a la entrada siguiente */}
            <button onClick={nextEntry} disabled={currentIndex === entries.length - 1} className="arrow right-arrow"></button>
          </div>
        )}


        </>
      ) : (
        <p>Loading diary...</p>
      )}
  
      <h3>Subscribed Diaries</h3>

      {subscriptionDetails.length === 0 ? (
  <p>You are not subscribed to any diaries.</p>
) : (
  <div className="entry-slider">
    <button onClick={prevSubscriptions} disabled={currentSubIndex === 0} className="arrow left-arrow"></button>

    <div className="subscribed-container">
      {subscriptionDetails.slice(currentSubIndex, currentSubIndex + itemsPerPage).map((diary) => (
        <div key={diary.id} className={`card ${diary.hasUnreadEntries ? "highlight" : ""}`}>
          
          <p>📖 <strong>{diary.title}</strong> 
            <span style={{ fontSize: "0.8em", color: "#666" }}> ({diary.language || "Unknown"})</span> 
            <span> by</span> <em>{diary.username}</em>
          </p>
          <p className="diary-description">{diary.description}</p>
          <button onClick={() => handleViewDiary(diary.id)}>View</button>
          <button onClick={() => cancelSubscription(diary.id)} className="unsubscribe-btn">
            Unsubscribe
          </button>
          {diary.hasUnreadEntries && (
            <span style={{ color: "red", fontWeight: "bold", background: "#ffecec", padding: "5px 8px", borderRadius: "5px" }}>
              🔥 New Entry!
            </span>
          )}
        </div>
      ))}
    </div>

    <button onClick={nextSubscriptions} disabled={currentSubIndex + itemsPerPage >= subscriptionDetails.length} className="arrow right-arrow"></button>
  </div>
)}


    </div>
  );
  
}
