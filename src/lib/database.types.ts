export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Leader {
  name: string;
  phone: string;
  email: string;
  curso: string;
  active?: boolean;
}

export interface MeetingTime {
  id?: string;
  dayofweek: string;
  time: string;
  local?: string;
}

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string;
          university: string;
          city: string;
          state: string;
          country: string;
          instagram?: string;
          leader: Leader;
          leader_id?: string;
          coordinates: Coordinates;
          tipo?: string;
          fulladdress?: string;
          created_at?: string;
          updated_at?: string;
          active?: boolean;
          meetingTimes?: MeetingTime[];
        };
        Insert: {
          id?: string;
          university: string;
          city: string;
          state: string;
          country: string;
          instagram?: string;
          leader: Leader;
          leader_id?: string;
          coordinates: Coordinates;
          tipo?: string;
          fulladdress?: string;
          created_at?: string;
          updated_at?: string;
          active?: boolean;
          meetingTimes?: MeetingTime[];
        };
        Update: {
          id?: string;
          university?: string;
          city?: string;
          state?: string;
          country?: string;
          instagram?: string;
          leader?: Leader;
          leader_id?: string;
          coordinates?: Coordinates;
          tipo?: string;
          fulladdress?: string;
          updated_at?: string;
          active?: boolean;
          meetingTimes?: MeetingTime[];
        };
      };
      leaders: {
        Row: {
          id: string;
          name: string;
          phone: string;
          email: string;
          curso: string;
          created_at?: string;
          active?: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          email: string;
          curso: string;
          created_at?: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          email?: string;
          curso?: string;
          updated_at?: string;
          active?: boolean;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
} 