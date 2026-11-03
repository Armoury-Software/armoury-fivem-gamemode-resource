import { Vehicle } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { randomInt } from 'node:crypto';

import { VehicleRepository } from '../../repository/vehicle/vehicle.repository';
import { Command } from '@armoury/fivem-framework-server';


// TODO: Destroy all vehicles when resource stops
@Injectable()
export class VehicleService {

  public constructor(
    private readonly _repository: VehicleRepository,
  ) {}

  public async insert(
    modelHash: string | number,
		type: string,
    colorPrimary: number,
    colorSecondary: number,
    [posX, posY, posZ]: [number, number, number],
    [rotX, rotY, rotZ]: [number, number, number],
  ): Promise<Vehicle> {
    const vehicle = await this._repository.create(
      modelHash,
      type,
      colorPrimary,
      colorSecondary,
      [posX, posY, posZ],
      [rotX, rotY, rotZ]
    );

    return vehicle;
  }

  public spawn(
    modelHash: string | number,
		type: string,
    colorPrimary: number,
    colorSecondary: number,
    [posX, posY, posZ]: [number, number, number],
    [,, rotZ]: [number, number, number]
  ): void {
    // Persisted hashes may be strings; FiveM hashes string arguments as model names.
    const model = typeof modelHash === 'string' && /^-?\d+$/.test(modelHash.trim())
      ? Number(modelHash)
      : modelHash;
    const heading = ((rotZ % 360) + 360) % 360;
    const vehicle = Cfx.Server.CreateVehicleServerSetter(model, type, posX, posY, posZ, heading);

    if (!vehicle) {
      console.error(`Failed to spawn vehicle: model=${model}, type=${type}, position=${posX},${posY},${posZ}`);
      return;
    }

    const state = Cfx.Entity(vehicle).state;
    const initId = randomInt(0, 2 ** 48 - 1);

    state.set('armoury:vehicle:init', { colorPrimary, colorSecondary, initId }, true);
  }

  @Command({ permissions: 'armoury.vehicle.create' })
  protected createVehicle(
    playerId: number,
    modelHash: string,
    type: string,
    colorPrimary: number,
    colorSecondary: number
  ): void {
    if (!modelHash || !type || colorPrimary == null || colorSecondary == null) {
      return;
    }
    
    const playerPed = Cfx.Server.GetPlayerPed(playerId as any);
    const coords = Cfx.Server.GetEntityCoords(playerPed) as [number, number, number];
    const rotation = [0, 0, 0] as [number, number, number];

    this.spawn(
      modelHash,
      type,
      colorPrimary,
      colorSecondary,
      coords,
      rotation
    );

    this.insert(
      modelHash,
      type,
      Number(colorPrimary),
      Number(colorSecondary),
      coords,
      rotation
    );
  }

  @Command({ permissions: 'armoury.vehicle.create' })
  protected persistVehicle(playerId: number): void {
    const playerPed = Cfx.Server.GetPlayerPed(playerId as any);
    const vehicle = Cfx.Server.GetVehiclePedIsIn(playerPed, false);
    if (!vehicle) {
      return;
    }

    // TODO: Check whether the state bag of the current vehicle has an "id"/"vehicleId" assigned to it. Return if yes!

    const modelHash = Cfx.Server.GetEntityModel(vehicle);
    const type = Cfx.Server.GetVehicleType(vehicle);
    const [colorPrimary, colorSecondary] = Cfx.Server.GetVehicleColours(vehicle);
    const coords = Cfx.Server.GetEntityCoords(vehicle) as [number, number, number];
    const rotation = Cfx.Server.GetEntityRotation(vehicle) as [number, number, number];

    this.insert(
      modelHash,
      type,
      Number(colorPrimary),
      Number(colorSecondary),
      coords,
      rotation
    );
  }

}
