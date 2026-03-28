"""Authentication dependencies for FastAPI."""

from typing import Annotated
from fastapi import Depends, Header, Request
from firebase_admin import auth
from app.core.config import get_settings
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.core.firebase import init_firebase
from app.core.logging import get_logger
from app.models.user import AuthenticatedUser

logger = get_logger(__name__)


async def _extract_token(authorization: str | None = Header(None, alias="Authorization")) -> str:
    """Extract Bearer token from Authorization header."""
    if not authorization:
        raise UnauthorizedException("Missing Authorization header")
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise UnauthorizedException("Invalid Authorization header format")
    return parts[1]


async def get_current_user(
    request: Request,
    token: str = Depends(_extract_token),
) -> AuthenticatedUser:
    """Verify Firebase ID token and return authenticated user."""
    settings = get_settings()
    try:
        init_firebase()
        decoded = auth.verify_id_token(token)
        user = AuthenticatedUser(
            uid=decoded["uid"],
            email=decoded.get("email", ""),
            email_verified=decoded.get("email_verified", False),
            role=decoded.get("role", "listener"),
            stripe_account_id=decoded.get("stripeAccountId"),
            display_name=decoded.get("name", ""),
        )
        request.state.user = user
        return user
    except auth.ExpiredIdTokenError:
        raise UnauthorizedException("Token expired")
    except auth.RevokedIdTokenError:
        raise UnauthorizedException("Token revoked")
    except auth.InvalidIdTokenError:
        raise UnauthorizedException("Invalid token")
    except Exception as e:
        logger.error("auth_error", error=str(e))
        raise UnauthorizedException("Authentication failed")


async def get_optional_user(
    request: Request,
    authorization: str | None = Header(None, alias="Authorization"),
) -> AuthenticatedUser | None:
    """Optionally extract user if token present."""
    if not authorization:
        return None
    try:
        token = await _extract_token(authorization)
        return await get_current_user(request, token)
    except UnauthorizedException:
        return None


def require_role(*roles: str):
    """Factory: dependency that checks user role."""
    async def _check(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in roles:
            raise ForbiddenException(f"Role '{user.role}' cannot access this resource")
        return user
    return _check


# Typed dependencies
CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
OptionalUser = Annotated[AuthenticatedUser | None, Depends(get_optional_user)]
CreatorUser = Annotated[AuthenticatedUser, Depends(require_role("creator", "admin"))]
AdminUser = Annotated[AuthenticatedUser, Depends(require_role("admin"))]
