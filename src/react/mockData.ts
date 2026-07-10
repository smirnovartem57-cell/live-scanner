import type { MockFootballData } from "../services/footballDataProvider/MockFootballProvider";

declare global {
  interface Window {
    FootballMockData?: MockFootballData;
  }
}

export function getBrowserMockData(): MockFootballData {
  if (!window.FootballMockData) {
    throw new Error("Mock data is not loaded.");
  }

  return window.FootballMockData;
}
