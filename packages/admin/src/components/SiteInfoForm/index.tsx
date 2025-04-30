import {
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import UrlFormItem from '../UrlFormItem';
import { Col } from 'antd';
import { FormInstance } from 'antd/lib/form';

const trans_zh = {
  'site_form.author.label': '作者名字',
  'site_form.author.placeholder': '请输入作者名字',
  'site_form.author_desc.label': '作者描述',
  'site_form.author_desc.placeholder': '请输入作者描述',
  'site_form.author_logo.label': '作者 Logo',
  'site_form.author_logo.placeholder': '请输入作者 Logo Url',
  'site_form.author_logo_dark.label': '作者 Logo（黑暗模式）',
  'site_form.author_logo_dark.placeholder': '请输入黑暗模式作者 Logo Url，留空表示沿用上个',
  'site_form.site_logo.label': '网站 Logo',
  'site_form.site_logo.placeholder': '请输入网站 Logo Url',
  'site_form.site_logo_dark.label': '网站 Logo（黑暗模式）',
  'site_form.site_logo_dark.placeholder': '请输入网站黑暗模式 Logo Url，留空表示沿用上个',
  'site_form.favicon.label': '网站图标(favicon)',
  'site_form.favicon.placeholder': '请输入网站图标 Url',
  'site_form.site_name.label': '网站名',
  'site_form.site_name.placeholder': '请输入网站名',
  'site_form.site_desc.label': '网站描述',
  'site_form.site_desc.placeholder': '请输入网站描述',
  'site_form.pay_alipay.label': '支付宝图片 Url',
  'site_form.pay_alipay.placeholder': '请输入支付宝打赏图片 Url，留空不启用打赏',
  'site_form.pay_alipay_dark.label': '支付宝图片 Url（黑暗模式）',
  'site_form.pay_alipay_dark.placeholder': '请输入黑暗模式支付宝打赏图片 Url，留空沿用上个',
  'site_form.pay_wechat.label': '微信图片 Url',
  'site_form.pay_wechat.placeholder': '请输入微信打赏图片 Url，留空不启用打赏',
  'site_form.pay_wechat_dark.label': '微信图片 Url（黑暗模式）',
  'site_form.pay_wechat_dark.placeholder': '请输入黑暗模式微信打赏图片 Url，留空沿用上个',
  'site_form.base_url.label': '网站 Url',
  'site_form.base_url.placeholder': '请输入包含访问协议的完整 URL',
  'site_form.base_url.tooltip':
    '请输入包含访问协议的完整 URL，此 URL 会被用来生成前后台/RSS的相关数据。',
  'site_form.copyright.label': '版权协议',
  'site_form.copyright.placeholder': '版权协议',
  'site_form.beian.label': 'ICP 备案号',
  'site_form.beian.placeholder': '请输入备案号，留空不显示备案信息',
  'site_form.beian_url.label': 'ICP 备案网址',
  'site_form.beian_url.placeholder': '请输入备案网址，留空不显示备案信息',
  'site_form.ga_beian.label': '公安备案号',
  'site_form.ga_beian.placeholder': '请输入公安备案号，留空不显示公安备案信息',
  'site_form.ga_beian_url.label': '公安备案网址',
  'site_form.ga_beian_url.placeholder': '请输入公安备案号点击后跳转的网址，留空则不跳转',
  'site_form.ga_beian_logo.label': '公安备案 Logo 地址',
  'site_form.ga_beian_logo.placeholder': '请输入公安备案的 logo 的 url，留空不显示公安备案 logo',
  'site_form.ga_analysis.label': 'Google Analysis ID',
  'site_form.ga_analysis.placeholder': '请输入 Google Analysis ID，留空表示不启用',
  'site_form.baidu_analysis.label': 'Baidu 分析 ID',
  'site_form.baidu_analysis.placeholder': '请输入 Baidu 分析 ID，留空表示不启用',
  'site_form.enable_comment.label': '是否开启评论系统',
  'site_form.enable_comment.placeholder': '开启',
  'site_form.enable_comment.option.enabled': '开启',
  'site_form.enable_comment.option.disabled': '关闭',
  'site_form.enable_comment.tooltip': '默认开启',
  'site_form.since.label': '建站时间',
  'site_form.since.placeholder': '不填默认为此刻',
  'site_form.show_submenu.label': '显示分类导航栏',
  'site_form.show_submenu.placeholder': '隐藏',
  'site_form.show_submenu.option.show': '显示',
  'site_form.show_submenu.option.hide': '隐藏',
  'site_form.show_submenu.tooltip':
    '默认隐藏，开启后将在主导航栏下方显示分类子导航栏（其实就是双层导航栏）。',
  'site_form.submenu_offset.label': '分类导航栏左侧偏移（px）',
  'site_form.submenu_offset.placeholder': '0',
  'site_form.submenu_offset.tooltip':
    '导航栏显示的是网站名的时候，设置正确偏移以对其分类第一个字。',
  'site_form.header_left.label': '导航栏左侧显示内容',
  'site_form.header_left.option.logo': '网站logo',
  'site_form.header_left.option.name': '网站名',
  'site_form.header_left.placeholder': '网站名',
  'site_form.header_left.tooltip': '显示网站 logo 的前提是已设置正确的网站 logo 哦。默认显示网站名',
  'site_form.show_admin.label': '后台按钮是否显示',
  'site_form.show_admin.placeholder': '显示',
  'site_form.show_admin.option.show': '显示',
  'site_form.show_admin.option.hide': '隐藏',
  'site_form.show_admin.tooltip': '默认显示，关闭后前台会隐藏后台按钮',
  'site_form.show_donate_info.label': '是否显示捐赠信息',
  'site_form.show_donate_info.placeholder': '显示',
  'site_form.show_donate_info.option.show': '显示',
  'site_form.show_donate_info.option.hide': '隐藏',
  'site_form.show_donate_info.tooltip': '默认显示，关闭后关于页面会隐藏捐赠信息',
  'site_form.show_copyright.label': '是否显示版权声明',
  'site_form.show_copyright.placeholder': '显示',
  'site_form.show_copyright.option.show': '显示',
  'site_form.show_copyright.option.hide': '隐藏',
  'site_form.show_copyright.tooltip': '默认显示，关闭后文章页面将不显示版权声明',
  'site_form.show_donate.label': '是否显示打赏按钮',
  'site_form.show_donate.placeholder': '显示',
  'site_form.show_donate.option.show': '显示',
  'site_form.show_donate.option.hide': '隐藏',
  'site_form.show_donate.tooltip':
    '默认显示（前提是设置了支付宝和微信支付图片），关闭后所有位置将不显示打赏按钮',
  'site_form.show_donate_about.label': '关于页面是否显示打赏按钮',
  'site_form.show_donate_about.placeholder': '隐藏',
  'site_form.show_donate_about.option.show': '显示',
  'site_form.show_donate_about.option.hide': '隐藏',
  'site_form.show_donate_about.tooltip': '默认隐藏，开启后关于页面会显示打赏按钮',
  'site_form.default_theme.label': '前台默认主题模式',
  'site_form.default_theme.placeholder': '自动模式',
  'site_form.default_theme.option.auto': '自动模式',
  'site_form.default_theme.option.dark': '暗色模式',
  'site_form.default_theme.option.light': '亮色模式',
  'site_form.default_theme.tooltip': '设置后第一次进入前台的用户将以此作为默认主题模式',
  'site_form.allow_hidden.label': '是否允许通过 URL 打开隐藏的文章',
  'site_form.allow_hidden.placeholder': '不允许',
  'site_form.allow_hidden.option.allow': '允许',
  'site_form.allow_hidden.option.disallow': '不允许',
  'site_form.allow_hidden.tooltip': '默认不允许，开启后可通过 URL 打开隐藏文章。',
  'site_form.enable_custom.label': '是否开启客制化功能',
  'site_form.enable_custom.placeholder': '开启',
  'site_form.enable_custom.option.enabled': '开启',
  'site_form.enable_custom.option.disabled': '关闭',
  'site_form.enable_custom.tooltip':
    '默认开启，关闭后即使通过客制化面板，自定义了 CSS、Script、HTML 也不会生效。',
  'site_form.show_rss.label': '是否显示 RSS 按钮',
  'site_form.show_rss.placeholder': '显示',
  'site_form.show_rss.option.show': '显示',
  'site_form.show_rss.option.hide': '隐藏',
  'site_form.show_rss.tooltip': '默认显示，关闭后所有位置会隐藏 RSS 按钮。',
  'site_form.links_new_window.label': '前台点击链接时的默认行为',
  'site_form.links_new_window.placeholder': '在当前页面跳转',
  'site_form.links_new_window.option.new': '打开新标签页',
  'site_form.links_new_window.option.current': '在当前页面跳转',
  'site_form.links_new_window.tooltip':
    '默认在当前页面跳转，会影响除了导航栏之外的大部分链接。注意如果打开新标签的话，就不会那么丝滑了哦（当前页面跳转的话是无感切换的）',
  'site_form.show_expiration.label': '是否显示文章内容过时提醒',
  'site_form.show_expiration.placeholder': '显示',
  'site_form.show_expiration.option.show': '显示',
  'site_form.show_expiration.option.hide': '隐藏',
  'site_form.show_expiration.tooltip': '默认显示，关闭后文章页面不会显示内容过期提醒。',
  'site_form.show_edit.label': '是否在前台展示编辑按钮',
  'site_form.show_edit.placeholder': '显示',
  'site_form.show_edit.option.show': '显示',
  'site_form.show_edit.option.hide': '隐藏',
  'site_form.show_edit.tooltip': '默认开启，关闭后登录后台时，前台将不再显示编辑按钮。',
  'site_form.required': '这是必填项',
};

export default function (props: {
  showOption: boolean;
  showRequire: boolean;
  showLayout: boolean;
  form: FormInstance;
  isInit: boolean;
}) {
  return (
    <>
      {props.showRequire && (
        <>
          <ProFormText
            name="author"
            required
            label={trans_zh['site_form.author.label']}
            placeholder={trans_zh['site_form.author.placeholder']}
            rules={[{ required: true, message: trans_zh['site_form.required'] }]}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="authorDesc"
            required
            label={trans_zh['site_form.author_desc.label']}
            placeholder={trans_zh['site_form.author_desc.placeholder']}
            rules={[{ required: true, message: trans_zh['site_form.required'] }]}
            colProps={{ xs: 24, sm: 24 }}
          />
          <Col xs={24} sm={24}>
            <UrlFormItem
              isInit={props.isInit}
              formRef={props.form}
              name="authorLogo"
              required
              label={trans_zh['site_form.author_logo.label']}
              placeholder={trans_zh['site_form.author_logo.placeholder']}
            />
          </Col>
        </>
      )}
      {props.showOption && (
        <Col xs={24} sm={24}>
          <UrlFormItem
            required={false}
            formRef={props.form}
            name="authorLogoDark"
            label={trans_zh['site_form.author_logo_dark.label']}
            placeholder={trans_zh['site_form.author_logo_dark.placeholder']}
            isInit={props.isInit}
          />
        </Col>
      )}
      {props.showOption && (
        <>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              name="siteLogo"
              required={false}
              label={trans_zh['site_form.site_logo.label']}
              placeholder={trans_zh['site_form.site_logo.placeholder']}
              isInit={props.isInit}
            />
          </Col>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              name="siteLogoDark"
              label={trans_zh['site_form.site_logo_dark.label']}
              required={false}
              placeholder={trans_zh['site_form.site_logo_dark.placeholder']}
              isInit={props.isInit}
            />
          </Col>
        </>
      )}
      {props.showRequire && (
        <>
          <Col xs={24} sm={24}>
            <UrlFormItem
              isInit={props.isInit}
              formRef={props.form}
              name="favicon"
              required
              label={trans_zh['site_form.favicon.label']}
              placeholder={trans_zh['site_form.favicon.placeholder']}
              isFavicon={true}
            />
          </Col>
          <ProFormText
            name="siteName"
            required
            label={trans_zh['site_form.site_name.label']}
            placeholder={trans_zh['site_form.site_name.placeholder']}
            rules={[{ required: true, message: trans_zh['site_form.required'] }]}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="siteDesc"
            required
            label={trans_zh['site_form.site_desc.label']}
            placeholder={trans_zh['site_form.site_desc.placeholder']}
            rules={[{ required: true, message: trans_zh['site_form.required'] }]}
            colProps={{ xs: 24, sm: 24 }}
          />
        </>
      )}
      {props.showOption && (
        <>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              isInit={props.isInit}
              name="payAliPay"
              label={trans_zh['site_form.pay_alipay.label']}
              placeholder={trans_zh['site_form.pay_alipay.placeholder']}
              required={false}
            />
          </Col>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              isInit={props.isInit}
              name="payAliPayDark"
              label={trans_zh['site_form.pay_alipay_dark.label']}
              placeholder={trans_zh['site_form.pay_alipay_dark.placeholder']}
              required={false}
            />
          </Col>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              isInit={props.isInit}
              name="payWechat"
              label={trans_zh['site_form.pay_wechat.label']}
              placeholder={trans_zh['site_form.pay_wechat.placeholder']}
              required={false}
            />
          </Col>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              isInit={props.isInit}
              name="payWechatDark"
              label={trans_zh['site_form.pay_wechat_dark.label']}
              placeholder={trans_zh['site_form.pay_wechat_dark.placeholder']}
              required={false}
            />
          </Col>
        </>
      )}
      {props.showRequire && (
        <ProFormText
          name="baseUrl"
          rules={[{ required: true, message: trans_zh['site_form.required'] }]}
          label={trans_zh['site_form.base_url.label']}
          placeholder={trans_zh['site_form.base_url.placeholder']}
          tooltip={trans_zh['site_form.base_url.tooltip']}
          required={true}
          colProps={{ xs: 24, sm: 24 }}
        />
      )}
      {props.showOption && (
        <>
          <ProFormText
            name="copyrightAggreement"
            label={trans_zh['site_form.copyright.label']}
            placeholder={trans_zh['site_form.copyright.placeholder']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="beianNumber"
            label={trans_zh['site_form.beian.label']}
            placeholder={trans_zh['site_form.beian.placeholder']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="beianUrl"
            label={trans_zh['site_form.beian_url.label']}
            placeholder={trans_zh['site_form.beian_url.placeholder']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="gaBeianNumber"
            label={trans_zh['site_form.ga_beian.label']}
            placeholder={trans_zh['site_form.ga_beian.placeholder']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="gaBeianUrl"
            label={trans_zh['site_form.ga_beian_url.label']}
            placeholder={trans_zh['site_form.ga_beian_url.placeholder']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              isInit={props.isInit}
              name="gaBeianLogoUrl"
              label={trans_zh['site_form.ga_beian_logo.label']}
              placeholder={trans_zh['site_form.ga_beian_logo.placeholder']}
              required={false}
            />
          </Col>
          <ProFormText
            name="gaAnalysisId"
            label={trans_zh['site_form.ga_analysis.label']}
            placeholder={trans_zh['site_form.ga_analysis.placeholder']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="baiduAnalysisId"
            label={trans_zh['site_form.baidu_analysis.label']}
            placeholder={trans_zh['site_form.baidu_analysis.placeholder']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'enableComment'}
            label={trans_zh['site_form.enable_comment.label']}
            placeholder={trans_zh['site_form.enable_comment.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.enable_comment.option.enabled'],
              false: trans_zh['site_form.enable_comment.option.disabled'],
            }}
            tooltip={trans_zh['site_form.enable_comment.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormDateTimePicker
            name="since"
            width={'lg'}
            label={trans_zh['site_form.since.label']}
            placeholder={trans_zh['site_form.since.placeholder']}
            colProps={{ xs: 24, sm: 24 }}
          />
        </>
      )}
      {/* 布局选项 */}
      {props.showLayout && (
        <>
          <ProFormSelect
            name={'showSubMenu'}
            label={trans_zh['site_form.show_submenu.label']}
            placeholder={trans_zh['site_form.show_submenu.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.show_submenu.option.show'],
              false: trans_zh['site_form.show_submenu.option.hide'],
            }}
            tooltip={trans_zh['site_form.show_submenu.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />

          <ProFormDigit
            name={'subMenuOffset'}
            label={trans_zh['site_form.submenu_offset.label']}
            dependencies={['showSubMenu']}
            placeholder={trans_zh['site_form.submenu_offset.placeholder']}
            fieldProps={{ precision: 0 }}
            min={0}
            max={200}
            tooltip={trans_zh['site_form.submenu_offset.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'headerLeftContent'}
            label={trans_zh['site_form.header_left.label']}
            valueEnum={{
              siteLogo: trans_zh['site_form.header_left.option.logo'],
              siteName: trans_zh['site_form.header_left.option.name'],
            }}
            placeholder={trans_zh['site_form.header_left.placeholder']}
            tooltip={trans_zh['site_form.header_left.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showAdminButton'}
            label={trans_zh['site_form.show_admin.label']}
            placeholder={trans_zh['site_form.show_admin.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.show_admin.option.show'],
              false: trans_zh['site_form.show_admin.option.hide'],
            }}
            tooltip={trans_zh['site_form.show_admin.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showDonateInfo'}
            label={trans_zh['site_form.show_donate_info.label']}
            placeholder={trans_zh['site_form.show_donate_info.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.show_donate_info.option.show'],
              false: trans_zh['site_form.show_donate_info.option.hide'],
            }}
            tooltip={trans_zh['site_form.show_donate_info.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />

          <ProFormSelect
            name={'showCopyRight'}
            label={trans_zh['site_form.show_copyright.label']}
            placeholder={trans_zh['site_form.show_copyright.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.show_copyright.option.show'],
              false: trans_zh['site_form.show_copyright.option.hide'],
            }}
            tooltip={trans_zh['site_form.show_copyright.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showDonateButton'}
            label={trans_zh['site_form.show_donate.label']}
            placeholder={trans_zh['site_form.show_donate.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.show_donate.option.show'],
              false: trans_zh['site_form.show_donate.option.hide'],
            }}
            tooltip={trans_zh['site_form.show_donate.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showDonateInAbout'}
            label={trans_zh['site_form.show_donate_about.label']}
            placeholder={trans_zh['site_form.show_donate_about.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.show_donate_about.option.show'],
              false: trans_zh['site_form.show_donate_about.option.hide'],
            }}
            tooltip={trans_zh['site_form.show_donate_about.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'defaultTheme'}
            label={trans_zh['site_form.default_theme.label']}
            placeholder={trans_zh['site_form.default_theme.placeholder']}
            valueEnum={{
              auto: trans_zh['site_form.default_theme.option.auto'],
              dark: trans_zh['site_form.default_theme.option.dark'],
              light: trans_zh['site_form.default_theme.option.light'],
            }}
            tooltip={trans_zh['site_form.default_theme.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'allowOpenHiddenPostByUrl'}
            label={trans_zh['site_form.allow_hidden.label']}
            placeholder={trans_zh['site_form.allow_hidden.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.allow_hidden.option.allow'],
              false: trans_zh['site_form.allow_hidden.option.disallow'],
            }}
            tooltip={trans_zh['site_form.allow_hidden.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'enableCustomizing'}
            label={trans_zh['site_form.enable_custom.label']}
            placeholder={trans_zh['site_form.enable_custom.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.enable_custom.option.enabled'],
              false: trans_zh['site_form.enable_custom.option.disabled'],
            }}
            tooltip={trans_zh['site_form.enable_custom.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showRSS'}
            label={trans_zh['site_form.show_rss.label']}
            placeholder={trans_zh['site_form.show_rss.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.show_rss.option.show'],
              false: trans_zh['site_form.show_rss.option.hide'],
            }}
            tooltip={trans_zh['site_form.show_rss.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'openArticleLinksInNewWindow'}
            label={trans_zh['site_form.links_new_window.label']}
            placeholder={trans_zh['site_form.links_new_window.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.links_new_window.option.new'],
              false: trans_zh['site_form.links_new_window.option.current'],
            }}
            tooltip={trans_zh['site_form.links_new_window.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showExpirationReminder'}
            label={trans_zh['site_form.show_expiration.label']}
            placeholder={trans_zh['site_form.show_expiration.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.show_expiration.option.show'],
              false: trans_zh['site_form.show_expiration.option.hide'],
            }}
            tooltip={trans_zh['site_form.show_expiration.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showEditButton'}
            label={trans_zh['site_form.show_edit.label']}
            placeholder={trans_zh['site_form.show_edit.placeholder']}
            valueEnum={{
              true: trans_zh['site_form.show_edit.option.show'],
              false: trans_zh['site_form.show_edit.option.hide'],
            }}
            tooltip={trans_zh['site_form.show_edit.tooltip']}
            colProps={{ xs: 24, sm: 24 }}
          />
        </>
      )}
    </>
  );
}
