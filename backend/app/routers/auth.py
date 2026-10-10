from fastapi import APIRouter, HTTPException

from app.core.schools import school_from_email
from app.schemas.auth import SignUpRequest, SignUpResponse
from app.services.supabase_client import get_admin_client

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=SignUpResponse)
def signup(payload: SignUpRequest) -> SignUpResponse:
    school = school_from_email(payload.email)
    if school is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Reloved is only available to Tufts and Northeastern students. "
                "Please sign up with your .edu email."
            ),
        )

    admin = get_admin_client()

    try:
        created = admin.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                # TODO: If you want email confirmation, wire up admin.generate_link + a mailer.
                # Until then, confirm immediately so newly created users can log in.
                "email_confirm": True,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to create account.") from exc

    user = created.user
    if user is None:
        raise HTTPException(status_code=500, detail="Could not create user.")

    try:
        admin.table("profiles").insert(
            {
                "id": user.id,
                "school_id": school["id"],
                "full_name": payload.full_name.strip(),
            }
        ).execute()
    except Exception as exc:
        try:
            admin.auth.admin.delete_user(user.id)
        except Exception:
            pass
        raise HTTPException(
            status_code=500, detail="Account rolled back: profile setup failed."
        ) from exc

    return SignUpResponse(
        user_id=user.id,
        school_id=school["id"],
        message=f"Account created for {payload.email}. Confirm your email, then log in.",
    )
