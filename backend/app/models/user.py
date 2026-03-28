"""User domain models."""

from dataclasses import dataclass


@dataclass
class AuthenticatedUser:
    uid: str
    email: str
    email_verified: bool
    role: str
    stripe_account_id: str | None = None
    display_name: str = ""

    @property
    def is_creator(self) -> bool:
        return self.role in ("creator", "admin")

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
