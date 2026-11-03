
import { EVENT_DIRECTIONS, EventListener } from '@armoury/fivem-framework-server';
import { Injectable } from 'injection-js';

@Injectable()
export class SpawningConfig {
  private readonly pending = new Set<number>();

  private readonly verificationInterval = 500;
  private readonly maxAttempts = 10;

  @EventListener({ eventName: 'armoury:unsafe:vehicle:initialized', direction: EVENT_DIRECTIONS.CLIENT_TO_SERVER })
  protected _onVehicleInitializedUnsafe(networkId: number, initId: number): void {
    const playerId = Cfx.source;

    if (
      !Number.isInteger(networkId) ||
      networkId <= 0 ||
      !Number.isSafeInteger(initId)
    ) {
      return;
    }

    const entity =
      Cfx.Server.NetworkGetEntityFromNetworkId(networkId);

    if (
      !entity ||
      !Cfx.Server.DoesEntityExist(entity) ||
      Cfx.Server.GetEntityType(entity) !== 2 ||
      Cfx.Server.NetworkGetEntityOwner(entity) !== playerId
    ) {
      return;
    }

    const state = Cfx.Server.Entity(entity).state;

    const options = state['armoury:vehicle:init'] as
      | VehicleInitOptions
      | undefined;

    if (
      !options ||
      options.init ||
      options.initId !== initId ||
      this.pending.has(entity)
    ) {
      return;
    }

    this.pending.add(entity);

    this.verify(entity, networkId, initId, 0);
  }

  private verify(
    entity: number,
    networkId: number,
    initId: number,
    attempt: number
  ): void {
    setTimeout(() => {
      if (
        !Cfx.Server.DoesEntityExist(entity) ||
        Cfx.Server.NetworkGetNetworkIdFromEntity(entity)
          !== networkId
      ) {
        this.pending.delete(entity);
        return;
      }

      const state = Cfx.Server.Entity(entity).state;

      const options = state['armoury:vehicle:init'] as
        | VehicleInitOptions
        | undefined;

      // The initialization request was cancelled,
      // replaced, or already completed.
      if (
        !options ||
        options.init ||
        options.initId !== initId
      ) {
        this.pending.delete(entity);
        return;
      }

      const [primary, secondary] =
        Cfx.Server.GetVehicleColours(entity);

      if (
        primary === options.colorPrimary &&
        secondary === options.colorSecondary
      ) {
        state.set(
          'armoury:vehicle:init',
          { ...options, init: true },
          true
        );

        this.pending.delete(entity);
        return;
      }

      if (attempt + 1 < this.maxAttempts) {
        this.verify(
          entity,
          networkId,
          initId,
          attempt + 1
        );
        return;
      }

      this.pending.delete(entity);

      console.warn(
        `Vehicle ${networkId} failed initialization verification.`
      );

      this.recreateVehicle(entity);
    }, this.verificationInterval);
  }

  private recreateVehicle(entity: number): void {
    throw new Error('recreateVehicle(entity: number) is not implemented.');
    
    // 1. Retrieve the vehicle's persisted definition.
    // 2. Remove the failed vehicle.
    // 3. Spawn a replacement vehicle.
    // 4. Assign a NEW initId and initialization state.
  }
}

// TODO: Move to lib
type VehicleInitOptions = {
  initId: number;
  init?: boolean;
  colorPrimary: number;
  colorSecondary: number;
};
