import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  children: ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar" aria-label="Разделы приложения">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">FL</div>
          <div>
            <strong>Лаборатория паттернов</strong>
            <span>React MVP</span>
          </div>
        </div>
        <nav className="side-nav">
          {["Сканер", "Сигналы", "Паттерны", "История", "Аналитика"].map((item, index) => (
            <button className={`nav-item ${index === 0 ? "is-active" : ""}`} type="button" key={item}>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="mobile-title">
            <div className="brand-mark" aria-hidden="true">FL</div>
            <div>
              <p className="eyebrow">Лаборатория футбольных паттернов</p>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="topbar-button" type="button">Обновить</button>
            <button className="topbar-button ghost" type="button">Профиль</button>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
