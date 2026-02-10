'use client';

import { useMemo, useState } from 'react';
import { minutesToDecimalHours } from '@/lib/klogParser';

export default function Heatmap({ records }) {
    const [hoveredCell, setHoveredCell] = useState(null);

    const heatmapData = useMemo(() => {
        if (records.length === 0) return { weeks: [], monthLabels: [] };

        // Get date range
        const dates = records.map(r => r.date).sort();
        const minDate = new Date(dates[0]);
        const maxDate = new Date(dates[dates.length - 1]);

        // Extend to full weeks
        const startDate = new Date(minDate);
        startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7)); // Monday

        const endDate = new Date(maxDate);
        endDate.setDate(endDate.getDate() + (7 - ((endDate.getDay() + 6) % 7)) % 7); // Sunday

        // Build daily hours map (calculate from entries for filtered accuracy)
        const dayMap = {};
        for (const r of records) {
            if (!dayMap[r.date]) dayMap[r.date] = 0;
            dayMap[r.date] += r.entries.reduce((sum, e) => sum + (e.minutes || 0), 0);
        }

        // Find max for level calculation
        const maxMinutes = Math.max(...Object.values(dayMap), 1);

        // Generate weeks
        const weeks = [];
        const monthLabels = [];
        let currentDate = new Date(startDate);
        let lastMonth = -1;

        while (currentDate <= endDate) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const dateStr = currentDate.toISOString().slice(0, 10);
                const minutes = dayMap[dateStr] || 0;
                const hours = minutesToDecimalHours(minutes);

                let level = 0;
                if (minutes > 0) {
                    const ratio = minutes / maxMinutes;
                    if (ratio <= 0.25) level = 1;
                    else if (ratio <= 0.5) level = 2;
                    else if (ratio <= 0.75) level = 3;
                    else level = 4;
                }

                week.push({ date: dateStr, minutes, hours, level });

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
    }, [records]);

    if (records.length === 0) return null;

    const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', ''];

    return (
        <div className="chart-card full-width animate-slide-up">
            <div className="chart-header">
                <h3 className="chart-title">Activity Heatmap</h3>
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
                                {week.map((day, dayIdx) => (
                                    <div
                                        key={day.date}
                                        className={`heatmap-cell level-${day.level}`}
                                        onMouseEnter={() => setHoveredCell(`${weekIdx}-${dayIdx}`)}
                                        onMouseLeave={() => setHoveredCell(null)}
                                    >
                                        {hoveredCell === `${weekIdx}-${dayIdx}` && (
                                            <div className="heatmap-tooltip">
                                                <strong>{day.date}</strong>: {day.hours.toFixed(1)}h
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="heatmap-legend">
                    <span>Less</span>
                    {[0, 1, 2, 3, 4].map(level => (
                        <div key={level} className={`heatmap-cell level-${level}`} style={{ cursor: 'default' }} />
                    ))}
                    <span>More</span>
                </div>
            </div>
        </div>
    );
}
