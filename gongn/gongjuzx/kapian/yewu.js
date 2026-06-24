// 工具中心模块 - 卡片渲染
const GongjuzxKapianYewu = {
    renderCard(item) {
        const escape = window.GongjuzxGongju?.escapeHtml
            ? GongjuzxGongju.escapeHtml.bind(GongjuzxGongju)
            : (text) => String(text ?? '');

        const id = escape(item?.id || '');
        const name = escape(item?.name || '未命名网站');
        const url = escape(item?.url || '');
        const description = escape(item?.description || '暂无描述');
        const manageActions = item?.can_manage ? `
                        <button class="gongjuzx-card-btn" data-action="delete" data-id="${id}" type="button">
                            删除
                        </button>
                        <button class="gongjuzx-card-btn" data-action="edit" data-id="${id}" type="button">
                            编辑
                        </button>
        ` : '';

        return `
            <article class="gongjuzx-card" data-id="${id}">
                <div class="gongjuzx-card-head">
                    <div class="gongjuzx-card-title">${name}</div>
                    <div class="gongjuzx-card-actions">
                        ${manageActions}
                        <button class="gongjuzx-card-btn" data-action="visit" data-id="${id}" type="button">
                            访问
                        </button>
                    </div>
                </div>
                <div class="gongjuzx-card-url">${url}</div>
                <div class="gongjuzx-card-desc" data-desc="${description}" data-id="${id}">${description}</div>
            </article>
        `;
    },

    renderList(items = []) {
        if (!Array.isArray(items) || items.length === 0) {
            return `
                <div class="gongjuzx-empty">
                    <i class="fa-regular fa-folder-open"></i>
                    <p class="gongjuzx-empty-text">暂无资源，点击右下角添加</p>
                </div>
            `;
        }

        return items.map((item) => this.renderCard(item)).join('');
    }
};

window.GongjuzxKapianYewu = GongjuzxKapianYewu;
