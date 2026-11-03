import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable } from 'immer';

import { StashInteraction, SourceRecipe, TargetRecipe } from './stash.interaction';

@Injectable()
export class CrossStashSwapInteraction implements StashInteraction {

  public resolve(
    change: unknown /* TODO: Add typing to this */,
    source: Immutable<Stash>,
    target: Immutable<Stash>
  ): { sourceRecipe: SourceRecipe; targetRecipe?: TargetRecipe; } {
    // TODO: Validate this
    // TODO: The recipe can fail. If that happens, any change to the slot cache needs to be reverted. Prefer using immer for the slot cache as well, and bundle the recipes with the slot cache recipe.
    return {
      sourceRecipe: (draft, change) => {
        const { sourceSlotId, targetSlotId } = change as { sourceSlotId: number; targetSlotId: number };
        const targetSlot = target.slots![targetSlotId];

        draft.slots![sourceSlotId] = targetSlot == null
          ? null
          : { ...targetSlot, stashId: draft.id, slotIndex: sourceSlotId };
      },
      targetRecipe: (draft, change) => {
        const { sourceSlotId, targetSlotId } = change as { sourceSlotId: number; targetSlotId: number };
        const sourceSlot = source.slots![sourceSlotId];

        draft.slots![targetSlotId] = sourceSlot == null
          ? null
          : { ...sourceSlot, stashId: draft.id, slotIndex: targetSlotId };
      }
    };
  }
}
