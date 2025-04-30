export const parseMarkdownFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async (event) => {
      try {
        const fileContent = event.target.result;
        const matchResult = fileContent.match(/^---[\s\S]*?---\n/);
        let attributes = {};
        let title = 'untitled';
        let tags = [];
        let categories = [];
        let content = fileContent;
        let password = '';
        if (matchResult) {
          const yaml = matchResult[0].replaceAll('---', '').trim();
          try {
            attributes = window.jsyaml.load(yaml);
            content = fileContent.replace(/^---[\s\S]*?---\n/, '');
          } catch {
            // Ignore YAML parsing errors and continue with empty attributes
          }
          title = attributes?.title || 'untitled';
          if (attributes?.tags) {
            if (Array.isArray(attributes.tags)) {
              tags = attributes.tags;
            } else {
              tags = [attributes.tags];
            }
          }
          if (attributes?.categories) {
            if (Array.isArray(attributes.categories)) {
              categories = attributes.categories;
            } else {
              categories = [attributes.categories];
            }
          }
          password = attributes.password || '';
        }

        resolve({
          title,
          content: content,
          attributes: {
            categories,
            tags,
            private: !!attributes.private,
            password,
            ...attributes,
          },
        });
      } catch (error) {
        // Log the error to the console for debugging purposes
        console.error('Error parsing markdown file:', error);
        reject(new Error('Failed to parse markdown file'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
};

export const parseObjToMarkdown = (obj) => {
  try {
    const { title, content, attributes = {} } = obj;
    const yaml = {
      title,
      ...attributes,
    };
    const yamlStr = window.jsyaml.dump(yaml);

    return `---
${yamlStr}---

${content}`;
  } catch (error) {
    // Log the error to the console for debugging purposes
    console.error('Error converting object to markdown:', error);
    return '';
  }
};
