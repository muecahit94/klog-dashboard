import { NextResponse } from 'next/server';


const DEFAULT_CONFIG = {
    dailyTargetHours: 8.0
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

        return NextResponse.json({ ...DEFAULT_CONFIG, ...config });
    } catch (err) {
        console.error('[api/config] Error reading config:', err);
        return NextResponse.json(DEFAULT_CONFIG);
    }
}
