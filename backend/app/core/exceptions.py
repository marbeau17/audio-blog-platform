"""Application exception hierarchy."""

from __future__ import annotations

from fastapi import HTTPException, status


class AppException(HTTPException):
    """Base application exception."""
    def __init__(self, status_code: int, error_type: str, detail: str):
        super().__init__(status_code=status_code, detail=detail)
        self.error_type = error_type


class UnauthorizedException(AppException):
    def __init__(self, detail: str = "Authentication required"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "unauthorized", detail)


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status.HTTP_403_FORBIDDEN, "forbidden", detail)


class NotFoundException(AppException):
    def __init__(self, resource: str = "Resource", detail: str | None = None):
        super().__init__(
            status.HTTP_404_NOT_FOUND,
            "not_found",
            detail or f"{resource} not found",
        )


class ConflictException(AppException):
    def __init__(self, detail: str = "Resource conflict"):
        super().__init__(status.HTTP_409_CONFLICT, "conflict", detail)


class ValidationException(AppException):
    def __init__(self, detail: str, errors: list[dict] | None = None):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", detail)
        self.errors = errors or []


class RateLimitException(AppException):
    def __init__(self, retry_after: int = 60):
        super().__init__(status.HTTP_429_TOO_MANY_REQUESTS, "rate_limit_exceeded", "Rate limit exceeded")
        self.retry_after = retry_after


class UpstreamException(AppException):
    def __init__(self, service: str, detail: str = ""):
        super().__init__(
            status.HTTP_502_BAD_GATEWAY,
            "upstream_error",
            f"External service error ({service}): {detail}",
        )


class ServiceUnavailableException(AppException):
    def __init__(self, detail: str = "Service temporarily unavailable"):
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, "service_unavailable", detail)
