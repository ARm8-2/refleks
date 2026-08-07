import type { Settings } from "@/shared/types";
import type { AppLanguage } from "@/i18n";

export interface SettingsSaveResult {
  saved: Settings;
  isCurrent: boolean;
}

export class SettingsSaveQueue {
  private latest: Settings;
  private committed: Settings;
  private latestVersion = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    initial: Settings,
    private readonly save: (settings: Settings) => Promise<void>,
  ) {
    this.latest = initial;
    this.committed = initial;
  }

  setLatest(settings: Settings): void {
    this.latest = settings;
    this.latestVersion += 1;
  }

  getLatest(): Settings {
    return this.latest;
  }

  getCommitted(): Settings {
    return this.committed;
  }

  replaceCommitted(settings: Settings): void {
    this.latest = settings;
    this.committed = settings;
    this.latestVersion += 1;
  }

  rollback(): Settings {
    this.latest = this.committed;
    this.latestVersion += 1;
    return this.committed;
  }

  enqueue(): Promise<SettingsSaveResult> {
    let resolveResult!: (result: SettingsSaveResult) => void;
    let rejectResult!: (error: unknown) => void;
    const result = new Promise<SettingsSaveResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        const saved = this.latest;
        const savedVersion = this.latestVersion;
        try {
          await this.save(saved);
          this.committed = saved;
          resolveResult({
            saved,
            isCurrent: savedVersion === this.latestVersion,
          });
        } catch (error) {
          rejectResult(error);
          throw error;
        }
      })
      .catch(() => undefined);

    return result;
  }

  async saveLanguage(
    language: AppLanguage,
    apply: (language: AppLanguage) => Promise<void>,
  ): Promise<SettingsSaveResult> {
    this.setLatest({ ...this.latest, language });
    try {
      const result = await this.enqueue();
      if (result.saved.language === language) await apply(language);
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  async drain(): Promise<void> {
    await this.queue;
  }
}
