'use client';

import { minutesToDecimalHours } from '@/lib/klogParser';

export default function SummaryCards({ records }) {
    // Calculate from entries (not r.totalMinutes) so filtered records show correct totals
    const totalMinutes = records.reduce((sum, r) =>
        sum + r.entries.reduce((eSum, e) => eSum + (e.minutes || 0), 0), 0);
    const totalHours = minutesToDecimalHours(totalMinutes);
    const daysTracked = new Set(records.map(r => r.date)).size;
    const dailyAvg = daysTracked > 0 ? totalMinutes / daysTracked : 0;

    const allTags = new Set();
    records.forEach(r => {
        r.tags.forEach(t => allTags.add(t.name));
        r.entries.forEach(e => e.tags.forEach(t => allTags.add(t.name)));
    });

    const shouldTotalMin = records
        .filter(r => r.shouldTotal !== null)
        .reduce((sum, r) => sum + r.shouldTotal, 0);
    const diff = totalMinutes - shouldTotalMin;

    const totalEntries = records.reduce((sum, r) => sum + r.entries.length, 0);

    const cards = [
        {
            icon: '⏱️',
            value: totalHours.toFixed(2) + 'h',
            label: 'Total Hours',
        },
        {
            icon: '📅',
            value: daysTracked,
            label: 'Days Tracked',
        },
        {
            icon: '📊',
            value: minutesToDecimalHours(dailyAvg).toFixed(2) + 'h',
            label: 'Daily Average',
        },
        {
            icon: '🏷️',
            value: allTags.size,
            label: 'Unique Tags',
        },
        {
            icon: '📝',
            value: totalEntries,
            label: 'Total Entries',
        },
        {
            icon: shouldTotalMin > 0 ? (diff >= 0 ? '✅' : '⚠️') : '🎯',
            value: shouldTotalMin > 0 ? (diff >= 0 ? '+' : '') + minutesToDecimalHours(diff).toFixed(2) + 'h' : '—',
            label: 'Should vs Actual',
        },
    ];

    return (
        <div className="summary-grid animate-slide-up">
            {cards.map((card, i) => (
                <div key={i} className="summary-card" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="summary-card-icon">{card.icon}</div>
                    <div className="summary-card-value">{card.value}</div>
                    <div className="summary-card-label">{card.label}</div>
                </div>
            ))}
        </div>
    );
}
