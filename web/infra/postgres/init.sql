-- Runs once when the Postgres volume is created. The API uses the ordinary role "spa": superusers
-- bypass row-level security, so the API must never connect as one (SRS FR-B1.3, NFR-SEC.4).
CREATE ROLE spa LOGIN PASSWORD 'spa' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
ALTER DATABASE spa_platform OWNER TO spa;
\connect spa_platform
CREATE EXTENSION IF NOT EXISTS pgcrypto;
