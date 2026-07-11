import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Pattern, PatternConditionProfile, PatternEvent, PatternRule, Signal } from "../../types/patterns";
import { getPatternName } from "../domain/labels";
import { getReactPatternStats, getRuleText, patternStatusLabel } from "../domain/patternAnalytics";
import type { ReactSettings } from "../domain/settings";
import { MetricCard } from "./MetricCard";

type PatternLabViewProps = {
  patterns: Pattern[];
  history: PatternEvent[];
  signals: Signal[];
  settings: ReactSettings;
  setSettings: Dispatch<SetStateAction<ReactSettings>>;
};

export function PatternLabView({ patterns, history, signals, settings, setSettings }: PatternLabViewProps) {
  const [activePatternId, setActivePatternId] = useState(patterns[0]?.id || "");
  const [profileName, setProfileName] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const activePattern = patterns.find((pattern) => pattern.id === activePatternId) || patterns[0];
  const rows = useMemo(
    () => patterns.map((pattern) => getReactPatternStats(pattern, history, signals)),
    [patterns, history, signals]
  );
  const activeStats = activePattern ? getReactPatternStats(activePattern, history, signals) : null;
  const activeSignals = activePattern ? signals.filter((signal) => signal.patternId === activePattern.id) : [];
  const savedProfiles = activePattern ? settings.patternConditionProfiles.filter((profile) => profile.patternId === activePattern.id) : [];

  if (!activePattern || !activeStats) {
    return <div className="empty-state">Паттерны пока не загружены.</div>;
  }

  function updateRuleValue(ruleIndex: number, rawValue: string) {
    setSettings((current) => {
      const currentRules = activePattern.rules.map((rule) => ({ value: rule.value }));
      const sourceValue = activePattern.rules[ruleIndex]?.value;
      currentRules[ruleIndex] = { value: normalizeRuleValue(rawValue, sourceValue) };

      return {
        ...current,
        patternRuleOverrides: {
          ...current.patternRuleOverrides,
          [activePattern.id]: currentRules
        }
      };
    });
  }

  function resetActivePattern() {
    setSettings((current) => {
      const nextOverrides = { ...current.patternRuleOverrides };
      delete nextOverrides[activePattern.id];
      return { ...current, patternRuleOverrides: nextOverrides };
    });
  }

  function toggleActivePattern() {
    setSettings((current) => ({
      ...current,
      patternEnabledOverrides: {
        ...current.patternEnabledOverrides,
        [activePattern.id]: !activePattern.enabled
      }
    }));
  }

  function saveProfile() {
    const cleanName = profileName.trim() || `${activePattern.name} · ${new Date().toLocaleDateString("ru-RU")}`;
    const profile: PatternConditionProfile = {
      id: `profile-${activePattern.id}-${Date.now()}`,
      patternId: activePattern.id,
      name: cleanName,
      rules: activePattern.rules.map((rule) => ({ value: rule.value })),
      createdAt: new Date().toISOString()
    };

    setSettings((current) => ({
      ...current,
      patternConditionProfiles: [profile, ...current.patternConditionProfiles].slice(0, 40)
    }));
    setProfileName("");
  }

  function applyProfile(profile: PatternConditionProfile) {
    setActivePatternId(profile.patternId);
    setSettings((current) => ({
      ...current,
      patternRuleOverrides: {
        ...current.patternRuleOverrides,
        [profile.patternId]: profile.rules
      }
    }));
  }

  function exportProfiles() {
    const payload = {
      exportedAt: new Date().toISOString(),
      profiles: settings.patternConditionProfiles
    };
    downloadFile("football-pattern-profiles.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  }

  function importProfiles(file?: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}")) as { profiles?: PatternConditionProfile[] };
        const profiles = (parsed.profiles || []).filter(isPatternProfile);
        setSettings((current) => ({
          ...current,
          patternConditionProfiles: [...profiles, ...current.patternConditionProfiles].slice(0, 60)
        }));
      } catch {
        // Keep the current profiles unchanged when the imported file is invalid.
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="pattern-layout">
      <aside className="panel pattern-list">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Паттерны</p>
            <h2>Паттерны</h2>
          </div>
        </div>
        {patterns.map((pattern) => (
          <button
            className={`pattern-list-item ${pattern.id === activePattern.id ? "is-active" : ""}`}
            type="button"
            key={pattern.id}
            onClick={() => setActivePatternId(pattern.id)}
          >
            <span>{pattern.name}</span>
            <small>{pattern.enabled ? "Активен" : "Выключен"}</small>
          </button>
        ))}
      </aside>

      <section className="panel builder-panel">
        <div className="builder-header">
          <div>
            <p className="eyebrow">Паттерны &gt; {activePattern.name}</p>
            <h2>Конструктор паттерна</h2>
          </div>
          <div className="builder-status-actions">
            <button className={`mini-action ${activePattern.enabled ? "is-win" : "is-lose"}`} type="button" onClick={toggleActivePattern}>
              {activePattern.enabled ? "Активен" : "Выключен"}
            </button>
            <span className={`quality-badge ${activeStats.status}`}>{patternStatusLabel[activeStats.status]}</span>
          </div>
        </div>

        <p className="muted">{activePattern.description}</p>

        <div className="pattern-profile-note">
          <strong>Базовый профиль условий</strong>
          <span>Пороговые значения используются движком для поиска сигналов в live-матчах.</span>
        </div>

        <div className="threshold-list">
          {activePattern.rules.map((rule, index) => (
            <div className="threshold-row" key={`${rule.field}-${rule.operator}-${index}`}>
              <span>
                <b>{rule.label || rule.field}</b>
                <small>{getRuleText(rule)}</small>
              </span>
              <input
                value={String(rule.value)}
                aria-label={rule.label || rule.field}
                onChange={(event) => updateRuleValue(index, event.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="builder-actions">
          <button className="ghost-button" type="button" onClick={resetActivePattern}>Сбросить условия</button>
          <input
            className="profile-name-input"
            type="text"
            value={profileName}
            placeholder="Название профиля"
            onChange={(event) => setProfileName(event.target.value)}
          />
          <button className="ghost-button" type="button" onClick={saveProfile}>Сохранить профиль</button>
          <button className="ghost-button" type="button" onClick={exportProfiles} disabled={!settings.patternConditionProfiles.length}>Экспорт JSON</button>
          <button className="ghost-button" type="button" onClick={() => importInputRef.current?.click()}>Импорт JSON</button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => importProfiles(event.target.files?.[0])}
          />
        </div>

        <div className="saved-profile-list">
          {savedProfiles.length ? savedProfiles.map((profile) => (
            <span key={profile.id}>
              <b>{profile.name}</b>
              <small>{new Date(profile.createdAt).toLocaleDateString("ru-RU")} · {profile.rules.length} условий</small>
              <button className="mini-action" type="button" onClick={() => applyProfile(profile)}>Применить</button>
            </span>
          )) : (
            <span><b>Сохранённых профилей нет</b><small>Измените условия и сохраните профиль для повторного применения.</small></span>
          )}
        </div>
      </section>

      <aside className="panel">
        <h2>Статистика паттерна</h2>
        <div className="mini-stats">
          <MetricCard label="Срабатываний" value={activeStats.totalSignals} />
          <MetricCard label="Активных" value={activeStats.activeSignals} />
          <MetricCard label="До 10 мин" value={activeStats.successWithin10} />
          <MetricCard label="До 15 мин" value={activeStats.successWithin15} />
          <MetricCard label="Средняя минута" value={activeStats.averageMinute} />
          <MetricCard label="Средний индекс" value={activeStats.averagePressureScore} />
        </div>
        <div className={`quality-note ${activeStats.status}`}>
          <strong>{patternStatusLabel[activeStats.status]}</strong>
          <span>{activeStats.reason}</span>
        </div>
        <div className="pattern-analytics-details">
          <div>
            <h3>Эффективность</h3>
            <span>До 5 минут <b>{activeStats.successWithin5}</b></span>
            <span>До 10 минут <b>{activeStats.successWithin10}</b></span>
            <span>До 15 минут <b>{activeStats.successRate15}%</b></span>
            <span>Оценка <b>{activeStats.qualityScore}/100</b></span>
          </div>
          <div>
            <h3>Активные сигналы</h3>
            {activeSignals.slice(0, 4).map((signal) => (
              <span key={signal.id}>{getPatternName(signal.patternType)} <b>{signal.pressureScore}</b></span>
            ))}
            {!activeSignals.length ? <span>Сейчас активных сигналов нет</span> : null}
          </div>
        </div>
      </aside>

      <section className="panel wide-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Сводка</p>
            <h2>Статусы паттернов</h2>
          </div>
        </div>
        <div className="analytics-table">
          <div className="analytics-head">
            <span>Паттерн</span><span>Сигналов</span><span>Активных</span><span>До 15</span><span>Индекс</span><span>Оценка</span><span>Статус</span>
          </div>
          {rows.map((row) => (
            <div className={`analytics-row ${row.status}`} key={row.pattern.id}>
              <span><strong>{row.pattern.name}</strong><small>{row.reason}</small></span>
              <span>{row.totalSignals}</span>
              <span>{row.activeSignals}</span>
              <span>{row.successRate15}%</span>
              <span>{row.averagePressureScore}</span>
              <span><b>{row.qualityScore}/100</b></span>
              <span><b className={`quality-badge ${row.status}`}>{patternStatusLabel[row.status]}</b></span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function normalizeRuleValue(rawValue: string, sourceValue: PatternRule["value"]) {
  if (typeof sourceValue === "number") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : sourceValue;
  }

  return rawValue;
}

function isPatternProfile(profile: PatternConditionProfile): profile is PatternConditionProfile {
  return Boolean(profile?.id && profile.patternId && profile.name && Array.isArray(profile.rules));
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
