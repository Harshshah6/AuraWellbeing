use std::fs;
use std::path::PathBuf;
use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};

pub async fn init_db(app_data_dir: PathBuf) -> Result<SqlitePool, sqlx::Error> {
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).map_err(sqlx::Error::Io)?;
    }
    
    let db_path = app_data_dir.join("wellbeing.db");
    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true);
        
    let pool = SqlitePool::connect_with(options).await?;
    
    // Create the schema
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS apps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            executable_name TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            category TEXT DEFAULT 'Uncategorized',
            is_ignored INTEGER DEFAULT 0,
            productivity_score INTEGER DEFAULT 0
        );"
    ).execute(&pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id INTEGER NOT NULL,
            window_title TEXT,
            start_time TEXT NOT NULL, -- ISO-8601 string
            end_time TEXT NOT NULL,   -- ISO-8601 string
            duration_seconds INTEGER NOT NULL,
            FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
        );"
    ).execute(&pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS daily_summaries (
            date TEXT PRIMARY KEY, -- 'YYYY-MM-DD'
            total_screen_time INTEGER DEFAULT 0,
            total_productive_time INTEGER DEFAULT 0,
            total_distracting_time INTEGER DEFAULT 0,
            total_idle_time INTEGER DEFAULT 0
        );"
    ).execute(&pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS focus_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time TEXT NOT NULL,
            end_time TEXT,
            target_duration_seconds INTEGER NOT NULL,
            actual_duration_seconds INTEGER,
            completed INTEGER DEFAULT 0
        );"
    ).execute(&pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id INTEGER,
            category TEXT,
            duration_limit_seconds INTEGER NOT NULL,
            period TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
        );"
    ).execute(&pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );"
    ).execute(&pool).await?;

    Ok(pool)
}
