from scheduler import main as scheduler_main


def test_main_logs_start(caplog) -> None:
    with caplog.at_level("INFO"):
        scheduler_main.main()

    assert "fieldnote-scheduler started" in caplog.text
