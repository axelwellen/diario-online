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
      setDiary({ id: diarySnap.id, ...diarySnap.data() });
      fetchEntries(diarySnap.id);
      checkPendingRequests(diaryId);
      checkUnreadCorrections(diarySnap.id); // 🔥 Agregado para revisar correcciones no leídas
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

      // 🔥 Obtener detalles de cada diario suscrito
      let details = [];
      for (const diaryId of subscriptionIds) {
        const diaryRef = doc(db, "diaries", diaryId);
        const diarySnap = await getDoc(diaryRef);
        if (diarySnap.exists()) {
          const diaryData = diarySnap.data();

          // 🔥 Obtener el nombre del usuario que escribe el diario
          const userRef = doc(db, "users", diaryData.userId);
          const userSnap = await getDoc(userRef);
          const username = userSnap.exists() ? userSnap.data().username : "Unknown User";

          details.push({ id: diarySnap.id, title: diaryData.title, username });
        }
      }
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
          <h3>{diary.title}</h3>
          <button onClick={() => router.push("/entry")}>📝 New Entry</button>
  
          <h4>Diary ID: {diaryId}</h4>
          <button onClick={copyToClipboard}>📋 Copy ID</button>
  
          <h3>Entries:</h3>
          {entries.length === 0 ? <p>No entries yet.</p> : (
            entries.map(entry => (
                <div key={entry.id} className={`card ${unreadCorrections.includes(entry.id) ? "highlight" : ""}`}>
                    <p><strong>Date:</strong> {entry.date?.toDate().toLocaleString()}</p>
                    <p><strong>Content:</strong> {entry.content}</p>

                    {/* 🔥 Mostrar cantidad de likes */}
                    <h4>❤️ {entry.likedBy.length} Likes</h4>

                    {/* 🔥 Mostrar comentarios si existen */}
                    <h4>💬 Comments</h4>
                    {entry.comments.length === 0 ? (
                        <p>No comments yet.</p>
                    ) : (
                        entry.comments.map(comment => (
                            <div key={comment.id} className="comment-box">
                                <p><strong>{comment.username}:</strong> {comment.text}</p>
                            </div>
                        ))
                    )}

                    <button onClick={() => router.push(`/entry/${entry.id}`)}>✏️ Edit</button>
                    {unreadCorrections.includes(entry.id) && <span className="pending-review">🔔 Pending Review</span>}
                  </div>
                 ))
                )}

        </>
      ) : (
        <p>Loading diary...</p>
      )}
  
      <h3>Subscribed Diaries</h3>
      {subscriptionDetails.length === 0 ? (
        <p>You are not subscribed to any diaries.</p>
      ) : (
        subscriptionDetails.map((diary) => (
          <div key={diary.id} className="card">
            <p>📖 <strong>{diary.title}</strong> by <em>{diary.username}</em></p>
            <button onClick={() => router.push(`/diary/${diary.id}`)}>View</button>
            <button onClick={() => cancelSubscription(diary.id)} className="unsubscribe-btn">
              Unsubscribe
            </button>
          </div>
        ))
      )}
    </div>
  );
  
}
