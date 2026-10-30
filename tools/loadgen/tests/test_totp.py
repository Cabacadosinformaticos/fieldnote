from datetime import UTC, datetime

from loadgen.totp import generate_code

# RFC 6238's SHA-1 test secret, the ASCII string "12345678901234567890".
RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"


def test_rfc_vector_is_reduced_to_six_digits() -> None:
    # The RFC publishes 94287082 at this moment; six digits keep the low six.
    assert generate_code(RFC_SECRET, datetime(1970, 1, 1, 0, 0, 59, tzinfo=UTC)) == "287082"


def test_code_has_six_digits() -> None:
    code = generate_code(RFC_SECRET, datetime(2026, 11, 2, 12, 0, 0, tzinfo=UTC))
    assert len(code) == 6
    assert code.isdigit()
