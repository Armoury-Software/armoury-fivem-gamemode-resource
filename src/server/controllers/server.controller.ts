import { Controller, Export } from '@armoury/fivem-framework-server';

// The cache only needs registration metadata, independent of an item's implementation.
interface CachedItem {
  identifier: string;
  weightPerUnit: number;
  fullyOccupiesSlot: boolean;
}

@Controller()
export class Server {
  private readonly _itemCache: CachedItem[] = [];

  @Export()
  public addToItemCache(...items: CachedItem[]): void {
    items.forEach((item) => {
      const existingCachedItem = this._itemCache.find((cachedItem) => cachedItem.identifier === item.identifier);
      if (existingCachedItem) {
        console.warn(
          `[Armoury:] An item with identifier ${item.identifier} is planned to be registered, but an item with this identifier has already been cached. Be aware that this can cause issues.`
        );
        this._itemCache[this._itemCache.indexOf(existingCachedItem)] = item;
      } else {
        this._itemCache.push(item);
      }

      console.log(
        `[Armoury:] Successfully registered item with identifier ${item.identifier} (WPU: ${item.weightPerUnit}, FOS: ${item.fullyOccupiesSlot}).`
      );
    });
  }

  @Export()
  public getCachedItems(): CachedItem[] {
    return this._itemCache;
  }
}
