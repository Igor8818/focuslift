-- ============================================================================
-- FocusLift V1 - Schema Inicial PostgreSQL (Flyway Migration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workouts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_uuid VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    date VARCHAR(20) NOT NULL,
    notes TEXT,
    total_volume_kg NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_workout_user_client_uuid UNIQUE (user_id, client_uuid)
);

CREATE TABLE IF NOT EXISTS exercises (
    id BIGSERIAL PRIMARY KEY,
    workout_id BIGINT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    muscle_group VARCHAR(100),
    rest_timer_seconds INT DEFAULT 90,
    order_index INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id BIGSERIAL PRIMARY KEY,
    exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    weight NUMERIC(10, 2) NOT NULL,
    reps INT NOT NULL,
    rpe NUMERIC(3, 1),
    set_type VARCHAR(50) NOT NULL DEFAULT 'normal',
    completed_at VARCHAR(50),
    order_index INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS routines (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_uuid VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_routine_user_client_uuid UNIQUE (user_id, client_uuid)
);

CREATE TABLE IF NOT EXISTS routine_exercises (
    id BIGSERIAL PRIMARY KEY,
    routine_id BIGINT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    exercise_name VARCHAR(255) NOT NULL,
    muscle_group VARCHAR(100),
    target_sets INT DEFAULT 3,
    rest_timer_seconds INT DEFAULT 90,
    order_index INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_habits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date VARCHAR(20) NOT NULL,
    protein_done INT DEFAULT 0,
    water_done INT DEFAULT 0,
    workout_done INT DEFAULT 0,
    meals_done INT DEFAULT 0,
    streak_count INT DEFAULT 0,
    water_current_ml INT DEFAULT 0,
    water_target_ml INT DEFAULT 3000,
    protein_current_g INT DEFAULT 0,
    protein_target_g INT DEFAULT 160,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_daily_habits_user_date UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS sync_tombstones (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    client_uuid VARCHAR(100) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tombstone_user_entity_uuid UNIQUE (user_id, entity_type, client_uuid)
);

-- Índices de Alta Performance para Queries de Análise e Sincronização
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_exercises_workout ON exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_routines_user ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_habits_user_date ON daily_habits(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_user ON sync_tombstones(user_id);
