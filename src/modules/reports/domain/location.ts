import { InvalidLocationError } from "./errors";

export type LocationSnapshot = {
  latitude: number;
  longitude: number;
  address?: string;
};

export class Location {
  private constructor(
    readonly latitude: number,
    readonly longitude: number,
    readonly address?: string
  ) {}

  static create(input: LocationSnapshot): Location {
    if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
      throw new InvalidLocationError("Latitude must be a finite number between -90 and 90.");
    }

    if (
      !Number.isFinite(input.longitude) ||
      input.longitude < -180 ||
      input.longitude > 180
    ) {
      throw new InvalidLocationError("Longitude must be a finite number between -180 and 180.");
    }

    const address = input.address?.trim();

    return new Location(
      input.latitude,
      input.longitude,
      address && address.length > 0 ? address : undefined
    );
  }

  toSnapshot(): LocationSnapshot {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
      ...(this.address ? { address: this.address } : {})
    };
  }
}

