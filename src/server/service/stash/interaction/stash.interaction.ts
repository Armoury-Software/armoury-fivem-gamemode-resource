import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Draft, Immutable } from 'immer';

export interface StashInteraction<TChange = unknown, TSourceTransient = void> {
  resolve(
    change: TChange,
    source: Immutable<Stash>,
    target: Immutable<Stash>
  ): {
    sourceRecipe: SourceRecipe<TSourceTransient>;
    targetRecipe?: TargetRecipe;
  };
}

export type SourceRecipe<TChange = unknown, TTransient = void> = (draft: Draft<Stash>, change: TChange) => TTransient;
export type TargetRecipe<TChange = unknown> = SourceRecipe<TChange, void>;
