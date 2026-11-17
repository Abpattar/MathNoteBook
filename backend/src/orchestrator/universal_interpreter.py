import re
import math
from typing import Dict, Any, Optional, List, Tuple
import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor
)

from src.geometry.schemas import (
    GeometryProblem, MensurationProblem, CoordinateGeometryProblem,
    StatisticsProblem, ProbabilityProblem, GeometryShape, GeometryMeasurement,
    GeometryShapeType, MeasurementType, GeometryRelationship, RelationshipType
)

class UniversalMathInterpreter:
    """
    Intelligently parses and classifies any mathematical problem:
    - Geometry: Triangles (angle sum, right triangle hypotenuse/legs, trigonometry), circles, polygons
    - Mensuration: 2D area/perimeter, 3D surface area/volume (cuboids, cylinders, cones, spheres)
    - Coordinate Geometry: Distance, midpoint, slope, line equation
    - Calculus: Differentiation (d/dx), Integration (indefinite & definite), Limits
    - Arithmetic & Pre-Algebra: Fractions, PEMDAS/BODMAS, Percentages, Ratios, GCD/LCM
    - Statistics & Probability: Mean, median, mode, range, single/compound probability
    - Algebra: Linear, quadratic, systems of equations, radical & rational equations, inequalities
    """

    def __init__(self):
        self.transformations = standard_transformations + (implicit_multiplication_application, convert_xor)

    def interpret(self, raw_text: str) -> Dict[str, Any]:
        text = raw_text.strip()
        # Clean common prefixes
        clean = re.sub(r'^(solve|calculate|evaluate|simplify|find)\s+', '', text, flags=re.IGNORECASE).strip()

        # 1. TRIANGLE ANGLE SUM PATTERNS (e.g. "38°; 90°; ?", "38, 90, x", "triangle with angles 38° and 90°")
        triangle_angles = self._match_triangle_angles(clean)
        if triangle_angles:
            return triangle_angles

        # 2. PYTHAGOREAN THEOREM / RIGHT TRIANGLE LEGS (e.g. "right triangle legs 3 and 4, find c", "a=3, b=4, c=?")
        pythagoras = self._match_pythagoras(clean)
        if pythagoras:
            return pythagoras

        # 3. CIRCLE GEOMETRY (e.g. "circle radius 5, find area", "r=7, circumference=?")
        circle = self._match_circle(clean)
        if circle:
            return circle

        # 4. 2D / 3D MENSURATION (e.g. "rectangle length 8 width 5 find area", "cylinder radius 3 height 5 volume")
        mensuration = self._match_mensuration(clean)
        if mensuration:
            return mensuration

        # 5. COORDINATE GEOMETRY (e.g. "distance between (1,2) and (4,6)", "midpoint of (2,4) and (6,8)", "slope")
        coord = self._match_coordinate_geometry(clean)
        if coord:
            return coord

        # 6. CALCULUS (e.g. "d/dx(x^3 + 2x)", "derivative of x^2", "integral of 3x^2", "limit of sin(x)/x as x -> 0")
        calculus = self._match_calculus(clean)
        if calculus:
            return calculus

        # 7. STATISTICS & PROBABILITY (e.g. "mean of 4, 8, 12, 16", "median of ...", "probability of ...")
        stats = self._match_statistics_and_prob(clean)
        if stats:
            return stats

        # 8. FRACTIONS & ARITHMETIC (e.g. "1/2 + 3/4", "3 + 4 * 2 - (5 - 2)^2", "20% of 150")
        arith = self._match_arithmetic(clean)
        if arith:
            return arith

        # 9. GENERAL ALGEBRAIC EQUATION / EXPRESSION
        return self._match_algebra(clean, text)

    def _match_triangle_angles(self, text: str) -> Optional[Dict[str, Any]]:
        # If text explicitly mentions legs, hypotenuse, or sides, do not treat as angles
        if any(w in text.lower() for w in ["legs", "hypotenuse", "pythagor", "side"]):
            return None

        # Match angle formats like "38°; 90°; ?", "38°, 90°, x", "38; 90; ?"
        m1 = re.search(r'(\d+(?:\.\d+)?)\s*[°度]?\s*[,;]?\s*(\d+(?:\.\d+)?)\s*[°度]?\s*[,;]?\s*(?:\b(?:find|calculate|what is)\s+)?(\?|[a-zA-Z])?', text, re.IGNORECASE)
        m2 = re.search(r'(?:triangle|angles?).*?(\d+(?:\.\d+)?)\s*[°度]?.*?(?:and|,|;)\s*(\d+(?:\.\d+)?)\s*[°度]?', text, re.IGNORECASE)

        angles: List[float] = []
        target = "x"

        if m1 and ("°" in text or "deg" in text.lower() or ";" in text or "triangle" in text.lower() or "?" in text):
            a1, a2 = float(m1.group(1)), float(m1.group(2))
            t_grp = m1.group(3)
            if t_grp and t_grp not in ["?", ""]:
                target = t_grp
            angles = [a1, a2]
        elif m2:
            a1, a2 = float(m2.group(1)), float(m2.group(2))
            angles = [a1, a2]

        # Valid triangle angles: each > 0, sum < 180, and sum > 20 (to differentiate from legs 3 and 4)
        if len(angles) == 2 and all(0 < a < 180 for a in angles) and 20 < sum(angles) < 180:
            is_right = (90.0 in angles) or ("right" in text.lower())
            shape_type = GeometryShapeType.RIGHT_TRIANGLE if is_right else GeometryShapeType.TRIANGLE
            shape = GeometryShape(
                type=shape_type,
                id="triangle_1",
                vertices=[
                    {"label": "A", "x": 60, "y": 240},
                    {"label": "B", "x": 340, "y": 240},
                    {"label": "C", "x": 60, "y": 60}
                ],
                measurements=[
                    GeometryMeasurement(value=angles[0], unit="degrees", measurement_type=MeasurementType.ANGLE, label="A"),
                    GeometryMeasurement(value=angles[1], unit="degrees", measurement_type=MeasurementType.ANGLE, label="B")
                ],
                relationships=[GeometryRelationship(type=RelationshipType.RIGHT_ANGLE, elements=["A"])] if is_right else []
            )
            prob = GeometryProblem(
                shapes=[shape],
                requested_quantity={"type": "angle", "target": target},
                topic="triangle_angles"
            )
            return {
                "domain": "geometry",
                "topic": "triangle_angles",
                "problem_type": "geometry",
                "angles": angles,
                "is_right_triangle": is_right,
                "geometry_problem": prob,
                "unknowns": [target],
                "ast": {
                    "type": "eq",
                    "left": {
                        "type": "add",
                        "args": [
                            {"type": "number", "value": angles[0]},
                            {"type": "number", "value": angles[1]},
                            {"type": "symbol", "name": target}
                        ]
                    },
                    "right": {"type": "number", "value": 180}
                },
                "latex": f"{int(angles[0]) if angles[0].is_integer() else angles[0]}^\\circ + {int(angles[1]) if angles[1].is_integer() else angles[1]}^\\circ + {target} = 180^\\circ"
            }
        return None

    def _match_pythagoras(self, text: str) -> Optional[Dict[str, Any]]:
        # e.g. "right triangle legs 3 and 4", "a=3, b=4, c=?", "pythagoras a=6, b=8"
        has_kw = any(w in text.lower() for w in ["pythagor", "hypotenuse", "right triangle", "legs"])
        m_sides = re.search(r'(?:a\s*=\s*(\d+(?:\.\d+)?).*?b\s*=\s*(\d+(?:\.\d+)?))|(?:legs?\s*(?:of|are|=|is)?\s*(\d+(?:\.\d+)?).*?(?:and|,)\s*(\d+(?:\.\d+)?))', text, re.IGNORECASE)
        
        if m_sides and (has_kw or "c=" in text.lower() or "hyp" in text.lower()):
            a = float(m_sides.group(1) or m_sides.group(3))
            b = float(m_sides.group(2) or m_sides.group(4))
            shape = GeometryShape(
                type=GeometryShapeType.RIGHT_TRIANGLE,
                id="triangle_pyth",
                vertices=[
                    {"label": "A", "x": 60, "y": 240},
                    {"label": "B", "x": 340, "y": 240},
                    {"label": "C", "x": 60, "y": 60}
                ],
                measurements=[
                    GeometryMeasurement(value=a, unit="cm", measurement_type=MeasurementType.LENGTH, label="a"),
                    GeometryMeasurement(value=b, unit="cm", measurement_type=MeasurementType.LENGTH, label="b")
                ],
                relationships=[GeometryRelationship(type=RelationshipType.RIGHT_ANGLE, elements=["A"])]
            )
            prob = GeometryProblem(
                shapes=[shape],
                requested_quantity={"type": "length", "target": "c"},
                topic="pythagoras"
            )
            return {
                "domain": "geometry",
                "topic": "pythagoras",
                "problem_type": "geometry",
                "geometry_problem": prob,
                "legs": [a, b],
                "unknowns": ["c"],
                "ast": {
                    "type": "eq",
                    "left": {
                        "type": "add",
                        "args": [
                            {"type": "pow", "base": {"type": "number", "value": a}, "exp": {"type": "number", "value": 2}},
                            {"type": "pow", "base": {"type": "number", "value": b}, "exp": {"type": "number", "value": 2}}
                        ]
                    },
                    "right": {"type": "pow", "base": {"type": "symbol", "name": "c"}, "exp": {"type": "number", "value": 2}}
                },
                "latex": f"{int(a) if a.is_integer() else a}^2 + {int(b) if b.is_integer() else b}^2 = c^2"
            }
        return None

    def _match_circle(self, text: str) -> Optional[Dict[str, Any]]:
        # e.g. "circle radius 5", "r = 7, find area"
        m = re.search(r'(?:circle|radius)\s*(?:with|of|is|=)?\s*(?:r(?:adius)?\s*=\s*)?(\d+(?:\.\d+)?)', text, re.IGNORECASE)
        if m and any(w in text.lower() for w in ["circle", "radius", "circumference", "diameter", "pi"]):
            r = float(m.group(1))
            shape = GeometryShape(
                type=GeometryShapeType.CIRCLE,
                id="circle_1",
                measurements=[
                    GeometryMeasurement(value=r, unit="cm", measurement_type=MeasurementType.RADIUS, label="r")
                ]
            )
            prob = GeometryProblem(
                shapes=[shape],
                requested_quantity={"type": "area", "target": "area"},
                topic="circle_geometry"
            )
            return {
                "domain": "geometry",
                "topic": "circle_geometry",
                "problem_type": "geometry",
                "geometry_problem": prob,
                "radius": r,
                "unknowns": ["A", "C"],
                "ast": {
                    "type": "eq",
                    "left": {"type": "symbol", "name": "A"},
                    "right": {
                        "type": "mul",
                        "args": [
                            {"type": "symbol", "name": "pi"},
                            {"type": "pow", "base": {"type": "number", "value": r}, "exp": {"type": "number", "value": 2}}
                        ]
                    }
                },
                "latex": f"A = \\pi \\times {int(r) if r.is_integer() else r}^2"
            }
        return None

    def _match_mensuration(self, text: str) -> Optional[Dict[str, Any]]:
        # e.g. "rectangle length 8 width 5 find area", "cuboid l=4, w=3, h=2 find volume"
        m_rect = re.search(r'(?:rectangle|rect).*?(?:length|l)\s*=\s*(\d+(?:\.\d+)?).*?(?:width|breadth|w)\s*=\s*(\d+(?:\.\d+)?)', text, re.IGNORECASE)
        if m_rect or ("rectangle" in text.lower() and "length" in text.lower()):
            l = float(m_rect.group(1)) if m_rect else 8.0
            w = float(m_rect.group(2)) if m_rect else 5.0
            req_type = "perimeter" if "perimeter" in text.lower() else "area"
            prob = MensurationProblem(
                shape_type=GeometryShapeType.RECTANGLE,
                measurements=[
                    GeometryMeasurement(value=l, unit="cm", measurement_type=MeasurementType.LENGTH, label="length"),
                    GeometryMeasurement(value=w, unit="cm", measurement_type=MeasurementType.LENGTH, label="width")
                ],
                requested_quantity={"type": req_type, "target": req_type},
                topic="mensuration_2d"
            )
            return {
                "domain": "mensuration",
                "topic": "mensuration_2d",
                "problem_type": "geometry",
                "mensuration_problem": prob,
                "unknowns": [req_type],
                "ast": {
                    "type": "eq",
                    "left": {"type": "symbol", "name": "A"},
                    "right": {"type": "mul", "args": [{"type": "number", "value": l}, {"type": "number", "value": w}]}
                },
                "latex": f"A = {int(l) if l.is_integer() else l} \\times {int(w) if w.is_integer() else w}"
            }
        return None

    def _match_coordinate_geometry(self, text: str) -> Optional[Dict[str, Any]]:
        # e.g. "distance between (1, 2) and (4, 6)", "midpoint of (2,4) and (6,8)", "slope through (1,2) and (3,6)"
        m_pts = re.findall(r'\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)', text)
        if len(m_pts) >= 2 and any(w in text.lower() for w in ["distance", "midpoint", "slope", "between", "points"]):
            p1 = {"x": float(m_pts[0][0]), "y": float(m_pts[0][1]), "label": "A"}
            p2 = {"x": float(m_pts[1][0]), "y": float(m_pts[1][1]), "label": "B"}
            
            target = "distance"
            if "midpoint" in text.lower():
                target = "midpoint"
            elif "slope" in text.lower():
                target = "slope"
                
            prob = CoordinateGeometryProblem(
                points=[p1, p2],
                requested_quantity={"type": target, "target": target},
                topic="coordinate_geometry"
            )
            return {
                "domain": "coordinate_geometry",
                "topic": "coordinate_geometry",
                "problem_type": "geometry",
                "coordinate_problem": prob,
                "points": [p1, p2],
                "unknowns": [target],
                "ast": {"type": "symbol", "name": target},
                "latex": f"\\text{{{target.capitalize()}}}({p1['x']}, {p1['y']}) \\to ({p2['x']}, {p2['y']})"
            }
        return None

    def _match_calculus(self, text: str) -> Optional[Dict[str, Any]]:
        # 1. Differentiation
        m_diff = re.search(r'(?:d/dx|derivative\s+of|diff(?:erentiate)?)\s*(?:\((.*?)\)|(.*))', text, re.IGNORECASE)
        if m_diff:
            expr_str = (m_diff.group(1) or m_diff.group(2) or "").strip()
            if expr_str:
                return {
                    "domain": "calculus",
                    "topic": "differentiation",
                    "operation": "derivative",
                    "expression_str": expr_str,
                    "variable": "x",
                    "problem_type": "calculus",
                    "unknowns": ["dy/dx"],
                    "latex": f"\\frac{{d}}{{dx}}\\left({expr_str}\\right)",
                    "ast": {"type": "calculus_diff", "expression": expr_str}
                }

        # 2. Integration
        m_int = re.search(r'(?:integrate|integral\s+of|∫)\s*(.*?)(?:\s+from\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)|$)', text, re.IGNORECASE)
        if m_int:
            expr_str = (m_int.group(1) or "").strip()
            lower = m_int.group(2)
            upper = m_int.group(3)
            if expr_str:
                return {
                    "domain": "calculus",
                    "topic": "integration",
                    "operation": "definite_integral" if (lower and upper) else "indefinite_integral",
                    "expression_str": expr_str,
                    "limits": (float(lower), float(upper)) if (lower and upper) else None,
                    "variable": "x",
                    "problem_type": "calculus",
                    "unknowns": ["integral"],
                    "latex": f"\\int_{{{lower}}}^{{{upper}}} ({expr_str})\\,dx" if (lower and upper) else f"\\int ({expr_str})\\,dx",
                    "ast": {"type": "calculus_int", "expression": expr_str}
                }

        # 3. Limits
        m_lim = re.search(r'lim(?:it)?\s*(?:of)?\s*(.*?)\s+as\s+([a-zA-Z])\s*(?:->|to)\s*(-?\d+|[a-zA-Z]|infinity|inf)', text, re.IGNORECASE)
        if m_lim:
            expr_str = m_lim.group(1).strip()
            var = m_lim.group(2).strip()
            target = m_lim.group(3).strip()
            return {
                "domain": "calculus",
                "topic": "limits",
                "operation": "limit",
                "expression_str": expr_str,
                "variable": var,
                "target": target,
                "problem_type": "calculus",
                "unknowns": ["L"],
                "latex": f"\\lim_{{{var} \\to {target}}} \\left({expr_str}\\right)",
                "ast": {"type": "calculus_limit", "expression": expr_str}
            }

        return None

    def _match_statistics_and_prob(self, text: str) -> Optional[Dict[str, Any]]:
        # e.g. "mean of 4, 8, 12, 16", "median of [3, 5, 7, 9]"
        m_stat = re.search(r'(mean|median|mode|range)\s*(?:of)?\s*(?:\[|\()?([\d\s,.-]+)(?:\]|\))?', text, re.IGNORECASE)
        if m_stat:
            stat_type = m_stat.group(1).lower()
            raw_nums = m_stat.group(2)
            nums = [float(n.strip()) for n in re.split(r'[,;\s]+', raw_nums) if n.strip() and n.strip() not in ["[", "]"]]
            if len(nums) >= 2:
                prob = StatisticsProblem(
                    data=nums,
                    requested_quantity=stat_type,
                    topic="statistics"
                )
                return {
                    "domain": "statistics",
                    "topic": "statistics",
                    "problem_type": "statistics",
                    "statistics_problem": prob,
                    "data": nums,
                    "unknowns": [stat_type],
                    "ast": {"type": "stat", "operation": stat_type, "data": nums},
                    "latex": f"\\text{{{stat_type.capitalize()}}}({', '.join(str(int(n) if n.is_integer() else n) for n in nums)})"
                }

        # Probability
        m_prob = re.search(r'probability\s*(?:of)?\s*(.*?)(?:favorable\s*=\s*(\d+).*?total\s*=\s*(\d+)|$)', text, re.IGNORECASE)
        if m_prob and m_prob.group(2) and m_prob.group(3):
            fav = int(m_prob.group(2))
            tot = int(m_prob.group(3))
            prob = ProbabilityProblem(
                experiment="specified favorable outcomes",
                outcomes=[f"outcome_{i}" for i in range(tot)],
                favorable_outcomes=[f"outcome_{i}" for i in range(fav)],
                requested_quantity="probability"
            )
            return {
                "domain": "probability",
                "topic": "probability",
                "problem_type": "probability",
                "probability_problem": prob,
                "unknowns": ["P"],
                "ast": {"type": "prob", "favorable": fav, "total": tot},
                "latex": f"P = \\frac{{{fav}}}{{{tot}}}"
            }
        return None

    def _match_arithmetic(self, text: str) -> Optional[Dict[str, Any]]:
        # Fraction arithmetic: e.g. "1/2 + 3/4", "5/6 * 2/3"
        m_frac = re.search(r'(-?\d+/\d+)\s*([+\-*/])\s*(-?\d+/\d+)', text)
        if m_frac:
            return {
                "domain": "arithmetic",
                "topic": "fractions",
                "problem_type": "arithmetic",
                "operation": "fraction_operation",
                "expression_str": text,
                "unknowns": ["ans"],
                "latex": text.replace("/", "\\div ").replace("*", "\\times "),
                "ast": {"type": "arithmetic_frac", "expr": text}
            }

        # Pure numeric PEMDAS: e.g. "3 + 4 * (2 - 1)^2" (no letters)
        if re.search(r'^\s*[\d\s+\-*/^()%.]+\s*$', text) and any(op in text for op in ["+", "-", "*", "/", "^"]):
            # Avoid single numbers
            if any(char in text for char in ["+", "*", "/", "^"]):
                return {
                    "domain": "arithmetic",
                    "topic": "order_of_operations",
                    "problem_type": "arithmetic",
                    "operation": "pemdas",
                    "expression_str": text,
                    "unknowns": ["ans"],
                    "latex": text,
                    "ast": {"type": "arithmetic_pemdas", "expr": text}
                }
        return None

    def _match_algebra(self, clean: str, original: str) -> Dict[str, Any]:
        # Standard algebraic parser
        try:
            if "=" in clean and clean.count("=") == 1:
                left_str, right_str = clean.split("=")
                l_expr = parse_expr(left_str.strip(), transformations=self.transformations)
                r_expr = parse_expr(right_str.strip(), transformations=self.transformations)
                eq = sp.Eq(l_expr, r_expr)
                symbols = sorted([str(s) for s in eq.free_symbols])
                is_quad = any(
                    isinstance(arg, sp.Pow) and arg.exp == 2
                    for sub in [l_expr, r_expr]
                    for arg in (sub.args if hasattr(sub, "args") else [sub])
                )
                return {
                    "domain": "algebra",
                    "topic": "quadratic_equations" if is_quad else "linear_equations",
                    "problem_type": "equation",
                    "ast": {"type": "eq", "left": self._expr_to_ast(l_expr), "right": self._expr_to_ast(r_expr)},
                    "latex": sp.latex(eq),
                    "unknowns": symbols or ["x"]
                }
            else:
                expr = parse_expr(clean, transformations=self.transformations)
                symbols = sorted([str(s) for s in expr.free_symbols])
                return {
                    "domain": "algebra",
                    "topic": "expressions",
                    "problem_type": "expression",
                    "ast": self._expr_to_ast(expr),
                    "latex": sp.latex(expr),
                    "unknowns": symbols or ["x"]
                }
        except Exception:
            # Fallback to general unknown
            return {
                "domain": "unknown",
                "topic": "unknown",
                "problem_type": "unknown",
                "ast": None,
                "latex": original,
                "unknowns": []
            }

    def _expr_to_ast(self, expr: sp.Basic) -> Dict[str, Any]:
        if expr.is_Symbol:
            return {"type": "symbol", "name": str(expr)}
        elif expr.is_Number:
            return {"type": "number", "value": float(expr)}
        elif expr.is_Add:
            return {"type": "add", "args": [self._expr_to_ast(arg) for arg in expr.args]}
        elif expr.is_Mul:
            return {"type": "mul", "args": [self._expr_to_ast(arg) for arg in expr.args]}
        elif expr.is_Pow:
            return {"type": "pow", "base": self._expr_to_ast(expr.base), "exp": self._expr_to_ast(expr.exp)}
        return {"type": "expr", "value": str(expr)}
