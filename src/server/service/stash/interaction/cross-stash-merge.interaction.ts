import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable, WritableNonArrayDraft } from 'immer';

import { StashInteraction, SourceRecipe, TargetRecipe } from './stash.interaction';
import { StashSlotCache } from '../stash-slot.cache';
import { ItemService } from '../items/item.service';

/**
 * Handles interaction when the quantity of two valid slots of two different stashes
 * are merged into one single slot, ultimately having the sum of the quantities of
 * the previous two slots.
*/
@Injectable()
export class CrossStashMergeInteraction implements StashInteraction {

  public constructor(
    private readonly _slotCache: StashSlotCache,
    private readonly _items: ItemService,
  ) {}

  public resolve(
    change: unknown /* TODO: Add typing to this */,
    source: Immutable<Stash>,
    target: Immutable<Stash>
  ): { sourceRecipe: SourceRecipe; targetRecipe?: TargetRecipe; } {
    // TODO: Validate this

    if (!source || !target || source.id == target.id) {
      throw new Error('A cross-stash transfer requires two, valid different stashes.');
    }

    const { sourceSlotId, targetSlotId, amount: reqAmount } = change as { sourceSlotId: number; targetSlotId: number, amount: number };
    if (
      sourceSlotId == null || sourceSlotId < 0 || sourceSlotId > source.maxSlots - 1
      || targetSlotId == null || targetSlotId < 0 || targetSlotId > target.maxSlots - 1
    ) {
      throw new Error('Invalid sourceSlotId/targetSlotId.');
    }

    const amount = Number(reqAmount);
    if (Number.isNaN(amount) || amount < 0) {
      throw new Error('Forbidden operation (V-000)');
    }

    if (source.slots[sourceSlotId].itemIdentifier !== target.slots[targetSlotId].itemIdentifier) {
      throw new Error('Forbidden operation (V-001)');
    }

    return {
      // TODO: Update the cache, by making use of _slotCache and its methods.
      sourceRecipe: CrossStashMergeInteraction.prepareSource,
      targetRecipe: CrossStashMergeInteraction.prepareTarget,
    };
  }

  public static prepareSource(draft: WritableNonArrayDraft<Stash>, change: unknown/*, cache: StashSlotCache */): void {
    const { sourceSlotId, amount: reqAmount } = change as { sourceSlotId: number; amount: number };
    if (
      sourceSlotId == null || sourceSlotId < 0 || sourceSlotId > draft.maxSlots - 1
    ) {
      throw new Error('Invalid sourceSlotId.');
    }

    const slots = draft.slots!;
    const sourceSlot = slots[sourceSlotId];
    const amount = Number(reqAmount);

    if (amount != sourceSlot.amount) {
      throw new Error('Forbidden operation (000)');
    }

    if (sourceSlot.amount < amount) {
      throw new Error('Forbidden operation (001)');
    }

    if (sourceSlot == null) {
      throw new Error('Forbidden operation (002)');
    }

    slots[sourceSlotId].amount -= amount;
    if (slots[sourceSlotId].amount <= 0) {
      slots[sourceSlotId] = null;
    }
  }

  public static prepareTarget(draft: WritableNonArrayDraft<Stash>, change: unknown/*, cache: StashSlotCache *//*, itemRegistry: ItemRegistry*/): void {
    const { targetSlotId, amount: reqAmount } = change as { targetSlotId: number; amount: number };
    if (
      targetSlotId == null || targetSlotId < 0 || targetSlotId > draft.maxSlots - 1
    ) {
      throw new Error('Invalid targetSlotId.');
    }

    const slots = draft.slots!;
    const targetSlot = slots[targetSlotId];
    const amount = Number(reqAmount);

    if (Number.isNaN(amount) || amount < 0) {
      throw new Error('Forbidden operation (000)');
    }

    if (targetSlot.amount < amount) {
      throw new Error('Forbidden operation (001)');
    }

    if (targetSlot == null) {
      throw new Error('Forbidden operation (002)');
    }

    // TODO: Add this back
    // const item = ItemRegistry.findById(targetSlot.itemIdentifier);
    // if (item.stackSize > targetSlot.amount + amount) {
    //   throw new Error('Forbidden operation (003)');
    // }

    slots[targetSlotId].amount += amount;
  }
}
