(function registerVideoCreateSkill() {
    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.spsc.generate_video',
        tools: ['generate_video'],
        priority: 20,
        promptGuidance:
            '[视频生成规则]\n' +
            '- 用户要求生成视频、动画、短片、动态画面、让图片动起来、图生视频：使用 generate_video。\n' +
            '- 调用前整理 prompt：主体、动作、场景、镜头、风格、时长、画幅；不要只传用户原文。\n' +
            '- 统一参数可用 duration、quality、resolution、size、width、height、frame_rate、fps、num_frames、seed、num_inference_steps、negative_prompt、mode、video_mode。\n' +
            '- 用户未指定参数时不要硬编厂商专属字段；后端会按 provider 转换默认值。\n' +
            '- 基于图片/首帧/参考图生成视频时，使用 image_url/image_urls/images/image_ref/image_refs/first_frame/last_frame；刚上传或刚生成图片优先传 image_ref: "last"。\n' +
            '- 不要写厂商专属协议字段；只有用户明确要求模型专属参数时才使用 extra_body。\n' +
            '- 纯生成视频时 delivery_mode=card_only；用户要求生成后继续分析、说明、写文案或在回复中编排视频时 delivery_mode=await_then_reply。续写时如需插入视频，只输出系统提供的 [[media:...]] 占位符，不要输出视频链接、data URL 或 base64。'
    });
})();
