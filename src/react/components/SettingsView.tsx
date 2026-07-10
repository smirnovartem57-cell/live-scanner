import type { Dispatch, SetStateAction } from "react";
import { formatDate } from "../domain/dateFormat";
import { sendTelegramTestMessage, type ReactSettings } from "../domain/settings";

type SettingsViewProps = {
  settings: ReactSettings;
  setSettings: Dispatch<SetStateAction<ReactSettings>>;
};

export function SettingsView({ settings, setSettings }: SettingsViewProps) {
  function updateSetting<Key extends keyof ReactSettings>(key: Key, value: ReactSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function runTelegramTest() {
    setSettings((current) => ({
      ...current,
      lastTelegramTest: sendTelegramTestMessage(current)
    }));
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
        <h2>API-адаптер</h2>
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
