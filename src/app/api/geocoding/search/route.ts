import { NextResponse, type NextRequest } from "next/server";
import {
  GEOCODING_MAX_RESULTS,
  GeocodingProviderError,
  normalizeGeocodingLimit,
  validateSearchQuery,
  type GeocodingResult
} from "@/providers/geocoding/application/geocoding-provider";
import { createGeocodingProvider } from "@/providers/geocoding/infrastructure/provider-factory";
import { VENAFRO_MAP_CENTER } from "@/shared/config/map";

export async function GET(request: NextRequest) {
  const query = validateSearchQuery(request.nextUrl.searchParams.get("q") ?? "");

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const limit = normalizeGeocodingLimit(Number(request.nextUrl.searchParams.get("limit") ?? GEOCODING_MAX_RESULTS));

  try {
    const searchQuery = withVenafroContext(query);
    const results = await createGeocodingProvider().searchAddress({
      query: searchQuery,
      limit,
      bias: VENAFRO_MAP_CENTER
    });

    return NextResponse.json({ results: filterVenafroResults(results) });
  } catch (error) {
    if (!(error instanceof GeocodingProviderError)) {
      console.error("Geocoding search failed", error);
    }

    return NextResponse.json(
      { results: [], error: "Non siamo riusciti a trovare l'indirizzo. Puoi selezionare il punto direttamente sulla mappa." },
      { status: 503 }
    );
  }
}

function withVenafroContext(query: string): string {
  return query.toLowerCase().includes("venafro") ? query : `${query} Venafro`;
}

function filterVenafroResults(results: GeocodingResult[]): GeocodingResult[] {
  return results.filter((result) => {
    const city = result.city?.trim().toLowerCase();
    const labelParts = result.label.split(",").map((part) => part.trim().toLowerCase());

    return city ? city === "venafro" : labelParts.includes("venafro");
  });
}
