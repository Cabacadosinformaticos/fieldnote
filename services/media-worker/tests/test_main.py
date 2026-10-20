from media_worker import main as media_worker_main


def test_main_logs_start(caplog) -> None:
    with caplog.at_level("INFO"):
        media_worker_main.main()

    assert "fieldnote-media-worker started" in caplog.text
