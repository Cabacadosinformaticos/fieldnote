from loadgen.media import PNG_SIGNATURE, make_png


def test_generated_image_is_a_png() -> None:
    payload = make_png(1)
    assert payload.startswith(PNG_SIGNATURE)
    assert b"IHDR" in payload
    assert b"IEND" in payload


def test_generated_image_is_deterministic_per_seed() -> None:
    assert make_png(7) == make_png(7)


def test_different_seeds_produce_different_files() -> None:
    assert make_png(7) != make_png(8)
