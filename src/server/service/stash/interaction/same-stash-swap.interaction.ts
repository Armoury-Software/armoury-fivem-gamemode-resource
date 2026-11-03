import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable } from 'immer';

import { StashInteraction, SourceRecipe, TargetRecipe } from './stash.interaction';
import { StashSlotCache } from '../stash-slot.cache';

@Injectable()
export class SameStashSwapInteraction implements StashInteraction {

  public constructor(
    private readonly _slotCache: StashSlotCache,
  ) {}

  public resolve(
    change: unknown /* TODO: Add typing to this */,
    source: Immutable<Stash>
  ): { sourceRecipe: SourceRecipe; targetRecipe?: TargetRecipe; } {
    // TODO: Validate this

    // TODO: The recipe can fail. If that happens, any change to the slot cache needs to be reverted. Prefer using immer for the slot cache as well, and bundle the recipes with the slot cache recipe.
    const { sourceSlotId, targetSlotId } = change as { sourceSlotId: number; targetSlotId: number };
    if (source.slots[sourceSlotId]) { // TODO: Do a double-check. These if-s might not be okay.
      this._slotCache.disregard(source.id, source.slots[sourceSlotId].itemIdentifier, sourceSlotId);
    }

    if (source.slots[targetSlotId]) { // TODO: Do a double-check. These if-s might not be okay.
      this._slotCache.disregard(source.id, source.slots[targetSlotId].itemIdentifier, targetSlotId);
    }

    if (source.slots[targetSlotId]) { // TODO: Do a double-check. These if-s might not be okay.
      this._slotCache.updateAmount(
        source.id,
        source.slots[targetSlotId].itemIdentifier,
        sourceSlotId,
        source.slots[targetSlotId].amount
      );
    }

    if (source.slots[sourceSlotId]) { // TODO: Do a double-check. These if-s might not be okay.
      this._slotCache.updateAmount(
        source.id,
        source.slots[sourceSlotId].itemIdentifier,
        targetSlotId,
        source.slots[sourceSlotId].amount
      );
    }

    return {
      sourceRecipe: (draft, change) => { // TODO: Make this anonymous function static so that we can use it in multiple places?
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
