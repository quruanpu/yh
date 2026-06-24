const ZhiLiaoMessageRendererModule = {
    blockPrefix: '@@ZHILIAOMDBLOCK',
    blockSuffix: '@@',

    text(value) {
        if (value === null || value === undefined) return '';
        return String(value);
    },

    escapeHtml(value) {
        return this.text(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    escapeAttr(value) {
        return this.escapeHtml(value)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    decodeBasicEntities(value) {
        return this.text(value)
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    },

    makeToken(index) {
        return `${this.blockPrefix}${index}${this.blockSuffix}`;
    },

    makeInlineToken(kind, index) {
        return `@@ZHILIAOMD${kind}${index}@@`;
    },

    tokenIndex(line = '') {
        const text = String(line || '').trim();
        if (!text.startsWith(this.blockPrefix) || !text.endsWith(this.blockSuffix)) return -1;
        const raw = text.slice(this.blockPrefix.length, -this.blockSuffix.length);
        return /^\d+$/.test(raw) ? Number(raw) : -1;
    },

    addBlock(blocks, html) {
        const token = this.makeToken(blocks.length);
        blocks.push(html);
        return token;
    },

    sanitizeLang(lang = '') {
        const text = String(lang || '').trim();
        return /^[a-zA-Z0-9_-]+$/.test(text) ? text : '';
    },

    protectCodeBlocks(source, blocks) {
        return source.replace(/```([a-zA-Z0-9_-]*)\s*\n?([\s\S]*?)```/g, (_, lang, code) => {
            const className = this.sanitizeLang(lang);
            const html = `<pre><code class="language-${this.escapeAttr(className)}">${this.escapeHtml(String(code || '').trim())}</code></pre>`;
            return `\n${this.addBlock(blocks, html)}\n`;
        });
    },

    splitTableRow(line = '') {
        let text = String(line || '').trim();
        if (text.startsWith('|')) text = text.slice(1);
        if (text.endsWith('|')) text = text.slice(0, -1);

        const cells = [];
        let current = '';
        let escaped = false;

        for (let i = 0; i < text.length; i += 1) {
            const char = text[i];
            if (char === '\\' && !escaped) {
                escaped = true;
                current += char;
                continue;
            }
            if (char === '|' && !escaped) {
                cells.push(current.trim().replace(/\\\|/g, '|'));
                current = '';
                continue;
            }
            current += char;
            escaped = false;
        }

        cells.push(current.trim().replace(/\\\|/g, '|'));
        return cells;
    },

    isSeparatorCell(cell = '') {
        return /^:?-{3,}:?$/.test(String(cell || '').replace(/\s+/g, ''));
    },

    isSeparatorLine(line = '') {
        const cells = this.splitTableRow(line);
        return cells.length >= 2 && cells.every(cell => this.isSeparatorCell(cell));
    },

    getAlignment(cell = '') {
        const text = String(cell || '').replace(/\s+/g, '');
        if (text.startsWith(':') && text.endsWith(':')) return 'center';
        if (text.endsWith(':')) return 'right';
        return 'left';
    },

    isTableRowLine(line = '') {
        const text = String(line || '').trim();
        return text && text.includes('|') && this.tokenIndex(text) < 0;
    },

    canStartTable(lines, index) {
        const header = lines[index] || '';
        const separator = lines[index + 1] || '';
        if (!this.isTableRowLine(header) || !this.isSeparatorLine(separator)) return false;
        return this.splitTableRow(header).length >= 2;
    },

    renderTable(headerLine, separatorLine, rowLines = []) {
        const headers = this.splitTableRow(headerLine);
        const separators = this.splitTableRow(separatorLine);
        const columnCount = Math.max(headers.length, separators.length);
        const alignments = Array.from({ length: columnCount }, (_, index) => this.getAlignment(separators[index] || '---'));
        const classFor = align => align === 'right'
            ? ' align-right'
            : (align === 'center' ? ' align-center' : '');
        const renderCells = (cells, tag) => Array.from({ length: columnCount }, (_, index) => {
            const alignClass = classFor(alignments[index]).trim();
            const classAttr = alignClass ? ` class="${alignClass}"` : '';
            return `<${tag}${classAttr}>${this.renderInline(cells[index] || '')}</${tag}>`;
        }).join('');

        const head = `<thead><tr>${renderCells(headers, 'th')}</tr></thead>`;
        const bodyRows = rowLines.map(line => `<tr>${renderCells(this.splitTableRow(line), 'td')}</tr>`).join('');
        const body = bodyRows ? `<tbody>${bodyRows}</tbody>` : '<tbody></tbody>';
        return `<div class="zhiliao-md-table-wrap"><table class="zhiliao-md-table">${head}${body}</table></div>`;
    },

    protectTables(source, blocks) {
        const lines = source.split('\n');
        const output = [];
        let index = 0;

        while (index < lines.length) {
            if (!this.canStartTable(lines, index)) {
                output.push(lines[index]);
                index += 1;
                continue;
            }

            const header = lines[index];
            const separator = lines[index + 1];
            const rows = [];
            index += 2;

            while (index < lines.length && this.isTableRowLine(lines[index]) && !this.isSeparatorLine(lines[index])) {
                rows.push(lines[index]);
                index += 1;
            }

            output.push(this.addBlock(blocks, this.renderTable(header, separator, rows)));
        }

        return output.join('\n');
    },

    isSafeUrl(url = '') {
        const value = this.decodeBasicEntities(url).trim();
        if (!value) return false;
        const compact = value.replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase();
        if (/^(javascript|data|vbscript|file):/.test(compact)) return false;
        const protocolMatch = compact.match(/^([a-z][a-z0-9+.-]*):/);
        if (!protocolMatch) return true;
        return ['http:', 'https:', 'mailto:', 'tel:'].includes(protocolMatch[1] + ':');
    },

    isSafeImageUrl(url = '') {
        const value = this.decodeBasicEntities(url).trim();
        if (!value || !this.isSafeUrl(value)) return false;
        const compact = value.replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase();
        const protocolMatch = compact.match(/^([a-z][a-z0-9+.-]*):/);
        if (!protocolMatch) return false;
        return ['http:', 'https:'].includes(protocolMatch[1] + ':');
    },

    isSafeDisplayMediaUrl(url = '', tagName = '', attrName = '') {
        const value = this.decodeBasicEntities(url).trim();
        if (!value) return false;
        const compact = value.replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase();
        if (/^(javascript|vbscript|file):/.test(compact)) return false;

        const tag = String(tagName || '').toLowerCase();
        const attr = String(attrName || '').toLowerCase();
        if (attr === 'src' || attr === 'poster') {
            if (compact.startsWith('blob:')) return true;
            if (tag === 'img' && compact.startsWith('data:image/')) return true;
            if ((tag === 'video' || tag === 'source') && compact.startsWith('data:video/')) return true;
            const protocolMatch = compact.match(/^([a-z][a-z0-9+.-]*):/);
            if (!protocolMatch) return true;
            return ['http:', 'https:'].includes(protocolMatch[1] + ':');
        }
        return this.isSafeUrl(value);
    },

    sanitizeInlineStyle(value = '') {
        const styleText = this.text(value);
        if (!styleText) return '';
        if (/expression\s*\(|javascript\s*:|@import|url\s*\(/i.test(styleText)) return '';
        return styleText;
    },

    removeUnsafeDisplayNodes(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        root.querySelectorAll([
            'script',
            'style',
            'iframe',
            'object',
            'embed',
            'meta',
            'base',
            'link'
        ].join(',')).forEach(node => node.remove());
    },

    sanitizeDisplayElement(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return root;
        this.removeUnsafeDisplayNodes(root);
        const elements = [
            ...(root.nodeType === 1 ? [root] : []),
            ...root.querySelectorAll('*')
        ];
        elements.forEach(element => {
            Array.from(element.attributes || []).forEach(attribute => {
                const name = attribute.name;
                const lower = name.toLowerCase();
                if (
                    lower.startsWith('on') ||
                    lower === 'srcdoc' ||
                    lower === 'srcset' ||
                    lower === 'formaction' ||
                    lower === 'contenteditable'
                ) {
                    element.removeAttribute(name);
                    return;
                }

                if (lower === 'style') {
                    const safeStyle = this.sanitizeInlineStyle(attribute.value);
                    if (safeStyle) element.setAttribute(name, safeStyle);
                    else element.removeAttribute(name);
                    return;
                }

                if (['href', 'src', 'poster', 'action', 'xlink:href'].includes(lower)) {
                    if (!this.isSafeDisplayMediaUrl(attribute.value, element.tagName, lower)) {
                        element.removeAttribute(name);
                    }
                }
            });

            if (String(element.tagName || '').toLowerCase() === 'a') {
                const target = String(element.getAttribute('target') || '').toLowerCase();
                if (target === '_blank') {
                    element.setAttribute('rel', 'noopener noreferrer');
                }
            }
        });
        return root;
    },

    sanitizeDisplayHtml(html = '') {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        this.sanitizeDisplayElement(template.content);
        return template.innerHTML;
    },

    renderInline(source = '') {
        const codeBlocks = [];
        const imageBlocks = [];
        let html = this.escapeHtml(source);

        html = html.replace(/`([^`]+)`/g, (_, code) => {
            const token = this.makeInlineToken('CODE', codeBlocks.length);
            codeBlocks.push(`<code>${code}</code>`);
            return token;
        });

        html = html.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_, alt, url) => {
            if (!this.isSafeImageUrl(url)) return alt || '';
            const token = this.makeInlineToken('IMAGE', imageBlocks.length);
            const src = this.decodeBasicEntities(url).trim();
            imageBlocks.push(`<span class="zhiliao-md-image-wrap"><img class="zhiliao-md-image" src="${this.escapeAttr(src)}" alt="${this.escapeAttr(alt)}" loading="lazy" data-preview="image"></span>`);
            return token;
        });

        html = html.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (_, text, url) => {
            if (!this.isSafeUrl(url)) return text;
            const href = this.decodeBasicEntities(url).trim();
            return `<a href="${this.escapeAttr(href)}" target="_blank" rel="noopener noreferrer" style="color: #3d6dff; text-decoration: underline;">${text}</a>`;
        });
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

        codeBlocks.forEach((block, index) => {
            html = html.split(this.makeInlineToken('CODE', index)).join(block);
        });
        imageBlocks.forEach((block, index) => {
            html = html.split(this.makeInlineToken('IMAGE', index)).join(block);
        });

        return html;
    },

    renderBlocks(source, blocks) {
        const lines = source.split('\n');
        const output = [];
        let paragraph = [];
        const flushParagraph = () => {
            if (!paragraph.length) return;
            const raw = paragraph.join('\n');
            const html = this.renderInline(raw).replace(/\n/g, '<br>');
            if (html.trim()) output.push(`<p>${html}</p>`);
            paragraph = [];
        };

        lines.forEach(line => {
            const blockIndex = this.tokenIndex(line);
            if (blockIndex >= 0 && blocks[blockIndex]) {
                flushParagraph();
                output.push(blocks[blockIndex]);
                return;
            }
            if (!String(line || '').trim()) {
                flushParagraph();
                return;
            }
            paragraph.push(line);
        });

        flushParagraph();
        return output.join('');
    },

    renderFinal(text = '') {
        const blocks = [];
        const normalized = this.text(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const withoutCode = this.protectCodeBlocks(normalized, blocks);
        const withoutTables = this.protectTables(withoutCode, blocks);
        return this.renderBlocks(withoutTables, blocks);
    },

    renderStreaming(text = '') {
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    },

    removeUnsafeClipboardNodes(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        root.querySelectorAll([
            'script',
            'style',
            'iframe',
            'object',
            'embed',
            'form',
            'input',
            'button',
            'textarea',
            'select',
            'canvas',
            'svg',
            'video',
            'audio',
            'img',
            '.chart-result',
            '.media-task-card'
        ].join(',')).forEach(node => node.remove());
    },

    sanitizeClipboardElement(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return root;
        this.removeUnsafeClipboardNodes(root);
        const elements = [root, ...root.querySelectorAll('*')];
        elements.forEach(element => {
            Array.from(element.attributes || []).forEach(attribute => {
                const name = attribute.name;
                const lower = name.toLowerCase();
                if (
                    lower.startsWith('on') ||
                    lower.startsWith('data-') ||
                    lower === 'id' ||
                    lower === 'style' ||
                    lower === 'contenteditable'
                ) {
                    element.removeAttribute(name);
                    return;
                }
                if ((lower === 'href' || lower === 'src') && !this.isSafeUrl(attribute.value)) {
                    element.removeAttribute(name);
                }
            });
        });
        return root;
    },

    buildClipboardHtml(element, plainText = '') {
        const raw = this.text(plainText);
        if (raw.trim()) return this.renderFinal(raw);
        if (!element || typeof element.cloneNode !== 'function') return '';
        const clone = element.cloneNode(true);
        this.sanitizeClipboardElement(clone);
        return String(clone.innerHTML || '').trim();
    }
};

window.ZhiLiaoMessageRendererModule = ZhiLiaoMessageRendererModule;
