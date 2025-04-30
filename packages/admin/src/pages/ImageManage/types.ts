import React from 'react';
// Define a function type for the menu item event handler instead of importing from react-contexify
type MenuItemEventHandler = (data: {
  event: React.MouseEvent;
  props: Record<string, unknown>;
}) => void;

// Define a more specific type for meta property
export interface ImageMeta {
  size?: number;
  dimensions?: {
    width?: number;
    height?: number;
  };
  uploadTime?: string;
  [key: string]: unknown; // Allow additional properties that might be present
}

export interface StaticItem {
  storageType: StorageType;
  staticType: string;
  fileType: string;
  realPath: string;
  meta: ImageMeta;
  name: string;
  sign: string;
}

export type StorageType = 'local' | 'picgo';

export interface MenuProps {
  clickItem?: StaticItem;
  showDelBtn: boolean;
  handleItemClick: MenuItemEventHandler;
}

export interface ImageGridProps {
  data: StaticItem[];
  responsive: boolean;
  displayMenu: (e: React.MouseEvent, item: StaticItem) => void;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  handlePageChange: (page: number, pageSize: number) => void;
}

export interface ActionButtonsProps {
  setLoading: (loading: boolean) => void;
  fetchData: () => void;
  showDelAllBtn: boolean;
}
