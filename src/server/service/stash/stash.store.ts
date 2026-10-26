import type { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { freeze, produce, type Draft } from 'immer';

interface PendingSave {
  version: number;
  dueAt: number;
  saving: boolean;
  failures: number;
  flushing?: boolean;
  completion?: Promise<void>;
  timer?: ReturnType<typeof setTimeout>;
}

/** Immutable stash snapshots with a separate, per-stash persistence timer. */
export class StashStore extends Map<number, Stash> {
  private static readonly SAVE_DELAY = 5 * 60 * 1000;
  private static readonly RETRY_DELAY = 30 * 1000;
  private static readonly MAX_RETRIES = 5;
  private readonly _pending = new Map<number, PendingSave>();

  public constructor(private readonly _save: (stash: Stash) => Promise<void>) {
    super();
  }

  /** Database reads are clean and must never overwrite a newer cached snapshot. */
  public load(stash: Stash): Stash {
    const cached = this.get(stash.id);
    if (cached) {
      return cached;
    }

    super.set(stash.id, freeze(stash, true));
    return stash;
  }

  public override set(stashId: number, stash: Stash): this {
    if (stashId !== stash.id) {
      throw new Error('Stash map key must match the stash ID.');
    }

    if (this.get(stashId) === stash) {
      return this;
    }

    super.set(stashId, freeze(stash, true));
    let pending = this._pending.get(stashId);
    if (!pending) {
      pending = { version: 0, dueAt: 0, saving: false, failures: 0 };
      this._pending.set(stashId, pending);
    }

    pending.version++;
    pending.failures = 0;
    pending.dueAt = Date.now() + StashStore.SAVE_DELAY;
    this._schedule(stashId, pending);
    return this;
  }

  /** Nested edits must go through a draft, or be replaced using set(). */
  public update(stashId: number, recipe: (draft: Draft<Stash>) => void): Stash {
    const stash = this.get(stashId);
    if (!stash) {
      throw new Error(`Unknown stash ID: ${stashId}`);
    }

    const next = produce(stash, recipe);
    this.set(stashId, next);
    return next;
  }

  /** Immediately save pending snapshots, including those whose retries expired. */
  public async flush(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this._pending, async ([stashId, pending]) => {
        pending.flushing = true;
        if (pending.timer) {
          clearTimeout(pending.timer);
          pending.timer = undefined;
        }

        try {
          if (pending.completion) {
            await pending.completion;
          }
          if (this._pending.get(stashId) === pending) {
            await this._beginPersist(stashId, pending);
          }
          if (this._pending.get(stashId) === pending) {
            throw new Error(`Stash ${stashId} still has unsaved changes after flushing.`);
          }
        } finally {
          pending.flushing = false;
          if (this._pending.get(stashId) === pending && pending.failures <= StashStore.MAX_RETRIES && !pending.timer) {
            this._schedule(stashId, pending);
          }
        }
      })
    );

    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      throw new Error(`Failed to flush ${failures.length} pending stash(es).`);
    }
  }

  public override delete(stashId: number): boolean {
    const pending = this._pending.get(stashId);
    if (pending?.timer) {
      clearTimeout(pending.timer);
    }
    this._pending.delete(stashId);
    return super.delete(stashId);
  }

  public override clear(): void {
    for (const pending of this._pending.values()) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
    }
    this._pending.clear();
    super.clear();
  }

  private _schedule(stashId: number, pending: PendingSave): void {
    if (pending.flushing) {
      return;
    }
    if (pending.timer) {
      clearTimeout(pending.timer);
    }
    pending.timer = setTimeout(() => {
      pending.timer = undefined;
      void this._beginPersist(stashId, pending);
    }, Math.max(0, pending.dueAt - Date.now()));
  }

  private _beginPersist(stashId: number, pending: PendingSave): Promise<void> {
    if (!pending.completion) {
      pending.completion = this._persist(stashId, pending).finally(() => {
        pending.completion = undefined;
      });
    }
    return pending.completion;
  }

  private async _persist(stashId: number, pending: PendingSave): Promise<void> {
    if (pending.saving || this._pending.get(stashId) !== pending) {
      return;
    }

    const stash = this.get(stashId)!;
    const version = pending.version;
    pending.saving = true;
    try {
      await this._save(stash);
      if (pending.version === version && this._pending.get(stashId) === pending) {
        this._pending.delete(stashId);
      }
    } catch (error) {
      if (pending.version !== version) {
        console.error(`[Armoury:] Failed to save stash ${stashId}; a newer version is pending.`, error);
      } else {
        pending.failures++;
        if (pending.failures > StashStore.MAX_RETRIES) {
          console.error(
            `[Armoury:] Failed to save stash ${stashId}; all ${StashStore.MAX_RETRIES} retries exhausted. Automatic retries stopped; changes remain unsaved.`,
            error
          );
        } else {
          console.error(
            `[Armoury:] Failed to save stash ${stashId}; scheduling retry ${pending.failures}/${StashStore.MAX_RETRIES} in 30 seconds.`,
            error
          );
          pending.dueAt = Math.max(pending.dueAt, Date.now() + StashStore.RETRY_DELAY);
        }
      }
    } finally {
      pending.saving = false;
      if (this._pending.get(stashId) === pending && pending.failures <= StashStore.MAX_RETRIES) {
        this._schedule(stashId, pending);
      }
    }
  }
}
