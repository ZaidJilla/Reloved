SCHOOLS = [
    {"id": "tufts", "name": "Tufts University", "email_domain": "tufts.edu"},
    {"id": "northeastern", "name": "Northeastern University", "email_domain": "northeastern.edu"},
]


def school_from_email(email: str) -> dict | None:
    if "@" not in email:
        return None
    domain = email.rsplit("@", 1)[1].lower()
    return next((school for school in SCHOOLS if school["email_domain"] == domain), None)
