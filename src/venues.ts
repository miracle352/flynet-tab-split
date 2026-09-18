import { getRestaurantLocations, listRestaurants } from "./flynetClient";
import type { Location, Restaurant } from "./types";

/**
 * Server-only venue catalog loader.
 *
 * Composes `GET /restaurants` with `GET /restaurants/{id}/locations`
 * so the picker renders in one round trip instead of N+1 fetches from
 * the browser. Keep this out of client components — it pulls in
 * `flynetClient`, which reads API credentials from `process.env`.
 */

export interface VenueOption {
  restaurant: Restaurant;
  locations: Location[];
}

export interface VenueCatalog {
  venues: VenueOption[];
  /** Total restaurants the API reports, before pagination. */
  totalCount: number;
  /** True when the API had more pages than `MAX_PAGES` allows. */
  truncated: boolean;
}

const PAGE_SIZE = 50;

/**
 * Safety net: a misbehaving `next_page` cursor must not spin forever.
 * At 50 per page this still covers 1,000 restaurants.
 */
const MAX_PAGES = 20;

interface RestaurantPage {
  restaurants: Restaurant[];
  totalCount: number;
  truncated: boolean;
}

async function allRestaurants(): Promise<RestaurantPage> {
  const first = await listRestaurants({ page: 0, page_size: PAGE_SIZE });
  const restaurants = [...first.restaurants];

  let next = first.pagination.next_page;
  let pagesRead = 1;
  while (next !== null && pagesRead < MAX_PAGES) {
    const page = await listRestaurants({ page: next, page_size: PAGE_SIZE });
    restaurants.push(...page.restaurants);
    next = page.pagination.next_page;
    pagesRead += 1;
  }

  return {
    restaurants,
    totalCount: first.pagination.total_count,
    truncated: next !== null,
  };
}

export async function loadVenueCatalog(): Promise<VenueCatalog> {
  const { restaurants, totalCount, truncated } = await allRestaurants();

  // Locations for every restaurant are independent, so fan out.
  const locationPages = await Promise.all(
    restaurants.map((restaurant) =>
      getRestaurantLocations(restaurant.id, { page: 0, page_size: PAGE_SIZE }),
    ),
  );

  const venues = restaurants.map((restaurant, index) => ({
    restaurant,
    locations: locationPages[index].locations,
  }));

  return { venues, totalCount, truncated };
}
