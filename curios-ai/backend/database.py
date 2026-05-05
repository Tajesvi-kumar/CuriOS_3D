from datetime import datetime

from supabase_config import supabase

# CHAPTERS
def get_chapters(class_no: int, subject: str):
    try:
        response = (
            supabase.table("chapters")
            .select("*")
            .eq("class_no", class_no)
            .eq("subject", subject)
            .order("chapter_no")
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"Error in get_chapters: {e}")
        raise

def get_chapter_by_id(chapter_id: str):
    try:
        response = supabase.table("chapters").select("*").eq("id", chapter_id).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error in get_chapter_by_id: {e}")
        raise

# SESSIONS
def create_session(student_name: str, student_class: int, subject: str, language: str):
    try:
        data = {
            "student_name": student_name,
            "student_class": student_class,
            "subject": subject,
            "language": language,
            "mastery_score": 100
        }
        response = supabase.table("sessions").insert(data).execute()
        if response.data:
            return response.data[0]["id"]
        return None
    except Exception as e:
        print(f"Error in create_session: {e}")
        raise

def update_mastery(session_id: str, mastery: int):
    try:
        data = {
            "mastery_score": mastery,
            "updated_at": datetime.utcnow().isoformat()
        }
        response = supabase.table("sessions").update(data).eq("id", session_id).execute()
        return response.data
    except Exception as e:
        print(f"Error in update_mastery: {e}")
        raise

def get_session(session_id: str):
    try:
        response = supabase.table("sessions").select("*").eq("id", session_id).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error in get_session: {e}")
        raise

# GAPS
def upsert_gap(session_id: str, concept_id: str, concept_label: str, status: str):
    try:
        allowed_status = {"untested", "suspected", "confirmed", "root", "fixed"}
        if status not in allowed_status:
            raise ValueError(f"Invalid status '{status}'. Allowed: {sorted(allowed_status)}")

        # Check if gap exists
        response = (
            supabase.table("gaps")
            .select("*")
            .eq("session_id", session_id)
            .eq("concept_id", concept_id)
            .execute()
        )

        data = {
            "session_id": session_id,
            "concept_id": concept_id,
            "concept_label": concept_label,
            "status": status,
            "detected_at": datetime.utcnow().isoformat()
        }

        if response.data:
            # Update existing gap
            gap_id = response.data[0]["id"]
            update_res = supabase.table("gaps").update(data).eq("id", gap_id).execute()
            return update_res.data
        else:
            # Insert new gap
            insert_res = supabase.table("gaps").insert(data).execute()
            return insert_res.data
    except Exception as e:
        print(f"Error in upsert_gap: {e}")
        raise

def get_session_gaps(session_id: str):
    try:
        response = supabase.table("gaps").select("*").eq("session_id", session_id).execute()
        return response.data
    except Exception as e:
        print(f"Error in get_session_gaps: {e}")
        raise

# QUIZ
def save_quiz_attempt(session_id: str, chapter_id: str, chapter_title: str, subject: str, score: int, total: int, concept_analysis: dict, new_gaps: list):
    try:
        percentage = (score / total) * 100 if total > 0 else 0
        data = {
            "session_id": session_id,
            "chapter_id": chapter_id,
            "chapter_title": chapter_title,
            "subject": subject,
            "score": score,
            "total_questions": total,
            "percentage": percentage,
            "concept_analysis": concept_analysis,
            "new_gaps_detected": new_gaps
        }
        response = supabase.table("quiz_attempts").insert(data).execute()
        if response.data:
            return response.data[0]["id"]
        return None
    except Exception as e:
        print(f"Error in save_quiz_attempt: {e}")
        raise

def save_quiz_answers(attempt_id: str, answers: list):
    try:
        # Prepare bulk insert
        data_to_insert = []
        for ans in answers:
            data_to_insert.append({
                "attempt_id": attempt_id,
                "question_text": ans.get("question_text", ""),
                "question_type": ans.get("type", "MCQ"),
                "student_answer": ans.get("student_answer", ""),
                "correct_answer": ans.get("correct_answer", ""),
                "is_correct": ans.get("is_correct", False),
                "concept_tested": ans.get("concept_tested", "")
            })
        if data_to_insert:
            response = supabase.table("quiz_answers").insert(data_to_insert).execute()
            return response.data
        return []
    except Exception as e:
        print(f"Error in save_quiz_answers: {e}")
        raise

def get_chapter_attempts(session_id: str):
    try:
        response = (
            supabase.table("quiz_attempts")
            .select("chapter_id, chapter_title, score, percentage")
            .eq("session_id", session_id)
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"Error in get_chapter_attempts: {e}")
        raise
