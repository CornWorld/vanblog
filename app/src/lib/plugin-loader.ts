/**
 * Fetches a plugin's rendered HTML fragment from PocketBase JSVM.
 * Called server-side within Astro SSR pages.
 */

export interface PluginPageData {
    html: string;
    title: string;
    head: string;
    scripts?: string[];
    styles?: string[];
}

interface FetchPluginPageOptions {
    plugin: string;
    type: 'public' | 'admin';
    pbUrl: string;
    cookie: string;
}

export async function fetchPluginPage(opts: FetchPluginPageOptions): Promise<PluginPageData | null> {
    const endpoint = opts.type === 'public'
        ? `/_plugin/${opts.plugin}/render`
        : `/_plugin/${opts.plugin}/admin`;

    try {
        const res = await fetch(`${opts.pbUrl}${endpoint}`, {
            headers: {
                Cookie: opts.cookie,
            },
            // Don't throw on non-2xx — we handle that below
        });

        if (!res.ok) {
            console.warn(`[plugin-loader] ${opts.plugin} returned ${res.status}`);
            return null;
        }

        return (await res.json()) as PluginPageData;
    } catch (err) {
        console.error(`[plugin-loader] Failed to fetch ${opts.plugin}:`, err);
        return null;
    }
}
