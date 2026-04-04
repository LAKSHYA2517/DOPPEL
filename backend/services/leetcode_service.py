import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from models import LeetCodeAccount, DailyMetrics

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"

def get_leetcode_stats(username: str):
    """Fetch LeetCode user stats and streak via GraphQL."""
    query = """
    query getUserProfile($username: String!, $year: Int) {
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
        userCalendar(year: $year) {
          streak
          totalActiveDays
        }
      }
    }
    """
    current_year = datetime.now().year
    variables = {"username": username, "year": current_year}
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/{username}/",
    }
    try:
        print(f"[LeetCode] Fetching stats for user: {username}")
        response = httpx.post(
            LEETCODE_GRAPHQL_URL,
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10.0,
        )
        print(f"[LeetCode] Response status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            matched = data.get("data", {}).get("matchedUser")
            if matched:
                calendar = matched.get("userCalendar", {}) or {}
                submit_stats = matched.get("submitStats", {}) or {}
                streak = calendar.get("streak", 0)
                total_active_days = calendar.get("totalActiveDays", 0)
                ac_submissions = submit_stats.get("acSubmissionNum", [])
                total_solved = 0
                for item in ac_submissions:
                    if item.get("difficulty") == "All":
                        total_solved = item.get("count", 0)
                        break
                print(f"[LeetCode] Streak: {streak}, Active days: {total_active_days}, Total solved: {total_solved}")
                return {
                    "streak": streak,
                    "total_active_days": total_active_days,
                    "total_solved": total_solved,
                }
            else:
                print(f"[LeetCode] User '{username}' not found in API response")
                return None
        else:
            print(f"[LeetCode] API error status {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print(f"[LeetCode] Exception: {e}")
        return None

def sync_leetcode_data(db: Session, user_id: int):
    """Sync LeetCode data and update metrics."""
    leetcode_account = db.query(LeetCodeAccount).filter(LeetCodeAccount.user_id == user_id).first()
    if not leetcode_account:
        return None

    leetcode_username = leetcode_account.username or (leetcode_account.email.split("@")[0] if leetcode_account.email else None)
    if not leetcode_username:
        print("[LeetCode] No username available")
        return None

    stats = get_leetcode_stats(leetcode_username)

    today = datetime.now().date()
    metrics = db.query(DailyMetrics).filter(
        DailyMetrics.user_id == user_id,
        DailyMetrics.date >= today
    ).first()
    if not metrics:
        metrics = DailyMetrics(user_id=user_id, date=datetime.now())
        db.add(metrics)

    if stats:
        leetcode_streak = stats.get("streak", 0)
        metrics.leetcode_streak_days = leetcode_streak
        metrics.focus_score = max(metrics.focus_score, min(100, stats.get("total_solved", 0)))
        print(f"[LeetCode] Updated metrics — leetcode_streak: {metrics.leetcode_streak_days}, focus: {metrics.focus_score}")
    else:
        metrics.focus_score = max(metrics.focus_score, 50)

    db.commit()
    db.refresh(metrics)
    return metrics


def get_recent_ac_submissions(username: str, limit: int = 50):
    """Fetch recently accepted submissions for a user.
    Returns a list of problem title strings.
    """
    query = """
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
        timestamp
      }
    }
    """
    variables = {"username": username, "limit": limit}
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/{username}/",
    }
    try:
        print(f"[LeetCode] Fetching recent AC submissions for: {username}")
        response = httpx.post(
            LEETCODE_GRAPHQL_URL,
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10.0,
        )
        if response.status_code == 200:
            data = response.json()
            submissions = data.get("data", {}).get("recentAcSubmissionList", [])
            if submissions:
                titles = [s.get("title", "") for s in submissions]
                slugs = [s.get("titleSlug", "") for s in submissions]
                print(f"[LeetCode] Found {len(titles)} recent AC submissions")
                return {"titles": titles, "slugs": slugs}
        print(f"[LeetCode] No recent submissions found or API error")
        return {"titles": [], "slugs": []}
    except Exception as e:
        print(f"[LeetCode] Exception fetching submissions: {e}")
        return {"titles": [], "slugs": []}