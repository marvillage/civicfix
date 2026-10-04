import axios from "axios";
import { BRAND } from "../config/brand";

interface GeocodingResponse {
  display_name?: string;
  address?: Record<string, string>;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const response = await axios.get<GeocodingResponse>(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          lat: latitude,
          lon: longitude,
          format: "json",
        },
        headers: {
          "User-Agent": `${BRAND.name}/1.0`,
        },
      }
    );

    return response.data.display_name ?? null;
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return null;
  }
}