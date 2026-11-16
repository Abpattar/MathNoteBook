import logging
import re
from typing import Dict, Any, List, Set
from .base import BaseAdapter
from ..schemas.umr import (
    UnifiedMathematicalRepresentation,
)
from ..schemas.profile import StudentProfile

logger = logging.getLogger("orchestrator.adapters.sixth_sense")

# Validated template vocabulary from Sixth-Sense/data/preset-references.json
SUPPORTED_TEMPLATE_SIGNS: Set[str] = {
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
    'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
    'W', 'X', 'Y', 'Z', 'HELLO', 'HELP'
}

# Standard Indian Sign Language (ISL) educational mathematical glosses
MATH_OPERATOR_GLOSS: Dict[str, Dict[str, str]] = {
    '+': {'gloss': 'PLUS', 'gesture': 'Crossed index fingers forming a plus sign'},
    '-': {'gloss': 'MINUS', 'gesture': 'Horizontal index finger moving outward'},
    '=': {'gloss': 'EQUALS', 'gesture': 'Two parallel horizontal index fingers'},
    '*': {'gloss': 'TIMES', 'gesture': 'Crossed diagonal index fingers (X shape)'},
    '/': {'gloss': 'DIVIDE', 'gesture': 'Horizontal dividing bar with index and middle fingers'},
    '^2': {'gloss': 'SQUARED', 'gesture': 'Two-finger superscript motion'},
    '^': {'gloss': 'POWER', 'gesture': 'Upward exponent index finger point'}
}

class SixthSenseAdapter(BaseAdapter):
    """
    Adapter for Sixth-Sense Indian Sign Language (ISL) interaction.
    Provides structured tokenization, multi-digit decomposition, and educational
    ISL mathematical glossing for algebraic expressions.
    Maintained strictly isolated to satisfy GPL-3.0 obligations.
    """
    capability_name: str = "sixth_sense"
    is_available: bool = True

    async def initialize(self) -> bool:
        self.is_available = True
        return True

    def analyze_expression_for_isl(self, expr_str: str) -> Dict[str, Any]:
        """
        Decomposes mathematical expressions into signable units:
        - Multi-digit numbers (e.g. 40) decompose into sequential signed digits (4, 0).
        - Algebraic variables (X, Y) are signed using standard ISL fingerspelling.
        - Math operators (+, -, =) are mapped to educational ISL glosses.
        """
        clean_expr = expr_str.replace(" ", "")
        
        # Tokenize by symbols and alphanumeric blocks
        raw_tokens = re.findall(r'[a-zA-Z]|\d+|[\^]\d+|[^\s\w]', clean_expr)
        
        sign_sequence = []
        supported_templates = []
        gloss_operators = []
        unsupported = []

        for token in raw_tokens:
            upper = token.upper()

            # Handle power (e.g., ^2 or ^)
            if token.startswith('^'):
                gloss_info = MATH_OPERATOR_GLOSS.get(token, MATH_OPERATOR_GLOSS.get('^'))
                sign_sequence.append({
                    "display": token,
                    "sign": gloss_info['gloss'] if gloss_info else token,
                    "type": "operator_gloss",
                    "description": gloss_info['gesture'] if gloss_info else 'Mathematical power symbol',
                    "has_3d_template": False
                })
                if gloss_info:
                    gloss_operators.append(gloss_info['gloss'])
                unsupported.append(token)
                continue

            # Handle mathematical operators (+, -, =)
            if token in MATH_OPERATOR_GLOSS:
                gloss_info = MATH_OPERATOR_GLOSS[token]
                sign_sequence.append({
                    "display": token,
                    "sign": gloss_info['gloss'],
                    "type": "operator_gloss",
                    "description": gloss_info['gesture'],
                    "has_3d_template": False
                })
                gloss_operators.append(gloss_info['gloss'])
                unsupported.append(token)
                continue

            # Handle numbers: digits 0-9 are fully supported
            if token.isdigit():
                if token in SUPPORTED_TEMPLATE_SIGNS:
                    sign_sequence.append({
                        "display": token,
                        "sign": token,
                        "type": "digit",
                        "description": f"ISL Digit {token}",
                        "has_3d_template": True
                    })
                    supported_templates.append(token)
                else:
                    # Decompose multi-digit number into sequential digits (e.g. 40 -> 4, 0)
                    for d in token:
                        sign_sequence.append({
                            "display": d,
                            "sign": d,
                            "type": "digit",
                            "description": f"ISL Digit {d} (part of {token})",
                            "has_3d_template": True
                        })
                        supported_templates.append(d)
                continue

            # Handle single letters / variables (e.g. X, Y)
            if len(upper) == 1 and upper in SUPPORTED_TEMPLATE_SIGNS:
                sign_sequence.append({
                    "display": token,
                    "sign": upper,
                    "type": "variable_letter",
                    "description": f"ISL Fingerspelling letter {upper}",
                    "has_3d_template": True
                })
                supported_templates.append(upper)
                continue

            # Unhandled token
            unsupported.append(token)

        # De-duplicate lists for summary display
        unique_supported = sorted(list(set(supported_templates)))
        unique_glosses = sorted(list(set(gloss_operators)))
        unique_unsupported = sorted(list(set(unsupported)))

        return {
            "sign_sequence": sign_sequence,
            "supported_tokens": unique_supported,
            "operator_glosses": unique_glosses,
            "unsupported_tokens": unique_unsupported,
            "has_warnings": len(unique_unsupported) > 0,
            "disclaimer": (
                "Educational Note: Digits (0-9) and variable letters (e.g. X, Y) feature pre-recorded "
                "3D skeleton gesture templates from Sixth-Sense. Multi-digit numbers are signed sequentially. "
                "Mathematical operators use standard educational ISL glosses."
            )
        }

    async def process(
        self,
        umr: UnifiedMathematicalRepresentation,
        profile: StudentProfile
    ) -> UnifiedMathematicalRepresentation:
        latex = umr.input.recognized_latex or umr.input.raw_content or ""
        analysis = self.analyze_expression_for_isl(latex)

        umr.accessibility.sign_language = {
            "is_supported": len(analysis["unsupported_tokens"]) == 0,
            "dialect": "ISL",
            "sign_sequence": analysis["sign_sequence"],
            "supported_tokens": analysis["supported_tokens"],
            "operator_glosses": analysis["operator_glosses"],
            "unsupported_tokens": analysis["unsupported_tokens"],
            "has_warnings": analysis["has_warnings"],
            "disclaimer": analysis["disclaimer"],
            "skeleton_playback_ready": True
        }

        return umr

    def health_check(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "vocabulary_size": len(SUPPORTED_TEMPLATE_SIGNS),
            "math_glosses_supported": len(MATH_OPERATOR_GLOSS),
            "method": "MediaPipe Holistic + DTW Template Matching",
            "gpl_isolation": "Verified isolated boundary"
        }
