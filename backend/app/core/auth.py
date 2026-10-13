from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from app.core.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class UserContext:
    client: Client
    user_id: str


def get_user_context(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserContext:
    """Supabase client acting as the caller, plus the caller's user id.

    Uses the anon key plus the caller's JWT, so RLS and auth.uid() apply.
    Never use the service-role client for user-scoped reads or writes: it
    bypasses RLS and leaves auth.uid() null.
    """
    if creds is None:
        raise HTTPException(status_code=401, detail="Missing bearer token.")

    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)

    try:
        user = client.auth.get_user(creds.credentials)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc
    if user is None or user.user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    client.postgrest.auth(creds.credentials)
    return UserContext(client=client, user_id=user.user.id)


def get_user_client(ctx: UserContext = Depends(get_user_context)) -> Client:
    """Just the client, for endpoints that don't need the user id."""
    return ctx.client
