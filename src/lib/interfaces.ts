export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Leader {
  name: string;
  phone: string;
}

export interface Group {
  id: string;
  name: string;
  university: string;
  city: string;
  state: string;
  country: string;
  location: string;
  instagram: string;
  dayofweek: string;
  time: string;
  leader: Leader;
  coordinates: Coordinates;
  fullAddress?: string; // Optional full address from Google Places
  zipCode?: string; // Optional zip code from Google Places
} 