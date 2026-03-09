from thefuzz import fuzz


def fuzzy_match(expected: str, given: str, threshold: int = 75) -> bool:
    """Check if two strings are similar enough using fuzzy matching."""
    if not expected or not given:
        return False

    expected_lower = expected.lower().strip()
    given_lower = given.lower().strip()

    if expected_lower == given_lower:
        return True

    ratio = fuzz.ratio(expected_lower, given_lower)
    if ratio >= threshold:
        return True

    partial = fuzz.partial_ratio(expected_lower, given_lower)
    if partial >= 85:
        return True

    token_sort = fuzz.token_sort_ratio(expected_lower, given_lower)
    if token_sort >= threshold:
        return True

    return False
