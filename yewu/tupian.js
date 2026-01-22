// 图片模块 - 硅基流动API
const SILICONFLOW_API_KEY = 'sk-obgxzdqkaticlclnkqgbmavahnzhpchamurqmcvlgtiscmhi';
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_IMAGE_URL = 'https://api.siliconflow.cn/v1/images/generations';

const MODELS = {
  vision: 'Qwen/Qwen2-VL-72B-Instruct',
  image: 'Qwen/Qwen-Image',
  imageEdit: 'Qwen/Qwen-Image-Edit-2509'
};

// 当前编辑图片缓存
let currentImage = null;
export const getCurrentImage = () => currentImage;
export const setCurrentImage = img => currentImage = img;
export const clearCurrentImage = () => currentImage = null;

// 视觉分析
export async function analyzeImage(imageBase64, prompt = '描述这张图片') {
  const response = await fetch(SILICONFLOW_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SILICONFLOW_API_KEY}` },
    body: JSON.stringify({
      model: MODELS.vision,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: imageBase64 } },
        { type: 'text', text: prompt }
      ]}],
      max_tokens: 1000
    })
  });
  if (!response.ok) throw new Error(`视觉API错误：${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '无法识别图片';
}

// 生成图片
export async function generateImage(prompt) {
  try {
    const response = await fetch(SILICONFLOW_IMAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SILICONFLOW_API_KEY}` },
      body: JSON.stringify({ model: MODELS.image, prompt, batch_size: 1, num_inference_steps: 20, guidance_scale: 7.5 })
    });
    if (!response.ok) return { success: false, error: `API错误：${response.status}` };
    const data = await response.json();
    if (data.images?.[0]?.url) return { success: true, url: data.images[0].url };
    return { success: false, error: data.message || '生成失败' };
  } catch (e) { return { success: false, error: e.message }; }
}

// 编辑图片
export async function editImage(prompt, imageBase64) {
  try {
    if (!imageBase64) return { success: false, error: '没有可编辑的图片' };
    const response = await fetch(SILICONFLOW_IMAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SILICONFLOW_API_KEY}` },
      body: JSON.stringify({ model: MODELS.imageEdit, prompt, image: imageBase64, batch_size: 1 })
    });
    if (!response.ok) return { success: false, error: `API错误：${response.status}` };
    const data = await response.json();
    if (data.images?.[0]?.url) return { success: true, url: data.images[0].url };
    return { success: false, error: data.message || '编辑失败' };
  } catch (e) { return { success: false, error: e.message }; }
}

// AI工具定义
export const tools = [
  { name: 'generate_image', description: '纯文字生成图片，当用户要求画图但没有上传图片时调用', parameters: { prompt: { type: 'string', description: '图片描述' } }, required: ['prompt'] },
  { name: 'edit_image', description: '编辑用户上传的图片，当用户上传了图片并要求修改/编辑/添加/删除元素时调用', parameters: { prompt: { type: 'string', description: '编辑指令' } }, required: ['prompt'] },
  { name: 'analyze_image', description: '分析用户上传的图片内容，当用户上传了图片并询问图片内容、要求识别或理解图片时调用', parameters: { question: { type: 'string', description: '关于图片的问题' } }, required: ['question'] }
];

// AI工具执行
export async function execute(name, args, context) {
  const { notify } = context;
  switch (name) {
    case 'generate_image': {
      const result = await generateImage(args.prompt);
      if (result.success) {
        notify(`<img src="${result.url}" class="gen-image" onclick="showImagePreview('${result.url}')">`);
        return { success: true, message: '图片已生成并显示' };
      }
      notify(`❌ 图片生成失败：${result.error}`);
      return result;
    }
    case 'edit_image': {
      const imageBase64 = getCurrentImage();
      if (!imageBase64) {
        notify('⚠️ 没有可编辑的图片，请先上传图片');
        return { success: false, error: '没有可编辑的图片' };
      }
      const result = await editImage(args.prompt, imageBase64);
      if (result.success) {
        notify(`<img src="${result.url}" class="gen-image" onclick="showImagePreview('${result.url}')">`);
        return { success: true, message: '图片已编辑并显示' };
      }
      notify(`❌ 图片编辑失败：${result.error}`);
      return result;
    }
    case 'analyze_image': {
      const imageBase64 = getCurrentImage();
      if (!imageBase64) return { success: false, error: '没有可分析的图片' };
      try {
        const description = await analyzeImage(imageBase64, args.question || '请详细描述这张图片的内容');
        return { success: true, description };
      } catch (e) { return { success: false, error: e.message }; }
    }
  }
  return { success: false, error: '未知操作' };
}
