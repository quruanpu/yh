// 生活工具模块 - 天气、位置

// ============================================
// API配置
// ============================================
const API = {
  location: 'http://ip-api.com/json?lang=zh-CN',
  weather: 'https://wttr.in'
};

// ============================================
// AI工具定义
// ============================================
export const tools = [
  {
    name: 'get_location',
    description: '获取用户当前所在位置（城市、省份、国家）。当用户询问天气但未指定城市时，先调用此工具获取位置。',
    parameters: {}
  },
  {
    name: 'get_weather',
    description: '获取指定城市的天气信息，包括温度、天气状况、湿度、风力等。',
    parameters: {
      city: { type: 'string', description: '城市名称，如"北京"、"上海"、"广州"' }
    },
    required: ['city']
  }
];

// ============================================
// 功能实现
// ============================================

// 获取位置
async function getLocation() {
  try {
    const response = await fetch(API.location);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        success: true,
        country: data.country,
        region: data.regionName,
        city: data.city,
        ip: data.query,
        isp: data.isp
      };
    }
    return { success: false, error: '定位失败' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 获取天气
async function getWeather(city) {
  try {
    const url = `${API.weather}/${encodeURIComponent(city)}?format=j1&lang=zh`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return { success: false, error: `获取天气失败：${response.status}` };
    }
    
    const data = await response.json();
    const current = data.current_condition?.[0];
    const area = data.nearest_area?.[0];
    
    if (!current) {
      return { success: false, error: '无法获取天气数据' };
    }

    const weather = {
      success: true,
      location: {
        city: area?.areaName?.[0]?.value || city,
        region: area?.region?.[0]?.value || '',
        country: area?.country?.[0]?.value || ''
      },
      current: {
        temp_c: current.temp_C,
        feels_like_c: current.FeelsLikeC,
        condition: current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value,
        humidity: current.humidity,
        wind_speed: current.windspeedKmph,
        wind_dir: current.winddir16Point,
        visibility: current.visibility,
        uv_index: current.uvIndex,
        pressure: current.pressure
      }
    };

    const today = data.weather?.[0];
    if (today) {
      weather.today = {
        max_temp: today.maxtempC,
        min_temp: today.mintempC,
        sunrise: today.astronomy?.[0]?.sunrise,
        sunset: today.astronomy?.[0]?.sunset
      };
    }

    if (data.weather?.length > 1) {
      weather.forecast = data.weather.slice(1, 4).map(day => ({
        date: day.date,
        max_temp: day.maxtempC,
        min_temp: day.mintempC,
        condition: day.hourly?.[4]?.lang_zh?.[0]?.value || day.hourly?.[4]?.weatherDesc?.[0]?.value
      }));
    }

    return weather;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================
// AI工具执行入口
// ============================================
export async function execute(name, args, context) {
  switch (name) {
    case 'get_location': {
      const result = await getLocation();
      if (result.success) {
        return {
          success: true,
          message: `用户当前位置：${result.country} ${result.region} ${result.city}`,
          data: result
        };
      }
      return result;
    }
    
    case 'get_weather': {
      const { city } = args;
      if (!city) {
        return { success: false, error: '请提供城市名称' };
      }
      const result = await getWeather(city);
      if (result.success) {
        const c = result.current;
        return {
          success: true,
          message: `${result.location.city}：${c.condition}，${c.temp_c}°C（体感${c.feels_like_c}°C），湿度${c.humidity}%，${c.wind_dir}风${c.wind_speed}km/h`,
          data: result
        };
      }
      return result;
    }
  }
  
  return { success: false, error: '未知操作' };
}