// import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
// import { Injectable } from 'injection-js';
// import { Immutable, WritableNonArrayDraft } from 'immer';

// import { StashInteraction, SourceRecipe, TargetRecipe } from './stash.interaction';
// import { StashSlotCache } from '../../stash-slot.cache';
// import { ItemService } from '../../items/item.service';

// /**
//  * Handles interaction when the quantity of a slot is split, and the split amount is placed
//  * onto either an empty slot or a slot with the same item (as long as the destination slot
//  * amount does not overflow)
// */
// @Injectable()
// export class StashSlotSplitInteraction implements StashInteraction<unknown/* TODO: Type this */, Transient> {

//   public constructor(
//     private readonly _slotCache: StashSlotCache,
//     private readonly _items: ItemService,
//   ) {}

//   public resolve(
//     change: unknown /* TODO: Add typing to this */,
//     source: Immutable<Stash>,
//     target: Immutable<Stash>
//   ): {
//     sourceRecipe: SourceRecipe<unknown, Transient>;
//     targetRecipe?: TargetRecipe<unknown/* TODO: Type this */, Transient>;
//   } {
//     // TODO: Validate this

//     if (!source) {
//       throw new Error('There needs to be at least a source stash.');
//     }
    
//     const { sourceSlotId, targetSlotId, amount: reqAmount } = change as { sourceSlotId: number; targetSlotId: number, amount: number };
//     if (
//       sourceSlotId == null || sourceSlotId < 0 || sourceSlotId > source.maxSlots - 1
//       || targetSlotId == null || targetSlotId < 0 || targetSlotId > target.maxSlots - 1
//       || (source.id == target?.id && sourceSlotId == targetSlotId)
//     ) {
//       throw new Error('Invalid sourceSlotId/targetSlotId.');
//     }

//     const amount = Number(reqAmount);
//     if (Number.isNaN(amount) || amount < 0) {
//       throw new Error('Forbidden operation (V-000)');
//     }

//     if (
//       target.slots[targetSlotId] != null
//       && target.slots[targetSlotId].itemIdentifier != source.slots[sourceSlotId].itemIdentifier
//     ) {
//       throw new Error('Forbidden operation (V-001)');
//     }

//     return {
//       // TODO: Update the cache, by making use of _slotCache and its methods.
//       sourceRecipe: StashSlotSplitInteraction.prepareSource,
//       targetRecipe: target != null ? StashSlotSplitInteraction.prepareTarget : undefined,
//     };
//   }

//   public static prepareSource(draft: WritableNonArrayDraft<Stash>, change: unknown, cache: StashSlotCache): Transient {
//     const { sourceSlotId, amount: reqAmount } = change as { sourceSlotId: number; amount: number };
//     if (
//       sourceSlotId == null || sourceSlotId < 0 || sourceSlotId > draft.maxSlots - 1
//     ) {
//       throw new Error('Invalid sourceSlotId.');
//     }

//     const slots = draft.slots!;
//     const sourceSlot = slots[sourceSlotId];
//     const amount = Number(reqAmount);

//     if (sourceSlot == null) {
//       throw new Error('Forbidden operation (000)');
//     }

//     if (Number.isNaN(amount) || amount < 0) {
//       throw new Error('Forbidden operation (001)');
//     }

//     if (sourceSlot.amount < amount) {
//       throw new Error('Forbidden operation (002)');
//     }

//     slots[sourceSlotId].amount -= amount;
//     if (slots[sourceSlotId].amount <= 0) {
//       slots[sourceSlotId] = null;
//     }

//     return ({
//       itemIdentifier: sourceSlot.itemIdentifier,
//       /* flags: <...> */
//     });
//   }

//   public static prepareTarget(draft: WritableNonArrayDraft<Stash>, change: unknown, transientArgs: Transient, cache: StashSlotCache, items: ItemService): void {
//     const { targetSlotId, amount: reqAmount } = change as { targetSlotId: number; amount: number };
//     if (
//       targetSlotId == null || targetSlotId < 0 || targetSlotId > draft.maxSlots - 1
//     ) {
//       throw new Error('Invalid targetSlotId.');
//     }

//     const slots = draft.slots!;
//     const targetSlot = slots[targetSlotId];
//     const amount = Number(reqAmount);

//     if (Number.isNaN(amount) || amount < 0) {
//       throw new Error('Forbidden operation (001)');
//     }

//     const item = items.getById(transientArgs.itemIdentifier);
//     if (
//       (targetSlot?.amount ?? 0) + amount > item.stackSize 
//     ) {
//       throw new Error('Forbidden operation (003)');
//     }

//     if (targetSlot == null) {
//       slots[targetSlotId] = {
//         itemIdentifier: transientArgs.itemIdentifier,
//         amount: 0,
//         slotIndex: targetSlotId,
//         stashId: draft.id,
//         /* flags: <...> */
//       }
//     }
//     slots[targetSlotId].amount += amount;
//   }
// }

// type Transient = {
//   itemIdentifier: string,
//   /* flags: ItemFlags */
// }
