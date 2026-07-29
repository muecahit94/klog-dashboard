'use client';

import { useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { minutesToDecimalHours } from '@/lib/klogParser';

export default function Heatmap({ records, billableTags = [] }) {
    const [tooltip, setTooltip] = useState(null);
    const [mode, setMode] = useState('activity');

    const handleMouseMove = useCallback((e, day) => {
        setTooltip({
            x: e.clientX,
            y: e.clientY,
            date: day.date,
            hours: day.hours,
            minutes: day.minutes,
            billableHours: day.billableHours,
            billablePct: day.billablePct,
        });
    }, []);

    const handleMouseLeave = useCallback(() => {
        setTooltip(null);
    }, []);

    const heatmapData = useMemo(() => {
        if (records.length === 0) return { weeks: [], monthLabels: [] };

        const billable = new Set(
            (billableTags || []).map(t => String(t).replace(/^#/, '').toLowerCase()).filter(Boolean)
        );
        const isBillable = (tags) => (tags || []).some(t => {
            const name = typeof t === 'string' ? t : t.name;
            return billable.has(String(name || '').toLowerCase());
        });

        // Get date range
        const dates = records.map(r => r.date).sort();
        const minDate = new Date(dates[0]);
        const maxDate = new Date(dates[dates.length - 1]);

        // Extend to full weeks
        const startDate = new Date(minDate);
        startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7)); // Monday

        const endDate = new Date(maxDate);
        endDate.setDate(endDate.getDate() + (7 - ((endDate.getDay() + 6) % 7)) % 7); // Sunday

        // Build daily totals: total minutes + billable minutes (entries-based)
        const dayMap = {};
        for (const r of records) {
            const day = dayMap[r.date] || (dayMap[r.date] = { total: 0, billable: 0 });
            for (const e of r.entries) {
                day.total += e.minutes || 0;
                const tags = (e.allTags && e.allTags.length)
                    ? e.allTags
                    : [...(e.tags || []), ...(r.tags || [])];
                if (isBillable(tags)) day.billable += e.minutes || 0;
            }
        }

        // Max total for activity-level calculation
        const maxMinutes = Math.max(...Object.values(dayMap).map(d => d.total), 1);

        // Level: activity mode uses total vs max; billable mode uses billable ratio
        const levelFor = (day) => {
            if (day.total <= 0) return 0;
            if (mode === 'billable') {
                const ratio = day.billable / day.total;
                if (ratio <= 0) return 0;
                if (ratio <= 0.25) return 1;
                if (ratio <= 0.5) return 2;
                if (ratio <= 0.75) return 3;
                return 4;
            }
            const ratio = day.total / maxMinutes;
            if (ratio <= 0.25) return 1;
            if (ratio <= 0.5) return 2;
            if (ratio <= 0.75) return 3;
            return 4;
        };

        // Generate weeks
        const weeks = [];
        const monthLabels = [];
        let currentDate = new Date(startDate);
        let lastMonth = -1;

        while (currentDate <= endDate) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const dateStr = currentDate.toISOString().slice(0, 10);
                const rec = dayMap[dateStr] || { total: 0, billable: 0 };
                const minutes = rec.total;
                const hours = minutesToDecimalHours(minutes);
                const billableHours = minutesToDecimalHours(rec.billable);
                const billablePct = minutes > 0 ? (rec.billable / minutes) * 100 : 0;
                const level = levelFor(rec);

                week.push({ date: dateStr, minutes, hours, billableHours, billablePct, level });

                // Track month labels
                const month = currentDate.getMonth();
                if (month !== lastMonth && d === 0) {
                    monthLabels.push({
                        label: currentDate.toLocaleDateString('en', { month: 'short' }),
                        weekIndex: weeks.length,
                    });
                    lastMonth = month;
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }
            weeks.push(week);
        }

        return { weeks, monthLabels };
    }, [records, mode, billableTags]);

    if (records.length === 0) return null;

    const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', ''];

    return (
        <div className="chart-card full-width animate-slide-up">
            <div className="chart-header">
                <h3 className="chart-title">Activity Heatmap</h3>
                {billableTags.length > 0 && (
                    <div className="chart-toggle">
                        <button
                            className={mode === 'activity' ? 'active' : ''}
                            onClick={() => setMode('activity')}
                        >
                            Hours
                        </button>
                        <button
                            className={mode === 'billable' ? 'active' : ''}
                            onClick={() => setMode('billable')}
                        >
                            Billable %
                        </button>
                    </div>
                )}
            </div>

            <div className="heatmap-container">
                {/* Month labels */}
                <div className="heatmap-months" style={{ marginLeft: '30px' }}>
                    {heatmapData.weeks.map((_, weekIdx) => {
                        const monthLabel = heatmapData.monthLabels.find(m => m.weekIndex === weekIdx);
                        return (
                            <span key={weekIdx} className="heatmap-month-label" style={{ width: '17px' }}>
                                {monthLabel ? monthLabel.label : ''}
                            </span>
                        );
                    })}
                </div>

                <div style={{ display: 'flex' }}>
                    {/* Day labels */}
                    <div className="heatmap-day-labels">
                        {dayLabels.map((label, i) => (
                            <span key={i} className="heatmap-day-label">{label}</span>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="heatmap-grid">
                        {heatmapData.weeks.map((week, weekIdx) => (
                            <div key={weekIdx} className="heatmap-column">
                                {week.map((day) => (
                                    <div
                                        key={day.date}
                                        className={`heatmap-cell level-${day.level}`}
                                        onMouseMove={(e) => handleMouseMove(e, day)}
                                        onMouseLeave={handleMouseLeave}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="heatmap-legend">
                    <span>{mode === 'billable' ? '0%' : 'Less'}</span>
                    {[0, 1, 2, 3, 4].map(level => (
                        <div key={level} className={`heatmap-cell level-${level}`} style={{ cursor: 'default' }} />
                    ))}
                    <span>{mode === 'billable' ? '100%' : 'More'}</span>
                </div>
            </div>

            {/* Tooltip via portal to escape backdrop-filter stacking context */}
            {tooltip && typeof document !== 'undefined' && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: tooltip.x + 12,
                        top: tooltip.y - 36,
                        background: '#1a1d2e',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '16px',
                        color: '#f0f1f5',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        zIndex: 9999,
                    }}
                >
                    <strong>{tooltip.date}</strong>: {tooltip.hours.toFixed(2)}h
                    {mode === 'billable' && tooltip.minutes > 0 && (
                        <> · {tooltip.billablePct.toFixed(0)}% billable ({tooltip.billableHours.toFixed(2)}h)</>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
