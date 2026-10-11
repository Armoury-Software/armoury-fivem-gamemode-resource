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
    console.log('onStart onClientGameTypeStart');
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
        }
      );
    });

    Cfx.exports['spawnmanager'].setAutoSpawn(true);
    Cfx.exports['spawnmanager'].forceRespawn();
  }
}

interface SpawnConfig {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}
