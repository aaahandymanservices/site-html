import { SERVED_ZIPS, SERVICE_ROUTES } from "../functions/generated/service-zones.mjs";

/*
 * Server-side counterpart to the ZIP check the booking widget runs in the
 * browser. The browser copy exists to tell someone they are outside the county
 * before they finish typing; this one exists because a browser check is a
 * courtesy, not a control -- the API is what decides what gets written to the
 * bookings table.
 *
 * Both read the same generated table (see scripts/build-service-zones.mjs), so
 * "which ZIPs do we serve" is answered in one place.
 */

export type ServiceLocation = {
  zip: string;
  city: string;
  zone: string;
  route: string | null;
  routeLabel: string | null;
  routeDays: number[];
  served: boolean;
};

/** Oakland County ZIPs all start 480–484; anything else is a different county. */
const OAKLAND_COUNTY_PREFIX = /^48[0-4]\d{2}$/;

export const normalizeZip = (value: unknown) => String(value ?? "").trim().slice(0, 10).replace(/\D/g, "").slice(0, 5);

export const isOaklandCountyZip = (zip: string) => OAKLAND_COUNTY_PREFIX.test(zip);

/**
 * Resolve a ZIP to the city, travel zone, and route day we serve it on.
 *
 * A ZIP we do not list explicitly but that still reads as Oakland County comes
 * back `served: true` with no city or route: the business does cover the whole
 * county, and refusing a booking because a new subdivision's ZIP has not been
 * added to the JSON yet would turn a data gap into a lost customer. Only a ZIP
 * outside the county entirely is reported unserved.
 */
export const resolveServiceLocation = (rawZip: unknown): ServiceLocation | null => {
  const zip = normalizeZip(rawZip);
  if (zip.length !== 5) return null;

  const match = Object.prototype.hasOwnProperty.call(SERVED_ZIPS, zip) ? SERVED_ZIPS[zip] : null;
  if (!match) {
    return {
      zip,
      city: "",
      zone: "",
      route: null,
      routeLabel: null,
      routeDays: [],
      served: isOaklandCountyZip(zip),
    };
  }

  const route = match.route && Object.prototype.hasOwnProperty.call(SERVICE_ROUTES, match.route)
    ? SERVICE_ROUTES[match.route]
    : null;

  return {
    zip,
    city: match.city,
    zone: match.zone,
    route: match.route,
    routeLabel: route ? route.label : null,
    routeDays: route ? route.days : [],
    served: true,
  };
};
