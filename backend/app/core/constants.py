"""Application-wide constants."""

# Playback completion threshold (98% = considered fully listened)
PLAYBACK_COMPLETION_THRESHOLD = 0.98

# Resume playback offset (start N seconds before saved position)
RESUME_OFFSET_SECONDS = 2.0

# Stripe fee rate (approximate)
STRIPE_FEE_RATE = 0.036

# TTS chunk constraints
TTS_MIN_CHUNK_BYTES = 100

# TTS Circuit breaker settings
CIRCUIT_FAILURE_THRESHOLD = 5
CIRCUIT_RECOVERY_TIMEOUT = 30

# Audio normalization settings (LUFS)
AUDIO_LOUDNESS_TARGET = -16
AUDIO_TRUE_PEAK = -1.5
AUDIO_LOUDNESS_RANGE = 11

# Content version history limit
MAX_VERSION_HISTORY = 20

# Tip amount range (JPY)
TIP_MIN_AMOUNT = 100
TIP_MAX_AMOUNT = 50000

# Content pricing range (JPY)
PRICING_MIN = 100
PRICING_MAX = 50000

# Playback speed range
PLAYBACK_SPEED_MIN = 0.5
PLAYBACK_SPEED_MAX = 2.0

# Position save interval
POSITION_SAVE_INTERVAL_SECONDS = 5

# Signed URL expiry
DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 3600

# Refund window (days after purchase)
REFUND_WINDOW_DAYS = 7
