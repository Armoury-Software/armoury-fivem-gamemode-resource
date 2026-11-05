import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { Immutable } from 'immer';

import { StashRecipeDraft, type StashChangeHandler } from './stash.interaction';

@Injectable()
export class StashSlotsSwapInteraction implements StashChangeHandler<unknown> {

  public validateAndResolve(
    change: unknown /* TODO: Add typing to this */,
    source: Immutable<Stash>,
    target: Immutable<Stash>
  ): void {
    // TODO: Throw errors here.
  }

  public static bake(
    draft: StashRecipeDraft,
    change: unknown /* TODO: Add typing to this */,
  ): void {
    // TODO: Make changes to the cache

    const { sourceSlotId, targetSlotId } = change as { sourceSlotId: number; targetSlotId: number };

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
    const sourceSlot = sourceSlots[sourceSlotId];
    const targetSlots = draft.target?.slots ?? sourceSlots;

    if (sourceSlots == targetSlots && sourceSlotId == targetSlotId) {
      throw new Error(
        'Illegal operation: same stash swaps cannot have the same slot ID for both '
        + 'source and target.'
      );
    }

    sourceSlots[sourceSlotId] = targetSlots[targetSlotId];
    targetSlots[targetSlotId] = sourceSlot;

    if (sourceSlots[sourceSlotId] != null) {
      sourceSlots[sourceSlotId]!.slotIndex = sourceSlotId;
    }

    if (targetSlots[targetSlotId] != null) {
      targetSlots[targetSlotId]!.slotIndex = targetSlotId;
    }
  }
}
