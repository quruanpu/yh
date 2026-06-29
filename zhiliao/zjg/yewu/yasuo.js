const ZhiLiaoZjgYasuoModule = (() => {
    const methods = {
        formatTriedReason(reasonText) {
            const raw = String(reasonText || '').trim();
            if (!raw) return '';

            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    const message = String(parsed.message || parsed.error || '').trim();
                    if (message) return message;
                }
            } catch {
                // ignore
            }

            return raw.replace(/\s+/g, ' ').slice(0, 180);
        },

        isImageToolName(name) {
            return this.getMediaArtifactKind?.(name) === 'image';
        },

        isVideoToolName(name) {
            return this.getMediaArtifactKind?.(name) === 'video';
        },

        isMediaUnderstandingToolName(name) {
            const toolName = String(name || '').trim();
            return toolName === 'understand_image' || toolName === 'understand_video';
        },

        isChartToolName(name) {
            return this.getMediaArtifactKind?.(name) === 'chart';
        },

        inferImageToolAction(functionArgs = {}) {
            const actionText = String(functionArgs?.action || '').trim().toLowerCase();
            if (actionText === 'edit' || actionText === 'edits') return 'edit';
            if (
                actionText === 'generate' ||
                actionText === 'generation' ||
                actionText === 'generations' ||
                actionText === 'create'
            ) {
                return 'generate';
            }

            const hasImages =
                (Array.isArray(functionArgs?.images) && functionArgs.images.length > 0) ||
                (Array.isArray(functionArgs?.image) && functionArgs.image.length > 0) ||
                (Array.isArray(functionArgs?.image_urls) && functionArgs.image_urls.length > 0) ||
                (typeof functionArgs?.image_url === 'string' && functionArgs.image_url.trim()) ||
                (typeof functionArgs?.image_base64 === 'string' && functionArgs.image_base64.trim()) ||
                (typeof functionArgs?.imageBase64 === 'string' && functionArgs.imageBase64.trim()) ||
                (typeof functionArgs?.image_ref === 'string' && functionArgs.image_ref.trim()) ||
                (Array.isArray(functionArgs?.image_refs) && functionArgs.image_refs.length > 0);

            return hasImages ? 'edit' : 'generate';
        },

        getToolTip(functionName, functionArgs = {}) {
            if (this.isImageToolName(functionName)) {
                const action = this.inferImageToolAction(functionArgs);
                return {
                    icon: 'fa-image',
                    text: action === 'edit'
                        ? '正在编辑图片（可能耗时较长，请耐心等待）...'
                        : '正在生成图片（可能耗时较长，请耐心等待）...'
                };
            }

            if (this.isVideoToolName(functionName)) {
                return {
                    icon: 'fa-film',
                    text: '正在生成视频（可能耗时较长，请耐心等待）...'
                };
            }

            const toolTips = {
                'get_file_list': { icon: 'fa-folder-open', text: '正在查看文件列表...' },
                'describe_file_structure': { icon: 'fa-diagram-project', text: '正在分析文件结构...' },
                'get_file_content': { icon: 'fa-file-lines', text: '正在查看文件内容...' },
                'read_file_chunk': { icon: 'fa-file-lines', text: '正在分段读取文件...' },
                'search_file_content': { icon: 'fa-magnifying-glass', text: '正在定位文件内容...' },
                'search_files': { icon: 'fa-magnifying-glass', text: '正在搜索文件...' },
                'generate_chart_from_statistics': { icon: 'fa-chart-pie', text: '正在生成统计图表...' },
                'search_product': { icon: 'fa-pills', text: '正在查询商品...' },
                'understand_image': { icon: 'fa-eye', text: '正在理解图片内容...' },
                'understand_video': { icon: 'fa-film', text: '正在理解视频内容...' },
                'understand_product_image': { icon: 'fa-camera-retro', text: '正在理解图片内容...' },
                'manage_notebook_node': { icon: 'fa-book', text: '正在操作记事本...' },
                'manage_tool_center_item': { icon: 'fa-toolbox', text: '正在查询工具中心...' },
                'search_web': { icon: 'fa-globe', text: '正在联网搜索...' },
                'fetch_web_page': { icon: 'fa-link', text: '正在抓取网页内容...' }
            };

            return toolTips[functionName] || { icon: 'fa-spinner fa-spin', text: '正在处理中...' };
        },

        sanitizeHistoryImageUrl(value) {
            const raw = typeof value === 'string' ? value : '';
            if (!raw) return '';
            if (/^data:/i.test(raw)) return `[image-data:${raw.length}]`;
            if (/^https?:\/\//i.test(raw)) return '[image-url]';
            return raw;
        },

        summarizeMediaArgumentValue(value, kind = 'media') {
            const text = String(value || '').trim();
            if (!text) return '';
            if (/^data:/i.test(text)) return `[${kind}-data:${text.length}]`;
            if (/^https?:\/\//i.test(text)) return `[${kind}-url]`;
            if (text.length > 240) return `${text.slice(0, 240)}...`;
            return text;
        },

        summarizeMediaArgumentList(list = [], kind = 'image') {
            if (!Array.isArray(list)) return [];
            return list.slice(0, 8).map((item) => {
                if (typeof item === 'string') return this.summarizeMediaArgumentValue(item, kind);
                if (!item || typeof item !== 'object') return '';
                return {
                    image_url: this.summarizeMediaArgumentValue(item.image_url || item.url, 'image'),
                    video_url: this.summarizeMediaArgumentValue(item.video_url, 'video'),
                    ref: String(item.ref || item.image_ref || item.video_ref || '').trim()
                };
            }).filter(Boolean);
        },

        compactChartToolArgumentsForHistory(args = {}) {
            const compact = {
                chart_type: args.chart_type || args.chartType || args.type || '',
                title: args.title || '',
                subtitle: args.subtitle || '',
                dimensions: Array.isArray(args.dimensions) ? args.dimensions.slice(0, 8) : [],
                measures: Array.isArray(args.measures) ? args.measures.slice(0, 8) : [],
                x_field: args.x_field || args.xField || '',
                y_field: args.y_field || args.yField || '',
                group_field: args.group_field || args.groupField || '',
                stack: Boolean(args.stack),
                width: args.width,
                height: args.height,
                delivery_mode: args.delivery_mode || args.deliveryMode || ''
            };

            if (Array.isArray(args.labels)) compact.labels = args.labels.slice(0, 30);
            if (Array.isArray(args.values)) compact.values = args.values.slice(0, 30);
            if (Array.isArray(args.series)) {
                compact.series = args.series.slice(0, 8).map((item) => ({
                    name: item?.name || '',
                    data: Array.isArray(item?.data) ? item.data.slice(0, 30) : []
                }));
            }
            if (Array.isArray(args.rows)) {
                compact.rows = args.rows.slice(0, 20);
                if (args.rows.length > 20) compact.rows_omitted = args.rows.length - 20;
            }
            return compact;
        },

        compactMediaToolArgumentsForHistory(functionName, args = {}) {
            if (this.isChartToolName(functionName)) {
                return this.compactChartToolArgumentsForHistory(args);
            }

            const isVideo = this.isVideoToolName(functionName);
            const compact = {
                action: args.action || (isVideo ? 'generate' : ''),
                prompt: String(args.prompt || '').slice(0, 1200),
                size: args.size || '',
                quality: args.quality || '',
                delivery_mode: args.delivery_mode || args.deliveryMode || ''
            };

            if (isVideo) {
                compact.duration = args.duration || '';
                compact.resolution = args.resolution || '';
                compact.mode = args.mode || args.video_mode || '';
            } else {
                compact.output_format = args.output_format || '';
                compact.background = args.background || '';
            }

            const imageRef = String(args.image_ref || '').trim();
            const videoRef = String(args.video_ref || '').trim();
            if (imageRef) compact.image_ref = this.summarizeMediaArgumentValue(imageRef, 'image');
            if (videoRef) compact.video_ref = this.summarizeMediaArgumentValue(videoRef, 'video');
            if (Array.isArray(args.image_refs)) compact.image_refs = args.image_refs.slice(0, 8).map((item) => this.summarizeMediaArgumentValue(item, 'image'));
            if (Array.isArray(args.video_refs)) compact.video_refs = args.video_refs.slice(0, 8).map((item) => this.summarizeMediaArgumentValue(item, 'video'));

            const directImages = this.summarizeMediaArgumentList(args.images, 'image');
            const directImageUrls = this.summarizeMediaArgumentList(args.image_urls, 'image');
            if (directImages.length > 0) compact.images = directImages;
            if (directImageUrls.length > 0) compact.image_urls = directImageUrls;
            if (args.image_url) compact.image_url = this.summarizeMediaArgumentValue(args.image_url, 'image');
            if (args.first_frame) compact.first_frame = this.summarizeMediaArgumentValue(args.first_frame, 'image');
            if (args.last_frame) compact.last_frame = this.summarizeMediaArgumentValue(args.last_frame, 'image');
            if (args.mask) compact.mask = '[mask-provided]';
            return compact;
        },

        compactToolCallArgumentsForHistory(functionName, rawArguments = '') {
            const text = typeof rawArguments === 'string' ? rawArguments : JSON.stringify(rawArguments || {});
            if (!this.isMediaArtifactToolName?.(functionName)) return text;

            try {
                const args = typeof rawArguments === 'string'
                    ? JSON.parse(rawArguments || '{}')
                    : (rawArguments && typeof rawArguments === 'object' ? rawArguments : {});
                return JSON.stringify(this.compactMediaToolArgumentsForHistory(functionName, args));
            } catch {
                return '{}';
            }
        },

        extractFirstProductImageUrl(product) {
            if (!product || typeof product !== 'object') return '';
            const candidates = [
                product.image_url,
                product.logoUrl,
                product.logo,
                product.drugLogo
            ];
            if (Array.isArray(product.image_urls)) candidates.push(...product.image_urls);
            if (Array.isArray(product.picUrlList)) candidates.push(...product.picUrlList);

            for (let i = 0; i < candidates.length; i += 1) {
                const item = String(candidates[i] || '').trim();
                if (/^https?:\/\//i.test(item)) return item;
                if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(item)) return item;
            }
            return '';
        },

        compactProductItemForHistory(product) {
            const row = product && typeof product === 'object' ? product : {};
            const imageUrl = this.extractFirstProductImageUrl(row);
            return {
                wholesaleId: row.wholesaleId,
                drugId: row.drugId,
                provDrugCode: row.provDrugCode || '',
                drugName: row.drugName || '',
                appName: row.appName || '',
                pack: row.pack || '',
                approval: row.approval || '',
                factoryName: row.factoryName || '',
                wholesaleType: row.wholesaleType,
                wholesaleTypeName: row.wholesaleTypeName || '',
                status: row.status,
                statusName: row.statusName || '',
                unitPrice: row.unitPrice,
                chainPrice: row.chainPrice,
                stockAvailable: row.stockAvailable,
                validDate: row.validDate || '',
                providerName: row.providerName || '',
                image_url: this.sanitizeHistoryImageUrl(imageUrl)
            };
        },

        compactProductToolResultForHistory(functionName, result) {
            if (!result || typeof result !== 'object') return result;
            if (result.success !== true) {
                return {
                    success: false,
                    error: this.extractReadableError(result.error, '').slice(0, 220)
                };
            }

            const products = Array.isArray(result.products) ? result.products : [];
            const sampleSize = 8;
            const sampledProducts = products.slice(0, sampleSize).map((item) => this.compactProductItemForHistory(item));
            const resolvedImageUrl = this.extractReadableError(result.image_url, '') ||
                this.extractFirstProductImageUrl(products[0] || {});

            const output = {
                success: true,
                tool: functionName,
                count: Number(result.count || products.length || 0),
                total_products: products.length,
                sampled_products: sampledProducts.length,
                products: sampledProducts,
                summary: result.summary && typeof result.summary === 'object' ? result.summary : null,
                image_url: this.sanitizeHistoryImageUrl(resolvedImageUrl)
            };

            const imageRefs = Array.isArray(result.image_refs)
                ? result.image_refs.map((item) => String(item || '').trim()).filter(Boolean)
                : [];
            const imageRef = String(result.image_ref || result.first_card_image_ref || '').trim();
            if (imageRef && imageRefs.indexOf(imageRef) < 0) imageRefs.unshift(imageRef);
            if (imageRefs.length > 0) {
                output.image_ref = imageRefs[0];
                output.image_refs = imageRefs.slice(0, 8);
                output.image_pool_hint = `商品图片已登记为 ${output.image_ref}，生成/编辑图片时可传 image_ref。`;
            }

            if (typeof result.matched_keyword === 'string' && result.matched_keyword.trim()) {
                output.matched_keyword = result.matched_keyword.trim();
            }
            if (typeof result.matched_type === 'string' && result.matched_type.trim()) {
                output.matched_type = result.matched_type.trim();
            }
            if (result.recognized && typeof result.recognized === 'object') {
                output.recognized = { ...result.recognized };
            }
            if (products.length > sampleSize) {
                output.note = `历史上下文已压缩，仅保留前 ${sampleSize} 条商品。`;
            }
            return output;
        },

        compactCouponToolResultForHistory(result) {
            if (!result || typeof result !== 'object') return result;
            if (result.success !== true) {
                return {
                    success: false,
                    error: this.extractReadableError(result.error || result.message, '').slice(0, 220)
                };
            }

            const coupons = Array.isArray(result.coupons) ? result.coupons : [];
            const sampleSize = 12;
            return {
                success: true,
                tool: 'query_coupon',
                card_type: result.card_type || '',
                count: Number(result.count || coupons.length || 0),
                sampled_coupons: coupons.slice(0, sampleSize).map((coupon) => ({
                    id: coupon?.id || '',
                    name: coupon?.name || coupon?.keyword || '',
                    keyword: coupon?.keyword || '',
                    totalLimit: Number(coupon?.totalLimit || 0),
                    storeLimit: Number(coupon?.storeLimit || 0),
                    activityCount: Number(coupon?.activityCount || 0)
                })),
                display: '优惠券活动卡片已由前端展示；如需说明，只需简要提示用户可点选卡片后继续发券。'
            };
        },

        compactToolResultForHistory(functionName, result) {
            if (!result || typeof result !== 'object') return result;
            if (this.isChartToolName(functionName)) {
                if (result.success) {
                    const imageUrl = typeof result.image_url === 'string' ? result.image_url : '';
                    return {
                        success: true,
                        tool: functionName,
                        chart_type: result.chart_type || '',
                        width: Number(result.width || 0),
                        height: Number(result.height || 0),
                        description: result.description || '图表已生成',
                        image_ready: Boolean(imageUrl),
                        display: '图表已由前端卡片展示，最终回复只需说明图表含义，不要输出 Markdown 图片、相对图片路径、data URL 或 base64。'
                    };
                }
                return {
                    success: false,
                    tool: functionName,
                    error: this.extractReadableError(result.error, '').slice(0, 220)
                };
            }
            if (functionName === 'search_product' || functionName === 'understand_product_image') {
                return this.compactProductToolResultForHistory(functionName, result);
            }
            if (functionName === 'query_coupon') {
                return this.compactCouponToolResultForHistory(result);
            }
            if (this.isMediaUnderstandingToolName(functionName)) {
                if (result.success) {
                    return {
                        success: true,
                        tool: functionName,
                        media_kind: result.media_kind || (functionName === 'understand_video' ? 'video' : 'image'),
                        answer: String(result.answer || result.content || '').slice(0, 1200),
                        capability: result.capability || '',
                        model: result.model || '',
                        config_id: result.config_id || '',
                        config_name: result.config_name || ''
                    };
                }
                return {
                    success: false,
                    tool: functionName,
                    media_kind: result.media_kind || (functionName === 'understand_video' ? 'video' : 'image'),
                    error: this.extractReadableError(result.error, '').slice(0, 220)
                };
            }
            if (this.isVideoToolName(functionName)) {
                if (result.success) {
                    const videoUrl = typeof result.video_url === 'string' ? result.video_url : '';
                    return {
                        success: true,
                        action: result.action || 'generate',
                        route: result.route || 'video_generation',
                        model: result.model || '',
                        config_id: result.config_id || '',
                        config_name: result.config_name || '',
                        status_code: Number(result.status_code || 0),
                        video_count: Array.isArray(result.videos) ? result.videos.length : (videoUrl ? 1 : 0),
                        video_id: result.video_id || '',
                        task_id: result.task_id || '',
                        status: result.status || ''
                    };
                }

                return {
                    success: false,
                    error: this.extractReadableError(result.error, '').slice(0, 220),
                    status_code: Number(result.status_code || 0)
                };
            }

            if (!this.isImageToolName(functionName)) return result;

            const rawImageUrl = typeof result.image_url === 'string' ? result.image_url : '';

            if (result.success) {
                const refs = Array.isArray(result.image_refs)
                    ? result.image_refs.map((item) => String(item || '').trim()).filter(Boolean)
                    : [];
                const headRef = String(result.image_ref || '').trim();
                if (headRef && refs.indexOf(headRef) < 0) refs.unshift(headRef);

                return {
                    success: true,
                    action: result.action || '',
                    route: result.route || '',
                    model: result.model || '',
                    config_id: result.config_id || '',
                    config_name: result.config_name || '',
                    status_code: Number(result.status_code || 0),
                    description: result.description || '图片已生成',
                    image_ref: refs[0] || '',
                    image_refs: refs,
                    image_pool_hint: String(result.image_pool_hint || ''),
                    image_count: Array.isArray(result.image_urls)
                        ? result.image_urls.length
                        : (rawImageUrl ? 1 : 0)
                };
            }

            const attempts = Array.isArray(result.attempts)
                ? result.attempts.slice(0, 3).map((item) => ({
                    config_id: item?.config_id || '',
                    model: item?.model || '',
                    status: Number(item?.status || 0),
                    message: this.extractReadableError(item?.message, '').slice(0, 180)
                }))
                : [];

            return {
                success: false,
                error: this.extractReadableError(result.error, '').slice(0, 220),
                status_code: Number(result.status_code || 0),
                attempts
            };
        },

        getImageToolFailureMessage(result) {
            const direct = this.extractReadableError(result?.error, '').trim();
            const attempts = Array.isArray(result?.attempts) ? result.attempts : [];
            if (direct) {
                if (attempts.length > 0) {
                    const first = attempts[0] || {};
                    const model = String(first.model || '').trim();
                    const status = Number(first.status || 0);
                    const tag = [model ? `model=${model}` : '', status > 0 ? `status=${status}` : '']
                        .filter(Boolean)
                        .join(', ');
                    if (tag) return `${direct} (${tag})`;
                }
                return direct;
            }
            if (attempts.length > 0) {
                const last = attempts[attempts.length - 1] || {};
                const msg = this.extractReadableError(last.message, '').trim();
                if (msg) return msg;
                const status = Number(last.status || 0);
                if (status > 0) return `HTTP ${status}`;
            }

            const statusCode = Number(result?.status_code || 0);
            if (statusCode > 0) return `HTTP ${statusCode}`;
            return '未返回有效图片结果';
        },

        getVideoToolFailureMessage(result) {
            const direct = this.extractReadableError(result?.error, '').trim();
            if (direct) return direct;
            if ((result?.video_id || result?.task_id) && !result?.video_url) {
                const status = this.extractReadableError(result?.status, '').trim();
                return status
                    ? `视频任务已创建，但暂未返回可播放链接。当前状态：${status}`
                    : '视频任务已创建，但暂未返回可播放链接';
            }
            const statusCode = Number(result?.status_code || 0);
            if (statusCode > 0) return `HTTP ${statusCode}`;
            return '未返回有效视频结果';
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

window.ZhiLiaoZjgYasuoModule = ZhiLiaoZjgYasuoModule;
