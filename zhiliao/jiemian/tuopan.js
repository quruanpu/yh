const ZhiLiaoTuopanModule = {
    state: {
        files: [],
        coupons: [],
        filePreviewUrls: new Set()
    },

    getContainer() {
        return document.getElementById('chat-attachment-tray');
    },

    setFiles(files = []) {
        this.state.files = Array.isArray(files) ? files : [];
        this.render();
    },

    setCoupons(coupons = []) {
        this.state.coupons = Array.isArray(coupons) ? coupons : [];
        this.render();
    },

    cleanupFilePreviewUrls() {
        this.state.filePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        this.state.filePreviewUrls.clear();
    },

    createFilePreviewUrl(file) {
        const url = URL.createObjectURL(file);
        this.state.filePreviewUrls.add(url);
        return url;
    },

    hasItems() {
        return this.state.files.length > 0 || this.state.coupons.length > 0;
    },

    render() {
        const container = this.getContainer();
        if (!container) return;

        this.cleanupFilePreviewUrls();
        container.innerHTML = '';
        if (!this.hasItems()) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        this.state.files.forEach((file, index) => {
            container.appendChild(this.createFileItem(file, index));
        });
        this.state.coupons.forEach((coupon) => {
            container.appendChild(this.createCouponItem(coupon));
        });
    },

    createFileItem(file, index) {
        const isImage = String(file?.type || '').startsWith('image/');
        const item = document.createElement('div');
        item.className = isImage ? 'chat-tray-item chat-tray-image' : 'chat-tray-item chat-tray-file';

        if (isImage) {
            const url = this.createFilePreviewUrl(file);
            const img = document.createElement('img');
            img.className = 'chat-tray-thumb yulan-clickable';
            img.dataset.preview = 'image';
            img.src = url;
            img.alt = file?.name || '图片';
            item.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-file';
            item.appendChild(icon);

            const name = document.createElement('span');
            name.className = 'chat-tray-name';
            name.textContent = file?.name || '文件';
            item.appendChild(name);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'chat-tray-remove';
        removeBtn.type = 'button';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.ZhiLiaoModule?.removeFile?.(index);
        });
        item.appendChild(removeBtn);
        return item;
    },

    createCouponItem(coupon = {}) {
        const item = document.createElement('div');
        item.className = 'chat-tray-item chat-tray-coupon';
        item.dataset.id = String(coupon.id || '');

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-gift';
        item.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'chat-tray-name';
        name.textContent = coupon.name || '活动';
        item.appendChild(name);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'chat-tray-remove';
        removeBtn.type = 'button';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.YhquanYsModule?.removeSelectedCoupon?.(coupon.id);
        });
        item.appendChild(removeBtn);
        return item;
    }
};

window.ZhiLiaoTuopanModule = ZhiLiaoTuopanModule;
