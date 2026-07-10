import { useEffect, useState } from "react";
import { readReactSettings, writeReactSettings, type ReactSettings } from "../domain/settings";

export function useReactSettings() {
  const [settings, setSettings] = useState<ReactSettings>(() => readReactSettings());

  useEffect(() => {
    writeReactSettings(settings);
  }, [settings]);

  return { settings, setSettings };
}
