import { Config, EVENT_DIRECTIONS, EventListener, Resource, ResourceRef } from '@armoury/fivem-framework-client';
import { Injectable } from 'injection-js';

@Injectable()
export class SpawningConfig {
  public constructor(
    @Config('spawn') private readonly spawnConfig: SpawnConfig,
    @Resource('spawnmanager') private readonly spawnManager: ResourceRef
  ) {}

  @EventListener({ eventName: 'onClientGameTypeStart', direction: EVENT_DIRECTIONS.CLIENT_TO_CLIENT })
  public onStart() {
    this.spawnManager.instance.setAutoSpawnCallback(() => {
      this.spawnManager.instance.spawnPlayer(
        {
          x: this.spawnConfig.position.x,
          y: this.spawnConfig.position.y,
          z: this.spawnConfig.position.z,
          model: 'mp_m_freemode_01',
        },
        () => {
          Cfx.Client.SetEntityRotation(
            Cfx.Client.GetPlayerPed(-1),
            this.spawnConfig.rotation.x,
            this.spawnConfig.rotation.y,
            this.spawnConfig.rotation.z,
            2,
            true
          );

          this.removeMe_initializeModel();
        }
      );
    });

    this.spawnManager.instance.setAutoSpawn(true);
    this.spawnManager.instance.forceRespawn();
  }

  private async removeMe_initializeModel(): Promise<void> {
    const model: number = Cfx.Client.GetHashKey('mp_m_freemode_01');

    if (Cfx.Client.IsModelInCdimage(model) && Cfx.Client.IsModelValid(model)) {
      Cfx.Client.RequestModel(model);

      let attempts: number = 0;
      while (!Cfx.Client.HasModelLoaded(model)) {
        if (attempts > 10) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      Cfx.Client.SetPlayerModel(Cfx.Client.PlayerId(), model);

      const ped = Cfx.Client.PlayerPedId();

      // If male:
      if (model === Cfx.Client.GetHashKey('mp_m_freemode_01')) {
        Cfx.Client.SetPedComponentVariation(ped, 0, 0, 0, 2); // Face
        Cfx.Client.SetPedComponentVariation(ped, 2, 1, 4, 0); // Hair
        Cfx.Client.SetPedComponentVariation(ped, 4, 4, 2, 0); //  Pantalon
        Cfx.Client.SetPedComponentVariation(ped, 6, 1, 0, 2); //  Shoes
        Cfx.Client.SetPedComponentVariation(ped, 8, 15, 0, 0); // Undershirt (none)
        Cfx.Client.SetPedComponentVariation(ped, 11, 0, 8, 0); // Jacket
      } else {
        Cfx.Client.SetPedComponentVariation(ped, 0, 21, 0, 0); // Face
        Cfx.Client.SetPedComponentVariation(ped, 2, 11, 4, 0); // Hair
        Cfx.Client.SetPedComponentVariation(ped, 4, 6, 1, 0); //  Pantalon
        Cfx.Client.SetPedComponentVariation(ped, 6, 1, 1, 2); //  Shoes
        Cfx.Client.SetPedComponentVariation(ped, 8, 2, 0, 0); // Undershirt
        Cfx.Client.SetPedComponentVariation(ped, 11, 23, 1, 0); // Jacket
      }

      Cfx.Client.SetModelAsNoLongerNeeded(model);
    }
  }
}

interface SpawnConfig {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}
