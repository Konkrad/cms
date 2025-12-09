import type { RequestHandler } from '@builder.io/qwik-city';
import { geocodingService } from '~/services/geocoding.service';

export const onGet: RequestHandler = async ({ query, json }) => {
  const queryParam = query.get('query');
  const lat = query.get('lat');
  const lon = query.get('lon');

  try {
    if (queryParam) {
      const results = await geocodingService.forward(queryParam);
      json(200, results);
    } else if (lat && lon) {
      const result = await geocodingService.reverse(parseFloat(lat), parseFloat(lon));
      json(200, result);
    } else {
      json(400, { error: 'Either query or lat/lon parameters are required' });
    }
  } catch (error) {
    json(500, { error: 'Geocoding request failed' });
  }
};
