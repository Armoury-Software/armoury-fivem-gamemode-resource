import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable } from 'immer';

import { StashInteraction, StashRecipe } from './stash.interaction';

@Injectable()
export class SameStashSwapInteraction implements StashInteraction {

  public resolve(
    change: unknown /* TODO: Add typing to this */,
    source: Immutable<Stash>,
    target: Immutable<Stash>
  ): { sourceRecipe: StashRecipe; targetRecipe?: StashRecipe; } {
    // TODO: Validate this
    return {
      sourceRecipe: (draft, change) => {
        const { sourceSlotId, targetSlotId } = change as { sourceSlotId: number; targetSlotId: number };
        const slots = draft.slots!;
        const sourceSlot = slots[sourceSlotId];

        slots[sourceSlotId] = slots[targetSlotId];
        slots[targetSlotId] = sourceSlot;

        if (slots[sourceSlotId] != null) {
          slots[sourceSlotId]!.slotIndex = sourceSlotId;
        }

        if (sourceSlot != null) {
          sourceSlot.slotIndex = targetSlotId;
        }
      },
    };
  }
}
