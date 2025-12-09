export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export const geocodingService = {
  async forward(query: string): Promise<GeocodingResult[]> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CommunityManagementSystem/1.0',
      },
    });

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();

    return data.map((item: any) => ({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      displayName: item.display_name,
    }));
  },

  async reverse(latitude: number, longitude: number): Promise<GeocodingResult | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CommunityManagementSystem/1.0',
      },
    });

    if (!response.ok) {
      throw new Error('Reverse geocoding request failed');
    }

    const data = await response.json();

    if (!data || data.error) {
      return null;
    }

    return {
      latitude: parseFloat(data.lat),
      longitude: parseFloat(data.lon),
      displayName: data.display_name,
    };
  },
};
