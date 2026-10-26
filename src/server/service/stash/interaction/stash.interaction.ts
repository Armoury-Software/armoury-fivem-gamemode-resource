import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Draft, Immutable } from 'immer';

export interface StashInteraction<TChange = unknown> {
  resolve(
    change: TChange,
    source: Immutable<Stash>,
    target: Immutable<Stash>
  ): {
    sourceRecipe: StashRecipe;
    targetRecipe?: StashRecipe;
  };
}

export type StashRecipe = (draft: Draft<Stash>, change: unknown /* TODO: Add typing to this */) => void;
