export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Leader {
  name: string;
  phone: string;
  email: string;
  curso: string;
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
  tipo?: string; // Public or Private (Publica ou Privada)
  local?: string; // Additional location information
  fulladdress?: string; // Optional full address from Google Places (keep camelCase for UI)
  zipcode?: string; // Optional zip code from Google Places (keep camelCase for UI)
} 