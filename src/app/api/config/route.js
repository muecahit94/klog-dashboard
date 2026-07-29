import { NextResponse } from 'next/server';


const DEFAULT_CONFIG = {
    dailyTargetHours: 8.0,
    excludedTags: [],
    billableTags: [],
    billableTargetPercent: 0
};



export async function GET() {
    try {
        let config = {};

        // Only use Environment Variables
        if (process.env.KLOG_DAILY_TARGET_HOURS) {
            const envTarget = parseFloat(process.env.KLOG_DAILY_TARGET_HOURS);
            if (!isNaN(envTarget)) {
                config.dailyTargetHours = envTarget;
            }
        }

        // Comma-separated tag names excluded from all calculations (e.g. vacation,sickleave)
        if (process.env.KLOG_EXCLUDED_TAGS) {
            config.excludedTags = process.env.KLOG_EXCLUDED_TAGS
                .split(',')
                .map(s => s.trim().replace(/^#/, '').toLowerCase())
                .filter(Boolean);
        }

        // Comma-separated tag names counted as billable time (e.g. billable,client)
        if (process.env.KLOG_BILLABLE_TAGS) {
            config.billableTags = process.env.KLOG_BILLABLE_TAGS
                .split(',')
                .map(s => s.trim().replace(/^#/, '').toLowerCase())
                .filter(Boolean);
        }

        // Target billable percentage goal (0-100; 0 disables the goal)
        if (process.env.KLOG_BILLABLE_TARGET_PERCENT) {
            const pct = parseFloat(process.env.KLOG_BILLABLE_TARGET_PERCENT);
            if (!isNaN(pct)) {
                config.billableTargetPercent = Math.min(Math.max(pct, 0), 100);
            }
        }

        return NextResponse.json({ ...DEFAULT_CONFIG, ...config });
    } catch (err) {
        console.error('[api/config] Error reading config:', err);
        return NextResponse.json(DEFAULT_CONFIG);
    }
}
