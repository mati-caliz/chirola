import type { ArcaCallLogEntry } from './arca-call-log.service';
import type { ArcaCallRecorder } from './arca-soap.util';

export class RecordedArcaCalls implements ArcaCallRecorder {
  readonly entries: ArcaCallLogEntry[] = [];

  async record(entry: ArcaCallLogEntry): Promise<void> {
    this.entries.push(entry);
  }

  last(): ArcaCallLogEntry | undefined {
    return this.entries[this.entries.length - 1];
  }
}
