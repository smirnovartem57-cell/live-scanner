import { useState, type FormEvent } from "react";
import type { SupabaseAuthController } from "../hooks/useSupabaseAuth";

type AuthCardProps = {
  auth: SupabaseAuthController;
  title?: string;
  description?: string;
};

export function AuthCard({
  auth,
  title = "Аккаунт",
  description = "Войдите, чтобы связать настройки и историю с защищённой учётной записью."
}: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState<"sign-in" | "sign-up" | "sign-out" | null>(null);
  const [message, setMessage] = useState("");

  async function submit(mode: "sign-in" | "sign-up") {
    if (!email.trim() || password.length < 8) {
      setMessage("Укажите email и пароль не короче 8 символов.");
      return;
    }
    setSubmitting(mode);
    setMessage("");
    try {
      if (mode === "sign-in") {
        await auth.signIn(email, password);
        setMessage("Вход выполнен.");
      } else {
        const confirmationRequired = await auth.signUp(email, password);
        setMessage(confirmationRequired
          ? "Аккаунт создан. Подтвердите адрес по ссылке из письма."
          : "Аккаунт создан, вход выполнен.");
      }
    } catch {
      // The controller exposes a safe message in auth.error.
    } finally {
      setSubmitting(null);
    }
  }

  async function signOut() {
    setSubmitting("sign-out");
    setMessage("");
    try {
      await auth.signOut();
      setMessage("Вы вышли из аккаунта на этом устройстве.");
    } catch {
      // The controller exposes a safe message in auth.error.
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="panel auth-card">
      <p className="eyebrow">Supabase Auth</p>
      <h2>{title}</h2>
      <p className="muted">{description}</p>

      {!auth.configured ? (
        <p className="telegram-status is-warning">Сначала укажите Supabase URL и publishable key в настройках.</p>
      ) : auth.loading ? (
        <p className="muted">Проверяем сессию...</p>
      ) : auth.user ? (
        <div className="setting-stack">
          <span className="status-pill ok">Вход выполнен</span>
          <b>{auth.user.email || auth.user.id}</b>
          <button className="ghost-button" type="button" onClick={signOut} disabled={Boolean(submitting)}>
            {submitting === "sign-out" ? "Выходим..." : "Выйти на этом устройстве"}
          </button>
        </div>
      ) : (
        <form
          className="setting-stack"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void submit("sign-in");
          }}
        >
          <label className="input-label">
            Email
            <input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="input-label">
            Пароль
            <input
              type="password"
              value={password}
              minLength={8}
              autoComplete="current-password"
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className="auth-actions">
            <button className="primary-button" type="submit" disabled={Boolean(submitting)}>
              {submitting === "sign-in" ? "Входим..." : "Войти"}
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={Boolean(submitting)}
              onClick={() => void submit("sign-up")}
            >
              {submitting === "sign-up" ? "Создаём..." : "Создать аккаунт"}
            </button>
          </div>
        </form>
      )}

      {auth.error ? <p className="telegram-status is-warning">{auth.error}</p> : null}
      {message ? <p className="telegram-status is-ok">{message}</p> : null}
    </div>
  );
}
