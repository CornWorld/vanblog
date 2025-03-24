import { ReactNode } from 'react';

export default function Loading(props: { children: ReactNode; loading: boolean }) {
  if (props.loading) {
    return <div className="loader"></div>;
  }
  return props?.children;
}
