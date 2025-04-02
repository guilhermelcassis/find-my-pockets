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

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: {
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
          tipo?: string;
          local?: string;
          fulladdress?: string;
          zipcode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
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
          tipo?: string;
          local?: string;
          fulladdress?: string;
          zipcode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          university?: string;
          city?: string;
          state?: string;
          country?: string;
          location?: string;
          instagram?: string;
          dayofweek?: string;
          time?: string;
          leader?: Leader;
          coordinates?: Coordinates;
          tipo?: string;
          local?: string;
          fulladdress?: string;
          zipcode?: string;
          updated_at?: string;
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
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          email: string;
          curso: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          email?: string;
          curso?: string;
          updated_at?: string;
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