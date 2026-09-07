/* UPSTREAM: packages/website/components/NavBarMobile/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: next/link → <a>;MenuItem 从 NavBar.tsx 引用(同形内联类型的单一来源)。
 * react-burger-menu 抽屉行为原样(bm-* 样式见 styles/vendor/side-bar.css)。
 * 上游 fix → 对本文件 apply patch。
 */
import rbm from "react-burger-menu";
import { useCallback } from "react";
// react-burger-menu 为 CJS 包,Vite SSR 下命名导入不可用,经默认导出解构
const Menu = rbm.slide;
import type { MenuItem } from "./NavBar";
import { withBase } from "../lib/base"; // SEAM: 菜单内部链接带主题 base 前缀

export default function NavBarMobile(props: {
  isOpen: boolean;
  setIsOpen: (i: boolean) => void;
  showFriends: "true" | "false";
  showAdminButton: "true" | "false";
  menus: MenuItem[];
}) {
  const renderItem = useCallback((item: MenuItem, isSub?: boolean) => {
    if (item.value.includes("http")) {
      return (
        <li
          className="side-bar-item dark:border-dark-2 dark:hover:bg-dark-2"
          key={item.id}
        >
          <a
            className={`w-full inline-block  ${isSub ? "px-6" : "px-4"}`}
            target="_blank"
            href={withBase(item.value)}
          >
            {item.name}
          </a>
        </li>
      );
    } else {
      return (
        <li
          className="side-bar-item dark:border-dark-2 dark:hover:bg-dark-2"
          key={item.id}
        >
          <a href={withBase(item.value)}>
            <div className={`w-full inline-block  ${isSub ? "px-8" : "px-4"}`}>
              {item.name}
            </div>
          </a>
        </li>
      );
    }
  }, []);
  const renderLinks = useCallback(() => {
    const arr: React.ReactNode[] = [];
    props.menus.forEach((item) => {
      arr.push(renderItem(item));
      if (item.children && item.children.length > 0) {
        item.children.forEach((i) => {
          arr.push(renderItem(i, true));
        });
      }
    });
    return arr;
  }, [props]);
  return (
    <>
      <div>
        <Menu
          id="nav-mobile"
          disableAutoFocus={true}
          customCrossIcon={false}
          customBurgerIcon={false}
          isOpen={props.isOpen}
          onStateChange={(state) => {
            if (state.isOpen) {
              // 要打开
              document.body.style.overflow = "hidden";
            } else {
              document.body.style.overflow = "auto";
            }

            props.setIsOpen(state.isOpen);
          }}
        >
          <ul
            onClick={() => {
              document.body.style.overflow = "auto";
              props.setIsOpen(false);
            }}
            className=" sm:flex h-full items-center  text-sm text-gray-600 hidden divide-y divide-dashed divide-gray-200 dark:text-dark "
          >
            {renderLinks()}
            {props.showAdminButton == "true" && (
              <li
                className="side-bar-item dark:border-dark-2 dark:hover:bg-dark-2"
                key={"rss-phone-nav-btn"}
              >
                <a
                  className="w-full inline-block px-4 "
                  target="_blank"
                  href={"/admin"}
                >
                  {"后台"}
                </a>
              </li>
            )}
          </ul>
        </Menu>
      </div>
    </>
  );
}
