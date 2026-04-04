import requests
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import GitHubAccount, DailyMetrics
import os

GITHUB_API_URL = "https://api.github.com"

def _fetch_github_events(username: str, headers: dict, days: int = 30):
    """Internal helper to fetch and parse GitHub events."""
    url = f"{GITHUB_API_URL}/users/{username}/events/public"
    response = requests.get(url, headers=headers, timeout=10)
    print(f"[GitHub] Response status: {response.status_code}")

    if response.status_code != 200:
        print(f"[GitHub] API error status {response.status_code}: {response.text}")
        return None  # Signal to caller that this attempt failed

    events = response.json()
    print(f"[GitHub] Total events returned: {len(events)}")

    # Count PushEvents in the last N days
    commit_count = 0
    cutoff = datetime.now() - timedelta(days=days)
    push_events = []

    for event in events[:100]:  # Check last 100 events
        if event.get('type') == 'PushEvent':
            push_events.append(event)
            event_time = datetime.fromisoformat(event.get('created_at', '').replace('Z', '+00:00'))
            if event_time > cutoff:
                commit_count += 1
            else:
                break

    print(f"[GitHub] PushEvents found: {len(push_events)}")
    print(f"[GitHub] PushEvents in last {days} days: {commit_count}")
    if push_events:
        print(f"[GitHub] Most recent PushEvent: {push_events[0].get('created_at')}")

    return [commit_count] if commit_count > 0 else [0]


def get_github_commits(access_token: str, username: str, days: int = 30):
    """Fetch GitHub commits efficiently with timeout.
    
    Tries authenticated request first (Bearer token), 
    falls back to unauthenticated public access on 401.
    """
    print(f"[GitHub] Fetching events for user: {username}")

    try:
        # Attempt 1: Authenticated request using Bearer token format
        if access_token:
            print(f"[GitHub] Using token: Yes (Bearer)")
            headers = {"Authorization": f"Bearer {access_token}"}
            result = _fetch_github_events(username, headers, days)
            if result is not None:
                return result
            # Token was rejected — fall back to public access
            print(f"[GitHub] Token rejected, falling back to unauthenticated public access...")

        # Attempt 2: Unauthenticated public access (works for public events)
        print(f"[GitHub] Using token: No (public access)")
        result = _fetch_github_events(username, {}, days)
        if result is not None:
            return result

        return [0]
    except Exception as e:
        print(f"[GitHub] Exception: {e}")
        return [0]

def calculate_commit_streak(commits: list):
    """Calculate streak from commit counts"""
    streak = 0
    for count in commits:
        if count > 0:
            streak = 1
        else:
            break
    return streak

def sync_github_data(db: Session, user_id: int):
    github_account = db.query(GitHubAccount).filter(GitHubAccount.user_id == user_id).first()
    if not github_account:
        return None

    github_username = github_account.username or (github_account.email.split("@")[0] if github_account.email else None)
    commits = get_github_commits(github_account.access_token, github_username)
    streak = calculate_commit_streak(commits)

    # Update or create daily metrics
    today = datetime.now().date()
    metrics = db.query(DailyMetrics).filter(
        DailyMetrics.user_id == user_id,
        DailyMetrics.date >= today
    ).first()
    if not metrics:
        metrics = DailyMetrics(user_id=user_id, date=datetime.now())
        db.add(metrics)
    metrics.coding_streak_days = streak
    db.commit()
    db.refresh(metrics)
    return metrics