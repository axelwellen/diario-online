import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  return (
    <div className="container">
      <nav className="nav-bar">
        <h2>📖 Diarlii</h2>
        <div>
          <button onClick={() => router.push("/login")} className="button-primary">Login</button>
          <button onClick={() => router.push("/register")} className="button-secondary">Register</button>
        </div>
      </nav>

      <header className="hero">
        <h1>✍️ Guarda tus pensamientos, recibe correcciones y suscríbete a otros diarios</h1>
        <p>Un espacio seguro para escribir, compartir y mejorar juntos. 🚀</p>
        <button onClick={() => router.push("/register")} className="button-cta">¡Empieza ahora!</button>
      </header>

      <section className="features">
        <div className="feature-card">
          <h3>📖 Diario Personal</h3>
          <p>Escribe y organiza tus pensamientos con un diseño intuitivo.</p>
        </div>

        <div className="feature-card">
          <h3>✏️ Correcciones</h3>
          <p>Permite que otros te ayuden a mejorar con sugerencias y comentarios.</p>
        </div>

        <div className="feature-card">
          <h3>🔔 Notificaciones</h3>
          <p>Recibe alertas cuando alguien corrija o publique una nueva entrada.</p>
        </div>
      </section>

      <footer className="footer">
        <p>© 2024 Diario Online - Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
