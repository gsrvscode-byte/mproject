-- db/init.sql
--
-- Runs automatically the FIRST time the Postgres container starts with
-- an empty data volume (the official postgres image auto-executes every
-- .sql/.sh file placed in /docker-entrypoint-initdb.d/).
--
-- Note: POSTGRES_DB in docker-compose.yml already creates the
-- "employee_db" database itself before this script runs, so we only
-- need to create the table here.

CREATE TABLE IF NOT EXISTS employees (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    department  VARCHAR(255) NOT NULL,
    salary      NUMERIC(12, 2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
