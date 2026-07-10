import type { ReactNode } from "react";
import type { ReactNavItem, ReactViewId } from "../types";

type AppShellProps = {
  title: string;
  activeView: ReactViewId;
  navItems: ReactNavItem[];
  onViewChange: (viewId: ReactViewId) => void;
  children: ReactNode;
};

export function AppShell({ title, activeView, navItems, onViewChange, children }: AppShellProps) {
  return (
    <div className="app-shell react-app-shell">
      <aside className="desktop-sidebar" aria-label="Разделы приложения">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">FL</div>
          <div>
            <strong>Лаборатория паттернов</strong>
            <span>Live Scanner</span>
          </div>
        </div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              className={`nav-item ${item.id === activeView ? "is-active" : ""}`}
              type="button"
              key={item.id}
              onClick={() => onViewChange(item.id)}
            >
              {item.label}
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
            <button className="topbar-button ghost" type="button" onClick={() => onViewChange("profile")}>Профиль</button>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Нижняя навигация">
        {navItems.map((item) => (
          <button
            className={`nav-item ${item.id === activeView ? "is-active" : ""}`}
            type="button"
            key={item.id}
            onClick={() => onViewChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
