'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import './globals.css';
import FileImport from '@/components/FileImport';
import FilterBar from '@/components/FilterBar';
import SummaryCards from '@/components/SummaryCards';
import Charts from '@/components/Charts';
import BillableSplit from '@/components/BillableSplit';
import Heatmap from '@/components/Heatmap';
import EntriesTable from '@/components/EntriesTable';
import { filterRecords, getAllTags, excludeTagsFromRecords, minutesToDecimalHours, formatMinutes } from '@/lib/klogParser';

import pkg from '../../package.json';

const STORAGE_KEY = 'klog-dashboard-records';
const THEME_KEY = 'klog-dashboard-theme';
const EXCLUDE_KEY = 'klog-dashboard-excluded-tags';
const BILLABLE_KEY = 'klog-dashboard-billable-tags';
const BILLABLE_TARGET_KEY = 'klog-dashboard-billable-target';
// Snapshots of the last env-provided value applied, so a changed docker/env
// variable overrides a stale localStorage value while user edits still persist.
const EXCLUDE_ENV_KEY = 'klog-dashboard-excluded-tags-env';
const BILLABLE_ENV_KEY = 'klog-dashboard-billable-tags-env';
const BILLABLE_TARGET_ENV_KEY = 'klog-dashboard-billable-target-env';

export default function Home() {
    const [records, setRecords] = useState([]);
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        tags: [],
        search: '',
    });
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [config, setConfig] = useState(null);
    const [theme, setTheme] = useState('dark');
    const [excludedTags, setExcludedTags] = useState([]);
    const [excludeLoaded, setExcludeLoaded] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [excludeInput, setExcludeInput] = useState('');
    const [billableTags, setBillableTags] = useState([]);
    const [billableLoaded, setBillableLoaded] = useState(false);
    const [billableInput, setBillableInput] = useState('');
    const [billableTarget, setBillableTarget] = useState(0);
    const [billableTargetLoaded, setBillableTargetLoaded] = useState(false);

    // Load persisted theme and apply it to the document root
    useEffect(() => {
        let saved = null;
        try {
            saved = localStorage.getItem(THEME_KEY);
        } catch (e) {
            // ignore
        }
        const initial = saved === 'light' || saved === 'dark' ? saved : 'dark';
        setTheme(initial);
        document.documentElement.setAttribute('data-theme', initial);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try {
                localStorage.setItem(THEME_KEY, next);
            } catch (e) {
                // ignore
            }
            return next;
        });
    }, []);

    // Load persisted excluded tags on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(EXCLUDE_KEY);
            if (raw !== null) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setExcludedTags(parsed);
            }
        } catch (e) {
            // ignore
        }
        setExcludeLoaded(true);
    }, []);

    // Load persisted billable tags on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(BILLABLE_KEY);
            if (raw !== null) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setBillableTags(parsed);
            }
        } catch (e) {
            // ignore
        }
        setBillableLoaded(true);
    }, []);

    // Apply the env default (KLOG_EXCLUDED_TAGS) whenever it changes, overriding
    // any stale localStorage value. A snapshot of the last applied env value is
    // kept so the user's own edits persist between env changes.
    useEffect(() => {
        if (!excludeLoaded || !config) return;
        const envTags = Array.isArray(config.excludedTags) ? config.excludedTags : [];
        const envSnap = JSON.stringify(envTags);
        let storedSnap = null;
        try {
            storedSnap = localStorage.getItem(EXCLUDE_ENV_KEY);
        } catch (e) {
            // ignore
        }
        if (storedSnap !== envSnap) {
            setExcludedTags(envTags);
            try {
                localStorage.setItem(EXCLUDE_KEY, envSnap);
                localStorage.setItem(EXCLUDE_ENV_KEY, envSnap);
            } catch (e) {
                // ignore
            }
        }
    }, [config, excludeLoaded]);

    const persistExcluded = useCallback((next) => {
        try {
            localStorage.setItem(EXCLUDE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore
        }
    }, []);

    const addExcludedTag = useCallback((raw) => {
        const name = String(raw || '').trim().replace(/^#/, '').toLowerCase();
        if (!name) return;
        setExcludedTags(prev => {
            if (prev.includes(name)) return prev;
            const next = [...prev, name];
            persistExcluded(next);
            return next;
        });
        setExcludeInput('');
    }, [persistExcluded]);

    const removeExcludedTag = useCallback((name) => {
        setExcludedTags(prev => {
            const next = prev.filter(t => t !== name);
            persistExcluded(next);
            return next;
        });
    }, [persistExcluded]);

    // Apply the env default (KLOG_BILLABLE_TAGS) whenever it changes, overriding
    // any stale localStorage value; user edits persist between env changes.
    useEffect(() => {
        if (!billableLoaded || !config) return;
        const envTags = Array.isArray(config.billableTags) ? config.billableTags : [];
        const envSnap = JSON.stringify(envTags);
        let storedSnap = null;
        try {
            storedSnap = localStorage.getItem(BILLABLE_ENV_KEY);
        } catch (e) {
            // ignore
        }
        if (storedSnap !== envSnap) {
            setBillableTags(envTags);
            try {
                localStorage.setItem(BILLABLE_KEY, envSnap);
                localStorage.setItem(BILLABLE_ENV_KEY, envSnap);
            } catch (e) {
                // ignore
            }
        }
    }, [config, billableLoaded]);

    const persistBillable = useCallback((next) => {
        try {
            localStorage.setItem(BILLABLE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore
        }
    }, []);

    const addBillableTag = useCallback((raw) => {
        const name = String(raw || '').trim().replace(/^#/, '').toLowerCase();
        if (!name) return;
        setBillableTags(prev => {
            if (prev.includes(name)) return prev;
            const next = [...prev, name];
            persistBillable(next);
            return next;
        });
        setBillableInput('');
    }, [persistBillable]);

    const removeBillableTag = useCallback((name) => {
        setBillableTags(prev => {
            const next = prev.filter(t => t !== name);
            persistBillable(next);
            return next;
        });
    }, [persistBillable]);

    // Load persisted billable target on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(BILLABLE_TARGET_KEY);
            if (raw !== null) {
                const parsed = parseFloat(raw);
                if (!isNaN(parsed)) setBillableTarget(Math.min(Math.max(parsed, 0), 100));
            }
        } catch (e) {
            // ignore
        }
        setBillableTargetLoaded(true);
    }, []);

    // Seed billable target from env-provided config default only if the user never set their own
    useEffect(() => {
        if (!billableTargetLoaded || !config) return;
        const envVal = Math.min(Math.max(Number(config.billableTargetPercent) || 0, 0), 100);
        const envSnap = String(envVal);
        let storedSnap = null;
        try {
            storedSnap = localStorage.getItem(BILLABLE_TARGET_ENV_KEY);
        } catch (e) {
            // ignore
        }
        if (storedSnap !== envSnap) {
            setBillableTarget(envVal);
            try {
                localStorage.setItem(BILLABLE_TARGET_KEY, envSnap);
                localStorage.setItem(BILLABLE_TARGET_ENV_KEY, envSnap);
            } catch (e) {
                // ignore
            }
        }
    }, [config, billableTargetLoaded]);

    const updateBillableTarget = useCallback((raw) => {
        const num = parseFloat(raw);
        const val = isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
        setBillableTarget(val);
        try {
            localStorage.setItem(BILLABLE_TARGET_KEY, String(val));
        } catch (e) {
            // ignore
        }
    }, []);

    // Fetch config on mount
    useEffect(() => {
        fetch('/api/config')
            .then(res => res.json())
            .then(data => setConfig(data))
            .catch(err => console.error('Failed to load config:', err));
    }, []);

    // Load from localStorage on mount + set default date filter to current month
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setRecords(parsed);
                }
            }
        } catch (e) {
            // ignore
        }

        // Default to current month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setFilters((prev) => ({ ...prev, dateFrom: fmt(monthStart), dateTo: fmt(monthEnd) }));
    }, []);

    // Persist to localStorage
    useEffect(() => {
        if (records.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
            } catch (e) {
                // ignore quota errors
            }
        }
    }, [records]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
                e.preventDefault();
                document.querySelector('input[type="file"]')?.click();
            }
            if (e.key === 'Escape') {
                setFilters({ dateFrom: '', dateTo: '', tags: [], search: '' });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleImport = useCallback((newRecords, opts = {}) => {
        setRecords((prev) => {
            let next = [...prev];

            // If specific files are being updated, remove their old records first
            if (opts.replaceFiles && opts.replaceFiles.length > 0) {
                const filesToRemove = new Set(opts.replaceFiles);
                next = next.filter(r => !filesToRemove.has(r.fileName));
            }

            // Merge and deduplicate by date + summary + filename
            const existingKeys = new Set(next.map(r => `${r.date}|${r.summary}|${r.fileName}`));
            const unique = newRecords.filter(r => !existingKeys.has(`${r.date}|${r.summary}|${r.fileName}`));
            const merged = [...next, ...unique].sort((a, b) => a.date.localeCompare(b.date));
            return merged;
        });
    }, []);

    const handleClear = useCallback(() => {
        setRecords([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Excluded tags are removed from every calculation and view; persists across sessions
    const activeRecords = useMemo(
        () => excludeTagsFromRecords(records, excludedTags),
        [records, excludedTags],
    );
    const allTags = useMemo(() => getAllTags(activeRecords), [activeRecords]);
    const filteredRecords = useMemo(() => filterRecords(activeRecords, filters), [activeRecords, filters]);

    const handleTagClick = useCallback((tag) => {
        const tagName = typeof tag === 'object' ? tag.full : tag;
        setFilters(prev => {
            const current = prev.tags || [];
            if (current.includes(tagName)) return prev;
            return { ...prev, tags: [...current, tagName] };
        });
    }, []);

    const handleExportCSV = useCallback(() => {
        const headers = ['Date', 'Type', 'Duration (min)', 'Duration', 'Hours', 'Summary', 'Tags', 'File'];
        const rows = [];
        for (const r of filteredRecords) {
            for (const e of r.entries) {
                const tags = (e.allTags || e.tags).map(t => '#' + (typeof t === 'string' ? t : t.full)).join(', ');
                rows.push([
                    r.date,
                    e.type,
                    e.minutes,
                    formatMinutes(e.minutes),
                    minutesToDecimalHours(e.minutes).toFixed(2),
                    `"${(e.summary || '').replace(/"/g, '""')}"`,
                    `"${tags}"`,
                    `"${r.fileName || ''}"`,
                ].join(','));
            }
        }
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `klog-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    }, [filteredRecords]);

    const handleExportJSON = useCallback(() => {
        const json = JSON.stringify(filteredRecords, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `klog-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    }, [filteredRecords]);

    const hasData = records.length > 0;

    return (
        <main className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="app-logo">
                    <div className="app-logo-icon">⏰</div>
                    <div>
                        <h1>klog Dashboard</h1>
                        <span>Visual Time Tracking Analytics</span>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowSettings(true)}
                        title="Settings"
                        aria-label="Open settings"
                    >
                        ⚙️ Settings{excludedTags.length ? ` (${excludedTags.length})` : ''}
                    </button>
                    {hasData && (
                        <>
                            <div className="export-dropdown">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                >
                                    📥 Export
                                </button>
                                {showExportMenu && (
                                    <div className="export-menu">
                                        <button className="export-option" onClick={handleExportCSV}>
                                            📊 Export as CSV
                                        </button>
                                        <button className="export-option" onClick={handleExportJSON}>
                                            📋 Export as JSON
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button className="btn btn-danger btn-sm" onClick={handleClear}>
                                🗑️ Clear Data
                            </button>
                        </>
                    )}
                    <span className="kbd" title="Import files">⌘O</span>
                    <span className="kbd" title="Clear filters">Esc</span>
                </div>
            </header>

            {/* File Import */}
            <FileImport onImport={handleImport} hasData={hasData} />

            {/* Dashboard Content */}
            {hasData ? (
                <div style={{ marginTop: '24px' }}>
                    {/* Filters */}
                    <FilterBar
                        filters={filters}
                        onFilterChange={setFilters}
                        allTags={allTags}
                    />

                    {/* Summary Stats */}
                    <SummaryCards records={filteredRecords} config={config} billableTags={billableTags} />

                    {/* Billable vs Non-billable split */}
                    <BillableSplit records={filteredRecords} billableTags={billableTags} billableTarget={billableTarget} />

                    {/* Charts */}
                    <Charts records={filteredRecords} config={config} billableTags={billableTags} />

                    {/* Heatmap */}
                    <Heatmap records={filteredRecords} billableTags={billableTags} />

                    {/* Entries Table */}
                    <EntriesTable records={filteredRecords} onTagClick={handleTagClick} />
                </div>
            ) : (
                <div className="empty-state">
                    <span className="empty-state-icon">📊</span>
                    <h2>Welcome to klog Dashboard</h2>
                    <p>
                        Import your klog time tracking files to visualize your bookings
                        with interactive charts, filters, and detailed breakdowns.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <span className="kbd">⌘O to import</span>
                        <span className="kbd">.klg files</span>
                        <span className="kbd">drag & drop</span>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer style={{
                textAlign: 'center',
                padding: '32px 0 16px',
                color: 'var(--text-muted)',
                fontSize: '12px',
                borderTop: '1px solid var(--border-color)',
                marginTop: '48px',
            }}>
                klog Dashboard • v{pkg.version} • Built for{' '}
                <a href="https://github.com/jotaen/klog" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                    klog
                </a>
                {' '}time tracking format • <a href="https://github.com/muecahit94/klog-dashboard" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
                    GitHub
                </a>
            </footer>

            {/* Settings Modal */}
            {showSettings && (
                <div
                    onClick={() => setShowSettings(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(0, 0, 0, 0.55)',
                        backdropFilter: 'blur(2px)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        padding: '80px 16px 16px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '460px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            padding: '20px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                            <h2 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>⚙️ Settings</h2>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowSettings(false)}
                                aria-label="Close settings"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Appearance */}
                        <section style={{ marginBottom: '22px' }}>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Appearance
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Theme</span>
                                <button className="btn btn-secondary btn-sm" onClick={toggleTheme}>
                                    {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                                </button>
                            </div>
                        </section>

                        {/* Excluded tags */}
                        <section>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Excluded Tags
                            </h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                                Removed from all charts, tables, and balance calculations
                                (e.g. vacation, sickleave, holiday). Saved automatically.
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                <input
                                    className="filter-input"
                                    placeholder="e.g. vacation, sickleave, holiday"
                                    value={excludeInput}
                                    onChange={(e) => setExcludeInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addExcludedTag(excludeInput);
                                        }
                                    }}
                                    style={{ flex: 1, minWidth: 0 }}
                                />
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => addExcludedTag(excludeInput)}
                                >
                                    Add
                                </button>
                            </div>
                            <div className="filter-chips" style={{ marginBottom: 0 }}>
                                {excludedTags.length === 0 ? (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        No excluded tags
                                    </span>
                                ) : (
                                    excludedTags.map(tag => (
                                        <span key={tag} className="filter-chip">
                                            #{tag}
                                            <button onClick={() => removeExcludedTag(tag)}>×</button>
                                        </span>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Billable tags */}
                        <section style={{ marginTop: '22px' }}>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Billable Tags
                            </h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                                Time tagged with any of these counts as billable in the
                                Billable vs Non-billable split (e.g. billable, client). Saved automatically.
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                <input
                                    className="filter-input"
                                    placeholder="e.g. billable, client"
                                    value={billableInput}
                                    onChange={(e) => setBillableInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addBillableTag(billableInput);
                                        }
                                    }}
                                    style={{ flex: 1, minWidth: 0 }}
                                />
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => addBillableTag(billableInput)}
                                >
                                    Add
                                </button>
                            </div>
                            <div className="filter-chips" style={{ marginBottom: 0 }}>
                                {billableTags.length === 0 ? (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        No billable tags
                                    </span>
                                ) : (
                                    billableTags.map(tag => (
                                        <span key={tag} className="filter-chip">
                                            #{tag}
                                            <button onClick={() => removeBillableTag(tag)}>×</button>
                                        </span>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Billable goal */}
                        <section style={{ marginTop: '22px' }}>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Billable Goal
                            </h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                                Target billable percentage. Shown as a marker on the split bar
                                with over/under status. Set to 0 to disable. Saved automatically.
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    className="filter-input"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    placeholder="0"
                                    value={billableTarget || ''}
                                    onChange={(e) => updateBillableTarget(e.target.value)}
                                    style={{ width: '110px' }}
                                />
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>% billable</span>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </main>
    );
}
