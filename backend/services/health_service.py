import csv
import json
import io
import re

def parse_health_export(file_contents: bytes, filename: str) -> dict:
    """
    Parses a health export file (CSV or JSON) and heuristically extracts
    the most recent sleep duration and any stress/activity indicators.
    Returns a dict with 'hours_slept' and 'stress_modifier'
    """
    result = {"hours_slept": None, "stress_modifier": 0.0}
    
    content_str = file_contents.decode('utf-8', errors='ignore')
    
    if filename.endswith(".json"):
        try:
            data = json.loads(content_str)
            _recursive_search_json(data, result)
        except json.JSONDecodeError:
            _analyze_text(content_str, result)
    elif filename.endswith(".csv"):
        try:
            reader = csv.DictReader(io.StringIO(content_str))
            for row in reader:
                _analyze_row(row, result)
        except Exception:
            _analyze_text(content_str, result)
    else:
        # Fallback to plain text search
        _analyze_text(content_str, result)
        
    return result

def _recursive_search_json(data, result):
    if isinstance(data, dict):
        for k, v in data.items():
            k_lower = k.lower()
            if 'sleep' in k_lower or 'duration' in k_lower or 'value' in k_lower:
                if isinstance(v, (int, float)):
                    val = float(v)
                    # If enormous, it might be milliseconds (e.g. 28800000ms = 8h)
                    if val > 1000000:
                        val = val / 3600000.0  # ms to hr
                    # If highly large, maybe minutes
                    elif val > 24:
                        val = val / 60.0
                    
                    if 0 < val <= 24 and 'sleep' in k_lower:
                        result["hours_slept"] = val
                        
            elif 'stress' in k_lower:
                if isinstance(v, (int, float)):
                    if v > 70 or v > 7:
                        result["stress_modifier"] += 2.0
            _recursive_search_json(v, result)
    elif isinstance(data, list):
        for item in data:
            _recursive_search_json(item, result)

def _analyze_row(row: dict, result):
    for k, v in row.items():
        k_lower = k.lower() if k else ""
        try:
            val = float(v)
            if 'sleep' in k_lower or 'duration' in k_lower:
                if val > 24:
                    val /= 60.0
                if 0 < val <= 24:
                    result["hours_slept"] = val
            if 'stress' in k_lower and val > 70:
                result["stress_modifier"] += 1.0
        except (ValueError, TypeError):
            continue

def _analyze_text(text: str, result):
    sleep_match = re.search(r'sleep.*?(\d+\.?\d*)', text, re.IGNORECASE)
    if sleep_match:
        val = float(sleep_match.group(1))
        if val > 24:
            val /= 60.0
        if 0 < val <= 24:
            result["hours_slept"] = val
