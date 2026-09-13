import { NextResponse, type NextRequest } from "next/server";
import { GeocodingProviderError, isValidCoordinate } from "@/providers/geocoding/application/geocoding-provider";
import { createGeocodingProvider } from "@/providers/geocoding/infrastructure/provider-factory";

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));

  if (!isValidCoordinate(latitude, longitude)) {
    return NextResponse.json({ result: null, error: "Coordinate non valide." }, { status: 400 });
  }

  try {
    const result = await createGeocodingProvider().reverseGeocode({ latitude, longitude });
    return NextResponse.json({ result });
  } catch (error) {
    if (!(error instanceof GeocodingProviderError)) {
      console.error("Reverse geocoding failed", error);
    }

    return NextResponse.json(
      { result: null, error: "Non siamo riusciti a ricavare l'indirizzo dal punto selezionato." },
      { status: 503 }
    );
  }
}
