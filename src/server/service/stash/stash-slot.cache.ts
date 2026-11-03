import { Injectable } from 'injection-js';

@Injectable()
export class StashSlotCache {

  private _stashesToItemTypes = new Map<number, Record<string, Cache>>();

  public updateAmount(stashId: number, itemIdentifier: string, slotIndex: number, amount: number): void {
    if (!this._stashesToItemTypes.has(stashId)) {
      if (!amount) return;
      this._stashesToItemTypes.set(stashId, {});
    }

    if (!this._stashesToItemTypes.get(stashId)![itemIdentifier]) {
      if (!amount) return;
      this._stashesToItemTypes.get(stashId)![itemIdentifier] = new Cache();
    }

    console.log(`Stash (id: ${stashId}) now knows about having ${amount} amount of ${itemIdentifier} in slot ${slotIndex}.`);
    const cache = this._stashesToItemTypes.get(stashId)![itemIdentifier]!;
    cache.updateAmount(slotIndex, amount);
  }

  public disregard(stashId: number, itemIdentifier: string, slotIndex: number): void {
    return this.updateAmount(stashId, itemIdentifier, slotIndex, 0);
  }

}

class Cache extends Map<number, number> {

  public updateAmount(slotIndex: number, amount: number): void {
    if (amount == 0) {
      this.delete(slotIndex);
      return;
    }

    this.set(slotIndex, amount);
  }

}
