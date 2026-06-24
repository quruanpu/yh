const ZhiLiaoZjgMeitiCelueModule = (() => {
    const MEDIA_TOOLS = {
        generate_or_edit_image: 'image',
        generate_video: 'video',
        generate_chart_from_statistics: 'chart'
    };

    const AWAIT_HINTS = [
        '\u5e76\u5206\u6790',
        '\u5e76\u8bf4\u660e',
        '\u5e76\u89e3\u91ca',
        '\u5e76\u89e3\u8bfb',
        '\u5e76\u603b\u7ed3',
        '\u5e76\u8bc4\u4ef7',
        '\u751f\u6210\u540e',
        '\u5b8c\u6210\u540e',
        '\u7136\u540e\u5206\u6790',
        '\u7136\u540e\u8bf4\u660e',
        '\u7136\u540e\u89e3\u8bfb',
        '\u7136\u540e\u603b\u7ed3',
        '\u7136\u540e\u56de\u590d',
        '\u518d\u5206\u6790',
        '\u518d\u8bf4\u660e',
        '\u518d\u89e3\u8bfb',
        '\u518d\u603b\u7ed3',
        '\u518d\u56de\u590d',
        '\u8d8b\u52bf\u539f\u56e0',
        '\u539f\u56e0\u5206\u6790',
        '\u7ed3\u8bba',
        '\u62a5\u544a',
        '\u89e3\u8bfb',
        '\u5206\u6790\u4e00\u4e0b',
        '\u8bf4\u660e\u4e00\u4e0b'
    ];
    const CHART_AWAIT_HINTS = [
        '\u5206\u6790',
        '\u89e3\u8bfb',
        '\u8d8b\u52bf',
        '\u539f\u56e0',
        '\u7ed3\u8bba',
        '\u62a5\u544a'
    ];
    const AWAIT_PATTERNS = [
        /(?:\u751f\u6210|\u5b8c\u6210).{0,30}\u540e.{0,30}(?:\u5206\u6790|\u8bf4\u660e|\u89e3\u8bfb|\u89e3\u91ca|\u603b\u7ed3|\u56de\u590d|\u5199|\u6587\u6848|\u62a5\u544a)/,
        /(?:\u505a\u5b8c|\u751f\u6210\u597d).{0,30}(?:\u5206\u6790|\u8bf4\u660e|\u89e3\u8bfb|\u603b\u7ed3|\u56de\u590d|\u5199|\u6587\u6848|\u62a5\u544a)/
    ];

    const methods = {
        getMediaArtifactKind(toolName) {
            return MEDIA_TOOLS[String(toolName || '').trim()] || '';
        },

        isMediaArtifactToolName(toolName) {
            return !!this.getMediaArtifactKind(toolName);
        },

        normalizeDeliveryMode(value = '') {
            const text = String(value || '').trim().toLowerCase();
            if (text === 'await_then_reply' || text === 'wait_then_reply' || text === 'reply_after_ready') {
                return 'await_then_reply';
            }
            return 'card_only';
        },

        hasAwaitDeliveryIntent(text = '') {
            const content = String(text || '').trim();
            if (!content) return false;
            if (AWAIT_HINTS.some((hint) => content.includes(hint))) return true;
            return AWAIT_PATTERNS.some((pattern) => pattern.test(content));
        },

        inferDeliveryMode(toolName, params = {}, contextText = '') {
            const explicit = this.normalizeDeliveryMode(params?.delivery_mode || params?.deliveryMode);
            if (params && Object.prototype.hasOwnProperty.call(params, 'delivery_mode')) return explicit;
            if (params && Object.prototype.hasOwnProperty.call(params, 'deliveryMode')) return explicit;

            const text = String(contextText || '').trim();
            if (this.hasAwaitDeliveryIntent(text)) return 'await_then_reply';

            const kind = this.getMediaArtifactKind(toolName);
            if (kind === 'chart' && CHART_AWAIT_HINTS.some((hint) => text.includes(hint))) return 'await_then_reply';
            return 'card_only';
        },

        buildMediaTaskPolicy(toolName, params = {}, contextText = '') {
            const kind = this.getMediaArtifactKind(toolName);
            if (!kind) return null;
            return {
                toolName: String(toolName || '').trim(),
                kind,
                deliveryMode: this.inferDeliveryMode(toolName, params, contextText)
            };
        }
    };

    return {
        methods,
        applyTo(appModule) {
            if (!appModule || typeof appModule !== 'object') return appModule;
            Object.assign(appModule, methods);
            return appModule;
        }
    };
})();

window.ZhiLiaoZjgMeitiCelueModule = ZhiLiaoZjgMeitiCelueModule;
