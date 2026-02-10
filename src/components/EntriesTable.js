'use client';

import { useState, useMemo } from 'react';
import { formatMinutes } from '@/lib/klogParser';

const PAGE_SIZE = 20;

export default function EntriesTable({ records, onTagClick }) {
    const [sortField, setSortField] = useState('date');
    const [sortDir, setSortDir] = useState('desc');
    const [page, setPage] = useState(0);

    // Flatten records into entry rows
    const flatEntries = useMemo(() => {
        const entries = [];
        for (const r of records) {
            for (const e of r.entries) {
                entries.push({
                    date: r.date,
                    type: e.type,
                    duration: e.minutes,
                    durationFormatted: formatMinutes(e.minutes),
                    summary: e.summary,
                    tags: e.allTags || e.tags,
                    raw: e.raw,
                    fileName: r.fileName,
                    recordSummary: r.summary,
                });
            }
        }
        return entries;
    }, [records]);

    // Sort
    const sortedEntries = useMemo(() => {
        const sorted = [...flatEntries];
        sorted.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'date':
                    cmp = a.date.localeCompare(b.date);
                    break;
                case 'duration':
                    cmp = a.duration - b.duration;
                    break;
                case 'summary':
                    cmp = (a.summary || '').localeCompare(b.summary || '');
                    break;
                case 'type':
                    cmp = a.type.localeCompare(b.type);
                    break;
                default:
                    cmp = 0;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return sorted;
    }, [flatEntries, sortField, sortDir]);

    const totalPages = Math.ceil(sortedEntries.length / PAGE_SIZE);
    const pageEntries = sortedEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
        setPage(0);
    };

    const getSortIndicator = (field) => {
        if (sortField !== field) return '';
        return sortDir === 'asc' ? ' ↑' : ' ↓';
    };

    if (flatEntries.length === 0) return null;

    return (
        <div className="entries-section animate-slide-up">
            <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px 0' }}>
                    <h3 className="chart-title">All Entries ({flatEntries.length})</h3>
                </div>
                <div className="entries-table-wrap" style={{ marginTop: '16px' }}>
                    <table className="entries-table">
                        <thead>
                            <tr>
                                <th
                                    className={sortField === 'date' ? 'sorted' : ''}
                                    onClick={() => handleSort('date')}
                                >
                                    Date{getSortIndicator('date')}
                                </th>
                                <th
                                    className={sortField === 'type' ? 'sorted' : ''}
                                    onClick={() => handleSort('type')}
                                >
                                    Type{getSortIndicator('type')}
                                </th>
                                <th
                                    className={sortField === 'duration' ? 'sorted' : ''}
                                    onClick={() => handleSort('duration')}
                                >
                                    Duration{getSortIndicator('duration')}
                                </th>
                                <th
                                    className={sortField === 'summary' ? 'sorted' : ''}
                                    onClick={() => handleSort('summary')}
                                >
                                    Summary{getSortIndicator('summary')}
                                </th>
                                <th>Tags</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageEntries.map((entry, i) => (
                                <tr key={`${entry.date}-${i}`}>
                                    <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                        {entry.date}
                                    </td>
                                    <td>
                                        <span style={{
                                            fontSize: '11px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: entry.type === 'range' ? 'rgba(6, 182, 212, 0.1)' :
                                                entry.type === 'duration' ? 'rgba(99, 102, 241, 0.1)' :
                                                    'rgba(245, 158, 11, 0.1)',
                                            color: entry.type === 'range' ? '#06b6d4' :
                                                entry.type === 'duration' ? '#6366f1' : '#f59e0b',
                                        }}>
                                            {entry.type}
                                        </span>
                                    </td>
                                    <td className={entry.duration >= 0 ? 'duration-positive' : 'duration-negative'}>
                                        {entry.durationFormatted}
                                    </td>
                                    <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {entry.summary || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td>
                                        {entry.tags.map(t => (
                                            <span
                                                key={typeof t === 'string' ? t : t.full}
                                                className="tag-badge"
                                                onClick={() => onTagClick?.(typeof t === 'string' ? t : t.full)}
                                            >
                                                #{typeof t === 'string' ? t : t.full}
                                            </span>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="pagination">
                        <span>
                            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedEntries.length)} of {sortedEntries.length}
                        </span>
                        <div className="pagination-buttons">
                            <button
                                className="btn btn-ghost btn-sm"
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                            >
                                ← Prev
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
