import { NextResponse } from 'next/server';
import { DEFAULT_WORKING_DAYS, isValidIsoDate, parseWorkingDays } from '@/lib/klogParser';

const DEFAULT_CONFIG = {
    dailyTargetHours: 8.0,
    workingDays: DEFAULT_WORKING_DAYS,
    excludedTags: [],
    billableTags: [],
    billableTargetPercent: 0,
    vacationAllowanceDays: 0,
    vacationTags: ['vacation'],
    vacationStartDate: '',
};

function parseTagList(raw) {
    return String(raw || '')
        .split(',')
        .map(s => s.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean);
}

export async function GET() {
    try {
        let config = {};

        // Only use Environment Variables
        if (process.env.KLOG_DAILY_TARGET_HOURS) {
            const envTarget = parseFloat(process.env.KLOG_DAILY_TARGET_HOURS);
            if (!isNaN(envTarget) && envTarget >= 0) {
                config.dailyTargetHours = Math.min(envTarget, 24);
            }
        }

        // Comma-separated working days (e.g. mon,tue,wed,thu,fri or 1,2,3,4,5)
        if (process.env.KLOG_WORKING_DAYS) {
            const parsedDays = parseWorkingDays(process.env.KLOG_WORKING_DAYS);
            if (parsedDays !== null) {
                config.workingDays = parsedDays;
            }
        }

        // Comma-separated tag names excluded from all calculations (e.g. vacation,sickleave)
        if (process.env.KLOG_EXCLUDED_TAGS) {
            config.excludedTags = parseTagList(process.env.KLOG_EXCLUDED_TAGS);
        }

        // Comma-separated tag names counted as billable time (e.g. billable,client)
        if (process.env.KLOG_BILLABLE_TAGS) {
            config.billableTags = parseTagList(process.env.KLOG_BILLABLE_TAGS);
        }

        // Target billable percentage goal (0-100; 0 disables the goal)
        if (process.env.KLOG_BILLABLE_TARGET_PERCENT) {
            const pct = parseFloat(process.env.KLOG_BILLABLE_TARGET_PERCENT);
            if (!isNaN(pct)) {
                config.billableTargetPercent = Math.min(Math.max(pct, 0), 100);
            }
        }

        // Annual paid vacation allowance in days (0 disables the Leave Balance widget)
        if (process.env.KLOG_VACATION_ALLOWANCE_DAYS) {
            const days = parseFloat(process.env.KLOG_VACATION_ALLOWANCE_DAYS);
            if (!isNaN(days) && days >= 0) {
                config.vacationAllowanceDays = Math.min(days, 366);
            }
        }

        // Comma-separated tag names that count against the vacation allowance
        if (process.env.KLOG_VACATION_TAGS) {
            const tags = parseTagList(process.env.KLOG_VACATION_TAGS);
            if (tags.length > 0) config.vacationTags = tags;
        }

        // Employment start date (YYYY-MM-DD) for prorating first-year vacation allowance
        if (process.env.KLOG_VACATION_START_DATE) {
            const rawDate = String(process.env.KLOG_VACATION_START_DATE).trim();
            if (isValidIsoDate(rawDate)) {
                config.vacationStartDate = rawDate;
            }
        }

        return NextResponse.json({ ...DEFAULT_CONFIG, ...config });
    } catch (err) {
        console.error('[api/config] Error reading config:', err);
        return NextResponse.json(DEFAULT_CONFIG);
    }
}
