import {
  EARTH_RADIUS_KM,
  haversineDistanceKm,
  isWithinSearchRadius,
  roundHalfUpToTwoDecimals,
} from './haversine';

describe('haversine', () => {
  const origin = { latitude: -23.5500806, longitude: -46.6340827 };

  it('matches one degree of longitude at the equator', () => {
    const oneDegreeAtEquatorKm = EARTH_RADIUS_KM * (Math.PI / 180);

    expect(
      haversineDistanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeCloseTo(oneDegreeAtEquatorKm, 8);
  });

  it('keeps points inside 1 km and excludes points outside it', () => {
    const nearby = moveNorth(origin, 0.5);
    const far = moveNorth(origin, 2);

    const nearbyDistance = haversineDistanceKm(origin, nearby);
    const farDistance = haversineDistanceKm(origin, far);

    expect(nearbyDistance).toBeLessThan(1);
    expect(isWithinSearchRadius(nearbyDistance)).toBe(true);
    expect(farDistance).toBeGreaterThan(1);
    expect(isWithinSearchRadius(farDistance)).toBe(false);
  });
});

describe('search radius comparison', () => {
  it('uses the raw distance and does not treat 1.004 km as 1.00 km', () => {
    expect(roundHalfUpToTwoDecimals(1.004)).toBe(1);
    expect(isWithinSearchRadius(1.004)).toBe(false);
  });

  it('keeps 0.996 km inside the radius and then rounds it to 1', () => {
    expect(isWithinSearchRadius(0.996)).toBe(true);
    expect(roundHalfUpToTwoDecimals(0.996)).toBe(1);
  });
});

describe('roundHalfUpToTwoDecimals', () => {
  it('rounds 1.005 half-up even though Number#toFixed does not', () => {
    expect(Number((1.005).toFixed(2))).toBe(1);
    expect(roundHalfUpToTwoDecimals(1.005)).toBe(1.01);
  });
});

function moveNorth(
  coordinate: { latitude: number; longitude: number },
  distanceKm: number,
): { latitude: number; longitude: number } {
  const deltaLatitude = (distanceKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  return {
    latitude: coordinate.latitude + deltaLatitude,
    longitude: coordinate.longitude,
  };
}
