export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Leader {
  name: string;
  phone: string;
  email: string;
  curso: string;
  active?: boolean; // Field to determine if the leader is active or deactivated
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
  leader_id?: string; // Reference to the leader's ID
  coordinates: Coordinates;
  tipo?: string; // Public or Private (Publica ou Privada)
  local?: string; // Additional location information
  fulladdress?: string; // Optional full address from Google Places (keep camelCase for UI)
  zipcode?: string; // Optional zip code from Google Places (keep camelCase for UI)
  active?: boolean; // Field to determine if the group is active or deactivated
} 