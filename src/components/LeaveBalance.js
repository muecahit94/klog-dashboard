'use client';

import { useMemo, useState } from 'react';
import {
    aggregateLeaveBalance,
    calculateEffectiveVacationAllowance,
    isValidIsoDate,
} from '@/lib/klogParser';

const VACATION_COLORS = [
    '#f59e0b',
    '#f97316',
    '#fbbf24',
    '#ea580c',
];

const OTHER_LEAVE_COLORS = [
    'var(--accent-tertiary)',
    'var(--accent-secondary)',
    'var(--accent-primary)',
    'var(--text-secondary)',
];

function formatDays(days) {
    const rounded = Math.round((Number(days) || 0) * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export default function LeaveBalance({
    records,
    visible = false,
    vacationAllowance = 0,
    vacationTags = ['vacation'],
    startDate = '',
    excludedTags = [],
    dailyTargetHours = 8.0,
    preferredYear = '',
    onHighlight,
}) {
    const allowance = Number(vacationAllowance) || 0;
    const validStartDate = isValidIsoDate(startDate) ? startDate : '';
    const [chosenYear, setChosenYear] = useState(null);

    // Discover available years across all loaded records first
    const availableYears = useMemo(() => {
        const set = new Set();
        for (const r of records) {
            if (r.date && r.date.length >= 4) set.add(r.date.slice(0, 4));
        }
        return Array.from(set).sort();
    }, [records]);

    const activeYear = useMemo(() => {
        if (chosenYear && availableYears.includes(chosenYear)) return chosenYear;
        if (preferredYear && availableYears.includes(preferredYear)) return preferredYear;
        return availableYears[availableYears.length - 1] || '';
    }, [chosenYear, preferredYear, availableYears]);

    const {
        effectiveAllowance,
        yearAllowance,
        isAccruedToDate,
        isBeforeStart,
        effectiveAsOfMonth,
    } = useMemo(
        () => calculateEffectiveVacationAllowance(allowance, validStartDate, activeYear),
        [allowance, validStartDate, activeYear],
    );

    const stats = useMemo(
        () => aggregateLeaveBalance(records, {
            vacationTags,
            otherLeaveTags: excludedTags,
            dailyTargetMinutes: (Number(dailyTargetHours) || 0) * 60,
            year: activeYear || 'all',
            startDate: validStartDate,
        }),
        [records, vacationTags, excludedTags, dailyTargetHours, activeYear, validStartDate],
    );

    // Cap cumulative segment widths at 100% of the track
    const vacationSegments = useMemo(() => {
        return stats.vacationBreakdown.reduce((acc, row, i) => {
            const rawPct = effectiveAllowance > 0 ? (row.days / effectiveAllowance) * 100 : 0;
            const widthPct = Math.max(0, Math.min(rawPct, 100 - acc.filled));
            return {
                filled: acc.filled + widthPct,
                segments: [
                    ...acc.segments,
                    {
                        ...row,
                        widthPct,
                        color: VACATION_COLORS[i % VACATION_COLORS.length],
                    },
                ],
            };
        }, { filled: 0, segments: [] }).segments;
    }, [stats.vacationBreakdown, effectiveAllowance]);

    if (!visible || records.length === 0 || allowance <= 0) return null;

    const usedDays = stats.vacationUsedDays;
    const remainingDays = effectiveAllowance - usedDays;
    const isOver = !isBeforeStart && remainingDays < -0.05;
    const usedPct = effectiveAllowance > 0 ? (usedDays / effectiveAllowance) * 100 : 0;

    const statusColor = isOver
        ? 'var(--accent-danger)'
        : usedPct >= 90
            ? 'var(--accent-warning)'
            : 'var(--accent-success)';

    const configuredVacLabels = (vacationTags || []).map(t => `#${t}`).join(', ');

    return (
        <section
            className="animate-slide-up"
            style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                padding: '20px 24px',
                marginBottom: '24px',
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '16px',
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        🏖️ Vacation & Leave{activeYear ? ` (${activeYear})` : ''}
                    </h3>
                    {availableYears.length > 1 && (
                        <div className="chart-toggle">
                            {availableYears.map(yr => (
                                <button
                                    key={yr}
                                    type="button"
                                    className={activeYear === yr ? 'active' : ''}
                                    onClick={() => setChosenYear(yr)}
                                >
                                    {yr}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '18px' }}>
                        {formatDays(usedDays)}d
                    </strong>{' '}
                    / {formatDays(effectiveAllowance)}d {isAccruedToDate ? 'available' : 'used'}
                    <span style={{ color: isBeforeStart ? 'var(--text-muted)' : statusColor, marginLeft: '10px', fontWeight: 500 }}>
                        {isBeforeStart
                            ? `· Starts ${validStartDate}`
                            : isOver
                                ? `⚠️ ${formatDays(Math.abs(remainingDays))}d over`
                                : `· ${formatDays(remainingDays)}d remaining`}
                    </span>
                </span>
            </div>

            {/* Progress bar */}
            <div
                role="progressbar"
                aria-valuenow={Math.round(usedPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${formatDays(usedDays)} of ${formatDays(effectiveAllowance)} vacation days used`}
                style={{
                    display: 'flex',
                    height: '14px',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    background: 'var(--bg-input)',
                    marginBottom: '16px',
                }}
            >
                {vacationSegments.map(seg => seg.widthPct > 0 && (
                    <div
                        key={seg.tag}
                        title={`#${seg.tag}: ${formatDays(seg.days)}d (${seg.hours.toFixed(2)}h) — click to highlight`}
                        onClick={() => onHighlight?.({ kind: 'tag', value: seg.tag, label: '#' + seg.tag })}
                        style={{
                            width: `${seg.widthPct}%`,
                            background: seg.color,
                            cursor: onHighlight ? 'pointer' : 'default',
                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    />
                ))}
            </div>

            {/* Breakdown legend */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px 18px',
                alignItems: 'center',
            }}>
                {vacationSegments.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        No {configuredVacLabels || '#vacation'} entries logged{activeYear ? ` in ${activeYear}` : ''}
                    </span>
                ) : (
                    vacationSegments.map(seg => (
                        <span
                            key={seg.tag}
                            onClick={() => onHighlight?.({ kind: 'tag', value: seg.tag, label: '#' + seg.tag })}
                            title={`Vacation allowance tag — click to highlight #${seg.tag}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '7px',
                                fontSize: '13px',
                                cursor: onHighlight ? 'pointer' : 'default',
                            }}
                        >
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: seg.color, flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-primary)' }}>#{seg.tag}</span>
                            <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatDays(seg.days)}d · {seg.hours.toFixed(2)}h
                            </span>
                        </span>
                    ))
                )}

                {stats.otherLeaveBreakdown.length > 0 && (
                    <>
                        <span style={{ color: 'var(--border-color)', userSelect: 'none' }}>|</span>
                        {stats.otherLeaveBreakdown.map((row, idx) => {
                            const dotColor = OTHER_LEAVE_COLORS[idx % OTHER_LEAVE_COLORS.length];
                            return (
                                <span
                                    key={row.tag}
                                    onClick={() => onHighlight?.({ kind: 'tag', value: row.tag, label: '#' + row.tag })}
                                    title={`Other leave (does not deduct from vacation allowance) — click to highlight #${row.tag}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '7px',
                                        fontSize: '13px',
                                        cursor: onHighlight ? 'pointer' : 'default',
                                    }}
                                >
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>#{row.tag}</span>
                                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                        {formatDays(row.days)}d · {row.hours.toFixed(2)}h
                                    </span>
                                </span>
                            );
                        })}
                    </>
                )}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px', lineHeight: 1.5 }}>
                {isBeforeStart ? (
                    <>No days earned before company start date {validStartDate} ({formatDays(allowance)}d/yr thereafter).</>
                ) : isAccruedToDate ? (
                    <>
                        Accrued through {effectiveAsOfMonth}
                        {validStartDate ? ` (started ${validStartDate})` : ''}:{' '}
                        {formatDays(effectiveAllowance)}d
                        {yearAllowance !== allowance
                            ? ` of ${formatDays(yearAllowance)}d for ${activeYear} (${formatDays(allowance)}d/yr)`
                            : ` of ${formatDays(allowance)}d/yr`}.
                        {' '}Counting {configuredVacLabels || '#vacation'} ({dailyTargetHours > 0 ? `1 day = ${Number(dailyTargetHours).toFixed(2)}h` : '1 day per unique date'}).
                    </>
                ) : yearAllowance < allowance && validStartDate ? (
                    <>
                        Prorated from {validStartDate} ({formatDays(yearAllowance)}d of {formatDays(allowance)}d/yr).
                        {' '}Counting {configuredVacLabels || '#vacation'} ({dailyTargetHours > 0 ? `1 day = ${Number(dailyTargetHours).toFixed(2)}h` : '1 day per unique date'}).
                    </>
                ) : (
                    <>
                        Counting {configuredVacLabels || '#vacation'} toward {formatDays(effectiveAllowance)}d/yr allowance
                        {validStartDate ? ` (started ${validStartDate}, ` : ' ('}
                        {dailyTargetHours > 0 ? `1 day = ${Number(dailyTargetHours).toFixed(2)}h` : '1 day per unique date'}).
                    </>
                )}
                {stats.otherLeaveBreakdown.length > 0 && ' Other excluded tags are shown separately.'}
                {' '}Configure in Settings.
            </div>
        </section>
    );
}
