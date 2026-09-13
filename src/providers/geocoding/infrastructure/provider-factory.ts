import { PhotonGeocodingProvider } from "./photon-geocoding-provider";
import type { GeocodingProvider } from "../application/geocoding-provider";

export function createGeocodingProvider(): GeocodingProvider {
  const provider = process.env.GEOCODING_PROVIDER?.trim().toLowerCase() || "photon";

  switch (provider) {
    case "photon":
      return new PhotonGeocodingProvider();
    default:
      return new PhotonGeocodingProvider();
  }
}
