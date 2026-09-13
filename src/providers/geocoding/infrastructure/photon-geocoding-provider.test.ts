import { describe, expect, it, vi } from "vitest";
import { GeocodingProviderError } from "../application/geocoding-provider";
import { mapPhotonResponse, PhotonGeocodingProvider } from "./photon-geocoding-provider";

describe("PhotonGeocodingProvider", () => {
  it("maps Photon features into internal geocoding results", () => {
    expect(
      mapPhotonResponse({
        features: [
          {
            geometry: { coordinates: [14.043, 41.482] },
            properties: {
              osm_id: 123,
              osm_type: "way",
              street: "Via Colonia Giulia",
              housenumber: "10",
              city: "Venafro",
              state: "Molise",
              country: "Italia"
            }
          }
        ]
      })
    ).toEqual([
      {
        id: "way-123-41.482-14.043",
        label: "Via Colonia Giulia 10, Venafro, Molise, Italia",
        latitude: 41.482,
        longitude: 14.043,
        city: "Venafro",
        street: "Via Colonia Giulia"
      }
    ]);
  });

  it("does not leak invalid provider payloads", () => {
    expect(mapPhotonResponse({ features: [{ geometry: { coordinates: [200, 100] }, properties: { name: "Bad" } }] })).toEqual([]);
  });

  it("maps search results through fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              geometry: { coordinates: [14.0443, 41.4836] },
              properties: { osm_id: "1", osm_type: "node", name: "Corso Campano", city: "Venafro", country: "Italia" }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const provider = new PhotonGeocodingProvider({ baseUrl: "https://example.test", fetchImpl });

    await expect(provider.searchAddress({ query: "Corso Campano", limit: 3, bias: { latitude: 41.4821, longitude: 14.0474 } })).resolves.toEqual([
      expect.objectContaining({ label: "Corso Campano, Venafro, Italia", latitude: 41.4836, longitude: 14.0443 })
    ]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("q=Corso+Campano");
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("lat=41.4821");
  });

  it("raises an explicit provider error on failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 429 }));
    const provider = new PhotonGeocodingProvider({ baseUrl: "https://example.test", fetchImpl });

    await expect(provider.reverseGeocode({ latitude: 41.482, longitude: 14.043 })).rejects.toThrow(GeocodingProviderError);
  });
});
