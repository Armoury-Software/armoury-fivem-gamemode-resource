import { Item, Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable } from 'immer';

import { StashRecipeDraft, type StashChangeHandler } from './stash.interaction';
import { emptySlotRecipe } from '../recipes/remove-item.recipe';
import { addItemToSlotRecipe } from '../recipes/add-item.recipe';
import { ItemService } from '../items/item.service';

@Injectable()
export class StashSlotsMergeInteraction implements StashChangeHandler<unknown, Options> {

  public constructor(
    private readonly _items: ItemService,
  ) {}

  public validateAndResolve(
    change: unknown /* TODO: Add typing to this */,
    source: Immutable<Stash>,
    target: Immutable<Stash>
  ): Options {
    // TODO: Throw errors here.

    const { sourceSlotId } = change as { sourceSlotId: number };
    if (
      sourceSlotId < 0
      || sourceSlotId >= source.slots.length
      || source.slots[sourceSlotId]?.itemIdentifier == null
    ) {
      throw new Error(
        'Illegal operation: there\'s no valid item at specified sourceSlotId inside source.'
      );
    }

    const item = this._items.getById(source.slots[sourceSlotId].itemIdentifier);
    if (item == null) {
      throw new Error(
        'Illegal operation: the item for the specified item identifier could not be found.'
      );
    }

    return { item };
  }

  public static bake(
    draft: StashRecipeDraft,
    change: unknown /* TODO: Add typing to this */,
    options: Options,
  ): void {
    // TODO: Make changes to the cache

    const { sourceSlotId, targetSlotId, amount } =
      change as { sourceSlotId: number; targetSlotId: number, amount: number };

    if (
      !Number.isSafeInteger(amount)
      || amount < 0
    ) {
      throw new Error('Illegal operation: amount is either invalid or negative.');
    }

    if (
      !Number.isSafeInteger(sourceSlotId)
      || !Number.isSafeInteger(targetSlotId)
      || sourceSlotId < 0 || targetSlotId < 0
      || sourceSlotId >= draft.source.maxSlots
      || targetSlotId >= (draft.target ?? draft.source).maxSlots
    ) {
      throw new Error('Illegal operation: slot ID is either invalid or negative.');
    }

    const sourceSlots = draft.source.slots;
    const targetSlots = draft.target?.slots ?? sourceSlots;

    if (sourceSlots[sourceSlotId] == null || targetSlots[targetSlotId] == null) {
      throw new Error(
        'Illegal operation: one of the two slots is empty.'
      );
    }

    if (sourceSlots == targetSlots && sourceSlotId == targetSlotId) {
      throw new Error(
        'Illegal operation: same stash merges cannot have the same slot ID for both '
        + 'source and target.'
      );
    }

    if (sourceSlots[sourceSlotId].itemIdentifier != targetSlots[targetSlotId].itemIdentifier) {
      throw new Error(
        'Illegal operation: the two items requested to be merged do not share the '
        + 'same item identifier.'
      );
    }

    if (amount != sourceSlots[sourceSlotId].amount) {
      throw new Error(
        'Illegal operation: the amount requested to be merged does not match the '
        + 'amount from the source slot.'
      );
    }

    emptySlotRecipe(
      { stash: draft.source, cache: draft.cache },
      sourceSlots[sourceSlotId].itemIdentifier,
      sourceSlotId
    );

    addItemToSlotRecipe(
      { stash: draft.target ?? draft.source, cache: draft.cache },
      options.item,
      targetSlotId,
      amount
    );
  }
}

type Options = {
  item: Item,
};
