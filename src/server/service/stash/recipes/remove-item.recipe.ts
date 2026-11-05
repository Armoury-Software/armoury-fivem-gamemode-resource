import { type Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { WritableNonArrayDraft } from 'immer';

import { StashSlotCache } from '../stash-slot.cache';

export function removeItemRecipe(
  draft: { stash: WritableNonArrayDraft<Stash>, cache: WritableNonArrayDraft<StashSlotCache> },
  itemIdentifier: string,
  amount: number,
  options: RemoveItemRecipeOptions = { }
): void
{
  /** Validation: Is the stash maximum slot value valid? (Avoids infinite loops) */
  if (
    !Number.isSafeInteger(draft.stash.maxSlots) ||
    draft.stash.maxSlots < 1
  ) {
    throw new Error(`Invalid maximum slots for stash (id: ${draft.stash.id})`);
  }

  /** Validation: Is the preferred slot index valid? (Avoids infinite loops) */
  if (
    options.preferredSlot != null &&
    (
      !Number.isSafeInteger(options.preferredSlot) ||
      options.preferredSlot < 0 ||
      options.preferredSlot >= draft.stash.maxSlots
    )
  ) {
    throw new Error(`Invalid preferred slot index: ${options.preferredSlot}`);
  }

  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  let slotIndex: number, defaultSlotIndex: number, remainingAmount = amount;
  slotIndex = defaultSlotIndex = options.preferredSlot ?? 0;

  // TODO: Make use of cache. Take options.preferredSlot into consideration when making use of cache.

  /**
   * Start from default slot index (preferredSlot or 0), loop upwards through the stash,
   * and stop when we've checked all slots
  */
  do {
    const slot = draft.stash.slots[slotIndex];
    if (slot != null && slot.itemIdentifier == itemIdentifier) {
      const amountToRemove = Math.min(remainingAmount, slot.amount);
      if (options.spreadDisabled && amountToRemove < remainingAmount) {
        continue; // When spread is disabled, skip this slot if we can't remove all of the remaining amount from it
      }

      removeItemFromSlotRecipe(draft, itemIdentifier, slotIndex, amountToRemove, { });
      remainingAmount -= amountToRemove;
    }

    if (remainingAmount > 0 && options.spreadDisabled) {
      throw new Error(
        `There was not enough amount for removing ${amount} of ${itemIdentifier} in stash (id: ${draft.stash.id}) (000)`
      );
    }

    if (remainingAmount < 0) {
      throw new Error(
        `Negative overflow occured while removing ${amount} of ${itemIdentifier} in stash (id: ${draft.stash.id})`
      );
    }

    if (remainingAmount <= 0) {
      break;
    }
  } while (
    (slotIndex = (slotIndex + 1) % draft.stash.maxSlots) !== defaultSlotIndex
  );

  if (remainingAmount > 0) {
    throw new Error(
      `There was not enough amount for removing ${amount} of ${itemIdentifier} in stash (id: ${draft.stash.id}) (001)`
    );
  }
}

type RemoveItemRecipeOptions = {
  preferredSlot?: number;
  spreadDisabled?: boolean;
};

export function removeItemFromSlotRecipe(
  draft: { stash: WritableNonArrayDraft<Stash>, cache: WritableNonArrayDraft<StashSlotCache> },
  itemIdentifier: string,
  slotIndex: number,
  amount: number,
  options: RemoveItemFromSlotRecipeOptions = { }
): void
{
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  if (
    !Number.isSafeInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= draft.stash.maxSlots
  ) {
    throw new Error(`Invalid slot index: ${slotIndex}`);
  }

  const slot = draft.stash.slots[slotIndex];

  /** Validation: Does the slot contain the correct item? (the item or empty) */
  if (slot == null || slot.itemIdentifier !== itemIdentifier) {
    throw new Error(
      `Cannot remove ${amount} of ${itemIdentifier} from slot ${slotIndex} in stash (id: ${draft.stash.id}) `
      + `because it does not contain the correct item`);
  }

  if (amount > slot.amount) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  /** Validation: Does the slot have enough amount? */
  if (slot.amount - amount < 0) {
    throw new Error(
      `Negative amount would be reached while removing ${amount} of ${itemIdentifier} from slot `
      + `${slotIndex} in stash (id: ${draft.stash.id})`
    );
  }

  slot.amount -= amount;
  if (slot.amount == 0) {
    draft.stash.slots[slotIndex] = null;
  }
}

type RemoveItemFromSlotRecipeOptions = {
};

export function emptySlotRecipe(
  draft: { stash: WritableNonArrayDraft<Stash>, cache: WritableNonArrayDraft<StashSlotCache> },
  itemIdentifier: string,
  slotIndex: number
): void
{
  removeItemFromSlotRecipe(draft, itemIdentifier, slotIndex, draft.stash.slots[slotIndex]?.amount ?? 0, { });
}
