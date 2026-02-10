'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import './globals.css';
import FileImport from '@/components/FileImport';
import FilterBar from '@/components/FilterBar';
import SummaryCards from '@/components/SummaryCards';
import Charts from '@/components/Charts';
import Heatmap from '@/components/Heatmap';
import EntriesTable from '@/components/EntriesTable';
import { filterRecords, getAllTags, minutesToDecimalHours, formatMinutes } from '@/lib/klogParser';

const STORAGE_KEY = 'klog-dashboard-records';

export default function Home() {
    const [records, setRecords] = useState([]);
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        tags: [],
        search: '',
    });
    const [showExportMenu, setShowExportMenu] = useState(false);

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

    const allTags = useMemo(() => getAllTags(records), [records]);
    const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);

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
                    <SummaryCards records={filteredRecords} />

                    {/* Charts */}
                    <Charts records={filteredRecords} />

                    {/* Heatmap */}
                    <Heatmap records={filteredRecords} />

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
                klog Dashboard • Built for{' '}
                <a href="https://github.com/jotaen/klog" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                    klog
                </a>
                {' '}time tracking format
            </footer>
        </main>
    );
}
