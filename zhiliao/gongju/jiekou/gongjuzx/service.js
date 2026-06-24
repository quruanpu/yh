/**
 * Tool Center AI Service (Read-only)
 * - Query tool-center items from database
 * - Return matched tools with direct links
 */
const ToolCenterAiService = {
    config: {
        fallbackDbPath: 'gongju_zx/items',
        urlMaxLength: 2048,
        defaultListLimit: 50,
        maxListLimit: 300,
        maxFallbackAllItems: 300,
        maxRetryKeywords: 8
    },

    get defaultProvider() {
        return {
            provider_id: '3364',
            provider_name: '央拓医药'
        };
    },

    text(value) {
        if (value === undefined || value === null) return '';
        return String(value).trim();
    },

    toInt(value, fallback) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.floor(n);
    },

    clampInt(value, min, max, fallback) {
        const n = this.toInt(value, fallback);
        return Math.max(min, Math.min(max, n));
    },

    isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    },

    resolveDbPath() {
        const configured = this.text(window.GongjuzxConfig?.dbPath);
        return configured || this.config.fallbackDbPath;
    },

    async ensureDatabase() {
        if (!window.FirebaseModule) {
            throw new Error('Firebase 模块未加载');
        }
        await window.FirebaseModule.init();
        const db = window.FirebaseModule?.state?.database;
        if (!db) throw new Error('Firebase 数据库不可用');
        return db;
    },

    async getProviderInfo() {
        let credentials = null;
        try {
            const result = await window.LoginModule?.requireCredentials?.('scm', { silent: true });
            credentials = result?.ok ? result.credentials : null;
        } catch (_error) {
            credentials = null;
        }

        const session = window.LoginModule?.session || {};
        const providerInfo = session.providerInfo || {};
        const providerId = this.text(
            credentials?.provider_id
            || credentials?.providerId
            || session.credentials?.provider_id
            || session.credentials?.providerId
        );
        const providerName = this.text(
            providerInfo?.provider_name
            || credentials?.provider_name
            || credentials?.providerName
        );

        return {
            provider_id: providerId,
            provider_name: providerName
        };
    },

    normalizeUrl(rawUrl, required = false) {
        const raw = this.text(rawUrl).slice(0, this.config.urlMaxLength);
        if (!raw) {
            return required
                ? { valid: false, value: '', error: '请提供有效 URL' }
                : { valid: true, value: '' };
        }

        const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`];
        for (let i = 0; i < candidates.length; i += 1) {
            try {
                const parsed = new URL(candidates[i]);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
                parsed.hash = '';
                let value = parsed.toString();
                if (value.endsWith('/')) value = value.slice(0, -1);
                return { valid: true, value };
            } catch {
                // try next
            }
        }

        return { valid: false, value: '', error: 'URL 格式不正确' };
    },

    normalizeTagList(rawTags) {
        if (Array.isArray(rawTags)) {
            return rawTags.map((x) => this.text(x)).filter(Boolean);
        }
        if (typeof rawTags === 'string') {
            return rawTags
                .split(/[\s,;|/\\，。！？、；：]+/g)
                .map((x) => this.text(x))
                .filter(Boolean);
        }
        return [];
    },

    normalizeShared(value) {
        return value === true || value === 'true' || value === 'shared' || value === '共享';
    },

    canViewItem(item, currentProviderId) {
        if (item?.is_shared) return true;
        const ownerProviderId = this.text(item?.provider_id) || this.defaultProvider.provider_id;
        return !!currentProviderId && ownerProviderId === String(currentProviderId);
    },

    normalizeItemFromDb(id, item = {}) {
        const rawName = item?.name ?? item?.title ?? item?.tool_name ?? item?.toolName ?? '';
        const rawUrl = item?.url ?? item?.link ?? item?.website ?? item?.site ?? item?.address ?? '';
        const rawDescription = item?.description ?? item?.desc ?? item?.summary ?? item?.note ?? '';
        const rawCategory = item?.category ?? item?.group ?? item?.type ?? '';
        const normalized = this.normalizeUrl(rawUrl, false);
        const link = normalized.valid ? normalized.value : '';
        const hasSharedField = Object.prototype.hasOwnProperty.call(item || {}, 'is_shared');

        return {
            id: this.text(id),
            name: this.text(rawName),
            url: link || this.text(rawUrl),
            link,
            description: this.text(rawDescription),
            category: this.text(rawCategory),
            tags: this.normalizeTagList(item?.tags),
            is_shared: hasSharedField ? this.normalizeShared(item?.is_shared) : false,
            provider_id: this.text(item?.provider_id) || this.defaultProvider.provider_id,
            provider_name: this.text(item?.provider_name) || this.defaultProvider.provider_name,
            created_at: Number(item?.created_at || 0),
            updated_at: Number(item?.updated_at || 0)
        };
    },

    sortItems(items = []) {
        return items.slice().sort((a, b) => {
            const au = Number(a?.updated_at || 0);
            const bu = Number(b?.updated_at || 0);
            if (au !== bu) return bu - au;
            return String(a?.id || '').localeCompare(String(b?.id || ''));
        });
    },

    async listAllItems() {
        const db = await this.ensureDatabase();
        const path = this.resolveDbPath();
        const provider = await this.getProviderInfo();
        const snapshot = await db.ref(path).once('value');
        const raw = snapshot.val() || {};
        const list = Object.entries(raw)
            .map(([id, item]) => this.normalizeItemFromDb(id, item))
            .filter((item) => this.canViewItem(item, provider.provider_id));
        return this.sortItems(list);
    },

    normalizeSearchText(value) {
        const raw = this.text(value).toLowerCase();
        if (!raw) return '';
        return raw
            .replace(/[\u3000\t\r\n]+/g, ' ')
            .replace(/[，。！？、；：:（）()【】\[\]<>《》“”‘'"'`~!@#$%^&*+=|\\/]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    isGenericQueryToken(token) {
        const t = this.text(token).toLowerCase();
        if (!t) return true;
        return /^(我|我要|我想|帮我|给我|请|麻烦|推荐|找|查询|查找|搜|搜一下|有没有|有没有好用的|需要|想要|一下|一个|一些|这个|那个|怎么|如何|哪里|哪儿|哪个|哪些|什么|工具|软件|网站|网址|官网|入口|地址|平台|登录|登陆|app|应用|web|tool)$/i.test(t);
    },

    buildSearchTokens(keyword) {
        const raw = this.normalizeSearchText(keyword);
        if (!raw) return [];

        const direct = raw.split(/\s+/g).map((x) => x.trim()).filter(Boolean);
        const segments = (raw.match(/[\u4e00-\u9fa5a-z0-9]{2,40}/g) || []).map((x) => x.trim()).filter(Boolean);
        const variants = this.expandKeywordVariants(raw);
        const merged = [...direct, ...segments, ...variants];

        const unique = [];
        const seen = new Set();
        for (let i = 0; i < merged.length; i += 1) {
            const token = this.text(merged[i]).toLowerCase();
            if (!token) continue;
            if (token.length < 2) continue;
            if (token.length > 48) continue;
            if (this.isGenericQueryToken(token)) continue;
            if (seen.has(token)) continue;
            seen.add(token);
            unique.push(token);
        }
        return unique;
    },

    expandKeywordVariants(keyword) {
        const raw = this.normalizeSearchText(keyword);
        if (!raw) return [];

        const out = new Set([raw]);
        const compact = raw.replace(/\s+/g, '');
        if (compact) out.add(compact);

        const withoutRequestWords = compact
            .replace(/(我想|我要|帮我|给我|请|麻烦|推荐一下|推荐|找一下|找|查询|查找|搜一下|搜|有没有|需要|想要|一下|一个|一些|可以|能不能|想|要|做|用|给|看|下)/g, '')
            .trim();
        if (withoutRequestWords && withoutRequestWords.length >= 2) out.add(withoutRequestWords);

        const stripped = withoutRequestWords
            .replace(/(工具|软件|网站|官网|入口|登录|登陆|地址|平台|链接|网址|应用|app|有哪些|有什么|哪个好|哪款|什么)/g, '')
            .trim();
        if (stripped && stripped.length >= 2) out.add(stripped);

        const pieces = withoutRequestWords
            .split(/(工具|软件|网站|官网|入口|登录|登陆|地址|平台|链接|网址|应用|app|有哪些|有什么|哪个好|哪款|什么)/g)
            .map((x) => x.trim())
            .filter((x) => x && !this.isGenericQueryToken(x));
        pieces.forEach((x) => {
            if (x.length >= 2) out.add(x);
        });

        const synonymMap = [
            {
                patterns: ['录屏', '屏幕录制', '录制屏幕', '屏幕录像', 'screen record', 'screen recorder'],
                variants: ['录屏', '屏幕录制', '录制屏幕', '录制', '录像', 'screen record', 'recorder']
            },
            {
                patterns: ['二维码', 'qr code', 'qr'],
                variants: ['二维码', 'qr', 'qr code', '条码生成', '扫码']
            },
            {
                patterns: ['登录', '登陆', '入口', '官网', 'login', 'auth'],
                variants: ['登录', '登陆', '入口', '官网', 'login', 'auth', 'portal']
            }
        ];

        for (let i = 0; i < synonymMap.length; i += 1) {
            const row = synonymMap[i];
            const hit = row.patterns.some((p) => compact.includes(String(p).toLowerCase()));
            if (!hit) continue;
            row.variants.forEach((v) => out.add(String(v).toLowerCase()));
        }

        return Array.from(out).filter((x) => x.length >= 2 && !this.isGenericQueryToken(x));
    },

    detectIntentProfile(keyword) {
        const raw = this.normalizeSearchText(keyword);
        if (!raw) return '';
        if (/录屏|屏幕录制|录制屏幕|screen record|screen recorder/.test(raw)) return 'screen_record';
        if (/二维码|qr code|\bqr\b/.test(raw)) return 'qr';
        if (/登录|登陆|官网|入口|login|auth/.test(raw)) return 'login_portal';
        return '';
    },

    buildItemBundle(item = {}) {
        return this.normalizeSearchText([
            this.text(item?.name),
            this.text(item?.url),
            this.text(item?.description),
            this.text(item?.category),
            Array.isArray(item?.tags) ? item.tags.join(' ') : ''
        ].join('\n'));
    },

    matchesIntentProfile(item = {}, profile = '') {
        if (!profile) return true;
        const bundle = this.buildItemBundle(item);

        if (profile === 'screen_record') {
            return /录屏|屏幕|录制|录像|screen|record/.test(bundle);
        }
        if (profile === 'qr') {
            return /二维码|qr|扫码/.test(bundle);
        }
        if (profile === 'login_portal') {
            return /登录|登陆|入口|官网|login|auth|portal/.test(bundle);
        }
        return true;
    },

    itemMatchesTokens(item = {}, tokens = []) {
        if (!Array.isArray(tokens) || tokens.length === 0) return false;
        const bundle = this.buildItemBundle(item);
        const compactBundle = bundle.replace(/\s+/g, '');

        for (let i = 0; i < tokens.length; i += 1) {
            const token = this.normalizeSearchText(tokens[i]);
            if (!token) continue;
            const compactToken = token.replace(/\s+/g, '');
            if (bundle.includes(token)) return true;
            if (compactToken && compactBundle.includes(compactToken)) return true;
        }
        return false;
    },

    scoreLocalItem(item, keyword, tokens = []) {
        const q = this.normalizeSearchText(keyword);
        const compactQ = q.replace(/\s+/g, '');
        const name = this.normalizeSearchText(item?.name);
        const url = this.normalizeSearchText(item?.url);
        const desc = this.normalizeSearchText(item?.description);
        const category = this.normalizeSearchText(item?.category);
        const tags = Array.isArray(item?.tags) ? item.tags.map((x) => this.normalizeSearchText(x)).join(' ') : '';
        const bundle = `${name}\n${url}\n${desc}\n${category}\n${tags}`;
        const compactBundle = bundle.replace(/\s+/g, '');

        let score = 0;
        if (q) {
            if (name === q) score += 180;
            if (name.includes(q)) score += 110;
            if (compactQ && name.replace(/\s+/g, '').includes(compactQ)) score += 100;
            if (url.includes(q)) score += 70;
            if (desc.includes(q)) score += 55;
            if (category.includes(q)) score += 45;
            if (bundle.includes(q)) score += 30;
            if (compactQ && compactBundle.includes(compactQ)) score += 25;
        }

        for (let i = 0; i < tokens.length; i += 1) {
            const tk = this.normalizeSearchText(tokens[i]);
            if (!tk) continue;
            const compactTk = tk.replace(/\s+/g, '');
            if (name.includes(tk) || (compactTk && name.replace(/\s+/g, '').includes(compactTk))) score += 30;
            if (url.includes(tk) || (compactTk && url.replace(/\s+/g, '').includes(compactTk))) score += 18;
            if (desc.includes(tk) || (compactTk && desc.replace(/\s+/g, '').includes(compactTk))) score += 16;
            if (category.includes(tk) || (compactTk && category.replace(/\s+/g, '').includes(compactTk))) score += 14;
            if (tags.includes(tk)) score += 14;
        }

        if (!q && tokens.length === 0) score += 1;
        return score;
    },

    filterLocalItems(items = [], keyword = '', limit = this.config.defaultListLimit) {
        const q = this.text(keyword);
        const safeLimit = this.clampInt(limit, 1, this.config.maxListLimit, this.config.defaultListLimit);
        if (!q) return this.sortItems(items).slice(0, safeLimit);

        const tokens = this.buildSearchTokens(q);
        const profile = this.detectIntentProfile(q);
        const hasTokens = tokens.length > 0;

        const scored = items
            .map((item) => {
                const intentMatched = this.matchesIntentProfile(item, profile);
                const tokenMatched = this.itemMatchesTokens(item, tokens);
                let score = this.scoreLocalItem(item, q, tokens);

                if (profile) {
                    if (intentMatched) score += 35;
                    else score -= 24;
                }

                // Semantic guard: query has meaningful tokens but item contains none.
                if (hasTokens && !tokenMatched && !intentMatched) {
                    score -= 45;
                }

                return { item, score, intentMatched };
            })
            .filter((row) => row.score > 0)
            .sort((a, b) => {
                if (a.score !== b.score) return b.score - a.score;
                return Number(b.item.updated_at || 0) - Number(a.item.updated_at || 0);
            });

        if (profile) {
            const intentOnly = scored.filter((row) => row.intentMatched);
            if (intentOnly.length > 0) {
                return intentOnly.slice(0, safeLimit).map((row) => row.item);
            }
        }

        return scored.slice(0, safeLimit).map((row) => row.item);
    },

    ensureLinkField(items = []) {
        return (Array.isArray(items) ? items : []).map((row) => {
            const normalized = this.normalizeUrl(row?.url, false);
            const link = normalized.valid ? normalized.value : this.text(row?.link);
            return {
                ...(row || {}),
                url: link || this.text(row?.url),
                link: link || ''
            };
        });
    },

    parseManageInput(params = {}) {
        const base = this.isPlainObject(params) ? { ...params } : { keyword: params };
        let keyword = this.text(
            base.keyword || base.query || base.q || base.search || base.intent_text || base.text || base.content || base.message
        );
        if (!keyword && Array.isArray(base.keywords)) {
            keyword = this.text(base.keywords.find((x) => this.text(x)));
        }

        return {
            keyword,
            limit: this.clampInt(base.limit, 1, this.config.maxListLimit, this.config.defaultListLimit)
        };
    },

    buildRetryKeywords(keyword) {
        const raw = this.normalizeSearchText(keyword);
        if (!raw) return [];

        const merged = [...this.buildSearchTokens(raw), ...this.expandKeywordVariants(raw)];
        const unique = [];
        const seen = new Set();

        for (let i = 0; i < merged.length; i += 1) {
            const token = this.normalizeSearchText(merged[i]).replace(/\s+/g, '');
            if (!token) continue;
            if (token === raw.replace(/\s+/g, '')) continue;
            if (token.length < 2 || token.length > 32) continue;
            if (this.isGenericQueryToken(token)) continue;
            if (seen.has(token)) continue;
            seen.add(token);
            unique.push(token);
            if (unique.length >= this.config.maxRetryKeywords) break;
        }

        return unique;
    },

    async manageItems(params = {}) {
        try {
            const input = this.parseManageInput(params);
            const all = await this.listAllItems();
            const list = this.ensureLinkField(this.filterLocalItems(all, input.keyword, input.limit));
            const emptyWithKeyword = this.text(input.keyword) && list.length === 0;
            const retryKeywords = emptyWithKeyword ? this.buildRetryKeywords(input.keyword) : [];
            const appliedTokens = this.buildSearchTokens(input.keyword).slice(0, 12);
            const intentProfile = this.detectIntentProfile(input.keyword) || null;

            return {
                success: true,
                action: 'list_items',
                keyword: input.keyword,
                count: list.length,
                total_items: all.length,
                items: list,
                retry_keywords: retryKeywords,
                full_scan_suggested: emptyWithKeyword,
                full_scan_params: emptyWithKeyword ? { keyword: '', limit: this.config.maxListLimit } : null,
                fallback_all_items: emptyWithKeyword
                    ? this.ensureLinkField(all.slice(0, this.config.maxFallbackAllItems))
                    : [],
                query_insight: {
                    intent_profile: intentProfile,
                    applied_tokens: appliedTokens
                },
                read_only: true
            };
        } catch (error) {
            return { success: false, error: this.text(error?.message || error) || '工具中心查询失败' };
        }
    }
};

window.ToolCenterAiService = ToolCenterAiService;
