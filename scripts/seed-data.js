import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to format Date into ISO-8601 string with local timezone offset
function toISOStringLocal(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const offHours = pad(Math.floor(absOffset / 60));
    const offMinutes = pad(absOffset % 60);

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offHours}:${offMinutes}`;
}

function formatDateOnly(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Curated list of desktop applications across various categories
const APPS = [
    {
        executable_name: 'code.exe',
        display_name: 'Visual Studio Code',
        category: 'Development',
        productivity_score: 2,
        titles: [
            'db.rs — AuraWellbeing — Visual Studio Code',
            'App.tsx — AuraWellbeing — Visual Studio Code',
            'tracker.rs — AuraWellbeing — Visual Studio Code',
            'index.css — AuraWellbeing — Visual Studio Code',
            'package.json — AuraWellbeing — Visual Studio Code'
        ]
    },
    {
        executable_name: 'chrome.exe',
        display_name: 'Google Chrome',
        category: 'Browsing',
        productivity_score: 0,
        titles: [
            'Rust Documentation — sqlx::query',
            'GitHub — harshshah6/Aurawellbeing',
            'Stack Overflow — SQLite performance optimization in Rust',
            'Hacker News — Tech & Startups',
            'React 19 Release Notes & Migration Guide'
        ]
    },
    {
        executable_name: 'figma.exe',
        display_name: 'Figma',
        category: 'Design',
        productivity_score: 2,
        titles: [
            'Aura Wellbeing UI Design System v2 — Figma',
            'Dashboard Redesign & Analytics Charts — Figma',
            'Design Tokens & Color Palettes — Figma'
        ]
    },
    {
        executable_name: 'slack.exe',
        display_name: 'Slack',
        category: 'Communication',
        productivity_score: 1,
        titles: [
            '#engineering — Aura Team Workspace',
            '#general — Company Announcements',
            'Direct Message — Product Manager'
        ]
    },
    {
        executable_name: 'spotify.exe',
        display_name: 'Spotify',
        category: 'Entertainment',
        productivity_score: -1,
        titles: [
            'Lo-Fi Beats for Coding & Focus — Spotify',
            'Deep Focus Instrumental Playlist — Spotify',
            'Syntax FM — Web Development Podcast — Spotify'
        ]
    },
    {
        executable_name: 'youtube.exe',
        display_name: 'YouTube',
        category: 'Entertainment',
        productivity_score: -2,
        titles: [
            'Building Cross-Platform Desktop Apps with Tauri 2.0 & Rust — YouTube',
            '24/7 Lo-Fi Hip Hop Radio — Beats to Relax/Study to — YouTube',
            'Tech News Weekly & Architecture Reviews — YouTube'
        ]
    },
    {
        executable_name: 'terminal.exe',
        display_name: 'Terminal',
        category: 'Development',
        productivity_score: 2,
        titles: [
            'bash — cargo check --workspace',
            'bash — npm run dev',
            'bash — git commit -m "feat: Add mock database seeder"'
        ]
    },
    {
        executable_name: 'discord.exe',
        display_name: 'Discord',
        category: 'Social',
        productivity_score: -2,
        titles: [
            'Rust Community — #help-beginners',
            'Tauri Developers — #announcements',
            'Gaming Lounge Voice Channel'
        ]
    },
    {
        executable_name: 'notion.exe',
        display_name: 'Notion',
        category: 'Productivity',
        productivity_score: 2,
        titles: [
            'Weekly Goals & Productivity Backlog — Notion',
            'System Architecture Roadmap 2026 — Notion',
            'Sprint 14 Tasks & Technical Specs — Notion'
        ]
    },
    {
        executable_name: 'zoom.exe',
        display_name: 'Zoom Meetings',
        category: 'Communication',
        productivity_score: 1,
        titles: [
            'Daily Engineering Sync Meeting',
            'Sprint Retrospective & Planning',
            'Architecture Design Review'
        ]
    },
    {
        executable_name: 'postman.exe',
        display_name: 'Postman',
        category: 'Development',
        productivity_score: 2,
        titles: [
            'GET /api/v1/wellbeing/stats — Postman',
            'POST /api/v1/auth/session — Postman'
        ]
    },
    {
        executable_name: 'steam.exe',
        display_name: 'Steam',
        category: 'Gaming',
        productivity_score: -2,
        titles: [
            'Counter-Strike 2',
            'Steam Library',
            'Steam Store & Community'
        ]
    }
];

function escapeSqlStr(str) {
    if (str === null || str === undefined) return 'NULL';
    return `'${String(str).replace(/'/g, "''")}'`;
}

function generateSeedData(daysToSeed = 90) {
    console.log(`Generating mock screen time data for the past ${daysToSeed} days...`);

    const sqlStatements = [];
    
    // Header & Pragmas
    sqlStatements.push(`-- Aura Wellbeing Mock Seed Data`);
    sqlStatements.push(`-- Generated on ${new Date().toISOString()}`);
    sqlStatements.push(`PRAGMA foreign_keys = ON;`);
    sqlStatements.push(`PRAGMA busy_timeout = 10000;`);
    sqlStatements.push(``);
    sqlStatements.push(`BEGIN TRANSACTION;`);
    sqlStatements.push(``);
    sqlStatements.push(`-- Clean up existing data`);
    sqlStatements.push(`DELETE FROM activities;`);
    sqlStatements.push(`DELETE FROM daily_summaries;`);
    sqlStatements.push(`DELETE FROM focus_sessions;`);
    sqlStatements.push(`DELETE FROM goals;`);
    sqlStatements.push(`DELETE FROM settings;`);
    sqlStatements.push(`DELETE FROM apps;`);
    sqlStatements.push(`DELETE FROM sqlite_sequence WHERE name IN ('apps', 'activities', 'focus_sessions', 'goals');`);
    sqlStatements.push(``);

    // Insert Apps
    sqlStatements.push(`-- Apps`);
    APPS.forEach((app, idx) => {
        const id = idx + 1;
        app.id = id;
        sqlStatements.push(
            `INSERT INTO apps (id, executable_name, display_name, category, is_ignored, productivity_score) ` +
            `VALUES (${id}, ${escapeSqlStr(app.executable_name)}, ${escapeSqlStr(app.display_name)}, ${escapeSqlStr(app.category)}, 0, ${app.productivity_score});`
        );
    });
    sqlStatements.push(``);

    // Insert Settings
    sqlStatements.push(`-- Settings`);
    sqlStatements.push(`INSERT INTO settings (key, value) VALUES ('autostart', 'true');`);
    sqlStatements.push(`INSERT INTO settings (key, value) VALUES ('idle_monitoring', 'true');`);
    sqlStatements.push(``);

    // Insert Goals
    sqlStatements.push(`-- Goals`);
    sqlStatements.push(`INSERT INTO goals (id, app_id, category, duration_limit_seconds, period, is_active) VALUES (1, NULL, 'Entertainment', 3600, 'daily', 1);`);
    sqlStatements.push(`INSERT INTO goals (id, app_id, category, duration_limit_seconds, period, is_active) VALUES (2, NULL, 'Development', 18000, 'daily', 1);`);
    sqlStatements.push(`INSERT INTO goals (id, app_id, category, duration_limit_seconds, period, is_active) VALUES (3, 12, NULL, 2700, 'daily', 1);`);
    sqlStatements.push(`INSERT INTO goals (id, app_id, category, duration_limit_seconds, period, is_active) VALUES (4, NULL, 'Social', 1800, 'daily', 1);`);
    sqlStatements.push(``);

    const now = new Date();
    let activityIdCounter = 1;
    let focusSessionIdCounter = 1;

    sqlStatements.push(`-- Activities & Daily Summaries`);

    // Iterate through past N days up to today
    for (let dayOffset = daysToSeed - 1; dayOffset >= 0; dayOffset--) {
        const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
        const dateStr = formatDateOnly(currentDate);
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

        let totalScreenTime = 0;
        let totalProductiveTime = 0;
        let totalDistractingTime = 0;
        let totalIdleTime = isWeekend ? Math.floor(Math.random() * 3600) + 1800 : Math.floor(Math.random() * 2400) + 600;

        let currentHour = 8;
        let currentMin = Math.floor(Math.random() * 30);

        while (currentHour < 22) {
            let candidateApps = [];
            if (isWeekend) {
                if (currentHour < 12) {
                    candidateApps = APPS.filter(a => ['Browsing', 'Productivity', 'Entertainment'].includes(a.category));
                } else if (currentHour < 18) {
                    candidateApps = APPS.filter(a => ['Gaming', 'Entertainment', 'Browsing', 'Development'].includes(a.category));
                } else {
                    candidateApps = APPS.filter(a => ['Gaming', 'Entertainment', 'Social', 'Browsing'].includes(a.category));
                }
            } else {
                if (currentHour >= 9 && currentHour < 12) {
                    candidateApps = APPS.filter(a => ['Development', 'Communication', 'Productivity', 'Design'].includes(a.category));
                } else if (currentHour >= 12 && currentHour < 13) {
                    candidateApps = APPS.filter(a => ['Browsing', 'Entertainment', 'Communication'].includes(a.category));
                } else if (currentHour >= 13 && currentHour < 18) {
                    candidateApps = APPS.filter(a => ['Development', 'Design', 'Communication', 'Productivity'].includes(a.category));
                } else {
                    candidateApps = APPS.filter(a => ['Browsing', 'Entertainment', 'Social', 'Gaming', 'Development'].includes(a.category));
                }
            }

            if (candidateApps.length === 0) candidateApps = APPS;

            const selectedApp = candidateApps[Math.floor(Math.random() * candidateApps.length)];
            const title = selectedApp.titles[Math.floor(Math.random() * selectedApp.titles.length)];

            const durationSeconds = Math.floor(Math.random() * 2400) + 300;

            const startTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, currentMin, 0);
            const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

            if (endTime.getHours() >= 23 && endTime.getDate() !== currentDate.getDate()) {
                break;
            }

            const startTimeISO = toISOStringLocal(startTime);
            const endTimeISO = toISOStringLocal(endTime);

            sqlStatements.push(
                `INSERT INTO activities (id, app_id, window_title, start_time, end_time, duration_seconds) ` +
                `VALUES (${activityIdCounter++}, ${selectedApp.id}, ${escapeSqlStr(title)}, ${escapeSqlStr(startTimeISO)}, ${escapeSqlStr(endTimeISO)}, ${durationSeconds});`
            );

            totalScreenTime += durationSeconds;
            if (selectedApp.productivity_score > 0) {
                totalProductiveTime += durationSeconds;
            } else if (selectedApp.productivity_score < 0) {
                totalDistractingTime += durationSeconds;
            }

            const gapSeconds = Math.floor(Math.random() * 780) + 120;
            const nextTime = new Date(endTime.getTime() + gapSeconds * 1000);
            currentHour = nextTime.getHours();
            currentMin = nextTime.getMinutes();
        }

        sqlStatements.push(
            `INSERT INTO daily_summaries (date, total_screen_time, total_productive_time, total_distracting_time, total_idle_time) ` +
            `VALUES (${escapeSqlStr(dateStr)}, ${totalScreenTime}, ${totalProductiveTime}, ${totalDistractingTime}, ${totalIdleTime});`
        );

        if (!isWeekend && dayOffset < 30 && Math.random() > 0.4) {
            const fsStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 10, 0, 0);
            const targetSecs = Math.random() > 0.5 ? 1500 : 3000;
            const completed = Math.random() > 0.2 ? 1 : 0;
            const actualSecs = completed ? targetSecs : Math.floor(targetSecs * (0.3 + Math.random() * 0.5));
            const fsEnd = new Date(fsStart.getTime() + actualSecs * 1000);

            sqlStatements.push(
                `INSERT INTO focus_sessions (id, start_time, end_time, target_duration_seconds, actual_duration_seconds, completed) ` +
                `VALUES (${focusSessionIdCounter++}, ${escapeSqlStr(toISOStringLocal(fsStart))}, ${escapeSqlStr(toISOStringLocal(fsEnd))}, ${targetSecs}, ${actualSecs}, ${completed});`
            );
        }
    }

    sqlStatements.push(``);
    sqlStatements.push(`COMMIT;`);
    sqlStatements.push(``);
    sqlStatements.push(`-- Seeding finished successfully`);
    return sqlStatements.join('\n');
}

function getDefaultDbPath() {
    const home = os.homedir();
    const platform = os.platform();

    if (platform === 'linux') {
        const primary = path.join(home, '.local', 'share', 'com.aura.wellbeing', 'wellbeing.db');
        if (fs.existsSync(primary)) return primary;
        const fallback = path.join(home, '.local', 'share', 'aura-wellbeing', 'wellbeing.db');
        if (fs.existsSync(fallback)) return fallback;
        return primary;
    } else if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'com.aura.wellbeing', 'wellbeing.db');
    } else if (platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
        return path.join(localAppData, 'com.aura.wellbeing', 'wellbeing.db');
    }
    return path.join(home, '.local', 'share', 'com.aura.wellbeing', 'wellbeing.db');
}

function main() {
    const args = process.argv.slice(2);
    let days = 90;
    let targetDbPath = null;
    let generateSqlFileOnly = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--days' && args[i + 1]) {
            days = parseInt(args[i + 1], 10) || 90;
            i++;
        } else if (args[i] === '--db' && args[i + 1]) {
            targetDbPath = args[i + 1];
            i++;
        } else if (args[i] === '--sql-only') {
            generateSqlFileOnly = true;
        }
    }

    if (!targetDbPath) {
        targetDbPath = getDefaultDbPath();
    }

    const sqlContent = generateSeedData(days);

    const sqlFilePath = path.join(__dirname, 'seed.sql');
    fs.writeFileSync(sqlFilePath, sqlContent, 'utf-8');
    console.log(`Saved SQL seed statements to: ${sqlFilePath}`);

    if (generateSqlFileOnly) {
        console.log('Skipping direct DB seed (--sql-only flag passed).');
        return;
    }

    console.log(`Targeting SQLite Database at: ${targetDbPath}`);

    const dbDir = path.dirname(targetDbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    try {
        console.log('Executing seed SQL script into database using sqlite3 CLI...');
        execSync(`sqlite3 "${targetDbPath}" < "${sqlFilePath}"`, { stdio: 'inherit' });
        console.log('Successfully seeded database with mock usage and screen time data!');
    } catch (err) {
        console.error('Failed to execute sqlite3 command automatically:', err.message);
        console.log(`\nYou can manually run:\n  sqlite3 "${targetDbPath}" < "${sqlFilePath}"`);
    }
}

main();
