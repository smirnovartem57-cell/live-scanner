import type { ReactNode } from "react";
import type { ReactNavItem, ReactViewId } from "../types";

type AppShellProps = {
  title: string;
  activeView: ReactViewId;
  navItems: ReactNavItem[];
  onViewChange: (viewId: ReactViewId) => void;
  onRefresh: () => void;
  refreshing: boolean;
  sourceLabel: string;
  updatedLabel: string;
  children: ReactNode;
};

export function AppShell({ title, activeView, navItems, onViewChange, onRefresh, refreshing, sourceLabel, updatedLabel, children }: AppShellProps) {
  return (
    <div className="app-shell react-app-shell">
      <aside className="desktop-sidebar" aria-label="Разделы приложения">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <img src="/icons/live-scanner-icon-192.png" alt="" />
          </div>
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
            <div className="brand-mark" aria-hidden="true">
              <img src="/icons/live-scanner-icon-192.png" alt="" />
            </div>
            <div>
              <p className="eyebrow">Лаборатория футбольных паттернов</p>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="data-status" aria-live="polite">
              <span>{sourceLabel}</span>
              <small>{updatedLabel}</small>
            </div>
            <button className="topbar-button" type="button" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "Обновляем..." : "Обновить"}
            </button>
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
