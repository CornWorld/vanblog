import i18next from 'i18next';

export default [
  {
    path: '/welcome',
    name: i18next.t('menu.overview'),
    icon: 'SmileOutlined',
    access: 'isAdmin',
  },
  {
    path: '/article',
    name: i18next.t('menu.article'),
    icon: 'FormOutlined',
  },
  {
    path: '/editor',
    name: i18next.t('menu.editor'),
    icon: 'FormOutlined',
    hideInMenu: true,
  },
  {
    path: '/code',
    name: i18next.t('menu.code'),
    icon: 'ToolOutlined',
    hideInMenu: true,
    access: 'isAdmin',
  },
  {
    path: '/about',
    name: i18next.t('menu.about'),
    icon: 'FormOutlined',
    hideInMenu: true,
  },
  {
    path: '/draft',
    name: i18next.t('menu.draft'),
    icon: 'ContainerOutlined',
  },
  {
    path: '/static/img',
    name: i18next.t('menu.image'),
    icon: 'PictureOutlined',
    hideInBreadcrumb: true,
  },
  {
    path: '/site',
    name: i18next.t('menu.site'),
    icon: 'ToolOutlined',
    hideInBreadcrumb: true,
    access: 'isAdmin',
    routes: [
      {
        path: '/site/data',
        name: i18next.t('menu.site.data'),
      },
      {
        path: '/site/comment',
        name: i18next.t('menu.site.comment'),
      },
      {
        path: '/site/pipeline',
        name: i18next.t('menu.site.pipeline'),
      },
      {
        path: '/site/setting',
        name: i18next.t('menu.site.setting'),
      },
      {
        path: '/site/customPage',
        name: i18next.t('menu.site.customPage'),
      },
      {
        path: '/site/log',
        name: i18next.t('menu.site.log'),
      },
    ],
  },
];
