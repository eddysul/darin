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
export type MemoryPrivacyType = "only_me" | "family_circle" | "tagged_family" | "selected_people";
export type MemoryMediaType = "image" | "video";
export type MemoryTagType = "baby" | "family_member" | "friend_baby" | "manual_guest";
export type MemoryTagStatus = "approved" | "pending" | "rejected";
export type DiaryMediaType = "image";
export type GrowthBookStatus = "draft" | "ready" | "exported";
export type GrowthBookPageType = "cover" | "diary" | "letter" | "rolling_paper" | "custom";
export type GrowthBookCommentType = "page_comment" | "rolling_paper" | "letter";

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
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DiaryEntryRow = {
  id: string;
  baby_id: string;
  author_id: string;
  entry_date: string;
  title: string | null;
  body: string | null;
  mood: string | null;
  weather: string | null;
  tags: string[];
  included_in_growth_book: boolean;
  client_generated_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DiaryMediaRow = {
  id: string;
  diary_entry_id: string;
  baby_id: string;
  storage_path: string;
  media_type: DiaryMediaType;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type GrowthBookRow = {
  id: string;
  baby_id: string;
  title: string | null;
  status: GrowthBookStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type GrowthBookPageRow = {
  id: string;
  growth_book_id: string;
  baby_id: string;
  page_type: GrowthBookPageType;
  diary_entry_id: string | null;
  page_order: number;
  layout_type: string | null;
  content_json: Json;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type GrowthBookMediaRow = {
  id: string;
  growth_book_id: string;
  page_id: string | null;
  baby_id: string;
  storage_path: string;
  media_type: "image";
  width: number | null;
  height: number | null;
  created_by: string;
  created_at: string;
};

export type GrowthBookCommentRow = {
  id: string;
  growth_book_id: string;
  page_id: string | null;
  diary_entry_id: string | null;
  baby_id: string;
  author_id: string;
  body: string;
  comment_type: GrowthBookCommentType;
  metadata: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MemoryPostRow = {
  id: string;
  baby_id: string;
  author_id: string;
  caption: string | null;
  privacy_type: MemoryPrivacyType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MemoryMediaRow = {
  id: string;
  memory_post_id: string;
  baby_id: string;
  storage_path: string;
  media_type: MemoryMediaType;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type MemoryTagRow = {
  id: string;
  memory_post_id: string;
  tag_type: MemoryTagType;
  baby_id: string | null;
  tagged_user_id: string | null;
  tagged_baby_id: string | null;
  manual_label: string | null;
  status: MemoryTagStatus;
  created_by: string;
  created_at: string;
};

export type MemorySelectedPersonRow = {
  id: string;
  memory_post_id: string;
  user_id: string;
  created_at: string;
};

export type MemoryCommentRow = {
  id: string;
  memory_post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MemoryReactionRow = {
  id: string;
  memory_post_id: string;
  author_id: string;
  reaction_type: string;
  created_at: string;
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
      diary_entries: {
        Row: DiaryEntryRow;
        Insert: Partial<DiaryEntryRow> &
          Pick<DiaryEntryRow, "baby_id" | "author_id" | "entry_date">;
        Update: Partial<DiaryEntryRow>;
        Relationships: [];
      };
      diary_media: {
        Row: DiaryMediaRow;
        Insert: Partial<DiaryMediaRow> &
          Pick<DiaryMediaRow, "diary_entry_id" | "baby_id" | "storage_path">;
        Update: Partial<DiaryMediaRow>;
        Relationships: [];
      };
      growth_books: {
        Row: GrowthBookRow;
        Insert: Partial<GrowthBookRow> & Pick<GrowthBookRow, "baby_id" | "created_by">;
        Update: Partial<GrowthBookRow>;
        Relationships: [];
      };
      growth_book_pages: {
        Row: GrowthBookPageRow;
        Insert: Partial<GrowthBookPageRow> &
          Pick<GrowthBookPageRow, "growth_book_id" | "baby_id" | "page_type" | "page_order" | "created_by">;
        Update: Partial<GrowthBookPageRow>;
        Relationships: [];
      };
      growth_book_media: {
        Row: GrowthBookMediaRow;
        Insert: Partial<GrowthBookMediaRow> &
          Pick<GrowthBookMediaRow, "growth_book_id" | "baby_id" | "storage_path" | "created_by">;
        Update: Partial<GrowthBookMediaRow>;
        Relationships: [];
      };
      growth_book_comments: {
        Row: GrowthBookCommentRow;
        Insert: Partial<GrowthBookCommentRow> &
          Pick<GrowthBookCommentRow, "growth_book_id" | "baby_id" | "author_id" | "body">;
        Update: Partial<GrowthBookCommentRow>;
        Relationships: [];
      };
      memory_posts: {
        Row: MemoryPostRow;
        Insert: Partial<MemoryPostRow> &
          Pick<MemoryPostRow, "baby_id" | "author_id" | "privacy_type">;
        Update: Partial<MemoryPostRow>;
        Relationships: [];
      };
      memory_media: {
        Row: MemoryMediaRow;
        Insert: Partial<MemoryMediaRow> &
          Pick<MemoryMediaRow, "memory_post_id" | "baby_id" | "storage_path">;
        Update: Partial<MemoryMediaRow>;
        Relationships: [];
      };
      memory_tags: {
        Row: MemoryTagRow;
        Insert: Partial<MemoryTagRow> &
          Pick<MemoryTagRow, "memory_post_id" | "tag_type" | "created_by">;
        Update: Partial<MemoryTagRow>;
        Relationships: [];
      };
      memory_selected_people: {
        Row: MemorySelectedPersonRow;
        Insert: Partial<MemorySelectedPersonRow> &
          Pick<MemorySelectedPersonRow, "memory_post_id" | "user_id">;
        Update: Partial<MemorySelectedPersonRow>;
        Relationships: [];
      };
      memory_comments: {
        Row: MemoryCommentRow;
        Insert: Partial<MemoryCommentRow> &
          Pick<MemoryCommentRow, "memory_post_id" | "author_id" | "body">;
        Update: Partial<MemoryCommentRow>;
        Relationships: [];
      };
      memory_reactions: {
        Row: MemoryReactionRow;
        Insert: Partial<MemoryReactionRow> &
          Pick<MemoryReactionRow, "memory_post_id" | "author_id" | "reaction_type">;
        Update: Partial<MemoryReactionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_baby_member: { Args: { p_baby_id: string }; Returns: boolean };
      baby_permission: { Args: { p_baby_id: string }; Returns: PermissionRole };
      can_edit_care_logs: { Args: { p_baby_id: string }; Returns: boolean };
      can_edit_growth_records: { Args: { p_baby_id: string }; Returns: boolean };
      can_create_diary_entry: { Args: { p_baby_id: string }; Returns: boolean };
      can_manage_diary_entry: { Args: { p_diary_entry_id: string }; Returns: boolean };
      can_view_diary_entry: { Args: { p_diary_entry_id: string }; Returns: boolean };
      soft_delete_diary_entry: {
        Args: { p_diary_entry_id: string };
        Returns: undefined;
      };
      can_view_growth_book: { Args: { p_growth_book_id: string }; Returns: boolean };
      can_edit_growth_book: { Args: { p_growth_book_id: string }; Returns: boolean };
      can_view_growth_book_page: { Args: { p_page_id: string }; Returns: boolean };
      soft_delete_growth_book: { Args: { p_growth_book_id: string }; Returns: undefined };
      soft_delete_growth_book_page: { Args: { p_page_id: string }; Returns: undefined };
      care_log_creator_unchanged: {
        Args: { p_id: string; p_created_by: string | null };
        Returns: boolean;
      };
      growth_record_creator_unchanged: {
        Args: { p_id: string; p_created_by: string | null };
        Returns: boolean;
      };
      can_view_memory_post: { Args: { p_memory_post_id: string }; Returns: boolean };
      can_manage_memory_post: { Args: { p_memory_post_id: string }; Returns: boolean };
      can_delete_memory_post: { Args: { p_memory_post_id: string }; Returns: boolean };
      can_interact_with_memory_post: {
        Args: { p_memory_post_id: string };
        Returns: boolean;
      };
      soft_delete_memory_post: {
        Args: { p_memory_post_id: string };
        Returns: undefined;
      };
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
