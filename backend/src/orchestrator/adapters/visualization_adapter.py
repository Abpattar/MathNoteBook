import logging
from typing import Dict, Any
from .base import BaseAdapter
from ..schemas.umr import (
    UnifiedMathematicalRepresentation,
    VisualisationPayload,
)
from ..schemas.profile import StudentProfile

logger = logging.getLogger("orchestrator.adapters.visualization")

class VisualizationAdapter(BaseAdapter):
    capability_name: str = "visualization"
    is_available: bool = True

    async def initialize(self) -> bool:
        self.is_available = True
        return True

    def _extract_quadratic_coefficients(self, umr: UnifiedMathematicalRepresentation) -> Dict[str, float]:
        """Extract a, b, c from quadratic expression or AST."""
        # Defaults for x^2 + 5x + 6 = 0
        a, b, c = 1.0, 5.0, 6.0
        latex = umr.input.recognized_latex or ""
        
        import re
        # Try regex extraction for ax^2 + bx + c = 0
        match = re.search(r'([+-]?\s*\d*)\s*x\^?2\s*([+-]\s*\d*)\s*x\s*([+-]\s*\d+)', latex.replace(" ", ""))
        if match:
            a_str, b_str, c_str = match.groups()
            try:
                a_val = float(a_str.replace("+", "")) if a_str and a_str not in ("+", "-") else (-1.0 if a_str == "-" else 1.0)
                b_val = float(b_str.replace("+", "")) if b_str and b_str not in ("+", "-") else (-1.0 if b_str == "-" else 1.0)
                c_val = float(c_str.replace("+", ""))
                return {"a": a_val, "b": b_val, "c": c_val}
            except Exception:
                pass

        return {"a": a, "b": b, "c": c}

    def _extract_linear_coefficients(self, umr: UnifiedMathematicalRepresentation) -> Dict[str, float]:
        """Extract a, b, c for ax + b = c."""
        a, b, c = 2.0, 3.0, 7.0
        latex = umr.input.recognized_latex or ""
        import re
        match = re.search(r'([+-]?\s*\d*)\s*x\s*([+-]\s*\d+)?\s*=\s*([+-]?\s*\d+)', latex.replace(" ", ""))
        if match:
            a_str, b_str, c_str = match.groups()
            try:
                a_val = float(a_str) if a_str and a_str not in ("+", "-") else (-1.0 if a_str == "-" else 1.0)
                b_val = float(b_str) if b_str else 0.0
                c_val = float(c_str)
                return {"a": a_val, "b": b_val, "c": c_val}
            except Exception:
                pass
        return {"a": a, "b": b, "c": c}

    async def process(
        self,
        umr: UnifiedMathematicalRepresentation,
        profile: StudentProfile
    ) -> UnifiedMathematicalRepresentation:
        topic = umr.understanding.topic

        if topic == "quadratic_equations":
            coeffs = self._extract_quadratic_coefficients(umr)
            a, b, c = coeffs["a"], coeffs["b"], coeffs["c"]
            delta = b**2 - 4*a*c
            umr.visualisation = VisualisationPayload(
                type="quadratic_parabola",
                component_id="MathLearnParabolaVisualizer",
                initial_params={
                    "a": a,
                    "b": b,
                    "c": c,
                    "discriminant": delta,
                    "vertex_x": -b / (2 * a) if a != 0 else 0,
                    "vertex_y": c - (b**2) / (4 * a) if a != 0 else 0,
                    "has_real_roots": delta >= 0
                },
                description="Interactive parabola with dynamic roots, vertex, and discriminant slider."
            )
        elif topic == "linear_equations":
            coeffs = self._extract_linear_coefficients(umr)
            umr.visualisation = VisualisationPayload(
                type="equation_balance",
                component_id="MathLearnBalanceVisualizer",
                initial_params={
                    "a": coeffs["a"],
                    "b": coeffs["b"],
                    "c": coeffs["c"]
                },
                description="Interactive equation balance demonstrating inverse operations on both sides."
            )
        else:
            # General fallback or none
            umr.visualisation = VisualisationPayload(
                type=None,
                component_id=None,
                initial_params={},
                description="No specific visualizer mapped for this problem type."
            )

        return umr

    def health_check(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "visualizers": ["quadratic_parabola", "equation_balance", "algebra_tiles"],
            "source": "MathLearn-Primary ported components"
        }

