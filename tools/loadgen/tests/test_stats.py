from loadgen.stats import compare_entries, latency_percentiles, percentile


def test_percentile_of_an_empty_list_is_zero() -> None:
    assert percentile([], 0.5) == 0.0


def test_percentile_interpolates_between_values() -> None:
    assert percentile([0.0, 10.0], 0.5) == 5.0
    assert percentile([0.0, 10.0], 0.0) == 0.0
    assert percentile([0.0, 10.0], 1.0) == 10.0


def test_latency_percentiles_of_a_single_value() -> None:
    assert latency_percentiles([12.0]) == {"p50": 12.0, "p90": 12.0, "p99": 12.0}


def test_compare_counts_losses_and_duplicates() -> None:
    comparison = compare_entries(
        ["a", "b", "c"],
        ["a", "a", "b"],
    )
    assert comparison.confirmed == 2
    assert comparison.losses == 1
    assert comparison.duplicates == 1
    assert comparison.unexpected == 0
    assert not comparison.ok


def test_compare_is_clean_when_every_entry_appears_once() -> None:
    comparison = compare_entries(["a", "b"], ["a", "b"])
    assert comparison.confirmed == 2
    assert comparison.losses == 0
    assert comparison.duplicates == 0
    assert comparison.unexpected == 0
    assert comparison.ok


def test_compare_flags_entries_of_another_study() -> None:
    comparison = compare_entries(["a"], ["a", "zzz"])
    assert comparison.confirmed == 1
    assert comparison.unexpected == 1
    assert not comparison.ok
