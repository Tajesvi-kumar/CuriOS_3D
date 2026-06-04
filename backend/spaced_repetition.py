import os
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple
from supabase_config import supabase
from database import _sb
from concept_graph import engine

_LOCAL_DB_FILE = os.path.join(os.path.dirname(__file__), "local_db.json")

class SpacedRepetitionEngine:
    @staticmethod
    def get_local_reviews() -> List[Dict[str, Any]]:
        if os.path.exists(_LOCAL_DB_FILE):
            try:
                with open(_LOCAL_DB_FILE, "r") as f:
                    data = json.load(f)
                    return data.get("spaced_reviews", [])
            except Exception:
                pass
        return []

    @staticmethod
    def save_local_reviews(reviews: List[Dict[str, Any]]):
        try:
            data = {}
            if os.path.exists(_LOCAL_DB_FILE):
                with open(_LOCAL_DB_FILE, "r") as f:
                    data = json.load(f)
            data["spaced_reviews"] = reviews
            with open(_LOCAL_DB_FILE, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[WARN] Failed to save local spaced reviews: {e}")

    @staticmethod
    def compute_next_review(
        easiness_factor: float,
        previous_interval: int,
        repetition: int,
        quality_score: int
    ) -> Tuple[float, int, int, str]:
        """
        Computes next SM-2 interval parameters.
        """
        q = min(5, max(0, int(quality_score)))
        
        # EF = max(1.3, EF + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ef = easiness_factor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
        new_ef = max(1.3, new_ef)
        
        if q < 3:
            new_rep = 0
            new_interval = 1
        else:
            new_rep = repetition + 1
            if new_rep == 1:
                new_interval = 1
            elif new_rep == 2:
                new_interval = 6
            else:
                new_interval = round(previous_interval * new_ef)
                
        now = datetime.now(timezone.utc)
        next_review_date = (now + timedelta(days=new_interval)).isoformat()
        
        return new_ef, new_interval, new_rep, next_review_date

    @staticmethod
    def store_review(session_id: str, concept_id: str, quality_score: int) -> Dict[str, Any]:
        # Fetch current review parameters
        ef = 2.5
        interval = 1
        rep_count = 0
        record_id = None
        
        # Try Supabase first
        record = None
        try:
            res = _sb(lambda: supabase.table("spaced_reviews")
                      .select("*")
                      .eq("session_id", session_id)
                      .eq("concept_id", concept_id)
                      .execute())
            if res and res.data:
                record = res.data[0]
                record_id = record["id"]
                ef = record.get("easiness_factor", 2.5)
                interval = record.get("interval_days", 1)
                rep_count = record.get("repetition_count", 0)
        except Exception as e:
            print(f"[WARN] Supabase fetch in store_review failed: {e}")
            
        # Fallback/merge locally
        if not record:
            local_reviews = SpacedRepetitionEngine.get_local_reviews()
            for r in local_reviews:
                if r.get("session_id") == session_id and r.get("concept_id") == concept_id:
                    record_id = r.get("id")
                    ef = r.get("easiness_factor", 2.5)
                    interval = r.get("interval_days", 1)
                    rep_count = r.get("repetition_count", 0)
                    record = r
                    break

        new_ef, new_interval, new_rep, next_review_date = SpacedRepetitionEngine.compute_next_review(
            easiness_factor=ef,
            previous_interval=interval,
            repetition=rep_count,
            quality_score=quality_score
        )
        
        now = datetime.now(timezone.utc).isoformat()
        upsert_data = {
            "session_id": session_id,
            "concept_id": concept_id,
            "easiness_factor": new_ef,
            "interval_days": new_interval,
            "repetition_count": new_rep,
            "next_review_date": next_review_date,
            "last_reviewed": now
        }
        
        # Save to database
        saved_db = False
        if record_id:
            try:
                res = _sb(lambda: supabase.table("spaced_reviews").update(upsert_data).eq("id", record_id).execute())
                if res and res.data:
                    saved_db = True
            except Exception as e:
                print(f"[WARN] Supabase update in store_review failed: {e}")
        else:
            try:
                res = _sb(lambda: supabase.table("spaced_reviews").insert(upsert_data).execute())
                if res and res.data:
                    saved_db = True
                    record_id = res.data[0]["id"]
            except Exception as e:
                print(f"[WARN] Supabase insert in store_review failed: {e}")

        # Sync local file database
        local_reviews = SpacedRepetitionEngine.get_local_reviews()
        updated = False
        upsert_local = {
            "id": record_id or str(uuid.uuid4()),
            **upsert_data
        }
        for i, r in enumerate(local_reviews):
            if r.get("session_id") == session_id and r.get("concept_id") == concept_id:
                local_reviews[i] = upsert_local
                updated = True
                break
        if not updated:
            local_reviews.append(upsert_local)
        SpacedRepetitionEngine.save_local_reviews(local_reviews)
        
        return upsert_local

    @staticmethod
    def get_due_concepts(session_id: str) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        due_records = []
        
        # Try Supabase
        try:
            res = _sb(lambda: supabase.table("spaced_reviews")
                      .select("*")
                      .eq("session_id", session_id)
                      .lte("next_review_date", now.isoformat())
                      .execute())
            if res and res.data is not None:
                due_records = res.data
        except Exception as e:
            print(f"[WARN] Supabase fetch in get_due_concepts failed: {e}")
            
        # Fallback/merge with local backup
        if not due_records:
            local_reviews = SpacedRepetitionEngine.get_local_reviews()
            for r in local_reviews:
                if r.get("session_id") == session_id:
                    next_review_str = r.get("next_review_date")
                    if next_review_str:
                        try:
                            next_review = datetime.fromisoformat(next_review_str.replace("Z", "+00:00"))
                            if next_review <= now:
                                due_records.append(r)
                        except Exception:
                            pass
                            
        # Map concept info
        due_concepts = []
        for rec in due_records:
            concept_id = rec["concept_id"]
            node_info = engine.get_node_info(concept_id)
            due_concepts.append({
                "concept_id": concept_id,
                "label": node_info.get("label", concept_id.replace("_", " ").capitalize()),
                "subject": node_info.get("subject", "General"),
                "class": node_info.get("class", 7),
                "easiness_factor": rec.get("easiness_factor", 2.5),
                "repetition_count": rec.get("repetition_count", 0),
                "interval_days": rec.get("interval_days", 1)
            })
            
        return due_concepts
