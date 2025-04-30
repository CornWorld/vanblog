import React from 'react';
import { Pagination } from 'antd';
import { PaginationProps } from '../types';

export const PaginationComponent: React.FC<PaginationProps> = ({
  total,
  page,
  pageSize,
  handlePageChange,
}) => {
  return (
    <div className="pagination-container">
      <Pagination
        total={total}
        current={page}
        pageSize={pageSize}
        onChange={handlePageChange}
        showSizeChanger
        showQuickJumper
        showTotal={(t) => `总计 ${t} 个图片`}
      />
    </div>
  );
};
