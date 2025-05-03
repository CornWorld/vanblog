// import breaks from '@bytemd/plugin-breaks';
import frontmatter from '@bytemd/plugin-frontmatter';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import mediumZoom from '@bytemd/plugin-medium-zoom';
import mermaid from '@bytemd/plugin-mermaid';
import { Editor } from '@bytemd/react';
import { Spin } from 'antd';
import React, { useCallback, useMemo } from 'react';

// 导入基础ByteMD样式
import 'bytemd/dist/index.css';

// 导入Markdown和代码主题样式
import './style/github-markdown.css';
import './style/code-light.css';
import './style/code-dark.css';
import './style/custom-container.css';
import './style/diff-style.css';

// 导入我们的主样式入口点
import './style/index.less';

// Import custom plugins
import { emoji } from './plugins/emoji';
import { imgUploadPlugin, uploadImg } from './plugins/imgUpload';
import { insertMore } from './plugins/insertMore';
import { cn } from './locales';
import { useModel } from '@/router';
import { customContainer } from './plugins/customContainer';
import { historyIcon } from './plugins/history';
import { rawHTML } from './plugins/rawHTML';
import { Heading } from './plugins/heading';
import { customCodeBlock } from './plugins/codeBlock';
import { LinkTarget } from './plugins/linkTarget';
import { useTranslation } from 'react-i18next';

// Add type declaration for sanitize
/* eslint-disable @typescript-eslint/no-explicit-any */
const sanitize = (schema: any) => {
  // Allow specific tags and attributes for SVG
  schema.svg = {
    tag: true,
    attrs: {
      xmlns: true,
      width: true,
      height: true,
      viewbox: true,
      version: true,
      'stroke-width': true,
      'stroke-linecap': true,
      'stroke-linejoin': true,
      stroke: true,
      fill: true,
      class: true,
      'font-size': true,
      'text-anchor': true,
      style: true,
    },
    children: ['path', 'polygon', 'rect', 'text', 'line', 'circle', 'defs', 'marker', 'g', 'tspan'],
  };

  // Allow SVG path element
  schema.path = {
    tag: true,
    attrs: {
      d: true,
      fill: true,
      stroke: true,
      class: true,
      'marker-end': true,
      'stroke-width': true,
      'stroke-linecap': true,
      'stroke-linejoin': true,
      'data-id': true,
    },
  };

  // Allow data URIs in src attributes
  schema.protocols.src.push('data');

  // Add SVG-specific tags
  schema.tagNames.push('center');
  schema.tagNames.push('iframe');
  schema.tagNames.push('script');
  schema.tagNames.push('svg');
  schema.tagNames.push('path');
  schema.tagNames.push('g');
  schema.tagNames.push('circle');
  schema.tagNames.push('rect');
  schema.tagNames.push('line');
  schema.tagNames.push('polyline');
  schema.tagNames.push('polygon');

  // Add SVG-specific attributes
  schema.attributes['*'].push('style');
  schema.attributes['*'].push('src');
  schema.attributes['*'].push('scrolling');
  schema.attributes['*'].push('border');
  schema.attributes['*'].push('frameborder');
  schema.attributes['*'].push('framespacing');
  schema.attributes['*'].push('allowfullscreen');
  schema.attributes['*'].push('viewBox');
  schema.attributes['*'].push('width');
  schema.attributes['*'].push('height');
  schema.attributes['*'].push('fill');
  schema.attributes['*'].push('stroke');
  schema.attributes['*'].push('d');
  schema.attributes['*'].push('xmlns');
  schema.attributes['*'].push('focusable');
  schema.attributes['*'].push('data-icon');
  schema.attributes['*'].push('aria-hidden');

  schema.strip = [];
  return schema;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function EditorComponent(props: {
  value: string;
  onChange: (string: string) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
}) {
  const { loading, setLoading } = props;
  const { t } = useTranslation();

  // Move useModel hook to the top level of the component
  const { initialState } = useModel();
  const navTheme = initialState?.settings?.navTheme || 'light';
  const themeClass = navTheme.toLowerCase().includes('dark') ? 'dark' : 'light';

  const plugins = useMemo(() => {
    return [
      customContainer({ t }),
      gfm(),
      highlight(),
      frontmatter(),
      math(),
      mediumZoom(),
      mermaid(),
      imgUploadPlugin(setLoading, { t }),
      emoji({ t }),
      insertMore({ t }),
      rawHTML(),
      historyIcon({ t }),
      Heading({ t }),
      customCodeBlock(),
      LinkTarget(),
    ];
  }, [t, setLoading]);

  // Memoize the uploadImages function to prevent it from being recreated on every render
  const uploadImagesHandler = useCallback(
    async (files: File[]) => {
      setLoading(true);
      const res = [];
      try {
        for (const each of files) {
          const url = await uploadImg(each, { t });
          if (url) {
            // If it's already a data URI, use it as is
            if (url.startsWith('data:')) {
              res.push({ url });
            } else {
              // For regular URLs, encode them
              res.push({ url: encodeURI(url) });
            }
          }
        }
      } catch (error) {
        console.error('Error uploading images:', error);
      } finally {
        setLoading(false);
      }
      return res;
    },
    [setLoading, t],
  );

  return (
    <div className={`editor-container ${themeClass}`}>
      <Spin spinning={loading} className="editor-wrapper">
        <Editor
          value={props.value}
          plugins={plugins}
          onChange={props.onChange}
          locale={cn}
          sanitize={sanitize}
          uploadImages={uploadImagesHandler}
        />
      </Spin>
    </div>
  );
}
