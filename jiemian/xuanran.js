// 界面渲染模块 - 完全重构版
import { TimeUtil, getTime } from '../gongyong/gongju.js';

let detailCounter = 0;
export const detailDataMap = new Map();

// 商品详情数据存储
let productDetailCounter = 0;
export const productDetailDataMap = new Map();

export const AVATAR_SYS = '<div class="avatar avatar-sys">💡</div>';
export const AVATAR_USER = '<div class="avatar avatar-user">🎁</div>';

export const renderMsgTags = tags => tags.length ? `<div class="msg-tags">${tags.map(t => `<span class="msg-tag">${t.name}</span>`).join('')}</div>` : '';

/**
 * 渲染普通消息
 */
export function renderMessage(html, type, options = {}) {
  const { tags = [], images = [], files = [] } = options;
  let extra = '';
  if (images.length) extra += `<div class="msg-images">${images.map(img => `<img src="${img}" class="msg-image" onclick="showImagePreview('${img}')">`).join('')}</div>`;
  if (files.length) extra += files.map(f => `<div class="msg-file">${f}</div>`).join('');
  return `${type === 'sys' ? AVATAR_SYS : AVATAR_USER}<div class="msg-content"><div class="bubble">${html}</div>${extra}${type === 'user' ? renderMsgTags(tags) : ''}<div class="timestamp">${getTime()}</div></div>`;
}

/**
 * 渲染结果卡片
 */
export function renderReport(name, data, activityInfo = {}) {
  const result = data.result || {};
  const success = result.success || [];
  const failed = result.failed || {};
  const totalFailed = Object.values(failed).reduce((sum, ids) => sum + ids.length, 0);
  const { zongshu = '?', yizengsong = 0, dandian = '?', yaodian_tongji = {} } = activityInfo;

  const detailId = `detail_${++detailCounter}`;
  detailDataMap.set(detailId, { name, data, activityInfo });

  const allIds = [
    ...success.map(id => ({ id, ok: true })),
    ...Object.values(failed).flat().map(id => ({ id, ok: false }))
  ];

  const renderPill = (id, isSuccess) => {
    const count = yaodian_tongji[id] || 0;
    return `<span class="report-pill ${isSuccess ? 'success' : 'fail'}"><span class="pill-id">${id}</span><span class="pill-count">${count}/${dandian}</span></span>`;
  };

  let bodyContent = '';
  const maxVisible = 6;

  if (allIds.length === 0) {
    bodyContent = '<span class="report-empty">暂无数据</span>';
  } else if (allIds.length <= maxVisible) {
    bodyContent = allIds.map(({ id, ok }) => renderPill(id, ok)).join('');
  } else {
    bodyContent = allIds.slice(0, 5).map(({ id, ok }) => renderPill(id, ok)).join('');
    bodyContent += `<span class="report-pill more">共${allIds.length}个...</span>`;
  }

  return `<div class="report-card">
<div class="report-header"><span class="report-title">📄 ${name}</span><span class="report-stat success">✓${success.length}</span><span class="report-stat fail">✗${totalFailed}</span><button class="report-btn" onclick="showDetail('${detailId}')">详情</button></div>
<div class="report-body">${bodyContent}</div>
<div class="report-footer"><span>⏱ ${TimeUtil.calcDuration(data.time_start, data.time_finish)}</span><span>库存 ${yizengsong}/${zongshu}</span><span>处理 ${(data.finish_sbid || '-').toUpperCase()}</span></div>
</div>`;
}

/**
 * 渲染详情弹窗内容
 */
export function renderDetailContent(detailId) {
  const detail = detailDataMap.get(detailId);
  if (!detail) return '<p>数据不存在</p>';

  const { data, activityInfo = {} } = detail;
  const result = data.result || {};
  const success = result.success || [];
  const failed = result.failed || {};
  const { zongshu = '?', yizengsong = 0, dandian = '?', yaodian_tongji = {} } = activityInfo;
  const totalFailed = Object.values(failed).reduce((sum, ids) => sum + ids.length, 0);
  const total = success.length + totalFailed;
  const rate = total > 0 ? Math.round((success.length / total) * 100) : 0;

  const pill = (id, ok) => `<span class="detail-pill ${ok ? 'success' : 'fail'}"><span>${id}</span><span class="pill-count">${yaodian_tongji[id] || 0}/${dandian}</span></span>`;

  let html = '';
  if (success.length) {
    html += `<div class="detail-section"><div class="detail-title success">✓ 成功 (${success.length})</div><div class="detail-grid">${success.map(id => pill(id, true)).join('')}</div></div>`;
  }
  if (totalFailed) {
    html += `<div class="detail-section"><div class="detail-title fail">✗ 失败 (${totalFailed})</div>`;
    Object.entries(failed).forEach(([reason, ids]) => {
      html += `<div class="detail-fail-group"><div class="detail-fail-reason">⊘ ${reason} (${ids.length})</div><div class="detail-grid">${ids.map(id => pill(id, false)).join('')}</div></div>`;
    });
    html += '</div>';
  }

  const info = (label, value) => `<div class="detail-info"><div class="detail-info-label">${label}</div><div class="detail-info-value">${value}</div></div>`;
  html += `<div class="detail-section"><div class="detail-title">📊 统计</div><div class="detail-info-grid">
${info('成功率', rate + '%')}${info('耗时', TimeUtil.calcDuration(data.time_start, data.time_finish))}
${info('库存', yizengsong + '/' + zongshu)}${info('限制', dandian + '次/店')}
${info('发起', (data.start_sbid || '-').toUpperCase())}${info('处理', (data.finish_sbid || '-').toUpperCase())}
</div></div>`;
  return html;
}

/**
 * 渲染等待结果提示
 */
export function renderPendingResult(total, done) {
  const remaining = total - done;
  return `<div class="pending-box"><div class="pending-spin"></div><div class="pending-info"><span>正在获取结果${remaining > 1 ? `（剩余${remaining}个）` : ''}...</span><span class="pending-tip">你可以退出稍后查看</span></div></div>`;
}

/**
 * 渲染活动列表
 */
export function renderActivityList(activities, selectedCids = []) {
  if (!activities.length) return '暂无活动';
  return `<div style='margin-bottom:4px'><b>🎁 优惠券活动👇</b></div><div class='activity-list'>${activities.map(({ cid, name, keyword, zongshu, yizengsong, dandian }) => {
    const selected = selectedCids.includes(cid) ? 'selected' : '';
    const remain = Math.max(0, (zongshu || 0) - (yizengsong || 0));
    return `<div class="activity-item ${selected}" data-cid="${cid}" onclick="toggleActivityTag('${name.replace(/'/g, "\\'")}', '${keyword}', '${cid}')"><div class="item-name">${name}</div><div class="item-meta"><span class="stock-num">${remain}</span>/${zongshu || '?'} · 限${dandian || '?'}次</div></div>`;
  }).join('')}</div>`;
}

// ============================================
// 登录卡片渲染
// ============================================

/**
 * 渲染登录卡片
 * @param {string} message - 提示消息
 * @returns {string} HTML字符串
 */
export function renderLoginCard(message = '登录已失效，请重新登录') {
  return `<div class="login-card">
<div class="login-card-header">
  <span class="login-card-icon">🔐</span>
  <span class="login-card-title">需要登录</span>
</div>
<div class="login-card-body">
  <p class="login-card-message">${message}</p>
</div>
<div class="login-card-buttons">
  <button class="login-card-btn scm" onclick="openLoginModal('scm')">
    <span class="btn-icon">🏪</span>
    <span class="btn-text">SCM系统</span>
  </button>
  <button class="login-card-btn pms disabled" disabled title="暂未开放">
    <span class="btn-icon">📦</span>
    <span class="btn-text">PMS系统</span>
  </button>
</div>
</div>`;
}

// ============================================
// 商品卡片渲染 - 修正版 (2026-01-20)
// ============================================

/**
 * 格式化价格显示
 */
function formatPrice(price) {
  if (price === null || price === undefined || price === 0) {
    return '-';
  }
  return '¥' + Number(price).toFixed(2);
}

/**
 * 渲染商品卡片
 * 
 * 布局：
 * 1. 头部：商品ID、编码、详情按钮
 * 2. 名称行：单行显示，加粗
 * 3. 规格效期行：规格｜效期
 * 4. 价格表格
 * 5. 成本库存行
 * 6. 厂家
 */
export function renderProductCard(product, allProducts = []) {
  const detailId = `product_${++productDetailCounter}`;
  productDetailDataMap.set(detailId, { product, allProducts });

  const priceRows = [
    { label: '单体价格', value: formatPrice(product.unitPrice) },
    { label: '一环价', value: formatPrice(product.unitPrice1) },
    { label: '省内价', value: formatPrice(product.unitPrice2) },
    { label: '周边省份价', value: formatPrice(product.unitPrice3) },
    { label: '连锁价格', value: formatPrice(product.chainPrice) }
  ];

  const priceTableHtml = priceRows.map(row => 
    `<div class="product-price-row"><span class="price-label">${row.label}</span><span class="price-value">${row.value}</span></div>`
  ).join('');

  return `<div class="product-card">
<div class="product-header">
  <div class="product-ids">
    <span class="product-drug-id">${product.drugId}</span>
    <span class="product-code">${product.provDrugCode}</span>
  </div>
  <button class="product-detail-btn" onclick="showProductDetail('${detailId}')">详情</button>
</div>
<div class="product-name">${product.drugName}</div>
<div class="product-spec">${product.pack || '-'}｜${product.validDate || '-'}</div>
<div class="product-price-table">
  ${priceTableHtml}
</div>
<div class="product-info-row">成本：${formatPrice(product.unitPrice9)} | 库存：${product.stockAvailable || 0}</div>
<div class="product-factory">${product.factoryName || '-'}</div>
</div>`;
}

/**
 * 渲染商品详情弹窗内容
 * 
 * 修改：
 * 1. 添加采购金额显示
 * 2. 按采购金额、采购店数、采购数量降序排序
 */
export function renderProductDetailContent(detailId) {
  const data = productDetailDataMap.get(detailId);
  if (!data) return '<p>数据不存在</p>';

  let { allProducts } = data;
  
  if (!allProducts || allProducts.length === 0) {
    return '<p>暂无商品数据</p>';
  }

  // ✅ 排序：按采购金额、采购店数、采购数量降序
  allProducts = [...allProducts].sort((a, b) => {
    // 先按采购金额降序
    const costDiff = (b.totalCost || 0) - (a.totalCost || 0);
    if (costDiff !== 0) return costDiff;
    
    // 再按采购店数降序
    const storeDiff = (b.storeNum || 0) - (a.storeNum || 0);
    if (storeDiff !== 0) return storeDiff;
    
    // 最后按采购数量降序
    return (b.buyNum || 0) - (a.buyNum || 0);
  });

  const productsHtml = allProducts.map((product, index) => {
    const info = (label, value) => `<div class="product-detail-info"><span class="info-label">${label}</span><span class="info-value">${value || '-'}</span></div>`;
    
    return `<div class="product-detail-item${index > 0 ? ' with-border' : ''}">
      <div class="product-detail-header">
        <span class="detail-type-tag">${product.wholesaleTypeName || '未知类型'}</span>
        <span class="detail-activity-id">活动ID: ${product.wholesaleId}</span>
      </div>
      
      <div class="product-detail-section">
        <div class="section-title">📦 基本信息</div>
        <div class="product-detail-grid">
          ${info('商品ID', product.drugId)}
          ${info('商品编码', product.provDrugCode)}
          ${info('批准文号', product.approval)}
          ${info('商品名称', product.drugName)}
          ${info('规格包装', product.pack)}
          ${info('生产厂家', product.factoryName)}
        </div>
      </div>
      
      <div class="product-detail-section">
        <div class="section-title">💰 价格信息</div>
        <div class="product-detail-grid">
          ${info('单体价格', formatPrice(product.unitPrice))}
          ${info('一环价', formatPrice(product.unitPrice1))}
          ${info('省内价', formatPrice(product.unitPrice2))}
          ${info('周边省份价', formatPrice(product.unitPrice3))}
          ${info('含税成本价', formatPrice(product.unitPrice9))}
          ${info('连锁价格', formatPrice(product.chainPrice))}
        </div>
      </div>
      
      <div class="product-detail-section">
        <div class="section-title">📊 库存信息</div>
        <div class="product-detail-grid">
          ${info('可用库存', product.stockAvailable)}
          ${info('ERP库存', product.stockBalance)}
          ${info('有效期', product.validDate)}
        </div>
      </div>
      
      <div class="product-detail-section">
        <div class="section-title">🏷️ 活动信息</div>
        <div class="product-detail-grid">
          ${info('活动类型', product.wholesaleTypeName)}
          ${info('商圈', product.groupName)}
          ${info('供货对象', product.storetype)}
          ${info('发货仓库', product.whName)}
          ${info('起订量', product.minAmount)}
          ${info('活动上限', product.maxAmount || '无限制')}
          ${info('开始时间', product.beginDateStr)}
          ${info('结束时间', product.endDateStr)}
        </div>
      </div>
      
      <div class="product-detail-section">
        <div class="section-title">📈 销售统计</div>
        <div class="product-detail-grid">
          ${info('采购金额', formatPrice(product.totalCost))}
          ${info('采购店数', product.storeNum)}
          ${info('采购数量', product.buyNum)}
        </div>
      </div>
    </div>`;
  }).join('');

  return `<div class="product-detail-container">
    <div class="product-detail-summary">共 ${allProducts.length} 条记录（按采购金额降序）</div>
    ${productsHtml}
  </div>`;
}
