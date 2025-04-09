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

export interface MeetingTime {
  id?: string;
  dayofweek: string;
  time: string;
  local?: string; // Specific location for this meeting time
}

export interface Group {
  id: string;
  university: string;
  city: string;
  state: string;
  country: string;
  instagram: string;
  meetingTimes: MeetingTime[]; // Array of meeting times
  leader: Leader;
  leader_id?: string; // Reference to the leader's ID
  coordinates: Coordinates;
  tipo: string; // Public or Private (Publica ou Privada) - Required
  fulladdress?: string; // Optional full address from Google Places
  active?: boolean; // Field to determine if the group is active or deactivated
  zipcode?: string; // Optional field
} 