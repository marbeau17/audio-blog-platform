"""Validate that the backend environment is properly configured."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def check(name, condition, detail=""):
    status = "OK" if condition else "FAIL"
    print(f"  [{status}] {name}" + (f" - {detail}" if detail else ""))
    return condition

def main():
    print("=== Backend Setup Validation ===\n")
    all_ok = True

    # Check .env file
    print("Environment:")
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    all_ok &= check(".env file exists", os.path.exists(env_path))

    # Check service account key
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "./serviceAccountKey.json")
    sa_full = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), sa_path.lstrip("./"))
    all_ok &= check("Service account key", os.path.exists(sa_full), sa_full)

    # Check required env vars
    print("\nEnvironment Variables:")
    from dotenv import load_dotenv
    load_dotenv(env_path)

    required_vars = ["FIREBASE_PROJECT_ID", "FIREBASE_STORAGE_BUCKET", "GCS_AUDIO_BUCKET", "STRIPE_SECRET_KEY"]
    for var in required_vars:
        val = os.environ.get(var, "")
        all_ok &= check(var, bool(val) and val != "xxxx", val[:30] + "..." if len(val) > 30 else val)

    # Check Python imports
    print("\nPython Imports:")
    imports_to_check = [
        ("fastapi", "FastAPI framework"),
        ("firebase_admin", "Firebase Admin SDK"),
        ("google.cloud.firestore", "Firestore client"),
        ("google.cloud.texttospeech", "TTS API"),
        ("google.cloud.storage", "Cloud Storage"),
        ("stripe", "Stripe SDK"),
        ("redis", "Redis client"),
        ("markdown", "Markdown processor"),
        ("bleach", "HTML sanitizer"),
    ]
    for mod, desc in imports_to_check:
        try:
            __import__(mod)
            all_ok &= check(desc, True)
        except ImportError:
            all_ok &= check(desc, False, f"pip install {mod}")

    # Check Firebase connectivity
    print("\nFirebase Connection:")
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        if not firebase_admin._apps:
            cred = credentials.Certificate(sa_full)
            firebase_admin.initialize_app(cred, {"projectId": os.environ.get("FIREBASE_PROJECT_ID")})
        db = firestore.client()
        cats = list(db.collection("categories").limit(1).stream())
        all_ok &= check("Firestore connection", True, f"{len(cats)} doc(s) read")
    except Exception as e:
        all_ok &= check("Firestore connection", False, str(e)[:80])

    # Check external tools
    print("\nExternal Tools:")
    import shutil
    all_ok &= check("ffmpeg", shutil.which("ffmpeg") is not None)
    all_ok &= check("ffprobe", shutil.which("ffprobe") is not None)

    print(f"\n{'=' * 40}")
    print(f"Result: {'ALL CHECKS PASSED' if all_ok else 'SOME CHECKS FAILED'}")
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())
