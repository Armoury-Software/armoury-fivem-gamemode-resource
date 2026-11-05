import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Immutable, WritableNonArrayDraft } from 'immer';

import { type StashSlotCache } from '../stash-slot.cache';

export interface StashChangeHandler<TChange = unknown, TOptions = unknown> {
  validateAndResolve(
    change: TChange,
    source: Immutable<Stash>,
    target: Immutable<Stash>
  ): TOptions;
}

export type StashRecipeDraft = WritableNonArrayDraft<{
  source: Stash;
  target: Stash | null;
  cache: StashSlotCache;
}>;

export interface StashChangeHandlerClass<TChange = unknown, TOptions = unknown> {
  new (...args: any[]): StashChangeHandler<TChange, TOptions>;

  bake(
    draft: StashRecipeDraft,
    change: TChange,
    options: TOptions
  ): void;
}
