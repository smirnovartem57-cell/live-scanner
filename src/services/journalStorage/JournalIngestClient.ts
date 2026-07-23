import type { PatternEvent } from "../../types/patterns.ts";
import type { JournalIngestionRun, PatternStatsDaily } from "./JournalStorage.ts";

export type JournalIngestClientConfig = {
  supabaseUrl: string;
  anonKey: string;
  accessToken?: string;
  functionName?: string;
};

export type JournalIngestPayload = {
  events?: PatternEvent[];
  patternStats?: PatternStatsDaily[];
  ingestionRun?: JournalIngestionRun;
};

export type JournalIngestResult = {
  ok: boolean;
  signalsSaved: number;
  patternStatsSaved: number;
};

export class JournalIngestClient {
  private readonly functionName: string;

  constructor(private readonly config: JournalIngestClientConfig) {
    this.functionName = config.functionName || "journal-ingest";
  }

  async send(payload: JournalIngestPayload): Promise<JournalIngestResult> {
    const response = await fetch(`${this.config.supabaseUrl}/functions/v1/${this.functionName}`, {
      method: "POST",
      headers: {
        apikey: this.config.anonKey,
        authorization: `Bearer ${this.config.anonKey}`,
        ...(this.config.accessToken ? { "x-live-scanner-key": this.config.accessToken } : {}),
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Journal ingest failed: ${await response.text()}`);
    }

    return await response.json() as JournalIngestResult;
  }
}
