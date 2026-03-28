"""Pydantic schemas for Content API."""

from datetime import datetime
from pydantic import BaseModel, Field


# ─── Content Schemas ──────────────────────────────────

class AudioInfo(BaseModel):
    status: str = "none"
    audio_url: str | None = None
    duration_seconds: float | None = None
    file_size_bytes: int | None = None
    format: str = "mp3"
    tts_voice: str | None = None
    tts_job_id: str | None = None


class PricingInfo(BaseModel):
    type: str = "free"  # free | paid
    price_jpy: int = 0
    currency: str = "JPY"


class ContentStats(BaseModel):
    view_count: int = 0
    play_count: int = 0
    completion_count: int = 0
    purchase_count: int = 0
    average_rating: float = 0.0
    review_count: int = 0


class SeoInfo(BaseModel):
    meta_title: str | None = None
    meta_description: str | None = None
    og_image_url: str | None = None


class ContentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    excerpt: str = Field("", max_length=500)
    body_markdown: str = ""
    category_ids: list[str] = Field(default_factory=list, max_length=3)
    tags: list[str] = Field(default_factory=list, max_length=10)
    series_id: str | None = None
    series_order: int | None = None
    pricing: PricingInfo = PricingInfo()
    seo: SeoInfo = SeoInfo()
    thumbnail_url: str | None = None
    status: str = "draft"


class ContentUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    excerpt: str | None = Field(None, max_length=500)
    body_markdown: str | None = None
    category_ids: list[str] | None = Field(None, max_length=3)
    tags: list[str] | None = Field(None, max_length=10)
    series_id: str | None = None
    series_order: int | None = None
    pricing: PricingInfo | None = None
    seo: SeoInfo | None = None
    thumbnail_url: str | None = None


class ContentResponse(BaseModel):
    content_id: str
    creator_id: str
    creator_display_name: str
    title: str
    slug: str
    excerpt: str
    body_markdown: str | None = None  # Hidden for unpurchased paid content
    body_html: str | None = None
    thumbnail_url: str | None = None
    audio: AudioInfo
    category_ids: list[str]
    tags: list[str]
    series_id: str | None = None
    series_order: int | None = None
    pricing: PricingInfo
    stats: ContentStats
    status: str
    published_at: datetime | None = None
    seo: SeoInfo
    created_at: datetime
    updated_at: datetime


class ContentListResponse(BaseModel):
    data: list[ContentResponse]
    pagination: dict


# ─── TTS Schemas ──────────────────────────────────────

class TtsConfig(BaseModel):
    language_code: str = "ja-JP"
    voice_name: str = "ja-JP-Neural2-B"
    speaking_rate: float = Field(1.0, ge=0.5, le=2.0)
    pitch: float = Field(0.0, ge=-10.0, le=10.0)
    volume_gain_db: float = Field(0.0, ge=-10.0, le=10.0)
    audio_encoding: str = "MP3"
    sample_rate_hertz: int = 24000


class SsmlOverrides(BaseModel):
    heading_break_time: str = "1.5s"
    paragraph_break_time: str = "0.8s"


class TtsConvertRequest(BaseModel):
    content_id: str
    config: TtsConfig = TtsConfig()
    ssml_overrides: SsmlOverrides = SsmlOverrides()
    priority: str = "medium"


class TtsJobResponse(BaseModel):
    job_id: str
    content_id: str
    creator_id: str
    status: str
    priority: str
    progress: dict
    config: dict
    error: dict | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None


class TtsPreviewRequest(BaseModel):
    text: str = Field(..., max_length=500)
    config: TtsConfig = TtsConfig()


# ─── Payment Schemas ──────────────────────────────────

class PaymentIntentCreate(BaseModel):
    content_id: str


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    currency: str


class TipCreate(BaseModel):
    creator_id: str
    amount: int = Field(..., ge=100, le=50000)
    content_id: str | None = None


class PurchaseResponse(BaseModel):
    purchase_id: str
    content_id: str
    content_title: str
    creator_display_name: str
    price_jpy: int
    purchased_at: datetime
    access_granted: bool


class RefundRequest(BaseModel):
    reason: str


# ─── Stream Schemas ───────────────────────────────────

class StreamUrlResponse(BaseModel):
    url: str
    expires_at: datetime
    content_id: str


class PlaybackPositionUpdate(BaseModel):
    position_seconds: float = Field(..., ge=0)
    total_duration_seconds: float = Field(..., gt=0)
    playback_speed: float = Field(1.0, ge=0.5, le=2.0)
    device_id: str = ""


class PlaybackPositionResponse(BaseModel):
    content_id: str
    position_seconds: float
    total_duration_seconds: float
    playback_speed: float
    updated_at: datetime


class PlayEventCreate(BaseModel):
    event_type: str  # 'play' | 'pause' | 'complete' | 'seek'
    position_seconds: float


# ─── User Schemas ─────────────────────────────────────

class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=50)
    bio: str | None = Field(None, max_length=500)
    avatar_url: str | None = None
    preferences: dict | None = None


class UserProfileResponse(BaseModel):
    uid: str
    email: str
    display_name: str
    avatar_url: str | None
    bio: str
    role: str
    created_at: datetime


class CreatorUpgradeRequest(BaseModel):
    full_name: str
    contact_email: str
    agree_to_terms: bool


# ─── Creator Dashboard Schemas ────────────────────────

class DashboardSummary(BaseModel):
    total_earnings: float
    pending_earnings: float
    total_content: int
    total_plays: int
    total_purchases: int
    recent_earnings: list[dict]
    top_content: list[dict]


class AnalyticsQuery(BaseModel):
    period: str = "30d"
    content_id: str | None = None
    metric: str = "all"
    granularity: str = "daily"


# ─── Admin Schemas ────────────────────────────────────

class RoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(listener|creator|admin)$")


class SuspendRequest(BaseModel):
    reason: str


class ModerateRequest(BaseModel):
    action: str  # 'approve' | 'reject' | 'flag'
    reason: str = ""


# ─── Common Schemas ───────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


class DetailedHealthResponse(HealthResponse):
    services: dict[str, dict]


class PaginationMeta(BaseModel):
    cursor: str | None = None
    has_more: bool = False
    limit: int = 20


class ApiResponse(BaseModel):
    data: dict | list | None = None
    meta: dict | None = None
    pagination: PaginationMeta | None = None


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    error: dict
