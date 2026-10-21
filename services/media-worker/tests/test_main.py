from media_worker import main as media_worker_main


def test_main_starts_the_consumer(monkeypatch, caplog) -> None:
    started = []
    monkeypatch.setattr(media_worker_main.MediaConsumer, "run", lambda self: started.append(self))

    with caplog.at_level("INFO"):
        media_worker_main.main()

    assert len(started) == 1
    assert "fieldnote-media-worker started" in caplog.text
