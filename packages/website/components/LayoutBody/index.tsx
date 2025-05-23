import { ReactNode } from 'react';

export default function LayoutBody(props: { children: ReactNode; sideBar: ReactNode }) {
  return (
    <>
      <div className="flex mx-auto justify-center">
        <div className="flex-shrink flex-grow md:max-w-3xl xl:max-w-4xl w-full vanblog-main">
          {props.children}
        </div>
        <div
          className={`hidden lg:block flex-shrink-0 flex-grow-0 vanblog-sider ${
            props.sideBar ? 'w-52' : ''
          }`}
        >
          {props.sideBar}
        </div>
      </div>
    </>
  );
}
