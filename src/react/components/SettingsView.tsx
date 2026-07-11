import { useState, type Dispatch, type SetStateAction } from "react";
import type { PatternEvent } from "../../types/patterns";
import { formatDate } from "../domain/dateFormat";
import { sendFootballDataTest, sendJournalSyncTest, sendTelegramTestMessage, type ReactSettings } from "../domain/settings";

type SettingsViewProps = {
  settings: ReactSettings;
  setSettings: Dispatch<SetStateAction<ReactSettings>>;
  history: PatternEvent[];
};

export function SettingsView({ settings, setSettings, history }: SettingsViewProps) {
  const [journalSyncing, setJournalSyncing] = useState(false);
  const [footballDataChecking, setFootballDataChecking] = useState(false);

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

  return (
    <section className="settings-grid">
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
