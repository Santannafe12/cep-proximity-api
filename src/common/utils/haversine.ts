export const EARTH_RADIUS_KM = 6371;

export const SEARCH_RADIUS_KM = 1;

export const RADIUS_COMPARISON_TOLERANCE_KM = 1e-9;

const DECIMAL_PLACES = 2;

export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

export function haversineDistanceKm(
  origin: GeoCoordinate,
  destination: GeoCoordinate,
): number {
  assertFiniteCoordinate(origin);
  assertFiniteCoordinate(destination);

  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function isWithinSearchRadius(distanceKm: number): boolean {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error(
      'Distance must be a finite number greater than or equal to zero',
    );
  }

  return distanceKm <= SEARCH_RADIUS_KM + RADIUS_COMPARISON_TOLERANCE_KM;
}

export function roundHalfUpToTwoDecimals(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Value must be a finite number');
  }

  const sign = value < 0 ? -1 : 1;
  const scaled = Number(`${toPlainDecimal(Math.abs(value))}e${DECIMAL_PLACES}`);
  const rounded = Math.round(scaled);
  return sign * Number(`${rounded}e-${DECIMAL_PLACES}`);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function assertFiniteCoordinate(coordinate: GeoCoordinate): void {
  if (
    !Number.isFinite(coordinate.latitude) ||
    !Number.isFinite(coordinate.longitude)
  ) {
    throw new Error('Coordinate must use finite latitude and longitude');
  }
}

function toPlainDecimal(value: number): string {
  const text = value.toString();
  if (!text.includes('e')) {
    return text;
  }

  const [mantissaText, exponentText] = text.split('e');
  const exponent = Number(exponentText);
  const digits = mantissaText.replace('.', '');
  const decimalIndex =
    (mantissaText.includes('.') ? 1 : digits.length) + exponent;

  if (decimalIndex <= 0) {
    return `0.${'0'.repeat(-decimalIndex)}${digits}`;
  }

  if (decimalIndex >= digits.length) {
    return digits + '0'.repeat(decimalIndex - digits.length);
  }

  return `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}
