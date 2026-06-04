import time
from typing import Dict, List, Any, Tuple

class EmotionEngine:
    @staticmethod
    def compute(
        session_id: str,
        latency_ms: float | None,
        message: str,
        history: List[Dict[str, Any]],
        concept_failures: Dict[str, int]
    ) -> Tuple[str, str]:
        """
        Computes the student's emotion state and suggests a tone modifier.
        
        Args:
            session_id: Unique session ID.
            latency_ms: Latency in milliseconds between AI response and student reply.
            message: Current student message text.
            history: List of past chat message dictionaries containing 'role' and 'content'.
            concept_failures: Dict of concept_id to consecutive failure count.
            
        Returns:
            Tuple of (emotion_state, tone_modifier)
        """
        message_len = len(message.strip())
        
        # 1. Track consecutive wrong attempts
        # Find maximum consecutive failures for any concept
        consecutive_wrong = max(concept_failures.values(), default=0)
        
        # 2. Track message length trend for boredom detection
        # Get past student messages from history
        student_msgs = [m for m in history if m.get("role") == "student"]
        # Append current message to simulate full history
        all_student_msgs = student_msgs + [{"role": "student", "content": message}]
        
        # Check if length < 5 chars for 3+ turns in a row
        last_3_lengths = [len(m.get("content", "").strip()) for m in all_student_msgs[-3:]]
        is_bored_trend = len(last_3_lengths) >= 3 and all(length < 5 for length in last_3_lengths)
        
        # 3. Apply emotion state logic
        # Default to engaged
        emotion_state = "engaged"
        
        # Rule 1: latency > 30s AND length < 10 chars -> "confused"
        # latency_ms > 30000 ms
        if latency_ms is not None and latency_ms > 30000 and message_len < 10:
            emotion_state = "confused"
            
        # Rule 2: consecutive_wrong >= 3 -> "frustrated"
        elif consecutive_wrong >= 3:
            emotion_state = "frustrated"
            
        # Rule 3: length < 5 chars for 3+ turns in a row -> "bored"
        elif is_bored_trend:
            emotion_state = "bored"
            
        # 4. Map emotion state to tone modifier
        tone_modifiers = {
            "confused": "Use a simpler analogy. Break the concept into smaller steps.",
            "frustrated": "Be very encouraging. Acknowledge the difficulty. Use a fun Indian analogy.",
            "bored": "Make the question more interactive. Use a game or challenge format.",
            "engaged": "Continue current style."
        }
        
        suggested_tone = tone_modifiers.get(emotion_state, "Continue current style.")
        
        return emotion_state, suggested_tone
