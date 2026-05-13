import * as vscode from "vscode";
import type { DevPulseApi } from "./api";

/**
 * Periodic + event-driven activity reporting. Never sends file contents.
 * Respects `devpulse.heartbeatIntervalSec` (0 disables) and
 * `devpulse.trackFileChanges`.
 */
export class HeartbeatService {
  private timer: NodeJS.Timeout | undefined;
  private fileWatcherDisposable: vscode.Disposable | undefined;
  private readonly pendingFileChanges = new Set<string>();

  constructor(
    private readonly api: DevPulseApi,
    private readonly isSignedIn: () => boolean
  ) {}

  start(): void {
    const cfg = vscode.workspace.getConfiguration("devpulse");
    const intervalSec = cfg.get<number>("heartbeatIntervalSec", 120);
    const trackFiles = cfg.get<boolean>("trackFileChanges", true);

    if (intervalSec > 0) {
      this.timer = setInterval(
        () => void this.tick(),
        Math.max(intervalSec, 30) * 1000
      );
      void this.sendSessionEvent("session_start");
    }

    if (trackFiles) {
      this.fileWatcherDisposable = vscode.workspace.onDidSaveTextDocument(
        doc => {
          const relPath = vscode.workspace.asRelativePath(doc.uri, false);
          this.pendingFileChanges.add(relPath);
        }
      );
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.fileWatcherDisposable?.dispose();
    this.fileWatcherDisposable = undefined;
    if (this.isSignedIn()) {
      void this.sendSessionEvent("session_end");
    }
  }

  /** Silently swallow network/auth errors — heartbeats must never block the editor. */
  private async tick(): Promise<void> {
    if (!this.isSignedIn()) return;
    try {
      await this.api.recordActivity("heartbeat");
      if (this.pendingFileChanges.size > 0) {
        const paths = Array.from(this.pendingFileChanges);
        this.pendingFileChanges.clear();
        await this.api.recordActivity("file_change", { paths });
      }
    } catch {
      /* ignore */
    }
  }

  private async sendSessionEvent(
    type: "session_start" | "session_end"
  ): Promise<void> {
    if (!this.isSignedIn()) return;
    try {
      await this.api.recordActivity(type, {
        vscodeVersion: vscode.version,
      });
    } catch {
      /* ignore */
    }
  }
}
