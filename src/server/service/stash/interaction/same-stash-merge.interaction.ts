import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable } from 'immer';

import { StashInteraction, SourceRecipe, TargetRecipe } from './stash.interaction';
import { StashSlotCache } from '../stash-slot.cache';
import { ItemService } from '../items/item.service';

/**
 * Handles interaction when the quantity of two valid slots of the same stash are merged
 * into one single slot, ultimately having the sum of the quantities of the previous
 * two slots.
*/
@Injectable()
export class SameStashMergeInteraction implements StashInteraction {

  public constructor(
    private readonly _slotCache: StashSlotCache,
    private readonly _items: ItemService,
  ) {}

  public resolve(
    change: unknown /* TODO: Add typing to this */,
    source: Immutable<Stash>
  ): { sourceRecipe: SourceRecipe; targetRecipe?: TargetRecipe; } {
    // TODO: Validate this
    // TODO: The recipe can fail. If that happens, any change to the slot cache needs to be reverted. Prefer using immer for the slot cache as well, and bundle the recipes with the slot cache recipe.

    const { sourceSlotId, targetSlotId } = change as { sourceSlotId: number; targetSlotId: number };
    // TODO: Update the cache, by making use of _slotCache and its methods.

    return {
      sourceRecipe: (draft, change) => {
        const { sourceSlotId, targetSlotId, amount: reqAmount } = change as { sourceSlotId: number; targetSlotId: number, amount: number };
        if (
          sourceSlotId == null || sourceSlotId < 0 || sourceSlotId > draft.maxSlots - 1
          || targetSlotId == null || targetSlotId < 0 || targetSlotId > draft.maxSlots - 1
        ) {
          throw new Error('Invalid sourceSlotId/targetSlotId.');
        }

        const slots = draft.slots!;
        const sourceSlot = slots[sourceSlotId];
        const targetSlot = slots[targetSlotId];
        const amount = Number(reqAmount);

        if (Number.isNaN(amount) || amount < 0) {
          throw new Error('Forbidden operation (000)');
        }

        if (sourceSlot.amount != amount) {
          throw new Error('Forbidden operation (001)');
        }

        if (sourceSlot == null || targetSlot == null || sourceSlot.itemIdentifier != targetSlot.itemIdentifier) {
          throw new Error('Forbidden operation (002)');
        }

        const item = this._items.getById(sourceSlot.itemIdentifier);
        if (targetSlot.amount + amount > item.stackSize) {
          throw new Error('Forbidden operation (003)');
        }

        slots[sourceSlotId].amount -= amount;
        slots[targetSlotId].amount += amount;

        if (slots[sourceSlotId].amount <= 0) {
          slots[sourceSlotId] = null;
        }
      },
    };
  }
}
