/* ─── Domain Types ─────────────────────────────── */

export interface User {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  role: 'listener' | 'creator' | 'admin';
  creatorProfile?: CreatorProfile;
  preferences: UserPreferences;
  createdAt: string;
}

export interface CreatorProfile {
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  chargesEnabled: boolean;
  totalEarnings: number;
  contentCount: number;
  followerCount: number;
}

export interface UserPreferences {
  defaultPlaybackSpeed: number;
  autoPlayNext: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  preferredLanguage: string;
}

export interface Content {
  content_id: string;
  creator_id: string;
  creator_display_name: string;
  title: string;
  slug: string;
  excerpt: string;
  body_markdown: string | null;
  body_html: string | null;
  thumbnail_url: string | null;
  audio: AudioInfo;
  category_ids: string[];
  tags: string[];
  series_id: string | null;
  pricing: PricingInfo;
  stats: ContentStats;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudioInfo {
  status: 'none' | 'queued' | 'processing' | 'completed' | 'failed';
  audio_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  format: string;
  tts_voice: string | null;
  tts_job_id: string | null;
}

export interface PricingInfo {
  type: 'free' | 'paid';
  price_jpy: number;
  currency: string;
}

export interface ContentStats {
  view_count: number;
  play_count: number;
  completion_count: number;
  purchase_count: number;
  average_rating: number;
  review_count: number;
}

export interface TtsJob {
  job_id: string;
  content_id: string;
  status: string;
  priority: string;
  progress: {
    total_chunks: number;
    completed_chunks: number;
    current_step: string;
    percent_complete: number;
  };
  config: TtsConfig;
  created_at: string;
  completed_at: string | null;
}

export interface TtsConfig {
  language_code: string;
  voice_name: string;
  speaking_rate: number;
  pitch: number;
  volume_gain_db: number;
  audio_encoding: string;
  sample_rate_hertz: number;
}

export interface Purchase {
  purchase_id: string;
  content_id: string;
  content_title: string;
  creator_display_name: string;
  price_jpy: number;
  purchased_at: string;
  access_granted: boolean;
}

export interface PlaybackPosition {
  content_id: string;
  position_seconds: number;
  total_duration_seconds: number;
  playback_speed: number;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  children?: Category[];
}

export interface DashboardSummary {
  total_earnings: number;
  pending_earnings: number;
  total_content: number;
  total_plays: number;
  total_purchases: number;
  recent_earnings: { date: string; amount: number }[];
  top_content: { content_id: string; title: string; revenue: number; plays: number }[];
}

export interface Series {
  series_id: string;
  creator_id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  content_ids: string[];
  pricing: PricingInfo;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  chapter_id: string;
  title: string;
  start_seconds: number;
  end_seconds: number;
  order: number;
}

/* ─── API Response Types ──────────────────────── */

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  pagination?: {
    cursor: string | null;
    has_more: boolean;
    limit: number;
  };
}

export interface ApiError {
  error: {
    type: string;
    status: number;
    detail: string;
    instance?: string;
    errors?: { field: string; message: string }[];
  };
}
