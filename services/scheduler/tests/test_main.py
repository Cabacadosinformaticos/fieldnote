from scheduler import main as scheduler_main
from scheduler.service import SchedulerService


def test_main_starts_the_service_loop(monkeypatch) -> None:
    started: list[bool] = []
    closed: list[bool] = []

    def fake_run_forever(self: SchedulerService) -> None:
        started.append(True)

    def fake_close(self: SchedulerService) -> None:
        closed.append(True)

    monkeypatch.setattr(SchedulerService, "run_forever", fake_run_forever)
    monkeypatch.setattr(SchedulerService, "close", fake_close)
    monkeypatch.setattr(scheduler_main.signal, "signal", lambda *_args: None)

    scheduler_main.main()

    assert started == [True]
    assert closed == [True]
