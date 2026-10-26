import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable } from 'immer';

import { StashInteraction, StashRecipe } from './stash.interaction';

@Injectable()
export class CrossStashSwapInteraction implements StashInteraction {

  public resolve(
    change: unknown /* TODO: Add typing to this */,
    source: Immutable<Stash>,
    target: Immutable<Stash>
  ): { sourceRecipe: StashRecipe; targetRecipe?: StashRecipe; } {
    // TODO: Validate this
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
