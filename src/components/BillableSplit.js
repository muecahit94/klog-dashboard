'use client';

import { useMemo } from 'react';
import { aggregateBillable, aggregateBillableByTag, formatMinutes } from '@/lib/klogParser';

// Palette used to color each billable tag segment in the split bar
const TAG_COLORS = [
    'var(--accent-success)',
    'var(--accent-primary)',
    'var(--accent-tertiary)',
    'var(--accent-secondary)',
    'var(--accent-warning)',
    'var(--accent-pink)',
];

const NON_BILLABLE_COLOR = 'var(--text-muted)';

export default function BillableSplit({ records, billableTags = [], billableTarget = 0 }) {
    const stats = useMemo(
        () => aggregateBillable(records, billableTags),
        [records, billableTags],
    );
    const byTag = useMemo(
        () => aggregateBillableByTag(records, billableTags),
        [records, billableTags],
    );

    if (stats.totalMinutes <= 0) return null;

    const total = stats.totalMinutes;
    const billablePct = stats.billablePercent;
    const nonBillablePct = 100 - billablePct;
    const tagLabel = billableTags.length
        ? billableTags.map(t => `#${t}`).join(', ')
        : null;

    // Billable portion of the bar, split by first-level tag (share of TOTAL time)
    const tagSegments = byTag.map((row, i) => ({
        key: row.tag,
        label: `#${row.tag}`,
        minutes: row.minutes,
        hours: row.hours,
        pctOfTotal: total > 0 ? (row.minutes / total) * 100 : 0,
        pctOfBillable: row.percent,
        color: TAG_COLORS[i % TAG_COLORS.length],
    }));

    // Goal / target handling
    const hasGoal = Number(billableTarget) > 0;
    const target = Math.min(Math.max(Number(billableTarget) || 0, 0), 100);
    const goalMet = billablePct >= target;
    const goalDiff = billablePct - target;
    const goalColor = goalMet ? 'var(--accent-success)' : 'var(--accent-warning)';
    const headlineColor = hasGoal ? goalColor : 'var(--accent-success)';

    return (
        <section className="billable-split animate-slide-up" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            padding: '20px 24px',
            marginBottom: '24px',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '16px',
                flexWrap: 'wrap',
            }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    💰 Billable vs Non-billable
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: headlineColor, fontSize: '18px' }}>
                        {billablePct.toFixed(1)}%
                    </strong>{' '}
                    billable
                    {hasGoal && (
                        <span style={{ color: goalColor, marginLeft: '8px' }}>
                            {goalMet ? '✅' : '⚠️'} {goalMet ? '+' : ''}{goalDiff.toFixed(1)} pts vs {target}% goal
                        </span>
                    )}
                </span>
            </div>

            {/* Split bar: billable time colored per tag, non-billable in muted grey */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
                <div
                    role="img"
                    aria-label={`${billablePct.toFixed(1)}% billable, ${nonBillablePct.toFixed(1)}% non-billable${hasGoal ? `, goal ${target}%` : ''}`}
                    style={{
                        display: 'flex',
                        height: '14px',
                        borderRadius: '999px',
                        overflow: 'hidden',
                        background: 'var(--bg-input)',
                    }}
                >
                    {tagSegments.map(seg => seg.pctOfTotal > 0 && (
                        <div
                            key={seg.key}
                            title={`${seg.label}: ${formatMinutes(seg.minutes)} · ${seg.pctOfBillable.toFixed(1)}% of billable`}
                            style={{
                                width: `${seg.pctOfTotal}%`,
                                background: seg.color,
                                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        />
                    ))}
                    {nonBillablePct > 0 && (
                        <div
                            title={`Non-billable: ${formatMinutes(stats.nonBillableMinutes)} (${nonBillablePct.toFixed(1)}%)`}
                            style={{
                                width: `${nonBillablePct}%`,
                                background: NON_BILLABLE_COLOR,
                                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        />
                    )}
                </div>

                {/* Target marker */}
                {hasGoal && (
                    <div
                        title={`Billable goal: ${target}%`}
                        style={{
                            position: 'absolute',
                            top: '-3px',
                            bottom: '-3px',
                            left: `${target}%`,
                            width: '2px',
                            background: 'var(--text-primary)',
                            borderRadius: '2px',
                            transform: 'translateX(-1px)',
                        }}
                    />
                )}
            </div>

            {/* Legend */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px 18px',
                alignItems: 'center',
            }}>
                {tagSegments.map(seg => (
                    <span key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: seg.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)' }}>{seg.label}</span>
                        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {seg.hours.toFixed(2)}h · {seg.pctOfBillable.toFixed(1)}%
                        </span>
                    </span>
                ))}
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: NON_BILLABLE_COLOR, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-primary)' }}>Non-billable</span>
                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {stats.nonBillableHours.toFixed(2)}h · {nonBillablePct.toFixed(1)}%
                    </span>
                </span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px', lineHeight: 1.5 }}>
                {tagLabel
                    ? <>Time tagged with {tagLabel} counts as billable{hasGoal ? `; target ${target}% billable` : ''}. Configure in Settings.</>
                    : <>No billable tags set — all time counts as non-billable. Add tags (e.g. <code>#billable</code>) in Settings.</>}
            </div>
        </section>
    );
}
