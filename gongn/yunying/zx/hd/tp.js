// Copy the main data table in BI operation dialogs as a PNG image.
const YejiHudongTupian = {
    html2canvasUrl: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    html2canvasPromise: null,

    async copy(dialog, button = null) {
        if (!dialog) return;
        const originalHtml = button?.innerHTML || '';
        try {
            const canvas = await this.renderCanvas(dialog);
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            }
            const blob = await this.canvasToBlob(canvas);
            await this.writeClipboard(blob);
            this.toast('表格图片已复制', 'success');
        } catch (error) {
            console.error('[yeji] 表格图片复制失败', error);
            this.toast(error.message || '表格图片复制失败', 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalHtml;
            }
        }
    },

    async renderCanvas(dialog) {
        const html2canvas = await this.ensureHtml2Canvas();
        const table = this.findTable(dialog);
        if (!table) throw new Error('未找到可复制的表格');

        const shell = this.buildTableShell(table);
        document.body.appendChild(shell);
        try {
            const size = this.normalizeTableShell(shell);
            return await html2canvas(shell, {
                backgroundColor: '#ffffff',
                scale: Math.min(2, window.devicePixelRatio || 1),
                width: size.width,
                height: size.height,
                windowWidth: size.width,
                windowHeight: size.height,
                useCORS: true,
                logging: false
            });
        } finally {
            shell.remove();
        }
    },

    findTable(dialog) {
        return dialog?.querySelector?.('.yeji-batch-table, .yeji-trend-table, .yeji-table') || null;
    },

    buildTableShell(table) {
        const shell = document.createElement('div');
        shell.className = 'yeji-table-capture-shell';
        shell.style.position = 'fixed';
        shell.style.left = '-100000px';
        shell.style.top = '0';
        shell.style.padding = '0';
        shell.style.margin = '0';
        shell.style.background = '#ffffff';
        shell.style.overflow = 'visible';
        shell.appendChild(table.cloneNode(true));
        return shell;
    },

    normalizeTableShell(shell) {
        const table = shell.querySelector('table');
        this.normalizeTable(table);
        const width = Math.ceil(Math.max(table?.scrollWidth || 0, table?.offsetWidth || 0, table?.getBoundingClientRect?.().width || 0, shell.scrollWidth));
        const height = Math.ceil(Math.max(table?.scrollHeight || 0, table?.offsetHeight || 0, table?.getBoundingClientRect?.().height || 0, shell.scrollHeight));
        shell.style.width = `${width}px`;
        shell.style.height = `${height}px`;
        return { width, height };
    },

    normalizeTable(table) {
        if (!table) return;
        table.style.width = 'max-content';
        table.style.minWidth = 'max-content';
        table.style.margin = '0';
        table.style.position = 'static';
        table.style.left = 'auto';
        table.style.top = 'auto';

        table.querySelectorAll('th, td').forEach(cell => {
            cell.style.position = 'static';
            cell.style.left = 'auto';
            cell.style.right = 'auto';
            cell.style.zIndex = 'auto';
            cell.style.boxShadow = 'none';
        });

        table.querySelectorAll('.yeji-trend-table td:last-child').forEach(cell => {
            cell.style.maxWidth = 'none';
            cell.style.overflow = 'visible';
            cell.style.textOverflow = 'clip';
        });

        table.querySelectorAll('.yeji-batch-merge-toggle, .yeji-batch-merge-toggle span, .yeji-batch-child-name').forEach(el => {
            el.style.maxWidth = 'none';
            el.style.overflow = 'visible';
            el.style.textOverflow = 'clip';
            el.style.whiteSpace = 'nowrap';
        });
    },

    ensureHtml2Canvas() {
        if (window.html2canvas) return Promise.resolve(window.html2canvas);
        if (this.html2canvasPromise) return this.html2canvasPromise;
        this.html2canvasPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${this.html2canvasUrl}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(window.html2canvas), { once: true });
                existing.addEventListener('error', () => reject(new Error('图片复制组件加载失败')), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = this.html2canvasUrl;
            script.onload = () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error('图片复制组件未初始化'));
            script.onerror = () => reject(new Error('图片复制组件加载失败'));
            document.head.appendChild(script);
        }).catch(error => {
            this.html2canvasPromise = null;
            throw error;
        });
        return this.html2canvasPromise;
    },

    canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('图片生成失败'));
            }, 'image/png');
        });
    },

    async writeClipboard(blob) {
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
            throw new Error('当前浏览器不支持直接复制图片');
        }
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
    },

    toast(message, type = 'info') {
        if (window.YejiModule?._showToast) {
            window.YejiModule._showToast(message, type);
            return;
        }
        if (window.Tongzhi?.[type]) window.Tongzhi[type](message);
        else alert(message);
    }
};

window.YejiHudongTupian = YejiHudongTupian;
