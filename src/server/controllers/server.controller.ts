import { Controller, Export } from '@armoury/fivem-framework';
import { type IItemBase } from '@armoury/fivem-roleplay-gamemode';

@Controller()
export class Server {
  private readonly _itemCache: IItemBase[] = [];

  @Export()
  public addToItemCache(...items: IItemBase[]): void {
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
  public getCachedItems(): IItemBase[] {
    return this._itemCache;
  }
}
