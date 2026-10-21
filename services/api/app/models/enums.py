"""Closed value sets and their PostgreSQL enum types.

The enum types are created once by the migration (`create_type=False`), because several
columns and tables share the same type.
"""

from enum import StrEnum

from sqlalchemy.dialects.postgresql import ENUM


class UserRole(StrEnum):
    ADMIN = "admin"
    RESEARCHER = "researcher"


class StudyRole(StrEnum):
    PRINCIPAL_INVESTIGATOR = "principal_investigator"
    CO_INVESTIGATOR = "co_investigator"
    MEMBER = "member"


class StudyStatus(StrEnum):
    DRAFT = "draft"
    RUNNING = "running"
    CLOSED = "closed"


class ScheduleStyle(StrEnum):
    FIXED = "fixed"
    BALANCED = "balanced"
    VARIED = "varied"


class ParticipantStatus(StrEnum):
    ACTIVE = "active"
    PENDING_APPROVAL = "pending_approval"
    DECLINED = "declined"
    WITHDRAWN = "withdrawn"
    REMOVED = "removed"
    ERASURE_SCHEDULED = "erasure_scheduled"


class Locale(StrEnum):
    PT = "pt"
    EN = "en"


class InviteCodeKind(StrEnum):
    PERSONAL = "personal"
    STUDY = "study"


class QuestionKind(StrEnum):
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    YES_NO = "yes_no"
    SHORT_TEXT = "short_text"


class PromptStatus(StrEnum):
    PLANNED = "planned"
    UNPLANNED = "unplanned"
    SENT = "sent"
    ANSWERED = "answered"
    EXPIRED = "expired"


class UnplannedReason(StrEnum):
    OUTSIDE_AVAILABILITY = "outside_availability"
    MIN_GAP_INFEASIBLE = "min_gap_infeasible"
    DAILY_CAP = "daily_cap"
    SLOT_CAP = "slot_cap"
    SEARCH_CUT = "search_cut"


class EntryType(StrEnum):
    TEXT = "text"
    PHOTO = "photo"
    VIDEO = "video"
    AUDIO = "audio"
    SCALE = "scale"
    CHOICE = "choice"


class MediaStatus(StrEnum):
    PENDING = "pending"
    UPLOADED = "uploaded"
    PROCESSED = "processed"
    FAILED = "failed"


class PoolInvitationStatus(StrEnum):
    SENT = "sent"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


class AuditActorType(StrEnum):
    USER = "user"
    PARTICIPANT = "participant"
    SYSTEM = "system"


class EmailCodePurpose(StrEnum):
    SIGN_IN = "sign_in"
    ADD_METHOD = "add_method"


class AgeBand(StrEnum):
    AGE_18_24 = "18-24"
    AGE_25_34 = "25-34"
    AGE_35_44 = "35-44"
    AGE_45_54 = "45-54"
    AGE_55_64 = "55-64"
    AGE_65_OR_MORE = "65+"


class Gender(StrEnum):
    FEMALE = "female"
    MALE = "male"
    OTHER = "other"


class Occupation(StrEnum):
    STUDENT = "student"
    EMPLOYEE = "employee"
    SELF_EMPLOYED = "self_employed"
    UNEMPLOYED = "unemployed"
    RETIRED = "retired"
    OTHER = "other"


class TransportMode(StrEnum):
    WALKING = "walking"
    PUBLIC_TRANSPORT = "public_transport"
    CAR = "car"
    BICYCLE = "bicycle"
    SCOOTER = "scooter"
    OTHER = "other"


def _values(enum_cls: type[StrEnum]) -> list[str]:
    return [member.value for member in enum_cls]


def _enum(enum_cls: type[StrEnum], name: str) -> ENUM:
    return ENUM(enum_cls, name=name, create_type=False, values_callable=_values)


user_role = _enum(UserRole, "user_role")
study_role = _enum(StudyRole, "study_role")
study_status = _enum(StudyStatus, "study_status")
schedule_style = _enum(ScheduleStyle, "schedule_style")
participant_status = _enum(ParticipantStatus, "participant_status")
locale = _enum(Locale, "locale")
invite_code_kind = _enum(InviteCodeKind, "invite_code_kind")
question_kind = _enum(QuestionKind, "question_kind")
prompt_status = _enum(PromptStatus, "prompt_status")
unplanned_reason = _enum(UnplannedReason, "unplanned_reason")
entry_type = _enum(EntryType, "entry_type")
media_status = _enum(MediaStatus, "media_status")
pool_invitation_status = _enum(PoolInvitationStatus, "pool_invitation_status")
audit_actor_type = _enum(AuditActorType, "audit_actor_type")
email_code_purpose = _enum(EmailCodePurpose, "email_code_purpose")
age_band = _enum(AgeBand, "age_band")
gender = _enum(Gender, "gender")
occupation = _enum(Occupation, "occupation")
transport_mode = _enum(TransportMode, "transport_mode")
