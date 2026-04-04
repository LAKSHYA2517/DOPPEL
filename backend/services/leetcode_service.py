import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from models import LeetCodeAccount, DailyMetrics

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"

def get_leetcode_submissions(username: str):
    """Fetch LeetCode user stats with timeout"""
    query = """
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
    """
    variables = {"username": username}
    try:
        response = httpx.post(LEETCODE_GRAPHQL_URL, json={"query": query, "variables": variables}, timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            return data.get("data", {}).get("matchedUser")
        return None
    except Exception as e:
        print(f"LeetCode API error: {e}")
        return None

def sync_leetcode_data(db: Session, user_id: int):
    """Sync LeetCode data"""
    leetcode_account = db.query(LeetCodeAccount).filter(LeetCodeAccount.user_id == user_id).first()
    if not leetcode_account:
        return None

    leetcode_username = leetcode_account.username or (leetcode_account.email.split("@")[0] if leetcode_account.email else None)
    data = get_leetcode_submissions(leetcode_username)

    today = datetime.now().date()
    metrics = db.query(DailyMetrics).filter(
        DailyMetrics.user_id == user_id,
        DailyMetrics.date >= today
    ).first()
    if not metrics:
        metrics = DailyMetrics(user_id=user_id, date=datetime.now())
        db.add(metrics)
    
    metrics.focus_score = max(metrics.focus_score, 50)
    db.commit()
    db.refresh(metrics)
    return metrics