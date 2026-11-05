import { Item, StashSlot, type Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { WritableNonArrayDraft } from 'immer';

import { StashSlotCache } from '../stash-slot.cache';

export function addItemRecipe(
  draft: { stash: WritableNonArrayDraft<Stash>, cache: WritableNonArrayDraft<StashSlotCache> },
  item: Item,
  amount: number,
  options: AddItemRecipeOptions = { blueprint: { itemIdentifier: item.id } }
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
    if (slot != null && slot.amount < item.stackSize && slot.itemIdentifier == item.id) {
      const amountToAdd = Math.min(remainingAmount, item.stackSize - slot.amount);
      if (options.spreadDisabled && amountToAdd < remainingAmount) {
        continue; // When spread is disabled, skip this slot if we can't add all of the remaining amount to it
      }

      addItemToSlotRecipe(draft, item, slotIndex, amountToAdd, { blueprint: options.blueprint });
      remainingAmount -= amountToAdd;
    } else if (slot == null) {
      const amountToAdd = Math.min(remainingAmount, item.stackSize);
      addItemToSlotRecipe(draft, item, slotIndex, amountToAdd, { blueprint: options.blueprint });
      remainingAmount -= amountToAdd;
    }

    if (remainingAmount > 0 && options.spreadDisabled) {
      throw new Error(
        `There was not enough space for adding ${amount} of ${item.id} in stash (id: ${draft.stash.id}) (000)`
      );
    }

    if (remainingAmount < 0) {
      throw new Error(
        `Negative overflow occured while adding ${amount} of ${item.id} in stash (id: ${draft.stash.id})`
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
      `There was not enough space for adding ${amount} of ${item.id} in stash (id: ${draft.stash.id}) (001)`
    );
  }
}

type AddItemRecipeOptions = {
  preferredSlot?: number;
  spreadDisabled?: boolean;
  blueprint: AddItemToSlotRecipeOptions['blueprint'];
};

export function addItemToSlotRecipe(
  draft: { stash: WritableNonArrayDraft<Stash>, cache: WritableNonArrayDraft<StashSlotCache> },
  item: Readonly<Item>,
  slotIndex: number,
  amount: number,
  options: AddItemToSlotRecipeOptions = { blueprint: { itemIdentifier: item.id } }
): void
{
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > item.stackSize) {
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
  if (slot != null && slot.itemIdentifier !== item.id) {
    throw new Error(
      `Cannot add ${item.id} to slot ${slotIndex} in stash (id: ${draft.stash.id}) `
      + `because it already contains ${slot.itemIdentifier}`);
  }

  /** Validation: Does the slot have enough space? */
  if ((slot?.amount ?? 0) + amount > item.stackSize) {
    throw new Error(
      `Overflow occured while adding ${amount} of ${item.id} to slot `
      + `${slotIndex} in stash (id: ${draft.stash.id})`
    );
  }

  /** Set the amount on said slot */
  if (slot == null) {
    draft.stash.slots[slotIndex] = {
      ...options.blueprint,
      amount: amount,
      itemIdentifier: item.id,
      slotIndex,
      stashId: draft.stash.id,
    };
  } else {
    slot.amount += amount;
  }
}

type AddItemToSlotRecipeOptions = {
  blueprint: Pick<StashSlot, undefined/* TODO: Replace `undefined` with `flags`, etc */>;
};
