import { EventListener, Export } from '@armoury/fivem-framework-server';
import { type Item } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

// TODO: Does this need to be a shared(client + server) injectable?
@Injectable()
export class ItemService {

  private _items = new Map<string, Item>();

  public constructor() {
    this.loadAllItems();
  }

  @Export()
  public getById(id: string): Item | null {
    return this._items.get(id) ?? null;
  }

  private loadAllItems(): void {
    for (let i = 0; i < Cfx.Client.GetNumResources(); i++) {
      const resourceName = Cfx.Client.GetResourceByFindIndex(i);
      if (resourceName) {
        this.loadItemsFor(resourceName);
      }
    }
  }

  private loadItemsFor(resourceName: string): void {
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
      console.error(`There's been an error while loading items for resource (${resourceName}):`, error);
    }
  }

  @EventListener()
  protected onServerResourceStart(resourceName: string): void {
    if (!this._items.has(resourceName)) {
      this.loadItemsFor(resourceName);
    }
  }

}
