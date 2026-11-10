// 后续只需修改这里。留空的邮箱和项目网址不会跳转到虚构地址。
window.PORTFOLIO = {
  name: 'WANG CHEN',
  title: ['EXPERINCES', 'INTERESTS'],
  location: 'Creating from everywhere.',
  availability: 'Open for new possibilities',
  about: [],
  since: '2026',
  email: '',
  github: '',
  contactCodes: [],
  // 10 个作品位置。提供素材后填写 video / image / url，不需要修改动画代码。
  // video: 'assets/project-01.mp4'; image 用作视频封面，可留空。
  projects: Array.from({length:10}, (_,i)=>({
    title: `WORK ${String(i+1).padStart(2,'0')}`,
    description: '',
    video: '',
    image: '',
    url: ''
  }))
};

