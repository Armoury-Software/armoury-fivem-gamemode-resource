import { Item, Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable } from 'immer';

import { StashRecipeDraft, type StashChangeHandler } from './stash.interaction';
import { removeItemFromSlotRecipe } from '../recipes/remove-item.recipe';
import { addItemToSlotRecipe } from '../recipes/add-item.recipe';
import { ItemService } from '../items/item.service';

@Injectable()
export class StashSlotSplitInteraction implements StashChangeHandler<unknown, Options> {

  public constructor(
    private readonly _items: ItemService,
  ) { }

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
      || amount < 1
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

    if (sourceSlots[sourceSlotId] == null) {
      throw new Error(
        'Illegal operation: source slot is empty.'
      );
    }

    if (sourceSlots == targetSlots && sourceSlotId == targetSlotId) {
      throw new Error(
        'Illegal operation: same stash splits cannot have the same slot ID for both '
        + 'source and target.'
      );
    }

    if (
      targetSlots[targetSlotId] != null
      && targetSlots[targetSlotId].itemIdentifier != sourceSlots[sourceSlotId].itemIdentifier
    ) {
      throw new Error(
        'Illegal operation: the target slot already has an item which is different '
        + 'to the source slot\'s item.'
      );
    }

    removeItemFromSlotRecipe(
      { stash: draft.source, cache: draft.cache },
      sourceSlots[sourceSlotId].itemIdentifier,
      sourceSlotId,
      amount
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
  item: Item;
};
