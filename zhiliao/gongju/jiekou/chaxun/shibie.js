/**
 * 商品查询模块 - 图片识别
 *
 * 职责：
 * 1. 提供药品识别系统提示词
 * 2. 调用AI识别图片中的药品信息
 * 3. 解析识别结果并构建候选关键词
 * 4. 级联查询（按优先级依次尝试）
 */

const ChaxunShibieModule = {
    // 配置
    config: {
        // 识别系统提示词
        systemPrompt: `你是药品识别专家，请从图片中提取可查询的信息。

返回JSON：{"code":"","drugId":"","approval":"","name":"","factory":""}

字段说明：
- code: 商品编码（2位字母开头+数字，排除价格/条形码/批号）
- drugId: 药品ID（7位纯数字）
- approval: 批准文号（国药准字等完整编号）
- name: 药品名称（通用名或商品名，不含规格剂型）
- factory: 生产厂家（完整企业名称）

请运用你的药品行业知识智能判断每个字段，只填写图片中实际看到的完整信息，不确定的留空。
只返回JSON。`,

        // 用户提示词
        userPrompt: '请识别图片中的药品信息，返回JSON格式，只填写能识别到的字段，其他留空字符串。',

        // AI模型配置
        model: 'glm-4.6v',
        maxTokens: 300,
        temperature: 0.2
    },

    /**
     * 处理图片查询
     * @param {string} keyword - 用户输入的关键词（可选）
     * @param {Array} imageFiles - 图片文件列表
     * @param {Object} callbacks - 回调函数 { onStatus, onQuery, onError, onSuccess, onFail }
     */
    async handleImageQuery(keyword, imageFiles, callbacks = {}) {
        const { onStatus, onQuery, onError, onSuccess, onFail } = callbacks;

        try {
            // 1. 解析图片文件
            onStatus?.('正在识别图片...');

            if (!window.ZhiLiaoModule) {
                throw new Error('智聊模块未加载');
            }

            const parseData = await ZhiLiaoModule.parseFiles(imageFiles);
            const fileIds = parseData.fileIds;

            // 2. 构建多模态内容
            const userContent = await ZhiLiaoModule.buildMultimodalContent(
                this.config.userPrompt,
                imageFiles,
                fileIds
            );

            // 3. 调用AI识别
            onStatus?.('AI分析中...');

            const aiResponse = await this.callAI(userContent);
            console.log('AI原始返回:', aiResponse);

            // 4. 解析识别结果
            const drugInfo = this.parseResponse(aiResponse);
            console.log('解析后drugInfo:', drugInfo);

            // 5. 构建候选关键词列表
            const candidates = this.buildCandidates(keyword, drugInfo);
            console.log('查询候选列表:', candidates);

            if (candidates.length === 0) {
                onFail?.('无法识别图片中的药品信息，请重新拍摄清晰图片');
                return { success: false, error: '无法识别' };
            }

            // 6. 级联查询
            return await this.cascadeQuery(candidates, { onQuery, onSuccess, onFail });

        } catch (error) {
            console.error('图片查询失败:', error);
            onError?.(error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * 调用AI识别
     */
    async callAI(userContent) {
        const response = await fetch(ZhiLiaoModule.config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZhiLiaoModule.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    { role: 'system', content: this.config.systemPrompt },
                    { role: 'user', content: userContent }
                ],
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
                stream: false,
                thinking: { type: 'disabled' }
            })
        });

        const result = await response.json();
        return result.choices?.[0]?.message?.content?.trim() || '';
    },

    /**
     * 解析AI返回的JSON
     */
    parseResponse(aiResponse) {
        const defaultInfo = { code: '', drugId: '', approval: '', name: '', factory: '' };

        try {
            // 移除markdown代码块标记
            let cleanResponse = aiResponse
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();

            // 提取JSON部分
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return { ...defaultInfo, ...JSON.parse(jsonMatch[0]) };
            }
        } catch (e) {
            console.error('JSON解析失败:', e, '原始内容:', aiResponse);
        }

        // 解析失败，尝试使用返回内容作为名称
        if (aiResponse) {
            return { ...defaultInfo, name: aiResponse };
        }

        return defaultInfo;
    },

    /**
     * 构建候选关键词列表（按优先级排序）
     */
    buildCandidates(keyword, drugInfo) {
        const candidates = [];

        // 验证函数（排除价格格式）
        const isNotPrice = (value) => {
            if (!value) return false;
            if (/^\d+\.\d+$/.test(value)) return false; // 如 168.50
            if (/^[¥￥$€£]\d/.test(value)) return false; // 如 ¥99
            return true;
        };

        // 按优先级添加：用户指定 > 商品编码 > 商品ID > 批准文号 > 药品名称 > 厂家
        if (keyword) {
            candidates.push({ keyword: keyword.trim(), type: '用户指定' });
        }
        if (drugInfo.code && isNotPrice(drugInfo.code)) {
            candidates.push({ keyword: drugInfo.code.trim(), type: '商品编码' });
        }
        if (drugInfo.drugId && isNotPrice(drugInfo.drugId)) {
            candidates.push({ keyword: drugInfo.drugId.trim(), type: '商品ID' });
        }
        if (drugInfo.approval && drugInfo.approval.length >= 5 && isNotPrice(drugInfo.approval)) {
            candidates.push({ keyword: drugInfo.approval.trim(), type: '批准文号' });
        }
        if (drugInfo.name && drugInfo.name.trim()) {
            candidates.push({ keyword: drugInfo.name.trim(), type: '药品名称' });
        }
        if (drugInfo.factory && drugInfo.factory.trim()) {
            candidates.push({ keyword: drugInfo.factory.trim(), type: '厂家' });
        }

        return candidates;
    },

    /**
     * 级联查询（依次尝试每个候选关键词）
     */
    async cascadeQuery(candidates, callbacks = {}) {
        const { onQuery, onSuccess, onFail } = callbacks;

        for (let i = 0; i < candidates.length; i++) {
            const { keyword, type } = candidates[i];
            console.log(`尝试第${i + 1}个关键词:`, keyword, '类型:', type);

            // 显示当前查询状态
            onQuery?.(keyword, type);

            // 尝试查询
            const result = await GongjuApi.searchProducts(keyword, [], -1);

            if (result.success && result.data && result.data.length > 0) {
                console.log('查询成功，使用关键词:', keyword);

                // 按销售金额排序
                result.data.sort((a, b) => {
                    const costA = parseFloat(a.totalCost) || 0;
                    const costB = parseFloat(b.totalCost) || 0;
                    return costB - costA;
                });

                onSuccess?.(result.data, result.summary);
                return { success: true, products: result.data, keyword, type };
            }

            // 继续尝试下一个
            if (i < candidates.length - 1) {
                console.log('查询无结果，尝试下一个关键词');
            }
        }

        // 所有候选都查询失败
        onFail?.('暂无此商品！');
        return { success: false, error: '暂无此商品' };
    }
};

// 导出模块
window.ChaxunShibieModule = ChaxunShibieModule;
