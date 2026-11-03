import { Item, Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable, WritableNonArrayDraft } from 'immer';

import { StashInteraction, SourceRecipe, TargetRecipe } from './stash.interaction';
import { StashSlotCache } from '../stash-slot.cache';

// TODO: This might actually be used on the client when consuming items
@Injectable()
export class ServerOnlyRemoveItemInteraction implements StashInteraction {

  public constructor(
    private readonly _slotCache: StashSlotCache,
  ) {}

  public resolve(
    change: unknown /* TODO: Add typing to this */,
    source: Immutable<Stash>
  ): { sourceRecipe: SourceRecipe; targetRecipe?: TargetRecipe; } {
    // TODO: Validate this
    throw new Error('At this time, ServerOnlyRemoveItemInteraction is server-only.');

    // TODO: The recipe can fail. If that happens, any change to the slot cache needs to be reverted. Prefer using immer for the slot cache as well, and bundle the recipes with the slot cache recipe.
    const { sourceSlotId, targetSlotId } = change as { sourceSlotId: number; targetSlotId: number };

    this._slotCache.updateAmount(
      source.id,
      source.slots[targetSlotId].itemIdentifier,
      sourceSlotId,
      source.slots[targetSlotId].amount
    );

    this._slotCache.updateAmount(
      source.id,
      source.slots[sourceSlotId].itemIdentifier,
      targetSlotId,
      source.slots[sourceSlotId].amount
    );

    return {
      sourceRecipe: ServerOnlyRemoveItemInteraction.prepare,
    };
  }

  public static prepare(draft: WritableNonArrayDraft<Stash>, change: unknown/*, cache: StashSlotCache */): void {
    const { item, amount, shouldNotThrowOnNoAmountFulfillment } =
      change as { item: Item, amount: number, shouldNotThrowOnNoAmountFulfillment?: boolean };

    const slots = draft.slots!;

    // TODO: Check the cache first. If the cache says that there are slots containing this item..
    // TODO: ..inside this stash, verify whether that's true, and if yes, do the removal.

    // TODO: Keep in mind that this method is supposed to throw on impossibilities

    let remainingAmount = amount;
    // TODO: This is terribly inefficient, so do the cache thing ASAP
    for (const slot of slots) {
      if (slot != null && slot.itemIdentifier == item.id) {
        const amountToRemove = Math.min(slot.amount, remainingAmount);
        remainingAmount -= amountToRemove;
        slot.amount -= amountToRemove;

        // TODO: Update cache here
      }

      if (remainingAmount == 0) {
        return;
      }
    }

    if (remainingAmount > 0) {
      // TODO: Revert cache changes if the below error is thrown
      throw new Error(`There were not enough items for removing ${amount} of ${item.id} in stash (id: ${draft.id})`);
    }
  }
}
