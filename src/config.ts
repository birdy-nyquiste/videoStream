export const config = {
  // 访问网站的密码 (通过环境变量读取，本地取自 .env.local，线上取自 Cloudflare Pages 后台)
  sitePassword: import.meta.env.VITE_SITE_PASSWORD || '',

  // 视频列表
  videos: [
    {
      id: 'video-1',
      title: 'ReAngle Test Video',
      videoId: import.meta.env.VITE_VIDEO_ID || '',
    }
  ]
};
