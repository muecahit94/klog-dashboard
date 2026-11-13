'use client';

import {
    minutesToDecimalHours,
    aggregateBillable,
    aggregateCumulativeBalance,
    DEFAULT_WORKING_DAYS,
} from '@/lib/klogParser';

export default function SummaryCards({
    records,
    excludedRecords = [],
    showExcluded = false,
    config,
    dailyTargetHours,
    workingDays = DEFAULT_WORKING_DAYS,
    billableTags = [],
}) {
    // Calculate from entries (not r.totalMinutes) so filtered records show correct totals
    const totalMinutes = records.reduce((sum, r) =>
        sum + r.entries.reduce((eSum, e) => eSum + (e.minutes || 0), 0), 0);
    const totalHours = minutesToDecimalHours(totalMinutes);
    const daysTracked = new Set(records.map(r => r.date)).size;
    const dailyAvg = daysTracked > 0 ? totalMinutes / daysTracked : 0;

    const excludedMinutes = (showExcluded && excludedRecords.length > 0)
        ? excludedRecords.reduce((sum, r) => sum + r.entries.reduce((eSum, e) => eSum + (e.minutes || 0), 0), 0)
        : 0;
    const excludedHours = minutesToDecimalHours(excludedMinutes);

    const allTags = new Set();
    records.forEach(r => {
        r.tags.forEach(t => allTags.add(t.name));
        r.entries.forEach(e => e.tags.forEach(t => allTags.add(t.name)));
    });

    const resolvedTargetHours = dailyTargetHours ?? config?.dailyTargetHours ?? 8.0;
    const targetMin = resolvedTargetHours * 60;

    // Reuse date-level balance aggregation so Should vs Actual stays aligned with Cumulative Balance
    const balanceDays = aggregateCumulativeBalance(records, targetMin, workingDays);
    const shouldTotalMin = balanceDays.reduce((sum, d) => sum + d.shouldMinutes, 0);
    const diff = totalMinutes - shouldTotalMin;

    const totalEntries = records.reduce((sum, r) => sum + r.entries.length, 0);

    const billable = aggregateBillable(records, billableTags);

    const cards = [
        {
            icon: '⏱️',
            value: totalHours.toFixed(2) + 'h',
            label: excludedHours > 0 ? `Total Hours (+${excludedHours.toFixed(2)}h excluded)` : 'Total Hours',
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
            icon: records.length > 0 ? (diff >= 0 ? '✅' : '⚠️') : '🎯',
            value: records.length > 0 ? (diff >= 0 ? '+' : '') + minutesToDecimalHours(diff).toFixed(2) + 'h' : '—',
            label: 'Should vs Actual',
        },
    ];

    if (billableTags.length > 0 && billable.totalMinutes > 0) {
        cards.push({
            icon: '💰',
            value: billable.billablePercent.toFixed(1) + '%',
            label: `Billable · ${billable.billableHours.toFixed(2)}h`,
        });
    }

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
