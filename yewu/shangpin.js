


// 商品查询模块 - 药师帮SCM商品查询
// 通过云函数查询商品上架信息
// 支持多账户切换尝试

// ============================================
// 导入数据库模块
// ============================================
import * as shujuku from './shujuku.js';

// ============================================
// API配置
// ============================================
const API_URL = 'https://1317825751-lqnvz24xzp.ap-guangzhou.tencentscf.com';

// 商品类型映射 ✅ 已修正 (2026-01-20)
const WHOLESALE_TYPES = {
  0: '全部',
  1: '一口价',
  4: '特价',           // 特价不可用券，即"特价"
  5: '限时特价',       // ✅ 修正：原错误值为3
  7: '普通拼团',
  8: '批购包邮',
  10: '赠品',          // ✅ 修正：原错误值为5
  11: '其他类型',      // ✅ 新增
  71: '诊所拼团'       // ✅ 修正：原错误值为9
};

// 全选所有类型的数组
const ALL_WHOLESALE_TYPES = [1, 4, 5, 10, 8, 7, 71, 11];

// ============================================
// 凭证管理（支持多账户切换）
// ============================================

// 当前使用的账户（用于记录）
let currentAuthAccount = null;

/**
 * 尝试使用指定凭证查询
 * @param {Object} auth - 凭证对象 { token, cookies, providerIdM, accountName }
 * @param {Object} queryOptions - 查询选项
 * @returns {Object} { success, data, needSwitch, error }
 */
async function tryQueryWithAuth(auth, queryOptions) {
  const { keyword, wholesaleType, pageSize, fetchPages } = queryOptions;
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auth: {
          token: auth.token,
          cookies: auth.cookies,
          providerIdM: ''
        },
        query: {
          keyword,
          wholesaleType,
          pageSize,
          fetchPages
        }
      })
    });

    const result = await response.json();

    if (result.code === 0) {
      // 成功
      currentAuthAccount = auth.accountName;
      return { success: true, data: result.data };
    } else if (result.code === 2002) {
      // 凭证过期，需要切换账户
      return { success: false, needSwitch: true, error: '凭证已过期' };
    } else {
      // 其他错误
      return { success: false, needSwitch: false, error: result.message || '查询失败' };
    }
  } catch (e) {
    return { success: false, needSwitch: false, error: `网络请求失败：${e.message}` };
  }
}

/**
 * 检查是否有可用凭证
 */
export async function hasAuth() {
  const auths = await shujuku.getAllAuths();
  return auths.length > 0;
}

/**
 * 获取当前使用的账户名
 */
export function getCurrentAuthAccount() {
  return currentAuthAccount;
}

// ============================================
// AI工具定义
// ============================================
export const tools = [
  {
    name: 'query_product',
    description: '查询药品商品上架信息。当用户询问某个药品的价格、库存、上架状态等信息时调用此工具。支持通过商品名称、商品编码、批准文号等关键词搜索。默认查询进行中的一口价商品，注意用户的表述可能不规范，你需要分析语义知道用户的真实意图，无需用户确认。系统会自动获取登录凭证，无需配置。',
    parameters: {
      keyword: { type: 'string', description: '搜索关键词，支持：商品名称、商品编码、批准文号、商品ID、厂家名称等' },
      wholesaleType: { 
        type: 'number', 
        description: '商品类型：0=全部，1=一口价（默认），4=特价，5=限时特价，7=普通拼团，8=批购包邮，10=赠品，11=其他类型，71=诊所拼团。注意：常说的"特价"就是类型4（特价不可用券）' 
      }
    },
    required: ['keyword']
  }
];

// ============================================
// 核心查询函数（支持多账户切换）
// ============================================

/**
 * 查询商品（自动切换账户）
 * @param {Object} options - 查询选项
 * @param {string} options.keyword - 搜索关键词
 * @param {number|number[]} options.wholesaleType - 商品类型（默认1=一口价），支持数组
 * @param {number} options.pageSize - 每页条数（默认50）
 * @param {number} options.fetchPages - 获取页数（默认1）
 */
export async function queryProducts(options = {}) {
  const {
    keyword = '',
    wholesaleType = 1,
    pageSize = 50,
    fetchPages = 1
  } = options;

  // 获取所有账户（已按time_update降序排序）
  const allAuths = await shujuku.getAllAuths();
  
  if (allAuths.length === 0) {
    return {
      success: false,
      error: '暂无可用的登录凭证',
      needLogin: true,
      loginMessage: '请点击下方按钮登录SCM系统'
    };
  }

  const queryOptions = { keyword, wholesaleType, pageSize, fetchPages };
  const triedAccounts = [];

  // 依次尝试每个账户
  for (const auth of allAuths) {
    triedAccounts.push(auth.accountName);
    
    const result = await tryQueryWithAuth(auth, queryOptions);
    
    if (result.success) {
      return { success: true, data: result.data, usedAccount: auth.accountName };
    }
    
    if (result.needSwitch) {
      // 标记该账户凭证失效
      console.warn(`账户 ${auth.accountName} 凭证已失效，尝试下一个账户`);
      await shujuku.markAuthInvalid(auth.accountName);
      continue;
    }
    
    // 其他错误（如网络错误），不切换账户，直接返回
    if (!result.needSwitch) {
      return { success: false, error: result.error };
    }
  }

  // 所有账户都失效
  return {
    success: false,
    error: `所有账户凭证均已失效（已尝试：${triedAccounts.join('、')}）`,
    needLogin: true,
    loginMessage: '所有登录凭证已过期，请重新登录'
  };
}

/**
 * 格式化商品数据（提取关键字段）
 */
export function formatProduct(product) {
  return {
    wholesaleId: product.wholesaleId,
    drugId: product.drugId,
    provDrugCode: product.provDrugCode,
    drugName: product.drugName,
    pack: product.pack,
    approval: product.approval,
    factoryName: product.factoryName,
    validDate: product.validDate,
    unitPrice: product.unitPrice,
    unitPrice1: product.unitPrice1,
    unitPrice2: product.unitPrice2,
    unitPrice3: product.unitPrice3,
    unitPrice9: product.unitPrice9,
    chainPrice: product.chainPrice,
    stockAvailable: product.stockAvailable,
    stockBalance: product.stockBalance,
    wholesaleType: product.wholesaleType,
    wholesaleTypeName: product.wholesaleTypeName || WHOLESALE_TYPES[product.wholesaleType] || '未知',
    statusName: product.statusName,
    appName: product.appName,
    groupName: product.groupName,
    storetype: product.storetype,
    whName: product.whName,
    minAmount: product.minAmount,
    maxAmount: product.maxAmount,
    beginDateStr: product.beginDateStr,
    endDateStr: product.endDateStr,
    storeNum: product.storeNum,
    buyNum: product.buyNum,
    totalCost: product.totalCost,
    logo: product.logo
  };
}

/**
 * 获取商品类型名称
 */
export function getWholesaleTypeName(type) {
  return WHOLESALE_TYPES[type] || '未知';
}

/**
 * 获取全选类型数组
 */
export function getAllWholesaleTypes() {
  return ALL_WHOLESALE_TYPES;
}

// ============================================
// AI工具执行
// ============================================
export async function execute(name, args, context) {
  const { notify, renderLoginCard, renderProductCard } = context;

  if (name !== 'query_product') {
    return { success: false, error: '未知操作' };
  }

  const { keyword, wholesaleType = 1 } = args;
  
  if (!keyword) {
    return { success: false, error: '请提供搜索关键词' };
  }

  // 查询商品（自动切换账户）
  const result = await queryProducts({
    keyword,
    wholesaleType,
    pageSize: 50,
    fetchPages: 1
  });

  // 如果需要登录，显示登录卡片
  if (result.needLogin) {
    if (renderLoginCard) {
      renderLoginCard(result.loginMessage);
    } else {
      notify?.(`🔐 ${result.loginMessage}`);
    }
    return {
      success: false,
      error: result.error,
      needLogin: true
    };
  }

  if (!result.success) {
    notify?.('⚠️ ' + result.error);
    return result;
  }

  const { summary, products } = result.data;
  
  if (!products || products.length === 0) {
    notify?.(`🔍 未找到"${keyword}"相关商品`);
    return {
      success: true,
      message: '未找到相关商品',
      keyword,
      count: 0
    };
  }

  // 格式化商品数据
  const formattedProducts = products.map(formatProduct);
  const firstProduct = formattedProducts[0];
  
  // 渲染商品卡片
  if (renderProductCard) {
    renderProductCard(firstProduct, formattedProducts);
  }

  return {
    success: true,
    message: `找到${summary.totalRecord}条"${keyword}"相关商品`,
    keyword,
    wholesaleType,
    wholesaleTypeName: getWholesaleTypeName(wholesaleType),
    totalCount: summary.totalRecord,
    fetchedCount: summary.fetchedCount,
    usedAccount: result.usedAccount,
    firstProduct: {
      name: firstProduct.drugName,
      code: firstProduct.provDrugCode,
      price: firstProduct.unitPrice,
      stock: firstProduct.stockAvailable
    },
    allProducts: formattedProducts
  };
}
