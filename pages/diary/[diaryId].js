import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { doc, collection, getDoc, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function ViewDiary() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { diaryId } = router.query;
  const [diary, setDiary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [commentTexts, setCommentTexts] = useState({}); // Estado para comentarios

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (diaryId) fetchDiary();
  }, [user, loading, diaryId]);

  const fetchDiary = async () => {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) {
      alert("This diary does not exist.");
      router.push("/diary");
      return;
    }

    const diaryData = diarySnap.data();
    setDiary({ id: diarySnap.id, ...diaryData });

    checkSubscription();

    if (!diaryData.private) {
      setIsAuthorized(true);
      fetchEntries(diaryId);
      return;
    }

    checkSubscription();
  };

  const checkSubscription = async () => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().subscriptions) {
      const userSubscriptions = userSnap.data().subscriptions;
      setIsSubscribed(userSubscriptions.includes(diaryId));

      if (userSubscriptions.includes(diaryId)) {
        setIsAuthorized(true);
        fetchEntries(diaryId);
      }
    }
  };

  const fetchEntries = async (diaryId) => {
    const entriesRef = collection(db, "diaries", diaryId, "entries");
    const entriesSnap = await getDocs(entriesRef);

    const entriesList = entriesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      comments: [],
    }));

    setEntries(entriesList);
    fetchComments(entriesList);
  };

  const fetchComments = async (entriesList) => {
    for (const entry of entriesList) {
      const commentsRef = collection(db, "diaries", diaryId, "entries", entry.id, "comments");
      const commentsSnap = await getDocs(commentsRef);

      const comments = commentsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setEntries(prevEntries =>
        prevEntries.map(e =>
          e.id === entry.id ? { ...e, comments } : e
        )
      );
    }
  };

  const handleLike = async (entryId, likedBy) => {
    const entryRef = doc(db, "diaries", diaryId, "entries", entryId);

    if (likedBy.includes(user.uid)) {
      await updateDoc(entryRef, {
        likedBy: arrayRemove(user.uid),
      });
    } else {
      await updateDoc(entryRef, {
        likedBy: arrayUnion(user.uid),
      });
    }

    fetchEntries(diaryId);
  };

  const handleComment = async (entryId) => {
    const commentText = commentTexts[entryId] || "";

    if (!commentText.trim()) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const username = userSnap.exists() ? userSnap.data().username : "Anonymous";

    const commentsRef = collection(db, "diaries", diaryId, "entries", entryId, "comments");
    await addDoc(commentsRef, {
      userId: user.uid,
      username: username,
      text: commentText,
      timestamp: new Date(),
    });

    setCommentTexts(prev => ({ ...prev, [entryId]: "" })); // 🔥 Borrar input tras enviar
    fetchEntries(diaryId);
  };

  const handleSubscription = async () => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    let subscriptions = userSnap.exists() ? userSnap.data().subscriptions || [] : [];

    if (isSubscribed) {
      subscriptions = subscriptions.filter(id => id !== diaryId);
    } else {
      subscriptions.push(diaryId);
    }

    await updateDoc(userRef, { subscriptions });

    setIsSubscribed(!isSubscribed);
    alert(isSubscribed ? "Unsubscribed!" : "Subscribed!");
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <nav style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#eee" }}>
        <h2>📖 Viewing Diary</h2>
        <div>
          <button onClick={() => router.push("/diary")}>📖 My Diary</button>
          <button onClick={() => router.push("/explore")}>🔍 Explore</button>
          <button onClick={() => router.push("/user")}>⚙️ Settings</button>
          <button onClick={handleLogout} style={{ background: "red", color: "white" }}>🚪 Logout</button>
        </div>
      </nav>

      {diary && isAuthorized ? (
        <>
          <h2>{diary.title}</h2>
          <p>{diary.private ? "🔒 Private Diary" : "🌍 Public Diary"}</p>

          {/* 🔥 Botón de Suscribirse/Desuscribirse */}
          <button onClick={handleSubscription} style={{ marginBottom: "10px" }}>
            {isSubscribed ? "Unsubscribe" : "Subscribe"}
          </button>

          <h3>Entries:</h3>
          {entries.length === 0 ? (
            <p>No entries yet.</p>
          ) : (
            entries.map(entry => (
              <div key={entry.id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
                <p><strong>Date:</strong> {entry.date?.toDate().toLocaleString()}</p>
                <p><strong>Content:</strong> {entry.content}</p>

                {/* 🔥 Botón de Like con marcador cuando está activo */}
                <button
                  onClick={() => handleLike(entry.id, entry.likedBy || [])}
                  style={{
                    background: entry.likedBy?.includes(user.uid) ? "red" : "white",
                    color: entry.likedBy?.includes(user.uid) ? "white" : "black",
                    border: "1px solid #ccc",
                    padding: "5px 10px",
                    cursor: "pointer"
                  }}
                >
                  ❤️ Like {entry.likedBy?.length || 0}
                </button>
                <button onClick={() => router.push(`/correct/${entry.id}`)}>📝 Correct</button>
                {/* 🔥 Sección de Comentarios */}
                <h4>Comments</h4>
                {entry.comments.length === 0 ? <p>No comments yet.</p> : (
                  entry.comments.map(comment => (
                    <div key={comment.id} style={{ borderTop: "1px solid #ddd", padding: "5px" }}>
                      <p><strong>{comment.username}</strong>: {comment.text}</p>
                    </div>
                  ))
                )}

                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={commentTexts[entry.id] || ""}
                  onChange={(e) => setCommentTexts(prev => ({ ...prev, [entry.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleComment(entry.id);
                  }}
                />
                <button onClick={() => handleComment(entry.id)}>Send</button>
              </div>
            ))
          )}
        </>
      ) : (
        <p>Loading diary...</p>
      )}
    </div>
  );
}
