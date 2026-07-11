import { useState, type Dispatch, type SetStateAction } from "react";
import type { PatternEvent } from "../../types/patterns";
import { formatDate } from "../domain/dateFormat";
import {
  canUseJournalStorage,
  canUseRealFootballData,
  hasSupabaseConnectionSettings,
  sendJournalRoundtripTest,
  sendFootballDataTest,
  sendJournalSyncTest,
  sendTelegramTestMessage,
  type ReactSettings
} from "../domain/settings";

type SettingsViewProps = {
  settings: ReactSettings;
  setSettings: Dispatch<SetStateAction<ReactSettings>>;
  history: PatternEvent[];
};

export function SettingsView({ settings, setSettings, history }: SettingsViewProps) {
  const [journalSyncing, setJournalSyncing] = useState(false);
  const [journalRoundtripChecking, setJournalRoundtripChecking] = useState(false);
  const [footballDataChecking, setFootballDataChecking] = useState(false);
  const hasConnection = hasSupabaseConnectionSettings(settings);
  const journalReady = canUseJournalStorage(settings);
  const realDataReady = canUseRealFootballData(settings);
  const readinessItems = [
    {
      label: "Real data",
      value: !settings.mockMode && realDataReady ? "Готово" : settings.mockMode ? "Включен mock" : "Нужен token",
      ok: !settings.mockMode && realDataReady
    },
    {
      label: "Supabase",
      value: hasConnection ? "URL и anon key есть" : "Нет подключения",
      ok: hasConnection
    },
    {
      label: "Журнал",
      value: journalReady ? "Запись включена" : "Не готов",
      ok: journalReady
    },
    {
      label: "Проверка записи",
      value: settings.lastJournalRoundtrip?.ok ? "Круг прошел" : "Нужен тест",
      ok: Boolean(settings.lastJournalRoundtrip?.ok)
    },
    {
      label: "Live source",
      value: settings.lastFootballDataTest?.ok ? `${settings.lastFootballDataTest.matchesLoaded} матчей` : "Нужен тест",
      ok: Boolean(settings.lastFootballDataTest?.ok)
    }
  ];
  const readinessPassed = readinessItems.filter((item) => item.ok).length;
  const readinessTotal = readinessItems.length;
  const readinessReady = readinessPassed === readinessTotal;

  function updateSetting<Key extends keyof ReactSettings>(key: Key, value: ReactSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function runTelegramTest() {
    setSettings((current) => ({
      ...current,
      lastTelegramTest: sendTelegramTestMessage(current)
    }));
  }

  async function runJournalTest() {
    setJournalSyncing(true);
    try {
      const result = await sendJournalSyncTest(settings, history);
      setSettings((current) => ({ ...current, lastJournalSync: result }));
    } catch (error) {
      setSettings((current) => ({
        ...current,
        lastJournalSync: {
          ok: false,
          mode: "supabase",
          message: error instanceof Error ? error.message : "Не удалось проверить запись журнала.",
          signalsSaved: 0,
          patternStatsSaved: 0,
          createdAt: new Date().toISOString()
        }
      }));
    } finally {
      setJournalSyncing(false);
    }
  }

  async function runJournalRoundtripTest() {
    setJournalRoundtripChecking(true);
    try {
      const result = await sendJournalRoundtripTest(settings);
      setSettings((current) => ({ ...current, lastJournalRoundtrip: result }));
    } catch (error) {
      setSettings((current) => ({
        ...current,
        lastJournalRoundtrip: {
          ok: false,
          message: error instanceof Error ? error.message : "Не удалось проверить полный круг журнала.",
          eventId: "",
          signalsSaved: 0,
          foundAfterRead: false,
          createdAt: new Date().toISOString()
        }
      }));
    } finally {
      setJournalRoundtripChecking(false);
    }
  }

  async function runFootballDataTest() {
    setFootballDataChecking(true);
    try {
      const result = await sendFootballDataTest(settings);
      setSettings((current) => ({ ...current, lastFootballDataTest: result }));
    } catch (error) {
      setSettings((current) => ({
        ...current,
        lastFootballDataTest: {
          ok: false,
          provider: settings.footballDataFunctionName || "football-live",
          message: error instanceof Error ? error.message : "Не удалось проверить источник данных.",
          matchesLoaded: 0,
          cached: false,
          createdAt: new Date().toISOString()
        }
      }));
    } finally {
      setFootballDataChecking(false);
    }
  }

  function enableRealDataMode() {
    setSettings((current) => ({
      ...current,
      mockMode: false,
      journalStorageEnabled: true
    }));
  }

  return (
    <section className="settings-grid">
      <div className="panel real-readiness-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Real data readiness</p>
            <h2>Готовность к реальным событиям</h2>
            <p className="muted">
              {readinessReady
                ? "Можно запускать live-проверку: источник, журнал и чтение истории готовы."
                : "Перед live-проверкой нужно закрыть оставшиеся пункты ниже."}
            </p>
          </div>
          <span className={`readiness-score ${readinessReady ? "ok" : "warning"}`}>{readinessPassed}/{readinessTotal}</span>
        </div>
        <div className="readiness-check-grid">
          {readinessItems.map((item) => (
            <span className={`readiness-check-card ${item.ok ? "ok" : "warning"}`} key={item.label}>
              <b>{item.label}</b>
              <small>{item.value}</small>
            </span>
          ))}
        </div>
        <div className="real-wizard-grid">
          <div className={`real-wizard-step ${hasConnection ? "ok" : "warning"}`}>
            <b>1. Supabase</b>
            <span>{hasConnection ? "URL и anon key заполнены." : "Заполните Supabase URL и anon key ниже."}</span>
          </div>
          <div className={`real-wizard-step ${!settings.mockMode && journalReady ? "ok" : "warning"}`}>
            <b>2. Включить real-режим</b>
            <span>{!settings.mockMode && journalReady ? "Real-режим и журнал включены." : "Отключит mock и включит запись журнала."}</span>
            <button className="ghost-button" type="button" onClick={enableRealDataMode} disabled={!hasConnection}>
              Применить
            </button>
          </div>
          <div className={`real-wizard-step ${settings.lastJournalRoundtrip?.ok ? "ok" : "warning"}`}>
            <b>3. Проверить журнал</b>
            <span>{settings.lastJournalRoundtrip?.ok ? "Запись и чтение подтверждены." : "Создаст диагностическое событие и прочитает его обратно."}</span>
            <button className="ghost-button" type="button" onClick={runJournalRoundtripTest} disabled={journalRoundtripChecking || !journalReady}>
              {journalRoundtripChecking ? "Проверяем..." : "Проверить"}
            </button>
          </div>
          <div className={`real-wizard-step ${settings.lastFootballDataTest?.ok ? "ok" : "warning"}`}>
            <b>4. Проверить live source</b>
            <span>{settings.lastFootballDataTest?.ok ? "Источник отвечает." : "Проверит Edge Function с live-снимком."}</span>
            <button className="ghost-button" type="button" onClick={runFootballDataTest} disabled={footballDataChecking || !realDataReady}>
              {footballDataChecking ? "Проверяем..." : "Проверить"}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Режим данных</h2>
        <label className="switch field-row">
          <input
            type="checkbox"
            checked={settings.mockMode}
            onChange={(event) => updateSetting("mockMode", event.target.checked)}
          />
          <span>Демо-данные</span>
        </label>
        <p className="muted">Слой данных подготовлен под MockFootballProvider и будущий RealFootballProvider.</p>
        <div className="setting-stack">
          <span className={settings.mockMode || realDataReady ? "status-pill ok" : "status-pill warning"}>
            {settings.mockMode ? "Демо-режим активен" : realDataReady ? "Real-режим готов" : "Real-режим требует токен"}
          </span>
          <span className={journalReady ? "status-pill ok" : "status-pill warning"}>
            {journalReady ? "Журнал защищен и готов" : hasConnection ? "Добавьте Journal access token" : "Добавьте Supabase URL и anon key"}
          </span>
        </div>
      </div>

      <div className="panel">
        <h2>Избранные лиги</h2>
        <div className="setting-stack">
          {settings.favoriteLeagues.map((league) => (
            <span className="rule-chip" key={league}>{league}</span>
          ))}
        </div>
      </div>

      <div className="panel telegram-card">
        <h2>Уведомления в Telegram</h2>
        <label className="switch field-row">
          <input
            type="checkbox"
            checked={settings.telegramEnabled}
            onChange={(event) => updateSetting("telegramEnabled", event.target.checked)}
          />
          <span>Telegram-уведомления</span>
        </label>
        <label className="input-label">
          Канал или chat id
          <input
            type="text"
            value={settings.telegramChannel}
            placeholder="@my_channel"
            onChange={(event) => updateSetting("telegramChannel", event.target.value)}
          />
        </label>
        <button className="primary-button" type="button" onClick={runTelegramTest}>Отправить тестовое сообщение</button>
        {settings.lastTelegramTest ? (
          <p className="telegram-status">
            {settings.lastTelegramTest.message}
            <span>{settings.lastTelegramTest.channel} · {formatDate(settings.lastTelegramTest.createdAt)}</span>
          </p>
        ) : null}
      </div>

      <div className="panel">
        <h2>Постоянный журнал</h2>
        <label className="switch field-row">
          <input
            type="checkbox"
            checked={settings.journalStorageEnabled}
            onChange={(event) => updateSetting("journalStorageEnabled", event.target.checked)}
          />
          <span>Запись в Supabase</span>
        </label>
        <label className="input-label">
          Supabase URL
          <input
            type="url"
            value={settings.supabaseUrl}
            placeholder="https://project.supabase.co"
            onChange={(event) => updateSetting("supabaseUrl", event.target.value)}
          />
        </label>
        <label className="input-label">
          Anon key
          <input
            type="password"
            value={settings.supabaseAnonKey}
            placeholder="anon public key"
            onChange={(event) => updateSetting("supabaseAnonKey", event.target.value)}
          />
        </label>
        <label className="input-label">
          Journal access token
          <input
            type="password"
            value={settings.journalAccessToken}
            placeholder="личный токен функции"
            onChange={(event) => updateSetting("journalAccessToken", event.target.value)}
          />
        </label>
        <button className="primary-button" type="button" onClick={runJournalTest} disabled={journalSyncing}>
          {journalSyncing ? "Проверяем..." : "Проверить запись журнала"}
        </button>
        <button className="ghost-button" type="button" onClick={runJournalRoundtripTest} disabled={journalRoundtripChecking}>
          {journalRoundtripChecking ? "Проверяем..." : "Проверить полный круг"}
        </button>
        {settings.lastJournalSync ? (
          <p className="telegram-status">
            {settings.lastJournalSync.message}
            <span>
              {settings.lastJournalSync.signalsSaved} сигналов · {settings.lastJournalSync.patternStatsSaved} агрегатов · {formatDate(settings.lastJournalSync.createdAt)}
            </span>
          </p>
        ) : (
          <p className="muted">Service-role ключ хранится только в Supabase Edge Function, не в браузере.</p>
        )}
        {settings.lastJournalRoundtrip ? (
          <p className={settings.lastJournalRoundtrip.ok ? "telegram-status is-ok" : "telegram-status is-warning"}>
            {settings.lastJournalRoundtrip.message}
            <span>
              {settings.lastJournalRoundtrip.signalsSaved} событие · {settings.lastJournalRoundtrip.foundAfterRead ? "чтение подтверждено" : "чтение не подтвердилось"} · {formatDate(settings.lastJournalRoundtrip.createdAt)}
            </span>
          </p>
        ) : null}
      </div>

      <div className="panel">
        <h2>API-адаптер</h2>
        <label className="input-label">
          Edge Function
          <input
            type="text"
            value={settings.footballDataFunctionName}
            placeholder="football-live"
            onChange={(event) => updateSetting("footballDataFunctionName", event.target.value)}
          />
        </label>
        <label className="input-label">
          Data access token
          <input
            type="password"
            value={settings.footballDataAccessToken}
            placeholder="если пусто, используется Journal access token"
            onChange={(event) => updateSetting("footballDataAccessToken", event.target.value)}
          />
        </label>
        <button className="primary-button" type="button" onClick={runFootballDataTest} disabled={footballDataChecking}>
          {footballDataChecking ? "Проверяем..." : "Проверить источник данных"}
        </button>
        {settings.lastFootballDataTest ? (
          <p className="telegram-status">
            {settings.lastFootballDataTest.message}
            <span>
              {settings.lastFootballDataTest.provider} · {settings.lastFootballDataTest.cached ? "cache" : "live"} · {settings.lastFootballDataTest.matchesLoaded} матчей · {formatDate(settings.lastFootballDataTest.createdAt)}
            </span>
          </p>
        ) : null}
        <pre className="code-block">FootballDataProvider
  getLiveMatches()
  getMatchStats(matchId)
  getMatchEvents(matchId)
  getPatterns()
  getTeamProfile(teamId)
  getTeamRecentMatches(teamId)
  getUserProfile()
  getFeedbackItems()</pre>
        <p className="muted">Интерфейс независим от поставщика данных: сейчас работает MockFootballProvider, дальше подключается RealFootballProvider.</p>
      </div>
    </section>
  );
}
