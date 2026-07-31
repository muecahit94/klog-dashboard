'use client';

import { useMemo, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    PointElement,
    LineElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
    aggregateByDate, aggregateByWeek, aggregateByMonth,
    aggregateByDateWithTags, aggregateByWeekWithTags, aggregateByMonthWithTags,
    aggregateByTagGrouped, aggregateCumulativeBalance, aggregateCumulativeBillableBalance,
    aggregateBillableByPeriod, minutesToDecimalHours,
} from '@/lib/klogParser';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    PointElement,
    LineElement,
);

const TAG_COLORS = [
    '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#3b82f6', '#14b8a6', '#f97316',
    '#a855f7', '#22d3ee', '#84cc16', '#e11d48', '#0ea5e9',
];

// Maps a chart period key to the inclusive date range it represents.
function periodToRange(key, mode) {
    if (!key) return null;
    if (mode === 'monthly') {
        const [y, m] = key.split('-').map(Number);
        const end = new Date(y, m, 0);
        const pad = (n) => String(n).padStart(2, '0');
        return { from: `${key}-01`, to: `${key}-${pad(end.getDate())}`, label: key };
    }
    if (mode === 'weekly') {
        const start = new Date(key + 'T00:00:00');
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from: key, to: fmt(end), label: `week of ${key}` };
    }
    return { from: key, to: key, label: key };
}

const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            backgroundColor: 'rgba(18, 20, 30, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#f0f1f5',
            bodyColor: '#8b8fa3',
            padding: 12,
            cornerRadius: 8,
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'Inter' },
        },
    },
    scales: {
        x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#5a5e72', font: { family: 'Inter', size: 11 } },
        },
        y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
                color: '#5a5e72',
                font: { family: 'Inter', size: 11 },
                callback: (v) => v + 'h',
            },
        },
    },
};

export default function Charts({ records, config, billableTags = [], billableTarget = 0, onHighlight }) {
    const [timeMode, setTimeMode] = useState('daily');
    const [showTags, setShowTags] = useState(false);
    const [showBillable, setShowBillable] = useState(false);
    const [balanceMode, setBalanceMode] = useState('total');

    const dailyData = useMemo(() => aggregateByDate(records), [records]);
    const weeklyData = useMemo(() => aggregateByWeek(records), [records]);
    const monthlyData = useMemo(() => aggregateByMonth(records), [records]);
    const groupedTagData = useMemo(() => aggregateByTagGrouped(records), [records]);

    const dailyTagData = useMemo(() => aggregateByDateWithTags(records), [records]);
    const weeklyTagData = useMemo(() => aggregateByWeekWithTags(records), [records]);
    const monthlyTagData = useMemo(() => aggregateByMonthWithTags(records), [records]);

    const billableTimeData = useMemo(
        () => aggregateBillableByPeriod(records, billableTags, timeMode),
        [records, billableTags, timeMode],
    );

    const timeData = timeMode === 'daily' ? dailyData :
        timeMode === 'weekly' ? weeklyData : monthlyData;

    const timeTagData = timeMode === 'daily' ? dailyTagData :
        timeMode === 'weekly' ? weeklyTagData : monthlyTagData;

    const labelKey = timeMode === 'daily' ? 'date' :
        timeMode === 'weekly' ? 'week' : 'month';

    const targetHours = config?.dailyTargetHours || 8.0;

    // Build stacked datasets when showTags is true
    const stackedChartData = useMemo(() => {
        if (!showTags || timeTagData.length === 0) return null;

        // Collect all unique tags across all periods, sorted by total hours descending
        const tagTotals = {};
        for (const period of timeTagData) {
            for (const [tag, mins] of Object.entries(period.tagBreakdown)) {
                if (!tagTotals[tag]) tagTotals[tag] = 0;
                tagTotals[tag] += mins;
            }
        }
        const sortedTags = Object.entries(tagTotals)
            .sort(([, a], [, b]) => b - a)
            .map(([tag]) => tag);

        const labels = timeTagData.map(d => {
            const val = d.key;
            if (timeMode === 'daily' && val) return val.slice(5);
            if (timeMode === 'weekly' && val) return 'W ' + val.slice(5);
            return val;
        });

        const datasets = sortedTags.map((tag, i) => ({
            label: '#' + tag,
            data: timeTagData.map(d => {
                const mins = d.tagBreakdown[tag] || 0;
                return minutesToDecimalHours(mins);
            }),
            backgroundColor: TAG_COLORS[i % TAG_COLORS.length] + 'cc',
            borderColor: TAG_COLORS[i % TAG_COLORS.length],
            borderWidth: 1,
            borderRadius: 2,
            _tag: tag,
        }));

        return { labels, datasets };
    }, [showTags, timeTagData, timeMode]);

    // Billable vs non-billable stacked per period
    const billableChartData = useMemo(() => {
        if (!showBillable || billableTags.length === 0 || billableTimeData.length === 0) return null;
        const labels = billableTimeData.map(d => {
            const val = d.key;
            if (timeMode === 'daily' && val) return val.slice(5);
            if (timeMode === 'weekly' && val) return 'W ' + val.slice(5);
            return val;
        });
        return {
            labels,
            datasets: [
                {
                    label: 'Billable',
                    data: billableTimeData.map(d => d.billableHours),
                    backgroundColor: 'rgba(16, 185, 129, 0.75)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 2,
                    _billable: true,
                },
                {
                    label: 'Non-billable',
                    data: billableTimeData.map(d => d.nonBillableHours),
                    backgroundColor: 'rgba(139, 143, 163, 0.45)',
                    borderColor: '#8b8fa3',
                    borderWidth: 1,
                    borderRadius: 2,
                    _billable: false,
                },
            ],
        };
    }, [showBillable, billableTags, billableTimeData, timeMode]);

    const billableActive = showBillable && billableTags.length > 0;
    const stacked = showTags || billableActive;

    // Period key per bar index, used to map a bar click back to a date range
    const periodKeys = billableActive && billableChartData
        ? billableTimeData.map(d => d.key)
        : showTags && stackedChartData
            ? timeTagData.map(d => d.key)
            : timeData.map(d => d[labelKey]);

    const barChartData = billableActive && billableChartData ? billableChartData
        : showTags && stackedChartData ? stackedChartData : {
            labels: timeData.map(d => {
                const val = d[labelKey];
                if (timeMode === 'daily' && val) return val.slice(5); // MM-DD
                if (timeMode === 'weekly' && val) return 'W ' + val.slice(5);
                return val;
            }),
            datasets: [{
                label: 'Hours',
                data: timeData.map(d => d.hours),
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(99, 102, 241, 0.8)',
                order: 2,
            },
            ],
        };

    const barChartOptions = {
        ...chartDefaults,
        onClick: (evt, elements) => {
            if (!onHighlight || !elements || elements.length === 0) return;
            const key = periodKeys[elements[0].index];
            const range = periodToRange(key, timeMode);
            if (range) onHighlight({ kind: 'dateRange', from: range.from, to: range.to, label: range.label });
        },
        plugins: {
            ...chartDefaults.plugins,
            legend: {
                display: stacked,
                position: 'top',
                labels: {
                    color: '#8b8fa3',
                    font: { family: 'Inter', size: 10 },
                    padding: 8,
                    usePointStyle: true,
                    pointStyle: 'rect',
                    boxWidth: 10,
                },
            },
            tooltip: {
                ...chartDefaults.plugins.tooltip,
                mode: stacked ? 'index' : 'nearest',
                callbacks: {
                    label: (ctx) => {
                        const val = ctx.parsed.y;
                        if (billableActive) {
                            if (val === 0) return null;
                            return ` ${ctx.dataset.label}: ${val.toFixed(2)}h`;
                        }
                        if (showTags && val === 0) return null;
                        return showTags ? ` ${ctx.dataset.label}: ${val.toFixed(2)}h` : `${val.toFixed(2)}h`;
                    },
                    afterLabel: (ctx) => {
                        if (!showTags) return undefined;
                        if (ctx.parsed.y === 0) return undefined;
                        const primary = ctx.dataset._tag;
                        const period = timeTagData[ctx.dataIndex];
                        const subs = period?.subBreakdown?.[primary];
                        if (!subs) return undefined;
                        const entries = Object.entries(subs).sort(([, a], [, b]) => b - a);
                        if (entries.length === 0) return undefined;
                        const parentMins = period.tagBreakdown[primary] || 0;
                        return entries.map(([child, mins]) => {
                            const hrs = minutesToDecimalHours(mins);
                            const pct = parentMins > 0 ? ((mins / parentMins) * 100).toFixed(0) : 0;
                            return `    › #${child}: ${hrs.toFixed(2)}h (${pct}%)`;
                        });
                    },
                    footer: (items) => {
                        if (!billableActive || items.length === 0) return undefined;
                        const d = billableTimeData[items[0].dataIndex];
                        if (!d) return undefined;
                        const total = d.billableMinutes + d.nonBillableMinutes;
                        if (total <= 0) return undefined;
                        const pct = ((d.billableMinutes / total) * 100).toFixed(1);
                        return `Billable: ${pct}% of ${minutesToDecimalHours(total).toFixed(2)}h`;
                    },
                },
            },
        },
        scales: {
            ...chartDefaults.scales,
            x: {
                ...chartDefaults.scales.x,
                stacked,
            },
            y: {
                ...chartDefaults.scales.y,
                stacked,
            },
        },
    };

    const trendChartData = {
        labels: dailyData.map(d => d.date.slice(5)),
        datasets: [{
            label: 'Hours',
            data: dailyData.map(d => d.hours),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#6366f1',
            pointBorderColor: 'transparent',
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#6366f1',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
        }],
    };

    const balanceData = useMemo(
        () => aggregateCumulativeBalance(records, targetHours * 60),
        [records, targetHours],
    );

    const billablePercent = Number(billableTarget) || 0;
    const billableBalanceData = useMemo(
        () => aggregateCumulativeBillableBalance(records, billableTags, billablePercent),
        [records, billableTags, billablePercent],
    );

    const balanceBillable = balanceMode === 'billable' && billableTags.length > 0;
    const activeBalanceData = balanceBillable ? billableBalanceData : balanceData;

    const balanceTotals = useMemo(() => {
        const actual = activeBalanceData.reduce((s, d) => s + d.actualMinutes, 0);
        const target = activeBalanceData.reduce((s, d) => s + d.shouldMinutes, 0);
        return { actual, target, diff: actual - target };
    }, [activeBalanceData]);

    const balanceChartData = {
        labels: activeBalanceData.map(d => d.date.slice(5)),
        datasets: [{
            label: balanceBillable ? 'Cumulative Billable Balance' : 'Cumulative Balance',
            data: activeBalanceData.map(d => d.cumulativeHours),
            borderColor: balanceBillable ? '#10b981' : '#8b5cf6',
            backgroundColor: balanceBillable ? 'rgba(16, 185, 129, 0.12)' : 'rgba(139, 92, 246, 0.12)',
            fill: {
                target: 'origin',
                above: 'rgba(16, 185, 129, 0.12)',
                below: 'rgba(239, 68, 68, 0.12)',
            },
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: activeBalanceData.map(d => d.cumulativeMinutes >= 0 ? '#10b981' : '#ef4444'),
            pointBorderColor: 'transparent',
            pointHoverRadius: 6,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
        }],
    };

    const doughnutData = useMemo(() => {
        const groups = groupedTagData.slice(0, 10);
        return {
            labels: groups.map(g => '#' + g.tag),
            datasets: [{
                data: groups.map(g => g.hours),
                backgroundColor: groups.map((g, i) => TAG_COLORS[i % TAG_COLORS.length] + 'cc'),
                borderColor: groups.map((g, i) => TAG_COLORS[i % TAG_COLORS.length]),
                borderWidth: 2,
                hoverOffset: 6,
                _groups: groups,
            }],
        };
    }, [groupedTagData]);

    return (
        <div className="charts-grid animate-slide-up">
            {/* Time Bar Chart */}
            <div className="chart-card">
                <div className="chart-header">
                    <h3 className="chart-title">Time Overview</h3>
                    <div className="chart-toggle">
                        {['daily', 'weekly', 'monthly'].map(mode => (
                            <button
                                key={mode}
                                className={timeMode === mode ? 'active' : ''}
                                onClick={() => setTimeMode(mode)}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                        <label
                            onClick={() => setShowTags(v => {
                                const next = !v;
                                if (next) setShowBillable(false);
                                return next;
                            })}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                color: showTags ? '#f0f1f5' : 'var(--text-muted)',
                                cursor: 'pointer',
                                marginLeft: '10px',
                                userSelect: 'none',
                                transition: 'color 0.2s',
                            }}
                        >
                            <span style={{
                                position: 'relative',
                                width: '32px',
                                height: '18px',
                                borderRadius: '9px',
                                background: showTags
                                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                    : 'rgba(255, 255, 255, 0.1)',
                                transition: 'background 0.25s ease',
                                boxShadow: showTags ? '0 0 8px rgba(99, 102, 241, 0.4)' : 'none',
                                flexShrink: 0,
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: showTags ? '16px' : '2px',
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    background: '#fff',
                                    transition: 'left 0.25s ease',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                            </span>
                            Tags
                        </label>
                        {billableTags.length > 0 && (
                        <label
                            onClick={() => setShowBillable(v => {
                                const next = !v;
                                if (next) setShowTags(false);
                                return next;
                            })}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                color: showBillable ? '#f0f1f5' : 'var(--text-muted)',
                                cursor: 'pointer',
                                marginLeft: '10px',
                                userSelect: 'none',
                                transition: 'color 0.2s',
                            }}
                        >
                            <span style={{
                                position: 'relative',
                                width: '32px',
                                height: '18px',
                                borderRadius: '9px',
                                background: showBillable
                                    ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                                    : 'rgba(255, 255, 255, 0.1)',
                                transition: 'background 0.25s ease',
                                boxShadow: showBillable ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none',
                                flexShrink: 0,
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: showBillable ? '16px' : '2px',
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    background: '#fff',
                                    transition: 'left 0.25s ease',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                            </span>
                            Billable
                        </label>
                        )}
                    </div>
                </div>
                <div className="chart-container">
                    <Bar data={barChartData} options={barChartOptions} />
                </div>
            </div>

            {/* Tag Distribution */}
            <div className="chart-card">
                <div className="chart-header">
                    <h3 className="chart-title">Tag Distribution</h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        hover for sub-tags · click to highlight
                    </span>
                </div>
                <div className="chart-container">
                    <Doughnut data={doughnutData} options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        onClick: (evt, elements) => {
                            if (!onHighlight || !elements || elements.length === 0) return;
                            const group = groupedTagData[elements[0].index];
                            if (group) onHighlight({ kind: 'tag', value: group.tag, label: '#' + group.tag });
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'right',
                                labels: {
                                    color: '#8b8fa3',
                                    font: { family: 'Inter', size: 11 },
                                    padding: 8,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                },
                            },
                            tooltip: {
                                ...chartDefaults.plugins.tooltip,
                                callbacks: {
                                    label: (ctx) => {
                                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                        const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                                        return ` ${ctx.parsed.toFixed(2)}h (${pct}%)`;
                                    },
                                    afterLabel: (ctx) => {
                                        const group = ctx.dataset._groups?.[ctx.dataIndex];
                                        if (!group) return undefined;
                                        const subs = group.children.filter(c => c.tag !== '(direct)');
                                        if (subs.length === 0) return undefined;
                                        const parentHours = group.hours || 1;
                                        return subs.map(c => {
                                            const p = ((c.hours / parentHours) * 100).toFixed(0);
                                            return `  › #${c.tag}: ${c.hours.toFixed(2)}h (${p}%)`;
                                        });
                                    },
                                },
                            },
                        },
                    }} />
                </div>
            </div>

            {/* Trend Line */}
            <div className="chart-card full-width">
                <div className="chart-header">
                    <h3 className="chart-title">Daily Trend</h3>
                </div>
                <div className="chart-container" style={{ height: '220px' }}>
                    <Line data={trendChartData} options={{
                        ...chartDefaults,
                        plugins: {
                            ...chartDefaults.plugins,
                            tooltip: {
                                ...chartDefaults.plugins.tooltip,
                                callbacks: {
                                    label: (ctx) => `${ctx.parsed.y.toFixed(2)}h`,
                                },
                            },
                        },
                    }} />
                </div>
            </div>

            {/* Cumulative Balance */}
            <div className="chart-card full-width">
                <div className="chart-header">
                    <h3 className="chart-title">Cumulative Balance</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                {minutesToDecimalHours(balanceTotals.actual).toFixed(2)}h
                            </strong>
                            {' '}{balanceBillable ? 'billable' : 'worked'}
                            {' · target '}
                            <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                {minutesToDecimalHours(balanceTotals.target).toFixed(2)}h
                            </strong>
                            {' '}
                            <span style={{ color: balanceTotals.diff >= 0 ? 'var(--accent-success)' : 'var(--accent-warning)', fontVariantNumeric: 'tabular-nums' }}>
                                ({balanceTotals.diff >= 0 ? '+' : ''}{minutesToDecimalHours(balanceTotals.diff).toFixed(2)}h)
                            </span>
                        </span>
                        {billableTags.length > 0 && (
                            <div className="chart-toggle">
                                <button
                                    className={balanceMode === 'total' ? 'active' : ''}
                                    onClick={() => setBalanceMode('total')}
                                >
                                    Total
                                </button>
                                <button
                                    className={balanceMode === 'billable' ? 'active' : ''}
                                    onClick={() => setBalanceMode('billable')}
                                >
                                    Billable
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="chart-container" style={{ height: '220px' }}>
                    <Line data={balanceChartData} options={{
                        ...chartDefaults,
                        plugins: {
                            ...chartDefaults.plugins,
                            tooltip: {
                                ...chartDefaults.plugins.tooltip,
                                callbacks: {
                                    label: (ctx) => {
                                        const d = activeBalanceData[ctx.dataIndex];
                                        const sign = d.cumulativeMinutes >= 0 ? '+' : '';
                                        return ` Balance: ${sign}${d.cumulativeHours.toFixed(2)}h`;
                                    },
                                    afterLabel: (ctx) => {
                                        const d = activeBalanceData[ctx.dataIndex];
                                        const sign = d.dailyMinutes >= 0 ? '+' : '';
                                        const lines = [`  Day: ${sign}${d.dailyHours.toFixed(2)}h`];
                                        if (balanceBillable) {
                                            lines.push(`  Billable: ${minutesToDecimalHours(d.actualMinutes).toFixed(2)}h · target ${minutesToDecimalHours(d.shouldMinutes).toFixed(2)}h`);
                                        }
                                        return lines;
                                    },
                                },
                            },
                        },
                        scales: {
                            ...chartDefaults.scales,
                            y: {
                                ...chartDefaults.scales.y,
                                ticks: {
                                    ...chartDefaults.scales.y.ticks,
                                    callback: (v) => (Math.round(v * 100) / 100) + 'h',
                                },
                            },
                        },
                    }} />
                </div>
            </div>

            {/* Tag Breakdown Table */}
            <div className="chart-card full-width">
                <div className="chart-header">
                    <h3 className="chart-title">Tag Breakdown</h3>
                </div>
                <div className="tag-breakdown">
                    {(() => {
                        const totalHours = groupedTagData.reduce((sum, g) => sum + g.hours, 0);
                        const maxHours = groupedTagData[0]?.hours || 1;
                        return groupedTagData.slice(0, 15).map((group, i) => {
                        const pct = (group.hours / maxHours) * 100;
                        const sharePct = totalHours > 0 ? (group.hours / totalHours) * 100 : 0;
                        const color = TAG_COLORS[i % TAG_COLORS.length];
                        const hasChildren = group.children.some(c => c.tag !== '(direct)');
                        return (
                            <div key={group.tag} className="tag-breakdown-group">
                                <div className="tag-breakdown-item">
                                    <span className="tag-breakdown-name">#{group.tag}</span>
                                    <div className="tag-breakdown-bar">
                                        <div
                                            className="tag-breakdown-fill"
                                            style={{ width: `${pct}%`, background: color }}
                                        />
                                    </div>
                                    <span className="tag-breakdown-value">
                                        {group.hours.toFixed(2)}h ({sharePct.toFixed(0)}%)
                                    </span>
                                </div>
                                {hasChildren && group.children.map((child) => {
                                    const childPct = group.hours > 0 ? (child.hours / group.hours) * 100 : 0;
                                    const label = child.tag === '(direct)' ? 'direct (no sub-tag)' : '#' + child.tag;
                                    return (
                                        <div
                                            key={group.tag + '::' + child.tag}
                                            className="tag-breakdown-item"
                                            style={{ paddingLeft: '20px', opacity: 0.85 }}
                                        >
                                            <span
                                                className="tag-breakdown-name"
                                                style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                                            >
                                                <span style={{ marginRight: '4px' }}>↳</span>{label}
                                            </span>
                                            <div className="tag-breakdown-bar">
                                                <div
                                                    className="tag-breakdown-fill"
                                                    style={{
                                                        width: `${childPct}%`,
                                                        background: color,
                                                        opacity: 0.55,
                                                    }}
                                                />
                                            </div>
                                            <span
                                                className="tag-breakdown-value"
                                                style={{ fontSize: '12px' }}
                                            >
                                                {child.hours.toFixed(2)}h ({childPct.toFixed(0)}%)
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    });
                    })()}
                </div>
            </div>
        </div>
    );
}
