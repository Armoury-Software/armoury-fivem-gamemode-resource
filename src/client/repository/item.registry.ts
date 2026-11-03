import { UIListener } from '@armoury/fivem-framework-client';
import { type Item } from '@armoury/fivem-roleplay-gamemode-client';
import { Injectable } from 'injection-js';

// TODO: Make ItemService a shared script (client + server) and stop using this class
@Injectable()
export class ItemRegistry {

  private _items = new Map<string, Item>();

  public constructor() {
    this.loadAllItems();
  }

  private loadAllItems(): void {
    for (let i = 0; i < Cfx.Client.GetNumResources(); i++) {
      const resourceName = Cfx.Client.GetResourceByFindIndex(i);
      if (resourceName) {
        const filePath = 'items/items.json';
        try {
          const content = Cfx.Client.LoadResourceFile(resourceName, filePath);
          if (content != null) {
            const resourceItems: Item[] = JSON.parse(content);
            if (!Array.isArray(resourceItems)) {
              throw new Error('items.json should contain an array');
            }

            for (const item of resourceItems) {
              if (!item || !item.id) {
                throw new Error('items.json contains at least one invalid definition');
              }

              const realId = `${resourceName}:${item.id}`;
              this._items.set(realId, { ...item, id: realId });
            }

            console.log(
              `Loaded ${resourceItems.length} items from resource '${resourceName}':`,
              resourceItems.map(i => i.id).join(', ') + '.');
            
            console.log('Remove this log -', 'items are now', Object.fromEntries(this._items));
          }
        } catch (error) {
          console.log(`No item registered by resource (${resourceName}).`);
        }
      }
    }
  }

  @UIListener({ eventName: 'getItemDefinition' })
  protected UI_getItemDefinition({ itemIdentifier }: { itemIdentifier: string }): Item | null {
    return this._items.get(itemIdentifier) ?? null;
  }
}
