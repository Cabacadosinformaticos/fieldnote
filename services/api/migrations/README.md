# Migrations

Alembic owns the schema. The models in `app/models/` are the source; migrations are generated
from them and then read and corrected by hand.

The database URL comes from `Settings.database_url` (`FIELDNOTE_DATABASE_URL`), so pass the
connection string as an environment variable:

```bash
cd services/api
export FIELDNOTE_DATABASE_URL="postgresql+psycopg://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"

# Create a migration after changing a model.
uv run alembic revision --autogenerate -m "short description"

# Apply, inspect and revert.
uv run alembic upgrade head
uv run alembic current
uv run alembic downgrade -1
uv run alembic check   # fails when the models and the database disagree
```

After generating, open the new file in `versions/` and check it:

- PostgreSQL enum types are created with `CREATE TYPE` at the top of `upgrade`, because the
  column definitions use `create_type=False`; `downgrade` drops them after the tables.
- A new enum type also needs its values added to `app/models/enums.py`.
- Every foreign key has an explicit `ondelete`; keep it when editing.
- `downgrade` must leave an empty database: drop foreign keys created with `ALTER` (for the
  `participant` / `invite_code` cycle) before dropping the tables.

The initial revision is `0001_initial_schema`.
