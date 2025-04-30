declare namespace VanBlog {
  interface User {
    name: string;
    password?: string;
    role?: string;
  }

  interface Settings {
    title?: string;
    subtitle?: string;
    description?: string;
    keywords?: string[];
    author?: string;
    baseUrl?: string;
    logo?: string;
    favicon?: string;
    layout?: {
      theme?: string;
      customCss?: string;
      customScript?: string;
      customHtml?: string;
      customHead?: string;
    };
  }

  interface InitialState {
    settings?: Settings;
    theme?: string;
    user?: User;
  }
}

export = VanBlog;
export as namespace VanBlog;
