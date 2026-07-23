import type { FeedbackItem, UserProfile } from "../../types/user";

type Config = { supabaseUrl: string; anonKey: string; accessToken: string; functionName?: string };
type SocialDataResult = { ok: boolean; profile: UserProfile | null; feedbackItems: FeedbackItem[] };

export class SocialDataClient {
  private readonly functionName: string;
  constructor(private readonly config: Config) { this.functionName = config.functionName || "social-data"; }

  read(): Promise<SocialDataResult> { return this.request({ action: "read" }); }
  saveProfile(profile: UserProfile): Promise<SocialDataResult> { return this.request({ action: "save-profile", profile }); }
  vote(feedbackId: string): Promise<SocialDataResult> { return this.request({ action: "vote", feedbackId }); }

  private async request(payload: unknown): Promise<SocialDataResult> {
    const response = await fetch(`${this.config.supabaseUrl.trim()}/functions/v1/${this.functionName}`, {
      method: "POST",
      headers: {
        apikey: this.config.anonKey.trim(), authorization: `Bearer ${this.config.anonKey.trim()}`,
        "x-live-scanner-key": this.config.accessToken.trim(), "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Social data request failed: ${await response.text()}`);
    return await response.json() as SocialDataResult;
  }
}
