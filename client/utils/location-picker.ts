import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

// Request location permissions
async function requestLocationPermission(): Promise<boolean> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Location permission is required to share your location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          }
        },
      ]
    );
    return false;
  }

  return true;
}

// Get current location
export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    // Try to get address from coordinates
    let name: string | undefined;
    let address: string | undefined;

    try {
      const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode) {
        name = geocode.name || geocode.street;
        address = [
          geocode.street,
          geocode.city,
          geocode.region,
          geocode.country,
        ]
          .filter(Boolean)
          .join(', ');
      }
    } catch (error) {
      console.log('Could not get address from coordinates');
    }

    return {
      latitude,
      longitude,
      name: name || 'Current Location',
      address,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    Alert.alert('Error', 'Failed to get your location. Please try again.');
    return null;
  }
}

// Format location for display
export function formatLocationName(location: LocationData): string {
  if (location.name) return location.name;
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

// Open location in maps app
export function openInMaps(location: LocationData): void {
  const { latitude, longitude, name } = location;
  const label = encodeURIComponent(name || 'Shared Location');

  let url: string;
  if (Platform.OS === 'ios') {
    url = `maps:0,0?q=${label}@${latitude},${longitude}`;
  } else {
    url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
  }

  Linking.canOpenURL(url).then((supported) => {
    if (supported) {
      Linking.openURL(url);
    } else {
      // Fallback to Google Maps web
      const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.openURL(webUrl);
    }
  });
}
