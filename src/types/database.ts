/** Generated-style Database types for Supabase-backed vertical slices. */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PermissionRole = "admin" | "editor" | "viewer";
export type DbRelationshipLabel =
  | "엄마"
  | "아빠"
  | "보호자"
  | "가족"
  | "시터"
  | "할머니"
  | "할아버지"
  | "기타";
export type MemberStatus = "pending" | "active" | "inactive";

export type CareLogPayload = {
  chip?: string;
  chip2?: string;
  stoolState?: string;
  amount?: string;
  duration?: string;
  notes?: string;
  title?: string;
  details?: string;
  nextAt?: string;
  voice?: boolean;
  rawTranscript?: string;
  confidence?: number;
  flags?: string[];
  createdBy?: {
    userId: string;
    name: string;
    role: string;
  };
};

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  preferred_language: string;
  created_at: string;
  updated_at: string;
};

export type BabyRow = {
  id: string;
  name: string;
  birth_date: string | null;
  due_date: string | null;
  child_status: string;
  gender: string | null;
  photo_url: string | null;
  gestational_age_weeks: number | null;
  birth_weight: string | null;
  special_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BabyMemberRow = {
  id: string;
  baby_id: string;
  user_id: string;
  permission_role: PermissionRole;
  relationship_label: DbRelationshipLabel;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
};

export type InviteCodeRow = {
  id: string;
  baby_id: string;
  code: string;
  created_by: string | null;
  permission_role: PermissionRole;
  relationship_label: DbRelationshipLabel;
  expires_at: string | null;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CareLogRow = {
  id: string;
  baby_id: string;
  client_generated_id: string | null;
  category: string;
  recorded_at: string;
  date_key: string;
  time_local: string;
  payload: CareLogPayload;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowthRecordRow = {
  id: string;
  baby_id: string;
  client_generated_id: string | null;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  head_circumference_cm: number | null;
  source: "hospital" | "home";
  input_method: "manual" | "ai_extract";
  user_confirmed: boolean;
  confidence: Json | null;
  original_text: Json | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, "id">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      babies: {
        Row: BabyRow;
        Insert: Partial<BabyRow> & Pick<BabyRow, "name">;
        Update: Partial<BabyRow>;
        Relationships: [];
      };
      baby_members: {
        Row: BabyMemberRow;
        Insert: Partial<BabyMemberRow> &
          Pick<BabyMemberRow, "baby_id" | "user_id" | "permission_role">;
        Update: Partial<BabyMemberRow>;
        Relationships: [];
      };
      invite_codes: {
        Row: InviteCodeRow;
        Insert: Partial<InviteCodeRow> & Pick<InviteCodeRow, "baby_id" | "code">;
        Update: Partial<InviteCodeRow>;
        Relationships: [];
      };
      care_logs: {
        Row: CareLogRow;
        Insert: Partial<CareLogRow> &
          Pick<CareLogRow, "baby_id" | "category" | "recorded_at" | "date_key" | "time_local">;
        Update: Partial<CareLogRow>;
        Relationships: [];
      };
      growth_records: {
        Row: GrowthRecordRow;
        Insert: Partial<GrowthRecordRow> &
          Pick<GrowthRecordRow, "baby_id" | "measured_at" | "created_by">;
        Update: Partial<GrowthRecordRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_baby_member: { Args: { p_baby_id: string }; Returns: boolean };
      baby_permission: { Args: { p_baby_id: string }; Returns: PermissionRole };
      can_edit_care_logs: { Args: { p_baby_id: string }; Returns: boolean };
      can_edit_growth_records: { Args: { p_baby_id: string }; Returns: boolean };
      create_baby_with_owner: {
        Args: {
          p_name: string;
          p_birth_date?: string | null;
          p_due_date?: string | null;
          p_child_status?: string | null;
          p_gender?: string | null;
          p_photo_url?: string | null;
          p_gestational_age_weeks?: number | null;
          p_birth_weight?: string | null;
          p_special_notes?: string | null;
          p_relationship_label?: DbRelationshipLabel;
        };
        Returns: BabyRow;
      };
    };
    Enums: {
      permission_role: PermissionRole;
      relationship_label: DbRelationshipLabel;
      member_status: MemberStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
