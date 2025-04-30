const trans_zh = {
  'menu.overview': '分析概览',
  'menu.article': '文章管理',
  'menu.editor': '图形编辑器',
  'menu.code': '代码编辑器',
  'menu.about': '关于',
  'menu.draft': '草稿管理',
  'menu.image': '图片管理',
  'menu.site': '站点管理',
  'menu.site.data': '数据管理',
  'menu.site.comment': '评论管理',
  'menu.site.pipeline': '流水线',
  'menu.site.setting': '系统设置',
  'menu.site.customPage': '自定义页面',
  'menu.site.log': '日志管理',
};

export default [
  {
    path: '/welcome',
    name: trans_zh['menu.overview'],
    icon: 'SmileOutlined',
    access: 'isAdmin',
  },
  {
    path: '/article',
    name: trans_zh['menu.article'],
    icon: 'FormOutlined',
  },
  {
    path: '/editor',
    name: trans_zh['menu.editor'],
    icon: 'FormOutlined',
    hideInMenu: true,
  },
  {
    path: '/code',
    name: trans_zh['menu.code'],
    icon: 'ToolOutlined',
    hideInMenu: true,
    access: 'isAdmin',
  },
  {
    path: '/about',
    name: trans_zh['menu.about'],
    icon: 'FormOutlined',
    hideInMenu: true,
  },
  {
    path: '/draft',
    name: trans_zh['menu.draft'],
    icon: 'ContainerOutlined',
  },
  {
    path: '/static/img',
    name: trans_zh['menu.image'],
    icon: 'PictureOutlined',
    hideInBreadcrumb: true,
  },
  {
    path: '/site',
    name: trans_zh['menu.site'],
    icon: 'ToolOutlined',
    hideInBreadcrumb: true,
    access: 'isAdmin',
    routes: [
      {
        path: '/site/data',
        name: trans_zh['menu.site.data'],
      },
      {
        path: '/site/comment',
        name: trans_zh['menu.site.comment'],
      },
      {
        path: '/site/pipeline',
        name: trans_zh['menu.site.pipeline'],
      },
      {
        path: '/site/setting',
        name: trans_zh['menu.site.setting'],
      },
      {
        path: '/site/customPage',
        name: trans_zh['menu.site.customPage'],
      },
      {
        path: '/site/log',
        name: trans_zh['menu.site.log'],
      },
    ],
  },
];
