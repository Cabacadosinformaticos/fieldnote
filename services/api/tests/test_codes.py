from app.security import codes, tokens


def test_personal_code_shape():
    code = codes.generate_personal_code()
    assert len(code) == 14 and code.count("-") == 2
    assert codes.normalize_code(code) == code
    assert codes.is_personal_code(code)


def test_study_code_shape():
    code = codes.generate_study_code()
    assert len(code) == 9 and code.count("-") == 1
    assert not codes.is_personal_code(code)


def test_normalize_accepts_lookalikes_spaces_and_lower_case():
    assert codes.normalize_code(" abcd efgh jkmn ") == "ABCD-EFGH-JKMN"
    assert codes.normalize_code("O1IL-uvwx") == "0111-VVWX"


def test_normalize_rejects_wrong_lengths():
    assert codes.normalize_code("ABC") is None
    assert codes.normalize_code("ABCD-EFGH-JK") is None


def test_device_token_hash_matches_the_auth_dependency():
    token = codes.generate_device_token()
    assert codes.hash_device_token(token) == tokens.hash_token(token)
