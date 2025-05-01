import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import UrlFormItem from '../UrlFormItem';
import { Col } from 'antd';
import { FormInstance } from 'antd/lib/form';

interface SiteInfoFormProps {
  showOption: boolean;
  showRequire: boolean;
  showLayout: boolean;
  form: FormInstance;
  isInit: boolean;
}

export default function SiteInfoForm(props: SiteInfoFormProps) {
  const { t } = useTranslation();

  return (
    <>
      {props.showRequire && (
        <>
          <ProFormText
            name="author"
            required
            label={t('site_form.author.label')}
            placeholder={t('site_form.author.placeholder')}
            rules={[{ required: true, message: t('site_form.required') }]}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="authorDesc"
            required
            label={t('site_form.author_desc.label')}
            placeholder={t('site_form.author_desc.placeholder')}
            rules={[{ required: true, message: t('site_form.required') }]}
            colProps={{ xs: 24, sm: 24 }}
          />
          <Col xs={24} sm={24}>
            <UrlFormItem
              isInit={props.isInit}
              formRef={props.form}
              name="authorLogo"
              required
              label={t('site_form.author_logo.label')}
              placeholder={t('site_form.author_logo.placeholder')}
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
            label={t('site_form.author_logo_dark.label')}
            placeholder={t('site_form.author_logo_dark.placeholder')}
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
              label={t('site_form.site_logo.label')}
              placeholder={t('site_form.site_logo.placeholder')}
              isInit={props.isInit}
            />
          </Col>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              name="siteLogoDark"
              label={t('site_form.site_logo_dark.label')}
              required={false}
              placeholder={t('site_form.site_logo_dark.placeholder')}
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
              label={t('site_form.favicon.label')}
              placeholder={t('site_form.favicon.placeholder')}
              isFavicon={true}
            />
          </Col>
          <ProFormText
            name="siteName"
            required
            label={t('site_form.site_name.label')}
            placeholder={t('site_form.site_name.placeholder')}
            rules={[{ required: true, message: t('site_form.required') }]}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="siteDesc"
            required
            label={t('site_form.site_desc.label')}
            placeholder={t('site_form.site_desc.placeholder')}
            rules={[{ required: true, message: t('site_form.required') }]}
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
              label={t('site_form.pay_alipay.label')}
              placeholder={t('site_form.pay_alipay.placeholder')}
              required={false}
            />
          </Col>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              isInit={props.isInit}
              name="payAliPayDark"
              label={t('site_form.pay_alipay_dark.label')}
              placeholder={t('site_form.pay_alipay_dark.placeholder')}
              required={false}
            />
          </Col>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              isInit={props.isInit}
              name="payWechat"
              label={t('site_form.pay_wechat.label')}
              placeholder={t('site_form.pay_wechat.placeholder')}
              required={false}
            />
          </Col>
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              isInit={props.isInit}
              name="payWechatDark"
              label={t('site_form.pay_wechat_dark.label')}
              placeholder={t('site_form.pay_wechat_dark.placeholder')}
              required={false}
            />
          </Col>
        </>
      )}
      {props.showRequire && (
        <ProFormText
          name="baseUrl"
          rules={[{ required: true, message: t('site_form.required') }]}
          label={t('site_form.base_url.label')}
          placeholder={t('site_form.base_url.placeholder')}
          tooltip={t('site_form.base_url.tooltip')}
          required={true}
          colProps={{ xs: 24, sm: 24 }}
        />
      )}
      {props.showOption && (
        <>
          <ProFormText
            name="copyrightAggreement"
            label={t('site_form.copyright.label')}
            placeholder={t('site_form.copyright.placeholder')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="beianNumber"
            label={t('site_form.beian.label')}
            placeholder={t('site_form.beian.placeholder')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="beianUrl"
            label={t('site_form.beian_url.label')}
            placeholder={t('site_form.beian_url.placeholder')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="gaBeianNumber"
            label={t('site_form.ga_beian.label')}
            placeholder={t('site_form.ga_beian.placeholder')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="gaBeianUrl"
            label={t('site_form.ga_beian_url.label')}
            placeholder={t('site_form.ga_beian_url.placeholder')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <Col xs={24} sm={24}>
            <UrlFormItem
              formRef={props.form}
              isInit={props.isInit}
              name="gaBeianLogoUrl"
              label={t('site_form.ga_beian_logo.label')}
              placeholder={t('site_form.ga_beian_logo.placeholder')}
              required={false}
            />
          </Col>
          <ProFormText
            name="gaAnalysisId"
            label={t('site_form.ga_analysis.label')}
            placeholder={t('site_form.ga_analysis.placeholder')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormText
            name="baiduAnalysisId"
            label={t('site_form.baidu_analysis.label')}
            placeholder={t('site_form.baidu_analysis.placeholder')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'enableComment'}
            label={t('site_form.enable_comment.label')}
            placeholder={t('site_form.enable_comment.placeholder')}
            valueEnum={{
              true: t('site_form.enable_comment.option.enabled'),
              false: t('site_form.enable_comment.option.disabled'),
            }}
            tooltip={t('site_form.enable_comment.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormDateTimePicker
            name="since"
            width={'lg'}
            label={t('site_form.since.label')}
            placeholder={t('site_form.since.placeholder')}
            colProps={{ xs: 24, sm: 24 }}
          />
        </>
      )}
      {/* 布局选项 */}
      {props.showLayout && (
        <>
          <ProFormSelect
            name={'showSubMenu'}
            label={t('site_form.show_submenu.label')}
            placeholder={t('site_form.show_submenu.placeholder')}
            valueEnum={{
              true: t('site_form.show_submenu.option.show'),
              false: t('site_form.show_submenu.option.hide'),
            }}
            tooltip={t('site_form.show_submenu.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />

          <ProFormDigit
            name={'subMenuOffset'}
            label={t('site_form.submenu_offset.label')}
            dependencies={['showSubMenu']}
            placeholder={t('site_form.submenu_offset.placeholder')}
            fieldProps={{ precision: 0 }}
            min={0}
            max={200}
            tooltip={t('site_form.submenu_offset.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'headerLeftContent'}
            label={t('site_form.header_left.label')}
            valueEnum={{
              siteLogo: t('site_form.header_left.option.logo'),
              siteName: t('site_form.header_left.option.name'),
            }}
            placeholder={t('site_form.header_left.placeholder')}
            tooltip={t('site_form.header_left.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showAdminButton'}
            label={t('site_form.show_admin.label')}
            placeholder={t('site_form.show_admin.placeholder')}
            valueEnum={{
              true: t('site_form.show_admin.option.show'),
              false: t('site_form.show_admin.option.hide'),
            }}
            tooltip={t('site_form.show_admin.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showDonateInfo'}
            label={t('site_form.show_donate_info.label')}
            placeholder={t('site_form.show_donate_info.placeholder')}
            valueEnum={{
              true: t('site_form.show_donate_info.option.show'),
              false: t('site_form.show_donate_info.option.hide'),
            }}
            tooltip={t('site_form.show_donate_info.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />

          <ProFormSelect
            name={'showCopyRight'}
            label={t('site_form.show_copyright.label')}
            placeholder={t('site_form.show_copyright.placeholder')}
            valueEnum={{
              true: t('site_form.show_copyright.option.show'),
              false: t('site_form.show_copyright.option.hide'),
            }}
            tooltip={t('site_form.show_copyright.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showDonateButton'}
            label={t('site_form.show_donate.label')}
            placeholder={t('site_form.show_donate.placeholder')}
            valueEnum={{
              true: t('site_form.show_donate.option.show'),
              false: t('site_form.show_donate.option.hide'),
            }}
            tooltip={t('site_form.show_donate.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showDonateInAbout'}
            label={t('site_form.show_donate_about.label')}
            placeholder={t('site_form.show_donate_about.placeholder')}
            valueEnum={{
              true: t('site_form.show_donate_about.option.show'),
              false: t('site_form.show_donate_about.option.hide'),
            }}
            tooltip={t('site_form.show_donate_about.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'defaultTheme'}
            label={t('site_form.default_theme.label')}
            placeholder={t('site_form.default_theme.placeholder')}
            valueEnum={{
              auto: t('site_form.default_theme.option.auto'),
              dark: t('site_form.default_theme.option.dark'),
              light: t('site_form.default_theme.option.light'),
            }}
            tooltip={t('site_form.default_theme.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'allowOpenHiddenPostByUrl'}
            label={t('site_form.allow_hidden.label')}
            placeholder={t('site_form.allow_hidden.placeholder')}
            valueEnum={{
              true: t('site_form.allow_hidden.option.allow'),
              false: t('site_form.allow_hidden.option.disallow'),
            }}
            tooltip={t('site_form.allow_hidden.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'enableCustomizing'}
            label={t('site_form.enable_custom.label')}
            placeholder={t('site_form.enable_custom.placeholder')}
            valueEnum={{
              true: t('site_form.enable_custom.option.enabled'),
              false: t('site_form.enable_custom.option.disabled'),
            }}
            tooltip={t('site_form.enable_custom.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showRSS'}
            label={t('site_form.show_rss.label')}
            placeholder={t('site_form.show_rss.placeholder')}
            valueEnum={{
              true: t('site_form.show_rss.option.show'),
              false: t('site_form.show_rss.option.hide'),
            }}
            tooltip={t('site_form.show_rss.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'openArticleLinksInNewWindow'}
            label={t('site_form.links_new_window.label')}
            placeholder={t('site_form.links_new_window.placeholder')}
            valueEnum={{
              true: t('site_form.links_new_window.option.new'),
              false: t('site_form.links_new_window.option.current'),
            }}
            tooltip={t('site_form.links_new_window.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showExpirationReminder'}
            label={t('site_form.show_expiration.label')}
            placeholder={t('site_form.show_expiration.placeholder')}
            valueEnum={{
              true: t('site_form.show_expiration.option.show'),
              false: t('site_form.show_expiration.option.hide'),
            }}
            tooltip={t('site_form.show_expiration.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
          <ProFormSelect
            name={'showEditButton'}
            label={t('site_form.show_edit.label')}
            placeholder={t('site_form.show_edit.placeholder')}
            valueEnum={{
              true: t('site_form.show_edit.option.show'),
              false: t('site_form.show_edit.option.hide'),
            }}
            tooltip={t('site_form.show_edit.tooltip')}
            colProps={{ xs: 24, sm: 24 }}
          />
        </>
      )}
    </>
  );
}
