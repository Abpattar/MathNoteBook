import re
from typing import Dict, Any, Optional

WORD_TO_NUMBER = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13",
    "fourteen": "14", "fifteen": "15", "sixteen": "16", "seventeen": "17",
    "eighteen": "18", "nineteen": "19", "twenty": "20", "thirty": "30",
    "forty": "40", "fifty": "50", "sixty": "60", "seventy": "70",
    "eighty": "80", "ninety": "90", "hundred": "100"
}

OPERATOR_REPLACEMENTS = [
    # Powers and Exponents
    (r'\b(?:raised\s+to\s+the\s+power\s+of|to\s+the\s+power\s+of|power\s+of)\s*(\w+)', r'^{\g<1>}'),
    (r'(\w+)\s+squared\b', r'\g<1>^2'),
    (r'(\w+)\s+cubed\b', r'\g<1>^3'),
    (r'\bsquared\b', r'^2'),
    (r'\bcubed\b', r'^3'),

    # Roots
    (r'\bsquare\s+root\s+of\s+([^,\.\?]+)', r'\\sqrt{\g<1>}'),
    (r'\bcube\s+root\s+of\s+([^,\.\?]+)', r'\\sqrt[3]{\g<1>}'),
    (r'\broot\s+of\s+([^,\.\?]+)', r'\\sqrt{\g<1>}'),

    # Inequalities and Equality
    (r'\b(?:is\s+)?greater\s+than\s+or\s+equal\s+to\b', r'\\ge'),
    (r'\b(?:is\s+)?less\s+than\s+or\s+equal\s+to\b', r'\\le'),
    (r'\b(?:is\s+)?greater\s+than\b', r'>'),
    (r'\b(?:is\s+)?less\s+than\b', r'<'),
    (r'\b(?:is\s+)?equal\s+to\b', r'='),
    (r'\bequals\b', r'='),
    (r'\bequal\b', r'='),

    # Plus / Minus / Times / Divide
    (r'\bplus\s+or\s+minus\b', r'\\pm'),
    (r'\bplus\b', r'+'),
    (r'\bminus\b', r'-'),
    (r'\btimes\b', r'*'),
    (r'\bmultiplied\s+by\b', r'*'),
    (r'\bdivided\s+by\b', r'/'),

    # Constants & Symbols
    (r'\bpi\b', r'\\pi'),
    (r'\btheta\b', r'\\theta'),
    (r'\balpha\b', r'\\alpha'),
    (r'\bbeta\b', r'\\beta'),
    (r'\bdegrees?\b', r'°'),

    # Trigonometry
    (r'\bsine\s+of\b', r'\\sin'),
    (r'\bcosine\s+of\b', r'\\cos'),
    (r'\btangent\s+of\b', r'\\tan'),
    (r'\bsin\s+of\b', r'\\sin'),
    (r'\bcos\s+of\b', r'\\cos'),
    (r'\btan\s+of\b', r'\\tan'),

    # Parentheses
    (r'\bopen\s+parenthesis\b', r'('),
    (r'\bclose\s+parenthesis\b', r')'),
    (r'\bopen\s+bracket\b', r'['),
    (r'\bclose\s+bracket\b', r']'),
]


def normalize_voice_transcript(transcript: str) -> Dict[str, Any]:
    """
    Transforms spoken mathematical transcripts into standardized LaTeX and algebraic representations.
    Preserves natural language if it is a geometry or word problem.
    """
    if not transcript or not transcript.strip():
        return {
            "raw": transcript,
            "normalized": "",
            "latex": "",
            "is_equation": False,
            "confidence": 0.0
        }

    text = transcript.strip().lower()

    # Step 1: Detect if this is an explicit geometry/word problem command
    is_word_problem = bool(re.search(
        r'\b(find|calculate|determine|what\s+is|area|perimeter|volume|triangle|circle|hypotenuse|radius|diameter)\b',
        text
    ))

    # Step 2: Replace number words
    tens = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
    units = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9}
    for ten_word, ten_val in tens.items():
        for unit_word, unit_val in units.items():
            pattern = rf'\b{ten_word}\s+{unit_word}\b'
            text = re.sub(pattern, str(ten_val + unit_val), text)

    for word, num in WORD_TO_NUMBER.items():
        text = re.sub(rf'\b{word}\b', num, text)

    # Step 3: Handle fraction expressions like "A over B" or "A all over B"
    fraction_pattern = r'(\b[\w\^\+\-\*\s]+?)\s+(?:all\s+)?over\s+([\w\^\+\-\*]+)'
    text = re.sub(fraction_pattern, r'\\frac{\g<1>}{\g<2>}', text)

    # Step 4: Apply operator and mathematical rule replacements
    for pattern, replacement in OPERATOR_REPLACEMENTS:
        text = re.sub(pattern, replacement, text)

    # Step 5: Clean up algebraic juxtapositions for variables: "2 x" -> "2x", "5 y" -> "5y"
    text = re.sub(r'(\d)\s+([a-zA-Z])(?=\s|[+\-*/=><\^]|$)', r'\1\2', text)
    # Clean redundant spaces around operators
    text = re.sub(r'\s*([+\-*/=><])\s*', r' \1 ', text)
    text = re.sub(r'\s*\^\s*', r'^', text)
    text = re.sub(r'\s+', ' ', text).strip()

    is_equation = bool(re.search(r'[=><]|\\frac|\\sqrt|\^|\b[a-zA-Z]\b', text))

    return {
        "raw": transcript,
        "normalized": text,
        "latex": text,
        "is_equation": is_equation,
        "is_word_problem": is_word_problem,
        "confidence": 0.95 if is_equation or is_word_problem else 0.8
    }
