"""Account mail, sent through the platform's own SMTP server.

In development the server is Mailpit (``mailpit:1025`` inside Compose, ``127.0.0.1:1025`` from the
host). The message names no study and holds no participant data, as NFR-78 requires.
"""

import smtplib
from email.message import EmailMessage

from pydantic_settings import BaseSettings, SettingsConfigDict

SUBJECT = "O seu código de acesso Fieldnote"
BODY = "O seu código é {code}. É válido durante 10 minutos."
PASSWORD_RESET_SUBJECT = "Recuperação de palavra-passe Fieldnote"
PASSWORD_RESET_BODY = (
    "Use este token para definir uma nova palavra-passe: {token}. "
    "É válido durante 1 hora e só pode ser usado uma vez."
)


class MailSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FIELDNOTE_", extra="ignore")

    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    smtp_from: str = "Fieldnote <no-reply@fieldnote.local>"
    smtp_timeout_seconds: float = 10.0
    smtp_starttls: bool = False
    smtp_username: str | None = None
    smtp_password: str | None = None


settings = MailSettings()


class MailUnavailable(RuntimeError):
    """The SMTP server could not take the message."""


def _send(to: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        with smtplib.SMTP(
            settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds
        ) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password or "")
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise MailUnavailable("The mail server is unavailable.") from exc


def send_email_code(to: str, code: str) -> None:
    _send(to, SUBJECT, BODY.format(code=code))


def send_password_reset(to: str, token: str) -> None:
    _send(to, PASSWORD_RESET_SUBJECT, PASSWORD_RESET_BODY.format(token=token))
