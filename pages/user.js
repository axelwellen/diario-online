import { useState, useEffect } from "react"; 
import { useAuth } from "../context/AuthContext"; 
import { useRouter } from "next/router";
import { db } from "../lib/firebase";
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc, setDoc, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function UserSettings() {
  const { user, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [diary, setDiary] = useState(null);
  const [diaryId, setDiaryId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [subscriptionRequests, setSubscriptionRequests] = useState([]);
  const [subscribers, setSubscribers] = useState([]); // 🔥 Lista de suscriptores
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchUserData();
  }, [user, loading]);

  const fetchUserData = async () => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists() || !userSnap.data().diaryId) {
      alert("No diary found for this user.");
      return;
    }

    const userData = userSnap.data();
    setUsername(userData.username || "");
    setNewUsername(userData.username || "");
    setDiaryId(userData.diaryId);

    const diaryRef = doc(db, "diaries", userData.diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (diarySnap.exists()) {
      const diaryData = diarySnap.data();
      setDiary(diaryData);
      setNewTitle(diaryData.title);
      setIsPrivate(diaryData.private);
      fetchSubscriptionRequests(userData.diaryId);
      fetchSubscribers(userData.diaryId); // 🔥 Obtener suscriptores
    } else {
      alert("Diary not found.");
    }
  };

  const fetchSubscriptionRequests = async (diaryId) => {
    const requestsRef = collection(db, "diaries", diaryId, "subscription_requests");
    const requestsSnap = await getDocs(requestsRef);

    setSubscriptionRequests(
      requestsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
  };

  const fetchSubscribers = async (diaryId) => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("subscriptions", "array-contains", diaryId));
    const querySnapshot = await getDocs(q);

    const subscriberList = querySnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().username || "Unknown User",
    }));

    setSubscribers(subscriberList);
  };

  const approveSubscription = async (requestId, userId) => {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    let subscriptions = userSnap.exists() ? userSnap.data().subscriptions || [] : [];

    subscriptions.push(diaryId);
    await setDoc(userRef, { subscriptions }, { merge: true });

    await deleteDoc(doc(db, "diaries", diaryId, "subscription_requests", requestId));

    alert("Subscription approved!");
    fetchSubscriptionRequests(diaryId);
    fetchSubscribers(diaryId); // 🔥 Actualizar lista de suscriptores
  };

  const rejectSubscription = async (requestId) => {
    await deleteDoc(doc(db, "diaries", diaryId, "subscription_requests", requestId));
    alert("Subscription rejected!");
    fetchSubscriptionRequests(diaryId);
  };

  const removeSubscriber = async (subscriberId) => {
    const userRef = doc(db, "users", subscriberId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      let subscriptions = userSnap.data().subscriptions || [];
      subscriptions = subscriptions.filter(id => id !== diaryId);

      await setDoc(userRef, { subscriptions }, { merge: true });
      alert("Subscriber removed!");
      fetchSubscribers(diaryId); // 🔥 Actualizar lista de suscriptores
    }
  };

  const handleUpdateDiary = async () => {
    if (!diaryId) {
      alert("Error: No diary ID found.");
      return;
    }

    try {
      const diaryRef = doc(db, "diaries", diaryId);
      await updateDoc(diaryRef, {
        title: newTitle,
        private: isPrivate,
      });

      alert("Diary updated!");
      router.push("/diary");
    } catch (error) {
      console.error("Error updating diary:", error);
      alert("Failed to update diary.");
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      alert("Username cannot be empty.");
      return;
    }

    if (newUsername === username) {
      alert("No changes detected.");
      return;
    }

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", newUsername));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      alert("This username is already taken. Please choose another one.");
      return;
    }

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { username: newUsername });

      alert("Username updated!");
      setUsername(newUsername);
    } catch (error) {
      console.error("Error updating username:", error);
      alert("Failed to update username.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || !diaryId) return <p>Loading settings...</p>;

  return (
    <div>
      <nav style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#eee" }}>
        <h2>⚙️ User Settings</h2>
        <div>
          <button onClick={() => router.push("/diary")}>📖 My Diary</button>
          <button onClick={() => router.push("/explore")}>🔍 Explore</button>
          <button onClick={handleLogout} style={{ background: "red", color: "white" }}>🚪 Logout</button>
        </div>
      </nav>

      <h3>Edit Username</h3>
      <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
      <button onClick={handleUpdateUsername}>Save</button>

      <h3>Edit Diary Settings</h3>
      <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
      <label>
        <input type="checkbox" checked={isPrivate} onChange={() => setIsPrivate(!isPrivate)} />
        Private Diary
      </label>
      <button onClick={handleUpdateDiary}>Save</button>

      <h3>Pending Subscription Requests</h3>
        {/* 🔥 Notificación de solicitudes pendientes de suscripción 🔥 */}
        {subscriptionRequests.length > 0 && (
        <div style={{ background: "yellow", padding: "10px", margin: "10px 0", borderRadius: "5px" }}>
          🛎️ You have {subscriptionRequests.length} pending subscription requests!
        </div>
      )}
      {subscriptionRequests.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        subscriptionRequests.map(request => (
          <div key={request.id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <p>👤 {request.username} wants to subscribe</p>
            <button onClick={() => approveSubscription(request.id, request.userId)} style={{ background: "green", color: "white" }}>
              ✅ Approve
            </button>
            <button onClick={() => rejectSubscription(request.id)} style={{ background: "red", color: "white" }}>
              ❌ Reject
            </button>
          </div>
        ))
      )}
      <h3>Subscribers</h3>
      {subscribers.length === 0 ? (
        <p>No subscribers yet.</p>
      ) : (
        subscribers.map(subscriber => (
          <div key={subscriber.id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <p>👤 {subscriber.username}</p>
            <button onClick={() => removeSubscriber(subscriber.id)} style={{ background: "gray", color: "white" }}>
              ❌ Remove
            </button>
          </div>
        ))
      )}
      

    </div>
  );
}
