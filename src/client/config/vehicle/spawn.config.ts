
import { Injectable } from 'injection-js';

@Injectable()
export class SpawningConfig {
  private readonly initializingVehicles = new Set<string>();

  public constructor() {
    Cfx.Client.AddStateBagChangeHandler(
      'armoury:vehicle:init',
      null,
      this.onVehicleShouldInit.bind(this)
    );
  }

  private onVehicleShouldInit(
    bagName: string,
    key: string,
    value: VehicleInitOptions
  ): void {
    if (
      !value ||
      value.init ||
      this.initializingVehicles.has(bagName)
    ) {
      return;
    }

    this.initializingVehicles.add(bagName);

    let lastAcknowledgement = 0;

    const stop = (): void => {
      Cfx.clearTick(tick);
      this.initializingVehicles.delete(bagName);
    };

    const tick = Cfx.setTick(() => {
      const state = Cfx.Client.GetStateBagValue(
        bagName,
        key
      ) as VehicleInitOptions | null;

      if (!state || state.init) {
        stop();
        return;
      }

      const entity = Cfx.Client.GetEntityFromStateBagName(bagName);
      if (entity === 0) return;

      if (
        Cfx.Client.NetworkGetEntityOwner(entity) !==
        Cfx.Client.PlayerId()
      ) {
        return;
      }

      // Avoid repeatedly initializing and acknowledging
      // on every frame.
      const now = Date.now();

      if (now - lastAcknowledgement < 1000) {
        return;
      }

      lastAcknowledgement = now;

      Cfx.Client.SetVehicleColours(
        entity,
        state.colorPrimary,
        state.colorSecondary
      );

      Cfx.Client.SetVehicleOnGroundProperly(entity);

      const networkId =
        Cfx.Client.NetworkGetNetworkIdFromEntity(entity);

      Cfx.emitNet('armoury:unsafe:vehicle:initialized', networkId, state.initId);
    });
  }
}

// TODO: Move to lib
type VehicleInitOptions = {
  init?: boolean;
  initId: number;
  colorPrimary: number;
  colorSecondary: number;
};
